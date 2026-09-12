// ============================================================
// TacSync Backend — Incident Service
// ============================================================

import { prisma } from '../config/database.js';
import { NotFoundError } from '../utils/errors.js';
import { recordAudit, computeChanges } from '../events/auditService.js';
import type { IncidentSeverity, IncidentStatus } from '@prisma/client';

export interface CreateIncidentInput {
  type: string;
  severity?: IncidentSeverity;
  title: string;
  description: string;
  location?: string;
  reporterId: string;
  unitId?: string;
  deviceId?: string;
  metadata?: Record<string, unknown>;
  personnelIds?: string[];
  assetIds?: string[];
}

export interface UpdateIncidentInput {
  type?: string;
  severity?: IncidentSeverity;
  title?: string;
  description?: string;
  location?: string;
  status?: IncidentStatus;
  metadata?: Record<string, unknown>;
  personnelIds?: string[];
  assetIds?: string[];
}

export async function createIncident(input: CreateIncidentInput) {
  const { personnelIds, assetIds, metadata, ...rest } = input;
  const incident = await prisma.incident.create({
    data: {
      ...rest,
      severity: input.severity || 'SEV3_MODERATE',
      metadata: (metadata ?? undefined) as any,
      personnel: personnelIds
        ? { create: personnelIds.map((pid) => ({ personnelId: pid })) }
        : undefined,
      assets: assetIds
        ? { create: assetIds.map((aid) => ({ assetId: aid })) }
        : undefined,
    },
    include: {
      reporter: { select: { id: true, name: true } },
      personnel: { include: { personnel: { select: { id: true, name: true, callsign: true } } } },
      assets: { include: { asset: { select: { id: true, name: true, serialNumber: true } } } },
    },
  });

  await recordAudit({
    userId: input.reporterId,
    deviceId: input.deviceId,
    entityType: 'Incident',
    entityId: incident.id,
    action: 'CREATE',
    metadata: { type: input.type, severity: incident.severity, title: input.title },
  });

  return incident;
}

export async function getIncidents(filters: {
  unitId?: string;
  severity?: IncidentSeverity;
  status?: IncidentStatus;
  type?: string;
  search?: string;
  skip?: number;
  take?: number;
}) {
  const where: Record<string, unknown> = {};
  if (filters.unitId) where.unitId = filters.unitId;
  if (filters.severity) where.severity = filters.severity;
  if (filters.status) where.status = filters.status;
  if (filters.type) where.type = filters.type;
  if (filters.search) {
    where.OR = [
      { title: { contains: filters.search, mode: 'insensitive' } },
      { description: { contains: filters.search, mode: 'insensitive' } },
    ];
  }

  const [incidents, total] = await Promise.all([
    prisma.incident.findMany({
      where: where as any,
      include: {
        reporter: { select: { id: true, name: true } },
        _count: { select: { personnel: true, assets: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: filters.skip,
      take: filters.take,
    }),
    prisma.incident.count({ where: where as any }),
  ]);

  return { incidents, total };
}

export async function getIncidentById(id: string) {
  const incident = await prisma.incident.findUnique({
    where: { id },
    include: {
      reporter: { select: { id: true, name: true } },
      unit: { select: { id: true, name: true } },
      personnel: {
        include: { personnel: { select: { id: true, name: true, callsign: true } } },
      },
      assets: {
        include: { asset: { select: { id: true, name: true, serialNumber: true } } },
      },
    },
  });
  if (!incident) throw new NotFoundError('Incident', id);
  return incident;
}

export async function updateIncident(id: string, input: UpdateIncidentInput, userId: string, deviceId?: string) {
  const existing = await prisma.incident.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('Incident', id);

  // Update relations if provided
  if (input.personnelIds) {
    await prisma.incidentPersonnel.deleteMany({ where: { incidentId: id } });
  }
  if (input.assetIds) {
    await prisma.incidentAsset.deleteMany({ where: { incidentId: id } });
  }

  const { personnelIds, assetIds, metadata, ...updateData } = input;

  const incident = await prisma.incident.update({
    where: { id },
    data: {
      ...updateData,
      metadata: metadata !== undefined ? (metadata as any) : undefined,
      resolvedAt: input.status === 'RESOLVED' || input.status === 'CLOSED' ? new Date() : undefined,
      version: { increment: 1 },
      personnel: personnelIds
        ? { create: personnelIds.map((pid) => ({ personnelId: pid })) }
        : undefined,
      assets: assetIds
        ? { create: assetIds.map((aid) => ({ assetId: aid })) }
        : undefined,
    },
    include: {
      reporter: { select: { id: true, name: true } },
      personnel: { include: { personnel: { select: { id: true, name: true, callsign: true } } } },
      assets: { include: { asset: { select: { id: true, name: true } } } },
    },
  });

  const changes = computeChanges(
    existing as unknown as Record<string, unknown>,
    incident as unknown as Record<string, unknown>,
    ['type', 'severity', 'status', 'title', 'description', 'location'],
  );

  await recordAudit({
    userId,
    deviceId,
    entityType: 'Incident',
    entityId: id,
    action: 'UPDATE',
    changes,
  });

  return incident;
}

export async function deleteIncident(id: string, userId: string, deviceId?: string) {
  const existing = await prisma.incident.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('Incident', id);

  // Soft delete — set status to CLOSED
  const incident = await prisma.incident.update({
    where: { id },
    data: { status: 'CLOSED', version: { increment: 1 } },
  });

  await recordAudit({
    userId,
    deviceId,
    entityType: 'Incident',
    entityId: id,
    action: 'DELETE',
    metadata: { title: existing.title },
  });

  return incident;
}
