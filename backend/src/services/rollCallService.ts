// ============================================================
// TacSync Backend — Roll Call Service
// ============================================================

import { prisma } from '../config/database.js';
import { NotFoundError, ValidationError } from '../utils/errors.js';
import { recordAudit } from '../events/auditService.js';
import type { MusterStatus, RollCallStatus } from '@prisma/client';

export interface CreateRollCallInput {
  unitId: string;
  initiatedById: string;
  deviceId?: string;
  notes?: string;
  entries: {
    personnelId: string;
    status: MusterStatus;
    notes?: string;
    deviceId?: string;
  }[];
}

export async function createRollCall(input: CreateRollCallInput) {
  // Validate unit
  const unit = await prisma.unit.findUnique({ where: { id: input.unitId } });
  if (!unit) throw new NotFoundError('Unit', input.unitId);

  const rollCall = await prisma.rollCall.create({
    data: {
      unitId: input.unitId,
      initiatedById: input.initiatedById,
      deviceId: input.deviceId,
      notes: input.notes,
      status: input.entries.length > 0 ? 'COMPLETED' : 'IN_PROGRESS',
      completedAt: input.entries.length > 0 ? new Date() : null,
      entries: {
        create: input.entries.map((e) => ({
          personnelId: e.personnelId,
          status: e.status,
          notes: e.notes,
          deviceId: e.deviceId ?? input.deviceId,
          recordedAt: new Date(),
        })),
      },
    },
    include: {
      entries: {
        include: { personnel: { select: { id: true, name: true, callsign: true } } },
      },
      unit: { select: { id: true, name: true } },
      initiatedBy: { select: { id: true, name: true } },
    },
  });

  await recordAudit({
    userId: input.initiatedById,
    deviceId: input.deviceId,
    entityType: 'RollCall',
    entityId: rollCall.id,
    action: 'CREATE',
    metadata: {
      unitId: input.unitId,
      entryCount: input.entries.length,
      present: input.entries.filter((e) => e.status === 'PRESENT').length,
    },
  });

  return rollCall;
}

export async function getRollCalls(filters: {
  unitId?: string;
  status?: RollCallStatus;
  skip?: number;
  take?: number;
}) {
  const where: Record<string, unknown> = {};
  if (filters.unitId) where.unitId = filters.unitId;
  if (filters.status) where.status = filters.status;

  const [rollCalls, total] = await Promise.all([
    prisma.rollCall.findMany({
      where: where as any,
      include: {
        unit: { select: { id: true, name: true } },
        initiatedBy: { select: { id: true, name: true } },
        _count: { select: { entries: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: filters.skip,
      take: filters.take,
    }),
    prisma.rollCall.count({ where: where as any }),
  ]);

  return { rollCalls, total };
}

export async function getRollCallById(id: string) {
  const rollCall = await prisma.rollCall.findUnique({
    where: { id },
    include: {
      unit: { select: { id: true, name: true } },
      initiatedBy: { select: { id: true, name: true } },
      entries: {
        include: {
          personnel: { select: { id: true, name: true, callsign: true, role: true } },
        },
        orderBy: { recordedAt: 'asc' },
      },
    },
  });
  if (!rollCall) throw new NotFoundError('RollCall', id);
  return rollCall;
}
