/**
 * Sync Engine — CRDT Synchronization Orchestrator
 * 
 * Coordinates CRDT state synchronization between peers:
 * - On new connection: exchange full state
 * - On local mutation: broadcast delta to all peers
 * - On received delta: merge → persist → notify UI
 * - Periodic full reconciliation for consistency
 */

import { LWWMap, GCounter, HLC } from '../crdt/index.js';
import { saveCRDTState, loadCRDTState } from '../db/database.js';
import { getLastSyncedTimestamp, setLastSyncedTimestamp } from '../db/sync-log.js';
import {
  MessageType,
  createSyncRequest,
  createSyncResponse,
  createFullStateResponse,
  chunkMessage,
  ChunkAssembler,
} from './data-channel.js';

const COLLECTIONS = ['equipment', 'personnel', 'incidents'];
const RECONCILE_INTERVAL = 60000; // 60 seconds

export class SyncEngine {
  constructor(peerManager, hlc) {
    this.peerManager = peerManager;
    this.hlc = hlc;

    /** @type {Map<string, LWWMap>} collection name → CRDT map */
    this.collections = new Map();
    for (const name of COLLECTIONS) {
      this.collections.set(name, new LWWMap());
    }

    /** @type {GCounter} */
    this.syncCounter = new GCounter(peerManager.localPeerId);

    /** @type {ChunkAssembler} */
    this.chunkAssembler = new ChunkAssembler();

    /** @type {Function[]} Change listeners */
    this._changeListeners = [];

    /** @type {number|null} Reconciliation interval ID */
    this._reconcileInterval = null;

    // Listen for peer events
    this.peerManager.on('peer-connected', ({ peerId }) => this._onPeerConnected(peerId));
    this.peerManager.on('peer-data', ({ peerId, message }) => this._onPeerData(peerId, message));
  }

  /**
   * Initialize — load persisted CRDT states from IndexedDB.
   */
  async init() {
    for (const name of COLLECTIONS) {
      const savedState = await loadCRDTState(name);
      if (savedState) {
        this.collections.set(name, LWWMap.fromJSON(savedState));
      }
    }

    // Load sync counter
    const counterState = await loadCRDTState('_syncCounter');
    if (counterState) {
      this.syncCounter = GCounter.fromJSON(counterState);
    }

    // Start periodic reconciliation
    this._reconcileInterval = setInterval(() => {
      this._reconcileAll();
    }, RECONCILE_INTERVAL);
  }

  /**
   * Subscribe to state changes.
   * Callback receives { collection, keys, source }
   */
  onChange(callback) {
    this._changeListeners.push(callback);
    return () => {
      this._changeListeners = this._changeListeners.filter(cb => cb !== callback);
    };
  }

  /**
   * Notify all change listeners.
   */
  _notifyChange(collection, keys, source = 'local') {
    for (const cb of this._changeListeners) {
      try {
        cb({ collection, keys, source });
      } catch (e) {
        console.error('Change listener error:', e);
      }
    }
  }

  /**
   * Set a value in a collection. Generates HLC timestamp, persists, and broadcasts.
   */
  async set(collection, key, value) {
    const map = this.collections.get(collection);
    if (!map) throw new Error(`Unknown collection: ${collection}`);

    const timestamp = this.hlc.now();
    map.set(key, value, timestamp);

    // Persist
    await saveCRDTState(collection, map.toJSON());

    // Broadcast delta to all connected peers
    const delta = new LWWMap();
    delta.set(key, value, timestamp);

    const message = createSyncResponse({ [collection]: delta.toJSON() });
    const chunks = chunkMessage(message);
    for (const chunk of chunks) {
      this.peerManager.broadcast(chunk);
    }

    this.syncCounter.increment();
    await saveCRDTState('_syncCounter', this.syncCounter.toJSON());

    this._notifyChange(collection, [key], 'local');
  }

  /**
   * Delete a value from a collection (soft-delete via tombstone).
   */
  async delete(collection, key) {
    const map = this.collections.get(collection);
    if (!map) throw new Error(`Unknown collection: ${collection}`);

    const timestamp = this.hlc.now();
    map.delete(key, timestamp);

    await saveCRDTState(collection, map.toJSON());

    // Broadcast tombstone
    const delta = new LWWMap();
    delta.delete(key, timestamp);

    const message = createSyncResponse({ [collection]: delta.toJSON() });
    const chunks = chunkMessage(message);
    for (const chunk of chunks) {
      this.peerManager.broadcast(chunk);
    }

    this.syncCounter.increment();
    await saveCRDTState('_syncCounter', this.syncCounter.toJSON());

    this._notifyChange(collection, [key], 'local');
  }

  /**
   * Get a value from a collection.
   */
  get(collection, key) {
    const map = this.collections.get(collection);
    return map ? map.get(key) : undefined;
  }

  /**
   * Get all entries from a collection.
   */
  getAll(collection) {
    const map = this.collections.get(collection);
    return map ? map.entries() : [];
  }

  /**
   * Get collection size.
   */
  getSize(collection) {
    const map = this.collections.get(collection);
    return map ? map.size : 0;
  }

  /**
   * Handle new peer connection — send full state.
   */
  async _onPeerConnected(peerId) {
    // Send full state to new peer
    const states = {};
    for (const [name, map] of this.collections) {
      states[name] = map.toJSON();
    }

    const message = createFullStateResponse(states);
    const chunks = chunkMessage(message);
    for (const chunk of chunks) {
      this.peerManager.send(peerId, chunk);
    }
  }

  /**
   * Handle incoming data from a peer.
   */
  async _onPeerData(peerId, message) {
    // Handle chunked messages
    if (message.type === MessageType.CHUNK_START ||
        message.type === MessageType.CHUNK_DATA ||
        message.type === MessageType.CHUNK_END) {
      const assembled = this.chunkAssembler.processChunk(message);
      if (assembled) {
        await this._onPeerData(peerId, assembled);
      }
      return;
    }

    switch (message.type) {
      case MessageType.SYNC_REQUEST:
        await this._handleSyncRequest(peerId, message);
        break;
      case MessageType.SYNC_RESPONSE:
        await this._handleSyncResponse(peerId, message);
        break;
      case MessageType.FULL_STATE_RESPONSE:
        await this._handleFullState(peerId, message);
        break;
      case MessageType.FULL_STATE_REQUEST:
        await this._onPeerConnected(peerId);
        break;
    }
  }

  /**
   * Handle a sync request — compute and send deltas.
   */
  async _handleSyncRequest(peerId, request) {
    const deltas = {};
    for (const collection of (request.collections || COLLECTIONS)) {
      const map = this.collections.get(collection);
      if (map) {
        const since = request.since?.[collection] || HLC.zero();
        const delta = map.changesSince(since);
        if (delta.size > 0 || delta.tombstones?.size > 0) {
          deltas[collection] = delta.toJSON();
        }
      }
    }

    if (Object.keys(deltas).length > 0) {
      const message = createSyncResponse(deltas);
      const chunks = chunkMessage(message);
      for (const chunk of chunks) {
        this.peerManager.send(peerId, chunk);
      }
    }
  }

  /**
   * Handle sync response — merge deltas into local state.
   */
  async _handleSyncResponse(peerId, response) {
    const updatedCollections = [];

    for (const [collectionName, deltaJSON] of Object.entries(response.deltas || {})) {
      const localMap = this.collections.get(collectionName);
      if (!localMap) continue;

      const remoteMap = LWWMap.fromJSON(deltaJSON);
      const updatedKeys = localMap.merge(remoteMap);

      if (updatedKeys.length > 0) {
        await saveCRDTState(collectionName, localMap.toJSON());
        updatedCollections.push({ collection: collectionName, keys: updatedKeys });

        // Update HLC from remote timestamps
        const latestTs = remoteMap.latestTimestamp();
        this.hlc.receive(latestTs);
      }
    }

    // Notify UI of changes
    for (const { collection, keys } of updatedCollections) {
      this._notifyChange(collection, keys, 'sync');
    }

    if (updatedCollections.length > 0) {
      this.syncCounter.increment();
      await saveCRDTState('_syncCounter', this.syncCounter.toJSON());
    }
  }

  /**
   * Handle full state from a peer — merge everything.
   */
  async _handleFullState(peerId, response) {
    const updatedCollections = [];

    for (const [collectionName, stateJSON] of Object.entries(response.states || {})) {
      const localMap = this.collections.get(collectionName);
      if (!localMap) continue;

      const remoteMap = LWWMap.fromJSON(stateJSON);
      const updatedKeys = localMap.merge(remoteMap);

      if (updatedKeys.length > 0) {
        await saveCRDTState(collectionName, localMap.toJSON());
        updatedCollections.push({ collection: collectionName, keys: updatedKeys });
      }
    }

    for (const { collection, keys } of updatedCollections) {
      this._notifyChange(collection, keys, 'full-sync');
    }
  }

  /**
   * Periodic full-state reconciliation with all peers.
   */
  _reconcileAll() {
    if (this.peerManager.peerCount === 0) return;

    const request = createSyncRequest(COLLECTIONS, {});
    this.peerManager.broadcast(request);
  }

  /**
   * Get sync statistics.
   */
  getStats() {
    return {
      totalSynced: this.syncCounter.value(),
      localSynced: this.syncCounter.localValue(),
      collections: COLLECTIONS.map(name => ({
        name,
        size: this.collections.get(name)?.size || 0,
      })),
      connectedPeers: this.peerManager.peerCount,
    };
  }

  /**
   * Clean up intervals and listeners.
   */
  destroy() {
    if (this._reconcileInterval) {
      clearInterval(this._reconcileInterval);
    }
    this._changeListeners = [];
  }
}
