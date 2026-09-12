// ============================================================
// TacSync Backend — Sync Engine Service
// ============================================================
// Core synchronization service that:
//   1. Receives pending operations from offline devices
//   2. Deduplicates operations (idempotent)
//   3. Detects conflicts with existing operations
//   4. Resolves conflicts via CRDT/HLC strategy
//   5. Applies operations to the database
//   6. Returns missing operations the device needs
//   7. Logs everything for audit and recovery

import { prisma } from '../config/database.js';
import { recordAudit } from '../events/auditService.js';
import {
  hlcFromString,
  hlcToString,
  hlcNow,
  compareHLC,
  resolveConflict,
  detectConflict,
} from '../crdt/index.js';
import type { SyncOp, ConflictRecord } from '../crdt/index.js';
import type { SyncOperationStatus } from '@prisma/client';

// ─── Types ───────────────────────────────────────────────────

export interface SyncRequest {
  deviceId: string;
  unitId?: string;
  lastSyncTimestamp: string;
  knownOperationIds: string[];
  pendingOperations: SyncOp[];
  crdtMetadata?: {
    entityVersions?: Record<string, number>;
  };
}

export interface SyncResponse {
  accepted: string[];
  rejected: { id: string; reason: string }[];
  missingOperations: SyncOp[];
  conflicts: ConflictRecord[];
  serverVersion: number;
  syncTimestamp: string;
  deviceState: {
    lastSyncedAt: string;
    pendingCount: number;
  };
  sessionId: string;
}

// ─── Entity Applier Registry ─────────────────────────────────
// Maps entityType → function that applies an operation to the DB

type EntityApplier = (
  entityId: string,
  operationType: string,
  data: Record<string, unknown>,
) => Promise<void>;

const entityAppliers: Record<string, EntityApplier> = {
  asset: applyAssetOperation,
  personnel: applyPersonnelOperation,
  incident: applyIncidentOperation,
  rollcall: applyRollCallOperation,
  checklist: applyChecklistOperation,
  deployment: applyDeploymentOperation,
};

// ─── Main Sync Flow ──────────────────────────────────────────

export async function processSync(
  request: SyncRequest,
  userId: string,
): Promise<SyncResponse> {
  const sessionStartTime = new Date();

  // Create sync session
  const session = await prisma.syncSession.create({
    data: {
      deviceId: request.deviceId,
      status: 'IN_PROGRESS',
    },
  });

  const accepted: string[] = [];
  const rejected: { id: string; reason: string }[] = [];
  const conflicts: ConflictRecord[] = [];

  try {
    // ── Step 1: Process pending operations from device ──────
    for (const op of request.pendingOperations) {
      try {
        const result = await processOperation(op, session.id);
        if (result.status === 'ACCEPTED') {
          accepted.push(op.operationId);
        } else if (result.status === 'CONFLICT') {
          accepted.push(op.operationId); // Still accepted, but with conflict resolution
          if (result.conflict) conflicts.push(result.conflict);
        } else if (result.status === 'REJECTED') {
          rejected.push({ id: op.operationId, reason: result.reason || 'Unknown' });
        } else if (result.status === 'DUPLICATE') {
          // Already processed — idempotent skip, still report as accepted
          accepted.push(op.operationId);
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Processing failed';
        rejected.push({ id: op.operationId, reason: msg });
      }
    }

    // ── Step 2: Find operations the device is missing ────────
    const missingOperations = await findMissingOperations(
      request.deviceId,
      request.knownOperationIds,
      request.lastSyncTimestamp,
      request.unitId,
    );

    // ── Step 3: Update device state ─────────────────────────
    const syncTimestamp = hlcToString(hlcNow());

    await prisma.device.update({
      where: { id: request.deviceId },
      data: {
        lastSyncAt: new Date(),
        lastSeenAt: new Date(),
        pendingOpsCount: 0,
        syncFailureCount: 0,
      },
    });

    // ── Step 4: Complete session ─────────────────────────────
    await prisma.syncSession.update({
      where: { id: session.id },
      data: {
        status: 'COMPLETED',
        operationsRecv: request.pendingOperations.length,
        operationsSent: missingOperations.length,
        conflictsFound: conflicts.length,
        completedAt: new Date(),
      },
    });

    // ── Step 5: Audit log ────────────────────────────────────
    await recordAudit({
      userId,
      deviceId: request.deviceId,
      entityType: 'SyncSession',
      entityId: session.id,
      action: 'SYNC_COMPLETED',
      metadata: {
        accepted: accepted.length,
        rejected: rejected.length,
        conflicts: conflicts.length,
        missing: missingOperations.length,
        duration: Date.now() - sessionStartTime.getTime(),
      },
    });

    // Get latest server version
    const latestOp = await prisma.syncOperation.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { version: true },
    });

    return {
      accepted,
      rejected,
      missingOperations: missingOperations.map(opToSyncOp),
      conflicts,
      serverVersion: latestOp?.version || 0,
      syncTimestamp,
      deviceState: {
        lastSyncedAt: syncTimestamp,
        pendingCount: 0,
      },
      sessionId: session.id,
    };
  } catch (error) {
    // Mark session as failed
    await prisma.syncSession.update({
      where: { id: session.id },
      data: {
        status: 'FAILED',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        completedAt: new Date(),
      },
    });

    throw error;
  }
}

// ─── Process Single Operation ────────────────────────────────

interface ProcessResult {
  status: 'ACCEPTED' | 'REJECTED' | 'CONFLICT' | 'DUPLICATE';
  reason?: string;
  conflict?: ConflictRecord;
}

async function processOperation(op: SyncOp, sessionId: string): Promise<ProcessResult> {
  // ── Duplicate detection (idempotent) ───────────────────────
  const existing = await prisma.syncOperation.findUnique({
    where: { operationId: op.operationId },
  });
  if (existing) {
    return { status: 'DUPLICATE', reason: 'Operation already processed' };
  }

  // ── Check for conflicts ────────────────────────────────────
  // Find recent operations on the same entity from different devices
  const recentOps = await prisma.syncOperation.findMany({
    where: {
      entityType: op.entityType,
      entityId: op.entityId,
      deviceId: { not: op.deviceId },
      status: { in: ['ACCEPTED', 'CONFLICT'] },
    },
    orderBy: { createdAt: 'desc' },
    take: 5,
  });

  let conflict: ConflictRecord | undefined;
  let finalData = op.data;
  let status: SyncOperationStatus = 'ACCEPTED';

  for (const recentOp of recentOps) {
    const recentSyncOp: SyncOp = {
      operationId: recentOp.operationId,
      deviceId: recentOp.deviceId,
      entityType: recentOp.entityType,
      entityId: recentOp.entityId,
      operationType: recentOp.operationType,
      data: recentOp.data as Record<string, unknown>,
      hlcTimestamp: recentOp.hlcTimestamp,
      version: recentOp.version,
    };

    if (detectConflict(op, recentSyncOp)) {
      conflict = resolveConflict(op, recentSyncOp);
      finalData = conflict.mergedData;
      status = 'CONFLICT';

      // Log the conflict
      await recordAudit({
        deviceId: op.deviceId,
        entityType: op.entityType,
        entityId: op.entityId,
        action: 'CONFLICT_RESOLVE',
        metadata: {
          resolution: conflict.resolution,
          winningDevice: conflict.winningOp.deviceId,
          losingDevice: conflict.losingOp.deviceId,
        },
        operationId: op.operationId,
      });

      break; // Only resolve against the most recent conflicting op
    }
  }

  // ── Store the operation ────────────────────────────────────
  await prisma.syncOperation.create({
    data: {
      operationId: op.operationId,
      deviceId: op.deviceId,
      entityType: op.entityType,
      entityId: op.entityId,
      operationType: op.operationType,
      data: op.data as any,
      hlcTimestamp: op.hlcTimestamp,
      version: op.version ?? 1,
      status,
      conflictWith: conflict?.losingOp.operationId ?? null,
      resolvedData: conflict ? (finalData as any) : null,
      sessionId,
    },
  });

  // ── Apply to database ──────────────────────────────────────
  const applier = entityAppliers[op.entityType];
  if (applier) {
    try {
      await applier(op.entityId, op.operationType, finalData);
    } catch (error) {
      // Non-fatal: the operation is still stored, just failed to apply
      console.error(`Failed to apply ${op.entityType} operation:`, error);
    }
  }

  return { status: status === 'CONFLICT' ? 'CONFLICT' : 'ACCEPTED', conflict };
}

// ─── Find Missing Operations ─────────────────────────────────

async function findMissingOperations(
  deviceId: string,
  knownOperationIds: string[],
  lastSyncTimestamp: string,
  unitId?: string,
) {
  // Find operations the device doesn't have
  const where: Record<string, unknown> = {
    deviceId: { not: deviceId },       // Not from this device
    status: { in: ['ACCEPTED', 'CONFLICT'] }, // Only successful ops
  };

  // If device provided known IDs, exclude those
  if (knownOperationIds.length > 0) {
    where.operationId = { notIn: knownOperationIds };
  }

  // If there's a last sync timestamp, only get ops after it
  if (lastSyncTimestamp && lastSyncTimestamp !== '000000000-0000-') {
    // Use createdAt as a proxy — HLC strings aren't directly queryable in Prisma
    const hlc = hlcFromString(lastSyncTimestamp);
    where.createdAt = { gt: new Date(hlc.ts) };
  }

  return prisma.syncOperation.findMany({
    where: where as any,
    orderBy: { createdAt: 'asc' },
    take: 500, // Batch limit
  });
}

// ─── Entity Appliers ─────────────────────────────────────────

async function applyAssetOperation(
  entityId: string,
  opType: string,
  data: Record<string, unknown>,
) {
  if (opType === 'DELETE') {
    await prisma.asset.update({
      where: { id: entityId },
      data: { status: 'DECOMMISSIONED', version: { increment: 1 } },
    }).catch(() => {}); // May not exist
    return;
  }

  const { id, unit, deployments, incidents, createdAt, updatedAt, ...assetData } = data as any;

  if (opType === 'CREATE') {
    await prisma.asset.upsert({
      where: { id: entityId },
      create: { id: entityId, ...assetData, unitId: assetData.unitId || '' },
      update: { ...assetData, version: { increment: 1 } },
    });
  } else {
    await prisma.asset.update({
      where: { id: entityId },
      data: { ...assetData, version: { increment: 1 } },
    }).catch(() => {});
  }
}

async function applyPersonnelOperation(
  entityId: string,
  opType: string,
  data: Record<string, unknown>,
) {
  const { id, unit, rollCallEntries, deployments, incidents: _inc, createdAt, updatedAt, ...personnelData } = data as any;

  if (opType === 'CREATE') {
    await prisma.personnel.upsert({
      where: { id: entityId },
      create: { id: entityId, ...personnelData, unitId: personnelData.unitId || '' },
      update: { ...personnelData, version: { increment: 1 } },
    });
  } else if (opType === 'UPDATE') {
    await prisma.personnel.update({
      where: { id: entityId },
      data: { ...personnelData, version: { increment: 1 } },
    }).catch(() => {});
  }
}

async function applyIncidentOperation(
  entityId: string,
  opType: string,
  data: Record<string, unknown>,
) {
  const { id, reporter, unit: _u, personnel: _p, assets: _a, createdAt, updatedAt, ...incidentData } = data as any;

  if (opType === 'CREATE') {
    await prisma.incident.upsert({
      where: { id: entityId },
      create: {
        id: entityId,
        ...incidentData,
        reporterId: incidentData.reporterId || '',
      },
      update: { ...incidentData, version: { increment: 1 } },
    });
  } else if (opType === 'UPDATE') {
    await prisma.incident.update({
      where: { id: entityId },
      data: { ...incidentData, version: { increment: 1 } },
    }).catch(() => {});
  }
}

async function applyRollCallOperation(
  entityId: string,
  opType: string,
  data: Record<string, unknown>,
) {
  if (opType === 'CREATE') {
    const { entries, id, unit: _u, initiatedBy: _ib, createdAt, updatedAt, ...rollCallData } = data as any;

    await prisma.rollCall.upsert({
      where: { id: entityId },
      create: {
        id: entityId,
        ...rollCallData,
        unitId: rollCallData.unitId || '',
        initiatedById: rollCallData.initiatedById || '',
      },
      update: { ...rollCallData, version: { increment: 1 } },
    });

    // Apply entries using OR-Set semantics (upsert each)
    if (Array.isArray(entries)) {
      for (const entry of entries) {
        const { id: entryId, rollCall: _rc, personnel: _p, device: _d, createdAt: _ca, updatedAt: _ua, ...entryData } = entry;
        await prisma.rollCallEntry.upsert({
          where: {
            rollCallId_personnelId: {
              rollCallId: entityId,
              personnelId: entryData.personnelId,
            },
          },
          create: {
            rollCallId: entityId,
            ...entryData,
          },
          update: { ...entryData, version: { increment: 1 } },
        }).catch(() => {});
      }
    }
  }
}

async function applyChecklistOperation(
  entityId: string,
  opType: string,
  data: Record<string, unknown>,
) {
  const { id, template: _t, assignedTo: _at, createdAt, updatedAt, ...recordData } = data as any;

  if (opType === 'CREATE') {
    await prisma.checklistRecord.upsert({
      where: { id: entityId },
      create: { id: entityId, ...recordData, templateId: recordData.templateId || '' },
      update: { ...recordData, version: { increment: 1 } },
    });
  } else if (opType === 'UPDATE') {
    await prisma.checklistRecord.update({
      where: { id: entityId },
      data: { ...recordData, version: { increment: 1 } },
    }).catch(() => {});
  }
}

async function applyDeploymentOperation(
  entityId: string,
  opType: string,
  data: Record<string, unknown>,
) {
  const { id, asset: _a, assignedTo: _at, assignedBy: _ab, createdAt, updatedAt, ...deployData } = data as any;

  if (opType === 'CREATE') {
    await prisma.assetDeployment.upsert({
      where: { id: entityId },
      create: {
        id: entityId,
        ...deployData,
        assetId: deployData.assetId || '',
        assignedToId: deployData.assignedToId || '',
        assignedById: deployData.assignedById || '',
      },
      update: { ...deployData, version: { increment: 1 } },
    });
  } else if (opType === 'UPDATE') {
    await prisma.assetDeployment.update({
      where: { id: entityId },
      data: { ...deployData, version: { increment: 1 } },
    }).catch(() => {});
  }
}

// ─── Helper ──────────────────────────────────────────────────

function opToSyncOp(op: any): SyncOp {
  return {
    operationId: op.operationId,
    deviceId: op.deviceId,
    entityType: op.entityType,
    entityId: op.entityId,
    operationType: op.operationType,
    data: op.data as Record<string, unknown>,
    hlcTimestamp: op.hlcTimestamp,
    version: op.version,
  };
}

// ─── Sync Status & Recovery ──────────────────────────────────

export async function getDeviceSyncStatus(deviceId: string) {
  const device = await prisma.device.findUnique({ where: { id: deviceId } });
  if (!device) return null;

  const pendingOps = await prisma.syncOperation.count({
    where: { deviceId, status: 'PENDING' },
  });

  const lastSession = await prisma.syncSession.findFirst({
    where: { deviceId },
    orderBy: { startedAt: 'desc' },
  });

  const totalOps = await prisma.syncOperation.count({ where: { deviceId } });

  return {
    deviceId,
    lastSeenAt: device.lastSeenAt,
    lastSyncAt: device.lastSyncAt,
    pendingOperations: pendingOps,
    totalOperations: totalOps,
    syncFailureCount: device.syncFailureCount,
    lastSession: lastSession
      ? {
          id: lastSession.id,
          status: lastSession.status,
          startedAt: lastSession.startedAt,
          completedAt: lastSession.completedAt,
          operationsSent: lastSession.operationsSent,
          operationsRecv: lastSession.operationsRecv,
          conflictsFound: lastSession.conflictsFound,
          errorMessage: lastSession.errorMessage,
        }
      : null,
  };
}

export async function getDeviceSyncHistory(deviceId: string, limit = 20) {
  return prisma.syncSession.findMany({
    where: { deviceId },
    orderBy: { startedAt: 'desc' },
    take: limit,
  });
}

export async function getDevicePendingOps(deviceId: string) {
  return prisma.syncOperation.findMany({
    where: { deviceId, status: 'PENDING' },
    orderBy: { createdAt: 'asc' },
  });
}
