// FIELDLINK Deterministic CRDT Synchronization Engine
import { 
  CRDTOperation, 
  BaseTacticalEntity, 
  RollCallRecord, 
  ChecklistExecution, 
  Asset, 
  Incident, 
  Personnel 
} from '../types/tactical';

export interface CRDTMergeResult<T> {
  mergedData: T;
  hasConflict: boolean;
  conflictDescription?: string;
  winnerOrigin: string;
}

export class CRDTEngine {
  // Compute SHA-like simple deterministic hash for operation payload
  public static computeOpHash(op: Omit<CRDTOperation, 'hash'>): string {
    const raw = `${op.id}:${op.entityType}:${op.entityId}:${op.lamportClock}:${op.timestamp}:${op.originDeviceId}:${JSON.stringify(op.payload)}`;
    let hash = 0;
    for (let i = 0; i < raw.length; i++) {
      const char = raw.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0; // Convert to 32bit integer
    }
    return 'h_' + Math.abs(hash).toString(16);
  }

  // Compare two versions using Lamport Clock -> Timestamp -> Device ID (Deterministic LWW)
  public static compareVersions(
    vA: { lamportClock: number; updatedAt: number; originDeviceId: string },
    vB: { lamportClock: number; updatedAt: number; originDeviceId: string }
  ): number {
    // 1. Primary: Lamport clock
    if (vA.lamportClock !== vB.lamportClock) {
      return vA.lamportClock > vB.lamportClock ? 1 : -1;
    }
    // 2. Secondary: Wall clock timestamp
    if (vA.updatedAt !== vB.updatedAt) {
      return vA.updatedAt > vB.updatedAt ? 1 : -1;
    }
    // 3. Deterministic tie-breaker: Lexicographical comparison of device IDs
    return vA.originDeviceId.localeCompare(vB.originDeviceId);
  }

  // Merge Generic LWW Entity (Assets, Personnel, Incidents)
  public static mergeLWWEntity<T extends BaseTacticalEntity>(
    local: T | undefined,
    incoming: T
  ): CRDTMergeResult<T> {
    if (!local) {
      return {
        mergedData: { ...incoming, syncStatus: 'synced' },
        hasConflict: false,
        winnerOrigin: incoming.updatedByDeviceId,
      };
    }

    const comparison = this.compareVersions(
      {
        lamportClock: local.lamportClock || 0,
        updatedAt: local.updatedAt,
        originDeviceId: local.updatedByDeviceId,
      },
      {
        lamportClock: incoming.lamportClock || 0,
        updatedAt: incoming.updatedAt,
        originDeviceId: incoming.updatedByDeviceId,
      }
    );

    const isConcurrent = 
      local.updatedByDeviceId !== incoming.updatedByDeviceId &&
      Math.abs(local.updatedAt - incoming.updatedAt) < 60000; // within 1 min concurrent window

    if (comparison > 0) {
      // Local wins
      return {
        mergedData: { ...local, syncStatus: 'synced' },
        hasConflict: isConcurrent,
        conflictDescription: isConcurrent 
          ? `Concurrent edit on ${local.id}: Local (Node ${local.updatedByDeviceId}, Lamport ${local.lamportClock}) retained over Remote (Node ${incoming.updatedByDeviceId})` 
          : undefined,
        winnerOrigin: local.updatedByDeviceId,
      };
    } else {
      // Incoming wins
      return {
        mergedData: { ...incoming, syncStatus: 'synced' },
        hasConflict: isConcurrent,
        conflictDescription: isConcurrent 
          ? `Concurrent edit on ${incoming.id}: Remote (Node ${incoming.updatedByDeviceId}, Lamport ${incoming.lamportClock}) applied deterministically over Local (Node ${local.updatedByDeviceId})` 
          : undefined,
        winnerOrigin: incoming.updatedByDeviceId,
      };
    }
  }

  // Merge Roll Call CRDT (Multi-Entry Register Set)
  public static mergeRollCall(
    local: RollCallRecord | undefined,
    incoming: RollCallRecord
  ): CRDTMergeResult<RollCallRecord> {
    if (!local) {
      return {
        mergedData: { ...incoming, syncStatus: 'synced' },
        hasConflict: false,
        winnerOrigin: incoming.updatedByDeviceId,
      };
    }

    const mergedEntries = { ...local.entries };
    let entriesChanged = false;

    // Merge each personnel status entry deterministically
    for (const [persId, inEntry] of Object.entries(incoming.entries || {})) {
      const locEntry = mergedEntries[persId];
      if (!locEntry || inEntry.timestamp >= locEntry.timestamp) {
        mergedEntries[persId] = { ...inEntry };
        entriesChanged = true;
      }
    }

    // Recompute summary
    const values = Object.values(mergedEntries);
    const summary = {
      total: values.length,
      present: values.filter(e => e.status === 'Present').length,
      absent: values.filter(e => e.status === 'Absent').length,
      missing: values.filter(e => e.status === 'Missing').length,
      injured: values.filter(e => e.status === 'Injured').length,
      other: values.filter(e => e.status === 'Other').length,
    };

    const higherLamport = Math.max(local.lamportClock || 0, incoming.lamportClock || 0) + (entriesChanged ? 1 : 0);
    const latestTime = Math.max(local.updatedAt, incoming.updatedAt);
    const winnerDeviceId = incoming.updatedAt > local.updatedAt ? incoming.updatedByDeviceId : local.updatedByDeviceId;

    const mergedData: RollCallRecord = {
      ...local,
      ...incoming,
      entries: mergedEntries,
      summary,
      lamportClock: higherLamport,
      updatedAt: latestTime,
      updatedByDeviceId: winnerDeviceId,
      syncStatus: 'synced',
    };

    return {
      mergedData,
      hasConflict: false,
      winnerOrigin: winnerDeviceId,
    };
  }

  // Merge Checklist Execution CRDT (Grow-Only State + LWW item metadata)
  public static mergeChecklist(
    local: ChecklistExecution | undefined,
    incoming: ChecklistExecution
  ): CRDTMergeResult<ChecklistExecution> {
    if (!local) {
      return {
        mergedData: { ...incoming, syncStatus: 'synced' },
        hasConflict: false,
        winnerOrigin: incoming.updatedByDeviceId,
      };
    }

    const itemMap = new Map<string, any>();
    
    // Put local items
    for (const item of local.items) {
      itemMap.set(item.id, { ...item });
    }

    // Merge incoming items (CRDT rule: once checked completed, stays completed unless explicit uncheck with higher timestamp)
    for (const inItem of incoming.items) {
      const existing = itemMap.get(inItem.id);
      if (!existing) {
        itemMap.set(inItem.id, { ...inItem });
      } else {
        const inTime = inItem.completedAt || 0;
        const exTime = existing.completedAt || 0;
        // If one is completed and other is not, completed wins unless the uncompleted is strictly newer
        if (inItem.completed && !existing.completed) {
          itemMap.set(inItem.id, { ...existing, ...inItem });
        } else if (!inItem.completed && existing.completed) {
          if (inTime > exTime + 1000) {
            itemMap.set(inItem.id, { ...inItem });
          }
        } else if (inTime >= exTime) {
          itemMap.set(inItem.id, { ...existing, ...inItem });
        }
      }
    }

    const mergedItems = Array.from(itemMap.values());
    const completedCount = mergedItems.filter(i => i.completed).length;

    const mergedData: ChecklistExecution = {
      ...local,
      ...incoming,
      items: mergedItems,
      progress: {
        completed: completedCount,
        total: mergedItems.length,
      },
      status: completedCount === mergedItems.length ? 'Completed' : 'In Progress',
      lamportClock: Math.max(local.lamportClock || 0, incoming.lamportClock || 0) + 1,
      updatedAt: Math.max(local.updatedAt, incoming.updatedAt),
      updatedByDeviceId: incoming.updatedAt > local.updatedAt ? incoming.updatedByDeviceId : local.updatedByDeviceId,
      syncStatus: 'synced',
    };

    return {
      mergedData,
      hasConflict: false,
      winnerOrigin: mergedData.updatedByDeviceId,
    };
  }

  // Calculate missing delta operations based on vector clocks
  public static calculateMissingOps(
    localOps: CRDTOperation[],
    remoteVectorClock: Record<string, number>
  ): CRDTOperation[] {
    return localOps.filter(op => {
      const remoteLamportForOrigin = remoteVectorClock[op.originDeviceId] || 0;
      return op.lamportClock > remoteLamportForOrigin;
    });
  }
}
