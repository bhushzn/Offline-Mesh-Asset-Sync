/**
 * useCRDT — React hook for CRDT-aware state management
 * 
 * Bridges the SyncEngine with React state. Provides reactive access
 * to CRDT collections that automatically update when sync events occur.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { SyncEngine } from '../mesh/sync-engine.js';
import { HLC } from '../crdt/index.js';

/**
 * Hook that provides access to CRDT collections with real-time sync.
 */
export function useCRDT(peerManager) {
  const [engine, setEngine] = useState(null);
  const [ready, setReady] = useState(false);
  const [version, setVersion] = useState(0); // Trigger re-renders on changes
  const hlcRef = useRef(null);
  const engineRef = useRef(null);

  // Initialize
  useEffect(() => {
    if (!peerManager) return;

    // Create or reuse HLC
    if (!hlcRef.current) {
      hlcRef.current = new HLC(peerManager.localPeerId);
    }

    const syncEngine = new SyncEngine(peerManager, hlcRef.current);
    engineRef.current = syncEngine;

    syncEngine.init().then(() => {
      setEngine(syncEngine);
      setReady(true);
    });

    // Listen for changes to trigger re-renders
    const unsubscribe = syncEngine.onChange(() => {
      setVersion(v => v + 1);
    });

    return () => {
      unsubscribe();
      syncEngine.destroy();
    };
  }, [peerManager]);

  /**
   * Set a value in a collection.
   */
  const set = useCallback(async (collection, key, value) => {
    if (!engineRef.current) return;
    await engineRef.current.set(collection, key, value);
    setVersion(v => v + 1);
  }, []);

  /**
   * Delete a value from a collection.
   */
  const remove = useCallback(async (collection, key) => {
    if (!engineRef.current) return;
    await engineRef.current.delete(collection, key);
    setVersion(v => v + 1);
  }, []);

  /**
   * Get a single value from a collection.
   */
  const get = useCallback((collection, key) => {
    if (!engineRef.current) return undefined;
    return engineRef.current.get(collection, key);
  }, [version]); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * Get all entries from a collection.
   */
  const getAll = useCallback((collection) => {
    if (!engineRef.current) return [];
    return engineRef.current.getAll(collection);
  }, [version]); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * Get sync statistics.
   */
  const getStats = useCallback(() => {
    if (!engineRef.current) return { totalSynced: 0, localSynced: 0, collections: [], connectedPeers: 0 };
    return engineRef.current.getStats();
  }, [version]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    engine,
    ready,
    set,
    remove,
    get,
    getAll,
    getStats,
    version,
  };
}
