// ============================================================
// TacSync Backend — Personnel Service
// ============================================================

import { prisma } from '../config/database.js';
import { NotFoundError } from '../utils/errors.js';
import { recordAudit, computeChanges } from '../events/auditService.js';
import type { PersonnelStatus } from '@prisma/client';

export interface CreatePersonnelInput {
  name: string;
  callsign?: string;
  role?: string;
  rank?: string;
  status?: PersonnelStatus;
  unitId: string;
  contactInfo?: Record<string, unknown>;
  notes?: string;
}

export interface UpdatePersonnelInput {
  name?: string;
  callsign?: string;
  role?: string;
  rank?: string;
  status?: PersonnelStatus;
  contactInfo?: Record<string, unknown>;
  notes?: string;
}

export async function createPersonnel(input: CreatePersonnelInput, userId: string, deviceId?: string) {
  const personnel = await prisma.personnel.create({ data: input as any });

  await recordAudit({
    userId,
    deviceId,
    entityType: 'Personnel',
    entityId: personnel.id,
    action: 'CREATE',
    metadata: { name: personnel.name, unitId: personnel.unitId },
  });

  return personnel;
}

export async function getPersonnel(filters: {
  unitId?: string;
  status?: PersonnelStatus;
  role?: string;
  search?: string;
  skip?: number;
  take?: number;
}) {
  const where: Record<string, unknown> = {};
  if (filters.unitId) where.unitId = filters.unitId;
  if (filters.status) where.status = filters.status;
  if (filters.role) where.role = filters.role;
  if (filters.search) {
    where.OR = [
      { name: { contains: filters.search, mode: 'insensitive' } },
      { callsign: { contains: filters.search, mode: 'insensitive' } },
    ];
  }

  const [personnel, total] = await Promise.all([
    prisma.personnel.findMany({
      where: where as any,
      include: { unit: { select: { id: true, name: true } } },
      orderBy: { name: 'asc' },
      skip: filters.skip,
      take: filters.take,
    }),
    prisma.personnel.count({ where: where as any }),
  ]);

  return { personnel, total };
}

export async function getPersonnelById(id: string) {
  const personnel = await prisma.personnel.findUnique({
    where: { id },
    include: {
      unit: { select: { id: true, name: true } },
      deployments: {
        include: { asset: { select: { id: true, name: true } } },
        where: { status: 'ACTIVE' },
      },
    },
  });
  if (!personnel) throw new NotFoundError('Personnel', id);
  return personnel;
}

export async function updatePersonnel(id: string, input: UpdatePersonnelInput, userId: string, deviceId?: string) {
  const existing = await prisma.personnel.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('Personnel', id);

  const personnel = await prisma.personnel.update({
    where: { id },
    data: { ...(input as any), version: { increment: 1 } },
  });

  const changes = computeChanges(
    existing as unknown as Record<string, unknown>,
    personnel as unknown as Record<string, unknown>,
    ['name', 'callsign', 'role', 'status', 'rank'],
  );

  await recordAudit({
    userId,
    deviceId,
    entityType: 'Personnel',
    entityId: id,
    action: 'UPDATE',
    changes,
  });

  return personnel;
}
