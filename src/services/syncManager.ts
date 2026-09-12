// FIELDLINK Master Sync Manager (CRDT + Mesh Orchestration)
import { offlineStorage, STORES } from './offlineStorageService';
import { syncQueue } from './syncQueueService';
import { p2pMesh, MeshMessage } from './p2pMeshService';
import { CRDTEngine } from './crdtService';
import { 
  CRDTOperation, 
  SyncStats, 
  Asset, 
  Personnel, 
  RollCallRecord, 
  ChecklistExecution, 
  Incident 
} from '../types/tactical';

export interface SyncPacketEvent {
  fromDeviceId: string;
  toDeviceId: string;
  opCount: number;
  entityTypes: string[];
  timestamp: number;
}

type SyncEventListener = (event: SyncPacketEvent) => void;
type ConflictListener = (conflict: { description: string; timestamp: number }) => void;

class SyncManager {
  private isSyncing = false;
  private lastSyncTime: number | null = Date.now();
  private packetListeners: Set<SyncEventListener> = new Set();
  private conflictListeners: Set<ConflictListener> = new Set();
  private statsListeners: Set<(stats: SyncStats) => void> = new Set();
  private recentConflicts: Array<{ description: string; timestamp: number }> = [];

  constructor() {
    this.setupListeners();
  }

  private setupListeners() {
    // Listen to mesh messages
    p2pMesh.subscribeMessages((msg) => this.handleMeshMessage(msg));
    
    // Listen to storage/queue updates to recalculate stats
    offlineStorage.subscribe(() => this.recalculateStats());
    syncQueue.subscribe(() => this.recalculateStats());
  }

  public subscribePacketEvents(listener: SyncEventListener): () => void {
    this.packetListeners.add(listener);
    return () => this.packetListeners.delete(listener);
  }

  public subscribeConflicts(listener: ConflictListener): () => void {
    this.conflictListeners.add(listener);
    return () => this.conflictListeners.delete(listener);
  }

  public subscribeStats(listener: (stats: SyncStats) => void): () => void {
    this.statsListeners.add(listener);
    this.recalculateStats();
    return () => this.statsListeners.delete(listener);
  }

  public getRecentConflicts() {
    return [...this.recentConflicts];
  }

  public async recalculateStats(): Promise<SyncStats> {
    const queue = await offlineStorage.getAll<any>(STORES.SYNC_QUEUE);
    const ops = await offlineStorage.getAll<CRDTOperation>(STORES.CRDT_OPS);
    const peers = p2pMesh.getDiscoveredPeers();

    const pending = queue.filter(q => q.status === 'pending' || q.status === 'failed').length;
    const synced = queue.filter(q => q.status === 'synced').length;
    const failed = queue.filter(q => q.status === 'failed').length;

    const stats: SyncStats = {
      pendingCount: pending,
      syncedCount: synced,
      failedCount: failed,
      lastSyncTime: this.lastSyncTime,
      activePeersCount: peers.filter(p => p.status === 'online').length,
      totalOpsCount: ops.length,
    };

    this.statsListeners.forEach(cb => cb(stats));
    return stats;
  }

  // Handle incoming mesh network messages
  private async handleMeshMessage(msg: MeshMessage) {
    const localDeviceId = syncQueue.getDeviceId();

    if (msg.type === 'SYNC_REQUEST' && msg.toDeviceId === localDeviceId) {
      // Remote requested missing ops. Compute delta and reply.
      const localOps = await offlineStorage.getAll<CRDTOperation>(STORES.CRDT_OPS);
      const deltaOps = CRDTEngine.calculateMissingOps(localOps, msg.vectorClock);

      p2pMesh.sendMessage({
        type: 'SYNC_RESPONSE',
        fromDeviceId: localDeviceId,
        toDeviceId: msg.fromDeviceId,
        ops: deltaOps,
        vectorClock: syncQueue.getVectorClock(),
      });
    } else if (msg.type === 'SYNC_RESPONSE' && msg.toDeviceId === localDeviceId) {
      // Received missing ops from remote. Merge using CRDT.
      await this.applyIncomingDelta(msg.ops, msg.fromDeviceId, msg.vectorClock);
    } else if (msg.type === 'SYNC_ACK' && msg.toDeviceId === localDeviceId) {
      // Mark our ops as synced
      for (const opId of msg.syncedOpIds) {
        await syncQueue.markOpSynced(opId, msg.fromDeviceId);
      }
    }
  }

  // Apply incoming delta operations deterministically
  public async applyIncomingDelta(
    ops: CRDTOperation[],
    peerId: string,
    remoteVectorClock?: Record<string, number>
  ): Promise<{ applied: number; conflicts: number }> {
    if (!ops || ops.length === 0) return { applied: 0, conflicts: 0 };

    this.isSyncing = true;
    p2pMesh.updatePeerStatus(peerId, 'syncing');

    let appliedCount = 0;
    let conflictCount = 0;
    const syncedOpIds: string[] = [];

    // Trigger visual packet animation event
    const entityTypes = Array.from(new Set(ops.map(o => o.entityType)));
    this.packetListeners.forEach(cb => cb({
      fromDeviceId: peerId,
      toDeviceId: syncQueue.getDeviceId(),
      opCount: ops.length,
      entityTypes,
      timestamp: Date.now()
    }));

    for (const op of ops) {
      try {
        // Prevent re-applying exact duplicate op
        const existingOp = await offlineStorage.getById<CRDTOperation>(STORES.CRDT_OPS, op.id);
        if (existingOp && existingOp.hash === op.hash) {
          syncedOpIds.push(op.id);
          continue;
        }

        // Apply based on entity type
        const hasConflict = await this.mergeEntityOperation(op);
        if (hasConflict) {
          conflictCount++;
        }

        // Store op in local log
        await offlineStorage.put(STORES.CRDT_OPS, op, true);
        
        // Advance vector clock
        syncQueue.updateClockFromRemote(op.lamportClock, op.originDeviceId);

        syncedOpIds.push(op.id);
        appliedCount++;
      } catch (err) {
        console.error('Error merging CRDT op:', op, err);
      }
    }

    // Acknowledge back to sender
    if (syncedOpIds.length > 0) {
      p2pMesh.sendMessage({
        type: 'SYNC_ACK',
        fromDeviceId: syncQueue.getDeviceId(),
        toDeviceId: peerId,
        syncedOpIds,
      });
    }

    this.lastSyncTime = Date.now();
    this.isSyncing = false;
    p2pMesh.updatePeerStatus(peerId, 'online', this.lastSyncTime);
    await this.recalculateStats();

    return { applied: appliedCount, conflicts: conflictCount };
  }

  // Merge individual entity
  private async mergeEntityOperation(op: CRDTOperation): Promise<boolean> {
    let hadConflict = false;

    switch (op.entityType) {
      case 'asset': {
        const local = await offlineStorage.getById<Asset>(STORES.ASSETS, op.entityId);
        const result = CRDTEngine.mergeLWWEntity<Asset>(local, op.payload);
        await offlineStorage.put(STORES.ASSETS, result.mergedData);
        if (result.hasConflict && result.conflictDescription) {
          hadConflict = true;
          this.recordConflict(result.conflictDescription);
        }
        break;
      }
      case 'personnel': {
        const local = await offlineStorage.getById<Personnel>(STORES.PERSONNEL, op.entityId);
        const result = CRDTEngine.mergeLWWEntity<Personnel>(local, op.payload);
        await offlineStorage.put(STORES.PERSONNEL, result.mergedData);
        if (result.hasConflict && result.conflictDescription) {
          hadConflict = true;
          this.recordConflict(result.conflictDescription);
        }
        break;
      }
      case 'roll_call': {
        const local = await offlineStorage.getById<RollCallRecord>(STORES.ROLL_CALLS, op.entityId);
        const result = CRDTEngine.mergeRollCall(local, op.payload);
        await offlineStorage.put(STORES.ROLL_CALLS, result.mergedData);
        break;
      }
      case 'checklist': {
        const local = await offlineStorage.getById<ChecklistExecution>(STORES.CHECKLISTS, op.entityId);
        const result = CRDTEngine.mergeChecklist(local, op.payload);
        await offlineStorage.put(STORES.CHECKLISTS, result.mergedData);
        break;
      }
      case 'incident': {
        const local = await offlineStorage.getById<Incident>(STORES.INCIDENTS, op.entityId);
        const result = CRDTEngine.mergeLWWEntity<Incident>(local, op.payload);
        await offlineStorage.put(STORES.INCIDENTS, result.mergedData);
        if (result.hasConflict && result.conflictDescription) {
          hadConflict = true;
          this.recordConflict(result.conflictDescription);
        }
        break;
      }
    }

    return hadConflict;
  }

  private recordConflict(description: string) {
    const entry = { description, timestamp: Date.now() };
    this.recentConflicts.unshift(entry);
    if (this.recentConflicts.length > 20) this.recentConflicts.pop();
    this.conflictListeners.forEach(cb => cb(entry));
  }

  // Trigger manual synchronization with a specific peer or all peers
  public async syncWithPeer(peerDeviceId: string): Promise<{ synced: number }> {
    const localOps = await offlineStorage.getAll<CRDTOperation>(STORES.CRDT_OPS);
    const localDeviceId = syncQueue.getDeviceId();
    
    p2pMesh.updatePeerStatus(peerDeviceId, 'syncing');

    // Trigger visual packet animation
    this.packetListeners.forEach(cb => cb({
      fromDeviceId: localDeviceId,
      toDeviceId: peerDeviceId,
      opCount: Math.max(1, localOps.length),
      entityTypes: ['assets', 'checklists', 'incidents'],
      timestamp: Date.now(),
    }));

    // Send SYNC_REQUEST with our vector clock
    p2pMesh.sendMessage({
      type: 'SYNC_REQUEST',
      fromDeviceId: localDeviceId,
      toDeviceId: peerDeviceId,
      vectorClock: syncQueue.getVectorClock(),
    });

    // Mark pending local ops as synced
    await syncQueue.markAllSynced();

    this.lastSyncTime = Date.now();
    setTimeout(() => {
      p2pMesh.updatePeerStatus(peerDeviceId, 'online', this.lastSyncTime!);
      this.recalculateStats();
    }, 800);

    return { synced: localOps.length };
  }

  // Sync with all active mesh peers
  public async syncAllPeers(): Promise<void> {
    const peers = p2pMesh.getDiscoveredPeers().filter(p => p.status === 'online');
    for (const peer of peers) {
      await this.syncWithPeer(peer.deviceId);
    }
  }
}

export const syncManager = new SyncManager();
