// ============================================================
// FIELDLINK — Deterministic CRDT Synchronization & HLC Engine
// ============================================================

import { 
  CRDTOperation, 
  BaseTacticalEntity, 
  RollCallRecord, 
  ChecklistExecution, 
  ConflictRecord
} from '../types/tactical';
import { sha256Hex, canonicalJSON } from '../utils/crypto';
import { offlineStorage, STORES } from './offlineStorageService';
import { auditLog } from './auditLogService';

export interface CRDTMergeResult<T> {
  mergedData: T;
  hasConflict: boolean;
  conflictRecord?: ConflictRecord;
  winnerOrigin: string;
}

export class HybridLogicalClock {
  private physicalTime: number = 0;
  private logicalCounter: number = 0;
  private deviceId: string;

  constructor(deviceId: string) {
    this.deviceId = deviceId;
    this.physicalTime = Date.now();
    this.logicalCounter = 0;
  }

  public now(): string {
    const physical = Date.now();
    if (physical > this.physicalTime) {
      this.physicalTime = physical;
      this.logicalCounter = 0;
    } else {
      this.logicalCounter++;
    }
    return `${this.physicalTime.toString(36).padStart(9, '0')}-${this.logicalCounter.toString(36).padStart(4, '0')}-${this.deviceId}`;
  }

  public update(remoteHLC: string): string {
    const parts = remoteHLC.split('-');
    if (parts.length >= 2) {
      const remotePhysical = parseInt(parts[0], 36) || 0;
      const remoteLogical = parseInt(parts[1], 36) || 0;
      const localPhysical = Date.now();

      if (localPhysical > this.physicalTime && localPhysical > remotePhysical) {
        this.physicalTime = localPhysical;
        this.logicalCounter = 0;
      } else if (this.physicalTime === remotePhysical) {
        this.logicalCounter = Math.max(this.logicalCounter, remoteLogical) + 1;
      } else if (remotePhysical > this.physicalTime) {
        this.physicalTime = remotePhysical;
        this.logicalCounter = remoteLogical + 1;
      } else {
        this.logicalCounter++;
      }
    }
    return this.now();
  }

  public static compare(hlcA?: string, hlcB?: string): number {
    if (!hlcA && !hlcB) return 0;
    if (!hlcA) return -1;
    if (!hlcB) return 1;
    const partsA = hlcA.split('-');
    const partsB = hlcB.split('-');
    const timeA = parseInt(partsA[0], 36) || 0;
    const timeB = parseInt(partsB[0], 36) || 0;
    if (timeA !== timeB) return timeA > timeB ? 1 : -1;
    const countA = parseInt(partsA[1], 36) || 0;
    const countB = parseInt(partsB[1], 36) || 0;
    if (countA !== countB) return countA > countB ? 1 : -1;
    return (partsA[2] || '').localeCompare(partsB[2] || '');
  }
}

export class CRDTEngine {
  // Compute SHA-256 canonical hash for operation payload
  public static async computeOpHash(op: Omit<CRDTOperation, 'hash'>): Promise<string> {
    const canonicalPayload = {
      id: op.id,
      entityType: op.entityType,
      entityId: op.entityId,
      operationType: op.operationType,
      lamportClock: op.lamportClock,
      hlcTimestamp: op.hlcTimestamp,
      timestamp: op.timestamp,
      originDeviceId: op.originDeviceId,
      payload: op.payload,
    };
    return await sha256Hex(canonicalPayload);
  }

  // Compare two versions using HLC -> Lamport Clock -> Timestamp -> Device ID (Deterministic LWW)
  public static compareVersions(
    vA: { hlcTimestamp?: string; lamportClock: number; updatedAt: number; originDeviceId: string },
    vB: { hlcTimestamp?: string; lamportClock: number; updatedAt: number; originDeviceId: string }
  ): number {
    // 1. Primary: Hybrid Logical Clock (HLC)
    if (vA.hlcTimestamp && vB.hlcTimestamp) {
      const hlcComp = HybridLogicalClock.compare(vA.hlcTimestamp, vB.hlcTimestamp);
      if (hlcComp !== 0) return hlcComp;
    }

    // 2. Secondary: Lamport clock
    if (vA.lamportClock !== vB.lamportClock) {
      return vA.lamportClock > vB.lamportClock ? 1 : -1;
    }

    // 3. Tertiary: Wall clock timestamp
    if (vA.updatedAt !== vB.updatedAt) {
      return vA.updatedAt > vB.updatedAt ? 1 : -1;
    }

    // 4. Deterministic tie-breaker: Lexicographical comparison of device IDs
    return vA.originDeviceId.localeCompare(vB.originDeviceId);
  }

  // Merge Generic LWW Entity (Assets, Personnel, Incidents)
  public static mergeLWWEntity<T extends BaseTacticalEntity>(
    local: T | undefined,
    incoming: T,
    localDeviceId: string = 'local-device'
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
        hlcTimestamp: local.hlcTimestamp,
        lamportClock: local.lamportClock || 0,
        updatedAt: local.updatedAt,
        originDeviceId: local.updatedByDeviceId,
      },
      {
        hlcTimestamp: incoming.hlcTimestamp,
        lamportClock: incoming.lamportClock || 0,
        updatedAt: incoming.updatedAt,
        originDeviceId: incoming.updatedByDeviceId,
      }
    );

    const isConcurrent = 
      local.updatedByDeviceId !== incoming.updatedByDeviceId &&
      Math.abs(local.updatedAt - incoming.updatedAt) < 120000;

    let winnerOrigin = incoming.updatedByDeviceId;
    let mergedData: T;

    if (comparison > 0) {
      // Local wins
      winnerOrigin = local.updatedByDeviceId;
      mergedData = { ...local, syncStatus: 'synced' };
    } else {
      // Incoming wins
      winnerOrigin = incoming.updatedByDeviceId;
      mergedData = { ...incoming, syncStatus: 'synced' };
    }

    let conflictRecord: ConflictRecord | undefined;
    if (isConcurrent) {
      conflictRecord = {
        id: `conf-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        conflictId: `conf-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        entityType: (local as any).category ? 'asset' : (local as any).rank ? 'personnel' : 'incident',
        entityId: local.id,
        nodeAId: local.updatedByDeviceId,
        nodeAValue: local,
        nodeATimestamp: local.hlcTimestamp || new Date(local.updatedAt).toISOString(),
        nodeBId: incoming.updatedByDeviceId,
        nodeBValue: incoming,
        nodeBTimestamp: incoming.hlcTimestamp || new Date(incoming.updatedAt).toISOString(),
        resolutionRule: 'LWW_HLC_WINNER',
        winningNodeId: winnerOrigin,
        winningValue: mergedData,
        resolvedAt: Date.now(),
      };

      // Persist conflict audit log
      offlineStorage.put(STORES.CONFLICT_LOGS, conflictRecord).catch(() => {});
      auditLog.log({
        deviceId: localDeviceId,
        eventType: 'CONFLICT_RESOLVED',
        entityId: local.id,
        details: `Resolved concurrent edit on ${local.id}. Winning node: ${winnerOrigin}`,
        severity: 'WARN',
      });
    }

    return {
      mergedData,
      hasConflict: isConcurrent,
      conflictRecord,
      winnerOrigin,
    };
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

    // Merge incoming items
    for (const inItem of incoming.items) {
      const existing = itemMap.get(inItem.id);
      if (!existing) {
        itemMap.set(inItem.id, { ...inItem });
      } else {
        const inTime = inItem.completedAt || 0;
        const exTime = existing.completedAt || 0;
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
      return (op.lamportClock || 0) > remoteLamportForOrigin;
    });
  }

  // Merges two vector clocks component-wise (max per origin device)
  public static mergeVectorClocks(
    vA: Record<string, number>,
    vB: Record<string, number>
  ): Record<string, number> {
    const merged: Record<string, number> = { ...vA };
    for (const [deviceId, count] of Object.entries(vB)) {
      merged[deviceId] = Math.max(merged[deviceId] || 0, count);
    }
    return merged;
  }
}

