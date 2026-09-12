/**
 * useDatabase — React hook for IndexedDB operations
 */
import { useState, useEffect, useCallback } from 'react';
import { openDatabase, save, load, loadAll, STORES } from '../db/database.js';

/**
 * Hook to load and manage data from an IndexedDB object store.
 */
export function useDatabase(storeName) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      await openDatabase();
      const items = await loadAll(storeName);
      setData(items);
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [storeName]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const saveItem = useCallback(async (item) => {
    try {
      await save(storeName, item);
      await refresh();
    } catch (e) {
      setError(e.message);
    }
  }, [storeName, refresh]);

  const loadItem = useCallback(async (key) => {
    try {
      return await load(storeName, key);
    } catch (e) {
      setError(e.message);
      return null;
    }
  }, [storeName]);

  return { data, loading, error, refresh, saveItem, loadItem };
}

/**
 * Hook for loading/saving app configuration.
 */
export function useConfig(key, defaultValue) {
  const [value, setValue] = useState(defaultValue);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        await openDatabase();
        const record = await load(STORES.CONFIG, key);
        if (record) {
          setValue(record.value);
        }
        setLoaded(true);
      } catch (e) {
        console.error('Config load error:', e);
        setLoaded(true);
      }
    })();
  }, [key]);

  const updateValue = useCallback(async (newValue) => {
    setValue(newValue);
    try {
      await save(STORES.CONFIG, { key, value: newValue });
    } catch (e) {
      console.error('Config save error:', e);
    }
  }, [key]);

  return [value, updateValue, loaded];
}
