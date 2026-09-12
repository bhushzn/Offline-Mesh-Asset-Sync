// FIELDLINK Offline Storage Service (IndexedDB Primary Local Data Layer)
import { 
  Asset, 
  AssetDeployment, 
  Personnel, 
  RollCallRecord, 
  ChecklistExecution, 
  Incident, 
  CRDTOperation, 
  SyncQueueItem, 
  DeviceMetadata 
} from '../types/tactical';

const DB_NAME = 'fieldlink_tactical_db';
const DB_VERSION = 2;

export const STORES = {
  USERS: 'users',
  DEVICES: 'devices',
  PERSONNEL: 'personnel',
  ASSETS: 'assets',
  ASSET_DEPLOYMENTS: 'asset_deployments',
  ROLL_CALLS: 'roll_calls',
  CHECKLISTS: 'checklists',
  INCIDENTS: 'incidents',
  SYNC_QUEUE: 'sync_queue',
  CRDT_OPS: 'crdt_ops',
  DEVICE_METADATA: 'device_metadata',
  AUDIT_LOGS: 'audit_logs',
  CONFLICT_LOGS: 'conflict_logs',
} as const;

type StoreName = typeof STORES[keyof typeof STORES];

type ListenerCallback = (storeName: StoreName, action: string, data?: any) => void;

class OfflineStorageService {
  private dbPromise: Promise<IDBDatabase> | null = null;
  private listeners: Set<ListenerCallback> = new Set();

  constructor() {
    this.initDB().catch(() => {});
  }

  public async getDB(): Promise<IDBDatabase> {
    if (!this.dbPromise) {
      this.initDB();
    }
    return this.dbPromise!;
  }

  private initDB(): Promise<IDBDatabase> {
    this.dbPromise = new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        return reject(new Error('IndexedDB not supported in this environment'));
      }
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Assets store
        if (!db.objectStoreNames.contains(STORES.ASSETS)) {
          const store = db.createObjectStore(STORES.ASSETS, { keyPath: 'id' });
          store.createIndex('syncStatus', 'syncStatus', { unique: false });
          store.createIndex('updatedAt', 'updatedAt', { unique: false });
          store.createIndex('category', 'category', { unique: false });
        }

        // Asset Deployments store
        if (!db.objectStoreNames.contains(STORES.ASSET_DEPLOYMENTS)) {
          const store = db.createObjectStore(STORES.ASSET_DEPLOYMENTS, { keyPath: 'id' });
          store.createIndex('assetId', 'assetId', { unique: false });
          store.createIndex('syncStatus', 'syncStatus', { unique: false });
        }

        // Personnel store
        if (!db.objectStoreNames.contains(STORES.PERSONNEL)) {
          const store = db.createObjectStore(STORES.PERSONNEL, { keyPath: 'id' });
          store.createIndex('syncStatus', 'syncStatus', { unique: false });
          store.createIndex('unit', 'unit', { unique: false });
        }

        // Roll Calls store
        if (!db.objectStoreNames.contains(STORES.ROLL_CALLS)) {
          const store = db.createObjectStore(STORES.ROLL_CALLS, { keyPath: 'id' });
          store.createIndex('syncStatus', 'syncStatus', { unique: false });
          store.createIndex('startedAt', 'startedAt', { unique: false });
        }

        // Checklists store
        if (!db.objectStoreNames.contains(STORES.CHECKLISTS)) {
          const store = db.createObjectStore(STORES.CHECKLISTS, { keyPath: 'id' });
          store.createIndex('syncStatus', 'syncStatus', { unique: false });
          store.createIndex('category', 'category', { unique: false });
        }

        // Incidents store
        if (!db.objectStoreNames.contains(STORES.INCIDENTS)) {
          const store = db.createObjectStore(STORES.INCIDENTS, { keyPath: 'id' });
          store.createIndex('syncStatus', 'syncStatus', { unique: false });
          store.createIndex('severity', 'severity', { unique: false });
          store.createIndex('reportedAt', 'reportedAt', { unique: false });
        }

        // Sync Queue store
        if (!db.objectStoreNames.contains(STORES.SYNC_QUEUE)) {
          const store = db.createObjectStore(STORES.SYNC_QUEUE, { keyPath: 'id' });
          store.createIndex('status', 'status', { unique: false });
          store.createIndex('opId', 'opId', { unique: false });
        }

        // CRDT Operations store
        if (!db.objectStoreNames.contains(STORES.CRDT_OPS)) {
          const store = db.createObjectStore(STORES.CRDT_OPS, { keyPath: 'id' });
          store.createIndex('entityType', 'entityType', { unique: false });
          store.createIndex('entityId', 'entityId', { unique: false });
          store.createIndex('timestamp', 'timestamp', { unique: false });
        }

        // Device Metadata store
        if (!db.objectStoreNames.contains(STORES.DEVICE_METADATA)) {
          db.createObjectStore(STORES.DEVICE_METADATA, { keyPath: 'deviceId' });
        }

        // Devices store
        if (!db.objectStoreNames.contains(STORES.DEVICES)) {
          db.createObjectStore(STORES.DEVICES, { keyPath: 'deviceId' });
        }

        // Users store
        if (!db.objectStoreNames.contains(STORES.USERS)) {
          db.createObjectStore(STORES.USERS, { keyPath: 'id' });
        }

        // Audit Logs store
        if (!db.objectStoreNames.contains(STORES.AUDIT_LOGS)) {
          const store = db.createObjectStore(STORES.AUDIT_LOGS, { keyPath: 'id' });
          store.createIndex('timestamp', 'timestamp', { unique: false });
          store.createIndex('severity', 'severity', { unique: false });
        }

        // Conflict Logs store
        if (!db.objectStoreNames.contains(STORES.CONFLICT_LOGS)) {
          const store = db.createObjectStore(STORES.CONFLICT_LOGS, { keyPath: 'conflictId' });
          store.createIndex('resolvedAt', 'resolvedAt', { unique: false });
        }
      };

      request.onsuccess = async (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        resolve(db);
      };

      request.onerror = (event) => {
        reject((event.target as IDBOpenDBRequest).error);
      };
    });

    return this.dbPromise;
  }

  // Subscribe to changes
  public subscribe(callback: ListenerCallback): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private notify(storeName: StoreName, action: string, data?: any) {
    this.listeners.forEach((listener) => listener(storeName, action, data));
  }

  // Generic Operations
  public async getAll<T>(storeName: StoreName): Promise<T[]> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result as T[]);
      request.onerror = () => reject(request.error);
    });
  }

  public async getById<T>(storeName: StoreName, id: string): Promise<T | undefined> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result as T | undefined);
      request.onerror = () => reject(request.error);
    });
  }

  public async put<T extends { id?: string; deviceId?: string }>(
    storeName: StoreName,
    item: T,
    silent = false
  ): Promise<string> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.put(item);

      request.onsuccess = () => {
        const id = (item.id || item.deviceId || request.result) as string;
        if (!silent) {
          this.notify(storeName, 'put', item);
        }
        resolve(id);
      };
      request.onerror = () => reject(request.error);
    });
  }

  public async bulkPut<T>(storeName: StoreName, items: T[], silent = false): Promise<void> {
    if (items.length === 0) return;
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);

      for (const item of items) {
        store.put(item);
      }

      transaction.oncomplete = () => {
        if (!silent) {
          this.notify(storeName, 'bulkPut', items);
        }
        resolve();
      };
      transaction.onerror = () => reject(transaction.error);
    });
  }

  public async delete(storeName: StoreName, id: string, silent = false): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.delete(id);

      request.onsuccess = () => {
        if (!silent) {
          this.notify(storeName, 'delete', { id });
        }
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  public async clearStore(storeName: StoreName): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.clear();

      request.onsuccess = () => {
        this.notify(storeName, 'clear');
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  public async clearAll(): Promise<void> {
    const db = await this.getDB();
    const stores = Object.values(STORES);
    const transaction = db.transaction(stores, 'readwrite');
    for (const store of stores) {
      transaction.objectStore(store).clear();
    }
    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => {
        this.notify(STORES.ASSETS, 'reset');
        resolve();
      };
      transaction.onerror = () => reject(transaction.error);
    });
  }

  // Export full snapshot
  public async exportSnapshot(): Promise<Record<string, any[]>> {
    const snapshot: Record<string, any[]> = {};
    for (const store of Object.values(STORES)) {
      snapshot[store] = await this.getAll(store);
    }
    return snapshot;
  }

  // Import snapshot
  public async importSnapshot(snapshot: Record<string, any[]>): Promise<void> {
    for (const [storeName, items] of Object.entries(snapshot)) {
      if (Object.values(STORES).includes(storeName as StoreName)) {
        await this.clearStore(storeName as StoreName);
        if (Array.isArray(items) && items.length > 0) {
          await this.bulkPut(storeName as StoreName, items, true);
        }
      }
    }
    this.notify(STORES.ASSETS, 'import');
  }
}

export const offlineStorage = new OfflineStorageService();
