// ============================================================
// TacSync Backend — Audit Event Service
// ============================================================
// Records immutable audit entries for every important operation.

import { prisma } from '../config/database.js';

export interface AuditEntry {
  userId?: string;
  deviceId?: string;
  entityType: string;
  entityId: string;
  action: string;
  changes?: Record<string, { old: unknown; new: unknown }> | null;
  metadata?: Record<string, unknown> | null;
  operationId?: string;
}

/**
 * Record an audit log entry. Fire-and-forget — never blocks the caller.
 */
export async function recordAudit(entry: AuditEntry): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: entry.userId ?? null,
        deviceId: entry.deviceId ?? null,
        entityType: entry.entityType,
        entityId: entry.entityId,
        action: entry.action,
        changes: (entry.changes ?? undefined) as any,
        metadata: (entry.metadata ?? undefined) as any,
        operationId: entry.operationId ?? null,
      },
    });
  } catch (error) {
    // Audit failures should never crash the application
    console.error('Audit log write failed:', error);
  }
}

/**
 * Compute a diff between old and new values for audit logging.
 */
export function computeChanges(
  oldVal: Record<string, unknown>,
  newVal: Record<string, unknown>,
  fields: string[],
): Record<string, { old: unknown; new: unknown }> | null {
  const changes: Record<string, { old: unknown; new: unknown }> = {};
  let hasChanges = false;

  for (const field of fields) {
    const o = oldVal[field];
    const n = newVal[field];
    if (JSON.stringify(o) !== JSON.stringify(n)) {
      changes[field] = { old: o, new: n };
      hasChanges = true;
    }
  }

  return hasChanges ? changes : null;
}
