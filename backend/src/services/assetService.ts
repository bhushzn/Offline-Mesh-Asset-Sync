// ============================================================
// TacSync Backend — Asset Service
// ============================================================

import { prisma } from '../config/database.js';
import { NotFoundError, ConflictError, ValidationError } from '../utils/errors.js';
import { recordAudit, computeChanges } from '../events/auditService.js';
import type { AssetCondition, AssetStatus, DeploymentStatus } from '@prisma/client';

export interface CreateAssetInput {
  name: string;
  serialNumber?: string;
  category: string;
  condition?: AssetCondition;
  status?: AssetStatus;
  unitId: string;
  location?: string;
  notes?: string;
  metadata?: Record<string, unknown>;
}

export interface UpdateAssetInput {
  name?: string;
  serialNumber?: string;
  category?: string;
  condition?: AssetCondition;
  status?: AssetStatus;
  location?: string;
  notes?: string;
  metadata?: Record<string, unknown>;
}

export interface CreateDeploymentInput {
  assetId: string;
  assignedToId: string;
  assignedById: string;
  location?: string;
  notes?: string;
}

// ── Assets ────────────────────────────────────────────────────

export async function createAsset(input: CreateAssetInput, userId: string, deviceId?: string) {
  const asset = await prisma.asset.create({ data: input as any });

  await recordAudit({
    userId,
    deviceId,
    entityType: 'Asset',
    entityId: asset.id,
    action: 'CREATE',
    metadata: { name: asset.name, category: asset.category },
  });

  return asset;
}

export async function getAssets(filters: {
  unitId?: string;
  category?: string;
  status?: AssetStatus;
  search?: string;
  skip?: number;
  take?: number;
}) {
  const where: Record<string, unknown> = {};
  if (filters.unitId) where.unitId = filters.unitId;
  if (filters.category) where.category = filters.category;
  if (filters.status) where.status = filters.status;
  if (filters.search) {
    where.OR = [
      { name: { contains: filters.search, mode: 'insensitive' } },
      { serialNumber: { contains: filters.search, mode: 'insensitive' } },
    ];
  }

  const [assets, total] = await Promise.all([
    prisma.asset.findMany({
      where: where as any,
      include: { unit: { select: { id: true, name: true } } },
      orderBy: { updatedAt: 'desc' },
      skip: filters.skip,
      take: filters.take,
    }),
    prisma.asset.count({ where: where as any }),
  ]);

  return { assets, total };
}

export async function getAssetById(id: string) {
  const asset = await prisma.asset.findUnique({
    where: { id },
    include: {
      unit: { select: { id: true, name: true } },
      deployments: {
        include: { assignedTo: true, assignedBy: { select: { id: true, name: true } } },
        orderBy: { deployedAt: 'desc' },
        take: 10,
      },
    },
  });
  if (!asset) throw new NotFoundError('Asset', id);
  return asset;
}

export async function updateAsset(id: string, input: UpdateAssetInput, userId: string, deviceId?: string) {
  const existing = await prisma.asset.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('Asset', id);

  const asset = await prisma.asset.update({
    where: { id },
    data: { ...(input as any), version: { increment: 1 } },
  });

  const changes = computeChanges(
    existing as unknown as Record<string, unknown>,
    asset as unknown as Record<string, unknown>,
    ['name', 'status', 'condition', 'location', 'category'],
  );

  await recordAudit({
    userId,
    deviceId,
    entityType: 'Asset',
    entityId: id,
    action: 'UPDATE',
    changes,
  });

  return asset;
}

export async function deleteAsset(id: string, userId: string, deviceId?: string) {
  const existing = await prisma.asset.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('Asset', id);

  // Soft delete — mark as decommissioned
  const asset = await prisma.asset.update({
    where: { id },
    data: { status: 'DECOMMISSIONED', version: { increment: 1 } },
  });

  await recordAudit({
    userId,
    deviceId,
    entityType: 'Asset',
    entityId: id,
    action: 'DELETE',
    metadata: { name: existing.name },
  });

  return asset;
}

// ── Deployments ───────────────────────────────────────────────

export async function createDeployment(input: CreateDeploymentInput, deviceId?: string) {
  // Validate asset exists and is available
  const asset = await prisma.asset.findUnique({ where: { id: input.assetId } });
  if (!asset) throw new NotFoundError('Asset', input.assetId);

  // Check for active deployment — prevent duplicate
  const activeDeployment = await prisma.assetDeployment.findFirst({
    where: { assetId: input.assetId, status: 'ACTIVE' },
  });
  if (activeDeployment) {
    throw new ConflictError(
      `Asset '${asset.name}' is already deployed (deployment ${activeDeployment.id})`,
      { existingDeploymentId: activeDeployment.id },
    );
  }

  // Validate personnel exists
  const personnel = await prisma.personnel.findUnique({ where: { id: input.assignedToId } });
  if (!personnel) throw new NotFoundError('Personnel', input.assignedToId);

  const [deployment] = await prisma.$transaction([
    prisma.assetDeployment.create({ data: input }),
    prisma.asset.update({
      where: { id: input.assetId },
      data: { status: 'DEPLOYED', version: { increment: 1 } },
    }),
  ]);

  await recordAudit({
    userId: input.assignedById,
    deviceId,
    entityType: 'AssetDeployment',
    entityId: deployment.id,
    action: 'CREATE',
    metadata: { assetId: input.assetId, assignedTo: personnel.name },
  });

  return deployment;
}

export async function getDeployments(filters: {
  assetId?: string;
  assignedToId?: string;
  status?: DeploymentStatus;
  skip?: number;
  take?: number;
}) {
  const where: Record<string, unknown> = {};
  if (filters.assetId) where.assetId = filters.assetId;
  if (filters.assignedToId) where.assignedToId = filters.assignedToId;
  if (filters.status) where.status = filters.status;

  const [deployments, total] = await Promise.all([
    prisma.assetDeployment.findMany({
      where: where as any,
      include: {
        asset: { select: { id: true, name: true, serialNumber: true } },
        assignedTo: { select: { id: true, name: true, callsign: true } },
        assignedBy: { select: { id: true, name: true } },
      },
      orderBy: { deployedAt: 'desc' },
      skip: filters.skip,
      take: filters.take,
    }),
    prisma.assetDeployment.count({ where: where as any }),
  ]);

  return { deployments, total };
}

export async function updateDeployment(
  id: string,
  data: { status?: DeploymentStatus; notes?: string; returnedAt?: Date },
  userId: string,
  deviceId?: string,
) {
  const existing = await prisma.assetDeployment.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('AssetDeployment', id);

  const deployment = await prisma.assetDeployment.update({
    where: { id },
    data: { ...data, version: { increment: 1 } },
  });

  // If returned, mark asset as available
  if (data.status === 'RETURNED' || data.status === 'LOST') {
    const newAssetStatus = data.status === 'LOST' ? 'LOST' as const : 'AVAILABLE' as const;
    await prisma.asset.update({
      where: { id: existing.assetId },
      data: { status: newAssetStatus, version: { increment: 1 } },
    });
  }

  await recordAudit({
    userId,
    deviceId,
    entityType: 'AssetDeployment',
    entityId: id,
    action: 'UPDATE',
    metadata: { status: data.status, assetId: existing.assetId },
  });

  return deployment;
}
