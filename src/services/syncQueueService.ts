// FIELDLINK Sync Queue Service
import { offlineStorage, STORES } from './offlineStorageService';
import { CRDTOperation, SyncQueueItem, SyncStatus } from '../types/tactical';
import { CRDTEngine } from './crdtService';

class SyncQueueService {
  private localDeviceId = 'device-a17';
  private localLamport = 1;
  private vectorClock: Record<string, number> = { 'device-a17': 1 };
  private listeners: Set<(pendingCount: number, queue: SyncQueueItem[]) => void> = new Set();

  constructor() {
    this.initClock();
  }

  private async initClock() {
    try {
      const ops = await offlineStorage.getAll<CRDTOperation>(STORES.CRDT_OPS);
      for (const op of ops) {
        if (op.lamportClock > this.localLamport) {
          this.localLamport = op.lamportClock;
        }
        const origin = op.originDeviceId || this.localDeviceId;
        this.vectorClock[origin] = Math.max(this.vectorClock[origin] || 0, op.lamportClock);
      }
    } catch {
      // Ignore if initializing
    }
  }

  public setDeviceId(deviceId: string) {
    this.localDeviceId = deviceId;
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

  public advanceClock(): number {
    this.localLamport += 1;
    this.vectorClock[this.localDeviceId] = this.localLamport;
    return this.localLamport;
  }

  public updateClockFromRemote(remoteLamport: number, remoteDeviceId: string) {
    this.localLamport = Math.max(this.localLamport, remoteLamport) + 1;
    this.vectorClock[this.localDeviceId] = this.localLamport;
    this.vectorClock[remoteDeviceId] = Math.max(this.vectorClock[remoteDeviceId] || 0, remoteLamport);
  }

  // Enqueue a local mutation
  public async enqueueMutation(
    entityType: CRDTOperation['entityType'],
    entityId: string,
    operationType: CRDTOperation['operationType'],
    payload: any
  ): Promise<CRDTOperation> {
    const lamport = this.advanceClock();
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
      timestamp,
      originDeviceId: this.localDeviceId,
      syncedWithPeers: [],
    };

    const hash = CRDTEngine.computeOpHash(opWithoutHash);
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
      status: 'pending',
      retries: 0,
    };

    await offlineStorage.put(STORES.SYNC_QUEUE, queueItem);
    this.notify();
    return crdtOp;
  }

  public async getPendingQueue(): Promise<SyncQueueItem[]> {
    const all = await offlineStorage.getAll<SyncQueueItem>(STORES.SYNC_QUEUE);
    return all.filter((item) => item.status === 'pending' || item.status === 'failed');
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
