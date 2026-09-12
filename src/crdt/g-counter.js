/**
 * G-Counter (Grow-only Counter)
 * 
 * A CRDT counter that only supports increment operations.
 * Each node maintains its own count. The total value is the
 * sum of all nodes' counts. Merge takes the pairwise maximum.
 * 
 * Used for sync statistics (messages sent, items synced).
 */
export class GCounter {
  constructor(nodeId) {
    this.nodeId = nodeId;
    /** @type {Map<string, number>} nodeId → count */
    this.counts = new Map();
    this.counts.set(nodeId, 0);
  }

  /**
   * Increment the counter for this node.
   */
  increment(amount = 1) {
    const current = this.counts.get(this.nodeId) || 0;
    this.counts.set(this.nodeId, current + amount);
  }

  /**
   * Get the total value across all nodes.
   */
  value() {
    let total = 0;
    for (const count of this.counts.values()) {
      total += count;
    }
    return total;
  }

  /**
   * Get this node's local count.
   */
  localValue() {
    return this.counts.get(this.nodeId) || 0;
  }

  /**
   * Merge with a remote counter state.
   * Takes the maximum of each node's count.
   */
  merge(remote) {
    for (const [nodeId, remoteCount] of remote.counts) {
      const localCount = this.counts.get(nodeId) || 0;
      this.counts.set(nodeId, Math.max(localCount, remoteCount));
    }
  }

  /**
   * Serialize to a plain object.
   */
  toJSON() {
    const counts = {};
    for (const [nodeId, count] of this.counts) {
      counts[nodeId] = count;
    }
    return { nodeId: this.nodeId, counts };
  }

  /**
   * Deserialize from a plain object.
   */
  static fromJSON(json) {
    if (!json) return new GCounter('unknown');
    const counter = new GCounter(json.nodeId);
    if (json.counts) {
      for (const [nodeId, count] of Object.entries(json.counts)) {
        counter.counts.set(nodeId, count);
      }
    }
    return counter;
  }
}
