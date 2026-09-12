/**
 * Sync Log — Per-peer sync state tracking
 * 
 * Tracks the last synced HLC timestamp per peer per collection.
 * Used by the sync engine to compute deltas (only send changes since last sync).
 */

import { save, load, STORES } from './database.js';
import { HLC } from '../crdt/hlc.js';

/**
 * Get the last synced timestamp for a peer + collection pair.
 */
export async function getLastSyncedTimestamp(peerId, collection) {
  const id = `${peerId}::${collection}`;
  const record = await load(STORES.SYNC_LOG, id);
  return record ? record.timestamp : HLC.zero();
}

/**
 * Update the last synced timestamp for a peer + collection pair.
 */
export async function setLastSyncedTimestamp(peerId, collection, timestamp) {
  const id = `${peerId}::${collection}`;
  return save(STORES.SYNC_LOG, { id, peerId, collection, timestamp, updatedAt: Date.now() });
}

/**
 * Get all sync log entries for a specific peer.
 */
export async function getPeerSyncState(peerId) {
  const { loadAll } = await import('./database.js');
  const all = await loadAll(STORES.SYNC_LOG);
  return all.filter(entry => entry.peerId === peerId);
}
