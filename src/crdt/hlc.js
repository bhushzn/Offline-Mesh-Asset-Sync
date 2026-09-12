/**
 * Hybrid Logical Clock (HLC)
 * 
 * Combines physical wall-clock time with a logical counter and node ID
 * to create a causally-consistent timestamp that works even with clock drift.
 * 
 * Format: { ts: number, counter: number, nodeId: string }
 * String form: "ts-counter-nodeId" (lexicographically sortable)
 */

export class HLC {
  constructor(nodeId) {
    this.nodeId = nodeId;
    this.ts = Date.now();
    this.counter = 0;
  }

  /**
   * Generate a new timestamp for a local event.
   * Ensures monotonically increasing timestamps even if wall clock hasn't advanced.
   */
  now() {
    const physicalTime = Date.now();
    if (physicalTime > this.ts) {
      this.ts = physicalTime;
      this.counter = 0;
    } else {
      this.counter++;
    }
    return this.pack();
  }

  /**
   * Receive a remote timestamp and advance the local clock.
   * Merges the remote clock with the local clock to maintain causal ordering.
   */
  receive(remoteTimestamp) {
    const remote = HLC.unpack(remoteTimestamp);
    const physicalTime = Date.now();

    if (physicalTime > this.ts && physicalTime > remote.ts) {
      this.ts = physicalTime;
      this.counter = 0;
    } else if (remote.ts > this.ts) {
      this.ts = remote.ts;
      this.counter = remote.counter + 1;
    } else if (this.ts > remote.ts) {
      this.counter++;
    } else {
      // Equal timestamps — advance counter past both
      this.counter = Math.max(this.counter, remote.counter) + 1;
    }
    return this.pack();
  }

  /**
   * Pack current state into a serializable timestamp object.
   */
  pack() {
    return {
      ts: this.ts,
      counter: this.counter,
      nodeId: this.nodeId,
    };
  }

  /**
   * Compare two HLC timestamps. Returns:
   *  -1 if a < b
   *   0 if a == b
   *   1 if a > b
   * 
   * Ordering: ts → counter → nodeId (deterministic tie-breaking)
   */
  static compare(a, b) {
    if (a.ts !== b.ts) return a.ts < b.ts ? -1 : 1;
    if (a.counter !== b.counter) return a.counter < b.counter ? -1 : 1;
    if (a.nodeId !== b.nodeId) return a.nodeId < b.nodeId ? -1 : 1;
    return 0;
  }

  /**
   * Convert an HLC timestamp to a sortable string representation.
   */
  static toString(hlcTimestamp) {
    const { ts, counter, nodeId } = hlcTimestamp;
    return `${ts.toString(36).padStart(9, '0')}-${counter.toString(36).padStart(4, '0')}-${nodeId}`;
  }

  /**
   * Parse a string representation back to an HLC timestamp object.
   */
  static fromString(str) {
    const parts = str.split('-');
    return {
      ts: parseInt(parts[0], 36),
      counter: parseInt(parts[1], 36),
      nodeId: parts.slice(2).join('-'),
    };
  }

  /**
   * Unpack a timestamp — accepts both object and string forms.
   */
  static unpack(timestamp) {
    if (typeof timestamp === 'string') return HLC.fromString(timestamp);
    return timestamp;
  }

  /**
   * Create a "zero" timestamp for initialization.
   */
  static zero(nodeId = '') {
    return { ts: 0, counter: 0, nodeId };
  }
}
