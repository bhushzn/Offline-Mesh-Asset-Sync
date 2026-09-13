// ============================================================
// FIELDLINK — Sync Queue Engine & Acknowledgement State Machine
// ============================================================

import { offlineStorage, STORES } from './offlineStorageService';
import { CRDTOperation, SyncQueueItem, SyncQueueState, SyncStatus } from '../types/tactical';
import { CRDTEngine, HybridLogicalClock } from './crdtService';
import { auditLog } from './auditLogService';

class SyncQueueService {
  private localDeviceId = 'device-a17';
  private localLamport = 1;
  private hlc: HybridLogicalClock;
  private vectorClock: Record<string, number> = { 'device-a17': 1 };
  private listeners: Set<(pendingCount: number, queue: SyncQueueItem[]) => void> = new Set();
  private inMemoryQueue: Map<string, SyncQueueItem> = new Map();

  constructor() {
    this.hlc = new HybridLogicalClock(this.localDeviceId);
    this.initQueueAndClock();
  }

  private async initQueueAndClock() {
    try {
      // 1. Load CRDT Ops to calibrate clocks
      const ops = await offlineStorage.getAll<CRDTOperation>(STORES.CRDT_OPS);
      for (const op of ops) {
        if (op.lamportClock > this.localLamport) {
          this.localLamport = op.lamportClock;
        }
        const origin = op.originDeviceId || this.localDeviceId;
        this.vectorClock[origin] = Math.max(this.vectorClock[origin] || 0, op.lamportClock);
        if (op.hlcTimestamp) {
          this.hlc.update(op.hlcTimestamp);
        }
      }

      // 2. Load pending Sync Queue
      const items = await offlineStorage.getAll<SyncQueueItem>(STORES.SYNC_QUEUE);
      for (const item of items) {
        this.inMemoryQueue.set(item.opId, item);
      }
      this.notify();
    } catch {
      // Ignore if initializing empty store
    }
  }

  public setDeviceId(deviceId: string) {
    this.localDeviceId = deviceId;
    this.hlc = new HybridLogicalClock(deviceId);
    if (!this.vectorClock[deviceId]) {
      this.vectorClock[deviceId] = this.localLamport;
    }
  }

  public getDeviceId(): string {
    return this.localDeviceId;
  }

  public getVectorClock(): Record<string, number> {
    return { ...this.vectorClock };
  }

  public getLamportClock(): number {
    return this.localLamport;
  }

  public getHLC(): string {
    return this.hlc.now();
  }

  public advanceClock(): { lamport: number; hlc: string } {
    this.localLamport += 1;
    this.vectorClock[this.localDeviceId] = this.localLamport;
    const hlcTimestamp = this.hlc.now();
    return { lamport: this.localLamport, hlc: hlcTimestamp };
  }

  public updateClockFromRemote(remoteLamport: number, remoteDeviceId: string, remoteHLC?: string) {
    this.localLamport = Math.max(this.localLamport, remoteLamport) + 1;
    this.vectorClock[this.localDeviceId] = this.localLamport;
    this.vectorClock[remoteDeviceId] = Math.max(this.vectorClock[remoteDeviceId] || 0, remoteLamport);
    if (remoteHLC) {
      this.hlc.update(remoteHLC);
    }
  }

  // Enqueue a local mutation
  public async enqueueMutation(
    entityType: CRDTOperation['entityType'],
    entityId: string,
    operationType: CRDTOperation['operationType'],
    payload: any
  ): Promise<CRDTOperation> {
    const { lamport, hlc: hlcTimestamp } = this.advanceClock();
    const timestamp = Date.now();
    const opId = `op_${this.localDeviceId}_${timestamp}_${Math.random().toString(36).substring(2, 7)}`;

    const opWithoutHash = {
      id: opId,
      entityType,
      entityId,
      operationType,
      payload,
      vectorClock: { ...this.vectorClock },
      lamportClock: lamport,
      hlcTimestamp,
      timestamp,
      originDeviceId: this.localDeviceId,
      syncedWithPeers: [],
    };

    const hash = await CRDTEngine.computeOpHash(opWithoutHash);
    const crdtOp: CRDTOperation = {
      ...opWithoutHash,
      hash,
    };

    // Store in CRDT log
    await offlineStorage.put(STORES.CRDT_OPS, crdtOp);

    // Add to pending sync queue
    const queueItem: SyncQueueItem = {
      id: `sq_${crdtOp.id}`,
      opId: crdtOp.id,
      operation: crdtOp,
      state: 'PENDING',
      status: 'pending',
      retries: 0,
      maxRetries: 5,
      createdAt: timestamp,
      acknowledgedByPeers: [],
    };

    this.inMemoryQueue.set(crdtOp.id, queueItem);
    await offlineStorage.put(STORES.SYNC_QUEUE, queueItem);

    auditLog.log({
      deviceId: this.localDeviceId,
      eventType: 'DATA_MODIFIED',
      entityType,
      entityId,
      details: `Created offline ${operationType} operation on ${entityType} ${entityId}`,
      severity: 'INFO',
    });

    this.notify();

    // Auto-broadcast real-time mutation across active transports
    try {
      const { p2pMesh } = await import('./p2pMeshService');
      p2pMesh.broadcast(
        'OPERATION_BATCH',
        { ops: [crdtOp] },
        this.getVectorClock(),
        this.getHLC()
      ).catch(() => {});
    } catch {
      // ignore
    }

    return crdtOp;
  }

  // Transitions queue state (e.g. SENDING -> SENT)
  public async updateItemState(opId: string, state: SyncQueueState, error?: string): Promise<void> {
    const item = this.inMemoryQueue.get(opId);
    if (!item) return;

    item.state = state;
    item.lastAttemptAt = Date.now();
    if (error) {
      item.errorMessage = error;
      item.retries += 1;
      const backoffMs = Math.min(30000, 1000 * Math.pow(2, item.retries));
      item.nextAttemptAt = Date.now() + backoffMs;
      if (item.retries >= item.maxRetries) {
        item.state = 'FAILED';
        item.status = 'failed';
      }
    } else {
      if (state === 'SYNCED' || state === 'ACK_RECEIVED') {
        item.status = 'synced';
      } else if (state === 'SENDING' || state === 'SENT') {
        item.status = 'syncing';
      }
    }

    this.inMemoryQueue.set(opId, item);
    await offlineStorage.put(STORES.SYNC_QUEUE, item);
    this.notify();
  }

  // Record acknowledgement from a peer
  public async recordAck(opId: string, peerDeviceId: string): Promise<void> {
    const item = this.inMemoryQueue.get(opId);
    if (item) {
      if (!item.acknowledgedByPeers.includes(peerDeviceId)) {
        item.acknowledgedByPeers.push(peerDeviceId);
      }
      item.state = 'SYNCED';
      item.status = 'synced';
      this.inMemoryQueue.set(opId, item);
      await offlineStorage.put(STORES.SYNC_QUEUE, item);
      this.notify();
    }
  }

  // Mark operation as fully synced and remove from pending active queue
  public async markAsSynced(opId: string, peerDeviceId?: string) {
    const item = this.inMemoryQueue.get(opId);
    if (item) {
      if (peerDeviceId && !item.acknowledgedByPeers.includes(peerDeviceId)) {
        item.acknowledgedByPeers.push(peerDeviceId);
      }
      item.state = 'SYNCED';
      item.status = 'synced';
      await offlineStorage.delete(STORES.SYNC_QUEUE, item.id);
      this.inMemoryQueue.delete(opId);
      this.notify();
    }
  }

  public async getPendingQueue(): Promise<SyncQueueItem[]> {
    return Array.from(this.inMemoryQueue.values()).filter(i => i.status !== 'synced');
  }

  public async getAllQueueItems(): Promise<SyncQueueItem[]> {
    return Array.from(this.inMemoryQueue.values());
  }

  public async getPendingCount(): Promise<number> {
    const pending = await this.getPendingQueue();
    return pending.length;
  }

  public async markOpSynced(opId: string, peerId: string): Promise<void> {
    const queueItem = await offlineStorage.getById<SyncQueueItem>(STORES.SYNC_QUEUE, `sq_${opId}`);
    if (queueItem) {
      queueItem.status = 'synced';
      if (!queueItem.operation.syncedWithPeers.includes(peerId)) {
        queueItem.operation.syncedWithPeers.push(peerId);
      }
      await offlineStorage.put(STORES.SYNC_QUEUE, queueItem);
      await offlineStorage.put(STORES.CRDT_OPS, queueItem.operation);
    }
    this.notify();
  }

  public async markAllSynced(): Promise<void> {
    const all = await offlineStorage.getAll<SyncQueueItem>(STORES.SYNC_QUEUE);
    for (const item of all) {
      if (item.status === 'pending' || item.status === 'syncing') {
        item.status = 'synced';
        await offlineStorage.put(STORES.SYNC_QUEUE, item, true);
      }
    }
    this.notify();
  }

  public async getPendingOperations(): Promise<CRDTOperation[]> {
    const queue = await offlineStorage.getAll<SyncQueueItem>(STORES.SYNC_QUEUE);
    return queue
      .filter((i) => i.status === 'pending' || itemIsUnsynced(i))
      .map((i) => i.operation);
  }

  public subscribe(callback: (pendingCount: number, queue: SyncQueueItem[]) => void): () => void {
    this.listeners.add(callback);
    // Trigger initial notification
    this.notify();
    return () => this.listeners.delete(callback);
  }

  private async notify() {
    const queue = await offlineStorage.getAll<SyncQueueItem>(STORES.SYNC_QUEUE);
    const pending = queue.filter((i) => i.status === 'pending' || itemIsUnsynced(i));
    this.listeners.forEach((cb) => cb(pending.length, queue));
  }
}

function itemIsUnsynced(i: SyncQueueItem): boolean {
  return i.status === 'pending' || i.status === 'syncing' || i.status === 'failed';
}

export const syncQueue = new SyncQueueService();
