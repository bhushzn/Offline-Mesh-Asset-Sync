// ============================================================
// TacSync Backend — HLC (Hybrid Logical Clock) for Server
// ============================================================
// Mirrors the frontend HLC implementation for consistent
// timestamp comparison across client and server.

export interface HLCTimestamp {
  ts: number;
  counter: number;
  nodeId: string;
}

/**
 * Compare two HLC timestamps. Returns:
 *  -1 if a < b
 *   0 if a == b
 *   1 if a > b
 *
 * Ordering: ts → counter → nodeId (deterministic tie-breaking)
 */
export function compareHLC(a: HLCTimestamp, b: HLCTimestamp): number {
  if (a.ts !== b.ts) return a.ts < b.ts ? -1 : 1;
  if (a.counter !== b.counter) return a.counter < b.counter ? -1 : 1;
  if (a.nodeId !== b.nodeId) return a.nodeId < b.nodeId ? -1 : 1;
  return 0;
}

/**
 * Convert an HLC timestamp to a sortable string representation.
 */
export function hlcToString(hlc: HLCTimestamp): string {
  return `${hlc.ts.toString(36).padStart(9, '0')}-${hlc.counter.toString(36).padStart(4, '0')}-${hlc.nodeId}`;
}

/**
 * Parse a string representation back to an HLC timestamp object.
 */
export function hlcFromString(str: string): HLCTimestamp {
  const parts = str.split('-');
  return {
    ts: parseInt(parts[0], 36),
    counter: parseInt(parts[1], 36),
    nodeId: parts.slice(2).join('-'),
  };
}

/**
 * Create a zero HLC timestamp.
 */
export function hlcZero(nodeId: string = ''): HLCTimestamp {
  return { ts: 0, counter: 0, nodeId };
}

/**
 * Create an HLC timestamp for the current time on the server.
 */
let lastTs = 0;
let lastCounter = 0;
const SERVER_NODE_ID = 'server';

export function hlcNow(): HLCTimestamp {
  const now = Date.now();
  if (now > lastTs) {
    lastTs = now;
    lastCounter = 0;
  } else {
    lastCounter++;
  }
  return { ts: lastTs, counter: lastCounter, nodeId: SERVER_NODE_ID };
}

/**
 * Merge two HLC timestamps — returns the "winning" one (higher).
 */
export function hlcMax(a: HLCTimestamp, b: HLCTimestamp): HLCTimestamp {
  return compareHLC(a, b) >= 0 ? a : b;
}
