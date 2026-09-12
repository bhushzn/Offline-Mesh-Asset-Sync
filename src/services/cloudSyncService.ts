// ============================================================
// FIELDLINK — Cloud Synchronization Bridge Service
// ============================================================
// Bridges offline IndexedDB with the central Fastify + PostgreSQL backend

import { offlineStorage, STORES } from './offlineStorageService';
import { syncQueue } from './syncQueueService';
import { CRDTOperation } from '../types/tactical';

export interface CloudSyncResult {
  success: boolean;
  pushedCount: number;
  pulledCount: number;
  conflictCount: number;
  serverVersion: number;
  timestamp: number;
  error?: string;
}

export type CloudStatusListener = (status: {
  isOnline: boolean;
  isSyncing: boolean;
  lastSyncedAt: number | null;
  serverVersion: number;
  serverAvailable: boolean;
}) => void;

class CloudSyncService {
  private backendUrl = 'http://localhost:3001/api/v1';
  private healthUrl = 'http://localhost:3001/health';
  private isSyncing = false;
  private serverAvailable = false;
  private lastSyncedAt: number | null = null;
  private serverVersion = 0;
  private listeners: Set<CloudStatusListener> = new Set();
  private autoSyncInterval: any = null;

  constructor() {
    this.initNetworkMonitoring();
    this.checkHealth();
  }

  public setBackendUrl(url: string) {
    this.backendUrl = url;
    this.checkHealth();
  }

  public getBackendUrl() {
    return this.backendUrl;
  }

  public subscribe(listener: CloudStatusListener): () => void {
    this.listeners.add(listener);
    this.notify();
    return () => this.listeners.delete(listener);
  }

  private notify() {
    const status = {
      isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
      isSyncing: this.isSyncing,
      lastSyncedAt: this.lastSyncedAt,
      serverVersion: this.serverVersion,
      serverAvailable: this.serverAvailable,
    };
    this.listeners.forEach((fn) => fn(status));
  }

  private initNetworkMonitoring() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.checkHealth();
        this.syncWithCloud().catch(() => {});
      });
      window.addEventListener('offline', () => {
        this.serverAvailable = false;
        this.notify();
      });
    }

    // Periodic health & auto-sync every 30s if online
    this.autoSyncInterval = setInterval(() => {
      if (typeof navigator !== 'undefined' && navigator.onLine) {
        this.checkHealth().then((available) => {
          if (available) {
            this.syncWithCloud().catch(() => {});
          }
        });
      }
    }, 30000);
  }

  /**
   * Ping backend to check if the Fastify API is reachable.
   */
  public async checkHealth(): Promise<boolean> {
    try {
      const res = await fetch(this.healthUrl, { method: 'GET', signal: AbortSignal.timeout(3000) });
      this.serverAvailable = res.ok;
    } catch {
      this.serverAvailable = false;
    }
    this.notify();
    return this.serverAvailable;
  }

  /**
   * Main bidirectional sync: Push local pending ops -> Receive server delta ops -> Apply locally.
   */
  public async syncWithCloud(): Promise<CloudSyncResult> {
    if (this.isSyncing) {
      return {
        success: false,
        pushedCount: 0,
        pulledCount: 0,
        conflictCount: 0,
        serverVersion: this.serverVersion,
        timestamp: Date.now(),
        error: 'Sync already in progress',
      };
    }

    this.isSyncing = true;
    this.notify();

    try {
      const deviceId = syncQueue.getDeviceId();
      const pendingQueue = await offlineStorage.getAll<any>(STORES.SYNC_QUEUE);
      const pendingOps: CRDTOperation[] = pendingQueue
        .filter((item) => item.status === 'pending' || item.status === 'failed')
        .map((item) => item.operation);

      const allLocalOps = await offlineStorage.getAll<CRDTOperation>(STORES.CRDT_OPS);
      const knownOperationIds = allLocalOps.map((op) => op.id);

      // Find highest local timestamp or default
      const lastLocalOp = allLocalOps[allLocalOps.length - 1];
      const lastSyncTimestamp = lastLocalOp ? `${lastLocalOp.timestamp}-0000-${deviceId}` : '0000000000000-0000-init';

      const payload = {
        deviceId,
        lastSyncTimestamp,
        knownOperationIds,
        pendingOperations: pendingOps.map((op) => ({
          operationId: op.id,
          deviceId: op.originDeviceId || deviceId,
          entityType: (op.entityType || 'asset').toLowerCase(),
          entityId: op.entityId,
          operationType: op.operationType,
          data: op.payload || {},
          hlcTimestamp: `${op.timestamp}-0000-${op.originDeviceId || deviceId}`,
          version: 1,
        })),
      };

      // Push to backend
      const res = await fetch(`${this.backendUrl}/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10000),
      });

      if (!res.ok) {
        throw new Error(`Cloud sync failed: HTTP ${res.status} ${res.statusText}`);
      }

      const json = await res.json();
      const { accepted, missingOperations, conflicts, serverVersion } = json.data;

      // Mark accepted operations as synced in local queue
      if (accepted && Array.isArray(accepted)) {
        for (const opId of accepted) {
          await syncQueue.markOpSynced(opId, 'command-hq');
        }
      }

      // Apply incoming missing operations from the server
      let pulledCount = 0;
      if (missingOperations && Array.isArray(missingOperations)) {
        for (const remoteOp of missingOperations) {
          const crdtOp: CRDTOperation = {
            id: remoteOp.operationId,
            entityType: remoteOp.entityType as any,
            entityId: remoteOp.entityId,
            operationType: remoteOp.operationType,
            payload: remoteOp.data,
            vectorClock: { [remoteOp.deviceId]: 1 },
            lamportClock: 1,
            timestamp: Date.now(),
            originDeviceId: remoteOp.deviceId,
            syncedWithPeers: [deviceId],
            hash: remoteOp.operationId,
          };
          await this.applyIncomingCloudOperation(crdtOp);
          pulledCount++;
        }
      }

      this.lastSyncedAt = Date.now();
      this.serverVersion = serverVersion || this.serverVersion;
      this.serverAvailable = true;

      const result: CloudSyncResult = {
        success: true,
        pushedCount: accepted?.length || 0,
        pulledCount,
        conflictCount: conflicts?.length || 0,
        serverVersion: this.serverVersion,
        timestamp: this.lastSyncedAt,
      };

      return result;
    } catch (err: any) {
      console.warn('Cloud sync error:', err.message);
      return {
        success: false,
        pushedCount: 0,
        pulledCount: 0,
        conflictCount: 0,
        serverVersion: this.serverVersion,
        timestamp: Date.now(),
        error: err.message,
      };
    } finally {
      this.isSyncing = false;
      this.notify();
    }
  }

  /**
   * Applies an incoming operation from the cloud backend directly to local IndexedDB.
   */
  private async applyIncomingCloudOperation(op: CRDTOperation): Promise<void> {
    // Check if we already have this op
    const existing = await offlineStorage.getById<CRDTOperation>(STORES.CRDT_OPS, op.id);
    if (existing) return;

    await offlineStorage.put(STORES.CRDT_OPS, op);

    const storeMap: Record<string, any> = {
      asset: STORES.ASSETS,
      personnel: STORES.PERSONNEL,
      rollcall: STORES.ROLL_CALLS,
      roll_call: STORES.ROLL_CALLS,
      checklist: STORES.CHECKLISTS,
      incident: STORES.INCIDENTS,
    };

    const targetStore = storeMap[op.entityType.toLowerCase()];
    if (!targetStore) return;

    if (op.operationType === 'DELETE') {
      await offlineStorage.delete(targetStore, op.entityId);
    } else {
      const current = await offlineStorage.getById<any>(targetStore, op.entityId);
      const merged = current ? { ...current, ...op.payload } : { id: op.entityId, ...op.payload };
      await offlineStorage.put(targetStore, merged);
    }
  }

  /**
   * Hydrates local empty IndexedDB from full server snapshot.
   */
  public async fetchSnapshot(): Promise<boolean> {
    try {
      const res = await fetch(`${this.backendUrl}/sync/snapshot`, {
        method: 'GET',
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) return false;

      const json = await res.json();
      const { assets, personnel, rollCalls, checklistTemplates, incidents } = json.data;

      if (assets && Array.isArray(assets)) {
        for (const item of assets) await offlineStorage.put(STORES.ASSETS, item);
      }
      if (personnel && Array.isArray(personnel)) {
        for (const item of personnel) await offlineStorage.put(STORES.PERSONNEL, item);
      }
      if (rollCalls && Array.isArray(rollCalls)) {
        for (const item of rollCalls) await offlineStorage.put(STORES.ROLL_CALLS, item);
      }
      if (checklistTemplates && Array.isArray(checklistTemplates)) {
        for (const item of checklistTemplates) await offlineStorage.put(STORES.CHECKLISTS, item);
      }
      if (incidents && Array.isArray(incidents)) {
        for (const item of incidents) await offlineStorage.put(STORES.INCIDENTS, item);
      }

      this.lastSyncedAt = Date.now();
      this.serverAvailable = true;
      this.notify();
      return true;
    } catch {
      return false;
    }
  }
}

export const cloudSync = new CloudSyncService();
