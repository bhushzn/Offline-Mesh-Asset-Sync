/**
 * IndexedDB Database Layer for TacSync
 * 
 * Manages all persistent storage using IndexedDB. Provides async
 * CRUD operations wrapped in Promises. Schema versioning with
 * auto-migration on upgrade.
 */

const DB_NAME = 'tacsync_db';
const DB_VERSION = 1;

const STORES = {
  EQUIPMENT: 'equipment',
  PERSONNEL: 'personnel',
  INCIDENTS: 'incidents',
  CRDT_STATE: 'crdt_state',
  MESH_PEERS: 'mesh_peers',
  SYNC_LOG: 'sync_log',
  CONFIG: 'config',
};

let dbInstance = null;

/**
 * Open (or create) the IndexedDB database.
 * Creates all object stores on first run or version upgrade.
 */
export function openDatabase() {
  if (dbInstance) return Promise.resolve(dbInstance);

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // Create object stores if they don't exist
      if (!db.objectStoreNames.contains(STORES.EQUIPMENT)) {
        db.createObjectStore(STORES.EQUIPMENT, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORES.PERSONNEL)) {
        db.createObjectStore(STORES.PERSONNEL, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORES.INCIDENTS)) {
        db.createObjectStore(STORES.INCIDENTS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORES.CRDT_STATE)) {
        db.createObjectStore(STORES.CRDT_STATE, { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains(STORES.MESH_PEERS)) {
        db.createObjectStore(STORES.MESH_PEERS, { keyPath: 'peerId' });
      }
      if (!db.objectStoreNames.contains(STORES.SYNC_LOG)) {
        db.createObjectStore(STORES.SYNC_LOG, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORES.CONFIG)) {
        db.createObjectStore(STORES.CONFIG, { keyPath: 'key' });
      }
    };

    request.onsuccess = (event) => {
      dbInstance = event.target.result;
      resolve(dbInstance);
    };

    request.onerror = (event) => {
      reject(new Error(`Failed to open database: ${event.target.error}`));
    };
  });
}

/**
 * Save a value to an object store.
 */
export async function save(storeName, value) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const request = store.put(value);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Load a single value by key from an object store.
 */
export async function load(storeName, key) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const request = store.get(key);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Load all values from an object store.
 */
export async function loadAll(storeName) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Delete a value by key from an object store.
 */
export async function remove(storeName, key) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const request = store.delete(key);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Clear all data from an object store.
 */
export async function clearStore(storeName) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const request = store.clear();
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Save the CRDT state for a given collection.
 */
export async function saveCRDTState(collectionName, state) {
  return save(STORES.CRDT_STATE, { key: collectionName, state, updatedAt: Date.now() });
}

/**
 * Load the CRDT state for a given collection.
 */
export async function loadCRDTState(collectionName) {
  const record = await load(STORES.CRDT_STATE, collectionName);
  return record ? record.state : null;
}

export { STORES };
