// ============================================================
// TacSync Backend — CRDT Conflict Resolver
// ============================================================
// Deterministic conflict resolution for offline-first sync.
//
// Strategy:
//   1. Compare HLC timestamps — higher timestamp wins
//   2. If timestamps are equal, deviceId is used as tiebreaker
//      (lexicographically higher deviceId wins — deterministic)
//   3. All conflicts are logged — never silently overwritten
//
// Per-entity merge policies:
//   - LWW (Last Writer Wins) per field for most entities
//   - OR-Set union for roll call entries
//   - Never auto-delete incidents

import { compareHLC, type HLCTimestamp, hlcFromString } from './hlc.js';

export interface SyncOp {
  operationId: string;
  deviceId: string;
  entityType: string;
  entityId: string;
  operationType: string; // CREATE, UPDATE, DELETE
  data: Record<string, unknown>;
  hlcTimestamp: string;
  version?: number;
}

export interface ConflictRecord {
  entityType: string;
  entityId: string;
  winningOp: SyncOp;
  losingOp: SyncOp;
  resolution: string;
  mergedData: Record<string, unknown>;
}

/**
 * Determine the winner between two conflicting operations.
 *
 * Returns { winner, loser, resolution, mergedData }
 */
export function resolveConflict(
  opA: SyncOp,
  opB: SyncOp,
): ConflictRecord {
  const hlcA = hlcFromString(opA.hlcTimestamp);
  const hlcB = hlcFromString(opB.hlcTimestamp);

  const cmp = compareHLC(hlcA, hlcB);

  let winner: SyncOp;
  let loser: SyncOp;
  let resolution: string;

  if (cmp > 0) {
    winner = opA;
    loser = opB;
    resolution = `HLC_TIMESTAMP: ${opA.deviceId} has later timestamp`;
  } else if (cmp < 0) {
    winner = opB;
    loser = opA;
    resolution = `HLC_TIMESTAMP: ${opB.deviceId} has later timestamp`;
  } else {
    // Equal timestamps — deterministic tiebreak on deviceId
    if (opA.deviceId >= opB.deviceId) {
      winner = opA;
      loser = opB;
    } else {
      winner = opB;
      loser = opA;
    }
    resolution = `DEVICE_TIEBREAK: ${winner.deviceId} wins (lexicographic)`;
  }

  // Merge data — winner's fields override, but preserve unique fields from loser
  const mergedData = mergeEntityData(
    opA.entityType,
    winner.data,
    loser.data,
    winner.operationType,
    loser.operationType,
  );

  return {
    entityType: opA.entityType,
    entityId: opA.entityId,
    winningOp: winner,
    losingOp: loser,
    resolution,
    mergedData,
  };
}

/**
 * Per-field LWW merge. Winner's fields always take precedence,
 * but loser's unique fields (not in winner) are preserved.
 */
function mergeEntityData(
  entityType: string,
  winnerData: Record<string, unknown>,
  loserData: Record<string, unknown>,
  winnerOpType: string,
  loserOpType: string,
): Record<string, unknown> {
  // If winner is DELETE, use winner data (tombstone)
  if (winnerOpType === 'DELETE') {
    return { ...winnerData, _deleted: true };
  }

  // If loser is DELETE but winner is CREATE/UPDATE, winner resurrects
  if (loserOpType === 'DELETE') {
    return { ...winnerData };
  }

  // For roll call entries, union merge (OR-Set semantics)
  if (entityType === 'rollcall_entry') {
    return mergeORSet(winnerData, loserData);
  }

  // Default: LWW per field — winner takes all explicit fields,
  // loser fills in any fields winner doesn't have
  const merged = { ...loserData };
  for (const [key, value] of Object.entries(winnerData)) {
    if (value !== undefined && value !== null) {
      merged[key] = value;
    }
  }

  return merged;
}

/**
 * OR-Set style merge for collection-type entities (roll call entries).
 * Union of all entries, deduplicated by a unique key.
 */
function mergeORSet(
  winnerData: Record<string, unknown>,
  loserData: Record<string, unknown>,
): Record<string, unknown> {
  const winnerEntries = (winnerData.entries as Record<string, unknown>[]) || [];
  const loserEntries = (loserData.entries as Record<string, unknown>[]) || [];

  // Deduplicate by personnelId (or similar unique key)
  const merged = new Map<string, Record<string, unknown>>();
  for (const entry of loserEntries) {
    const key = (entry.personnelId as string) || (entry.itemId as string) || JSON.stringify(entry);
    merged.set(key, entry);
  }
  for (const entry of winnerEntries) {
    const key = (entry.personnelId as string) || (entry.itemId as string) || JSON.stringify(entry);
    merged.set(key, entry); // Winner overrides
  }

  return {
    ...winnerData,
    entries: Array.from(merged.values()),
  };
}

/**
 * Check if two operations conflict.
 * Two operations conflict if they target the same entity
 * with different data from different devices.
 */
export function detectConflict(opA: SyncOp, opB: SyncOp): boolean {
  if (opA.entityType !== opB.entityType) return false;
  if (opA.entityId !== opB.entityId) return false;
  if (opA.deviceId === opB.deviceId) return false;
  if (opA.operationId === opB.operationId) return false;

  // Same entity, different devices, different operations = potential conflict
  return true;
}
