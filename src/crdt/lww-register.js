import { HLC } from './hlc.js';

/**
 * Last-Writer-Wins Register (LWW-Register)
 * 
 * A CRDT that stores a single value. Conflicts are resolved by keeping
 * the value with the highest HLC timestamp. Deterministic tie-breaking
 * on nodeId ensures convergence.
 */
export class LWWRegister {
  /**
   * @param {*} value - Initial value
   * @param {object} timestamp - HLC timestamp
   */
  constructor(value = null, timestamp = HLC.zero()) {
    this.value = value;
    this.timestamp = timestamp;
  }

  /**
   * Set a new value with the given HLC timestamp.
   */
  set(value, hlcTimestamp) {
    if (HLC.compare(hlcTimestamp, this.timestamp) > 0) {
      this.value = value;
      this.timestamp = hlcTimestamp;
      return true;
    }
    return false;
  }

  /**
   * Merge with a remote register. Keeps the value with the higher timestamp.
   * Returns true if local state was updated.
   */
  merge(remote) {
    if (HLC.compare(remote.timestamp, this.timestamp) > 0) {
      this.value = remote.value;
      this.timestamp = remote.timestamp;
      return true;
    }
    return false;
  }

  /**
   * Serialize to a plain object for storage/transmission.
   */
  toJSON() {
    return {
      value: this.value,
      timestamp: this.timestamp,
    };
  }

  /**
   * Deserialize from a plain object.
   */
  static fromJSON(json) {
    if (!json) return new LWWRegister();
    return new LWWRegister(json.value, json.timestamp);
  }
}
