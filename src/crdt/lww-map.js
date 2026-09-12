import { HLC } from './hlc.js';
import { LWWRegister } from './lww-register.js';

/**
 * LWW-Map (Last-Writer-Wins Map)
 * 
 * A CRDT map where each key maps to an LWW-Register.
 * Supports add, update, and soft-delete (tombstone) operations.
 * Used for equipment records, personnel records, and incident reports.
 */
export class LWWMap {
  constructor() {
    /** @type {Map<string, LWWRegister>} */
    this.registers = new Map();
    /** @type {Set<string>} keys that have been tombstoned */
    this.tombstones = new Set();
  }

  /**
   * Set a key-value pair with the given HLC timestamp.
   * If the key was previously deleted, it can be re-added if the new timestamp is higher.
   */
  set(key, value, hlcTimestamp) {
    const existing = this.registers.get(key);
    if (existing) {
      const updated = existing.set(value, hlcTimestamp);
      if (updated) {
        this.tombstones.delete(key);
      }
      return updated;
    }
    this.registers.set(key, new LWWRegister(value, hlcTimestamp));
    this.tombstones.delete(key);
    return true;
  }

  /**
   * Soft-delete a key by setting its value to a tombstone marker.
   */
  delete(key, hlcTimestamp) {
    const existing = this.registers.get(key);
    if (existing) {
      const updated = existing.set(null, hlcTimestamp);
      if (updated) {
        this.tombstones.add(key);
      }
      return updated;
    }
    // Create a tombstone register even if the key didn't exist locally
    this.registers.set(key, new LWWRegister(null, hlcTimestamp));
    this.tombstones.add(key);
    return true;
  }

  /**
   * Get the value for a key. Returns undefined if key doesn't exist or is tombstoned.
   */
  get(key) {
    if (this.tombstones.has(key)) return undefined;
    const reg = this.registers.get(key);
    return reg ? reg.value : undefined;
  }

  /**
   * Check if a key exists and is not tombstoned.
   */
  has(key) {
    return this.registers.has(key) && !this.tombstones.has(key);
  }

  /**
   * Get all non-tombstoned entries as an array of [key, value] pairs.
   */
  entries() {
    const result = [];
    for (const [key, reg] of this.registers) {
      if (!this.tombstones.has(key)) {
        result.push([key, reg.value]);
      }
    }
    return result;
  }

  /**
   * Get all non-tombstoned values.
   */
  values() {
    return this.entries().map(([, v]) => v);
  }

  /**
   * Get all non-tombstoned keys.
   */
  keys() {
    return this.entries().map(([k]) => k);
  }

  /**
   * Number of non-tombstoned entries.
   */
  get size() {
    return this.registers.size - this.tombstones.size;
  }

  /**
   * Merge with a remote LWW-Map. Each key's register is merged independently.
   * Returns array of keys that were updated.
   */
  merge(remote) {
    const updatedKeys = [];
    for (const [key, remoteReg] of remote.registers) {
      const localReg = this.registers.get(key);
      if (localReg) {
        const updated = localReg.merge(remoteReg);
        if (updated) {
          // Update tombstone status based on merged value
          if (localReg.value === null) {
            this.tombstones.add(key);
          } else {
            this.tombstones.delete(key);
          }
          updatedKeys.push(key);
        }
      } else {
        // Key doesn't exist locally — import it
        this.registers.set(key, LWWRegister.fromJSON(remoteReg.toJSON()));
        if (remoteReg.value === null) {
          this.tombstones.add(key);
        }
        updatedKeys.push(key);
      }
    }
    return updatedKeys;
  }

  /**
   * Get entries changed since a given HLC timestamp.
   * Used for delta sync — only send what's new.
   */
  changesSince(sinceTimestamp) {
    const delta = new LWWMap();
    for (const [key, reg] of this.registers) {
      if (HLC.compare(reg.timestamp, sinceTimestamp) > 0) {
        delta.registers.set(key, LWWRegister.fromJSON(reg.toJSON()));
        if (this.tombstones.has(key)) {
          delta.tombstones.add(key);
        }
      }
    }
    return delta;
  }

  /**
   * Get the highest HLC timestamp across all registers.
   */
  latestTimestamp() {
    let latest = HLC.zero();
    for (const reg of this.registers.values()) {
      if (HLC.compare(reg.timestamp, latest) > 0) {
        latest = reg.timestamp;
      }
    }
    return latest;
  }

  /**
   * Serialize to a plain object for IndexedDB storage.
   */
  toJSON() {
    const data = {};
    for (const [key, reg] of this.registers) {
      data[key] = reg.toJSON();
    }
    return {
      registers: data,
      tombstones: Array.from(this.tombstones),
    };
  }

  /**
   * Deserialize from a plain object.
   */
  static fromJSON(json) {
    const map = new LWWMap();
    if (!json) return map;
    if (json.registers) {
      for (const [key, regData] of Object.entries(json.registers)) {
        map.registers.set(key, LWWRegister.fromJSON(regData));
      }
    }
    if (json.tombstones) {
      for (const key of json.tombstones) {
        map.tombstones.add(key);
      }
    }
    return map;
  }
}
