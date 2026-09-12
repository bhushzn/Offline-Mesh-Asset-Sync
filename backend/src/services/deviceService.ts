// ============================================================
// TacSync Backend — Device Service
// ============================================================

import { prisma } from '../config/database.js';
import { NotFoundError, ConflictError } from '../utils/errors.js';
import { recordAudit } from '../events/auditService.js';

export interface RegisterDeviceInput {
  deviceFingerprint: string;
  name?: string;
  userId: string;
  unitId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Register a new device or return existing one if fingerprint matches.
 */
export async function registerDevice(input: RegisterDeviceInput) {
  // Check for existing device with this fingerprint
  const existing = await prisma.device.findUnique({
    where: { deviceFingerprint: input.deviceFingerprint },
  });

  if (existing) {
    // Update last seen and re-associate with user if needed
    const updated = await prisma.device.update({
      where: { id: existing.id },
      data: {
        userId: input.userId,
        unitId: input.unitId ?? existing.unitId,
        name: input.name ?? existing.name,
        lastSeenAt: new Date(),
        status: 'ACTIVE',
        metadata: (input.metadata ?? existing.metadata ?? undefined) as any,
      },
      include: { user: { select: { id: true, name: true, email: true } }, unit: true },
    });

    return updated;
  }

  const device = await prisma.device.create({
    data: {
      deviceFingerprint: input.deviceFingerprint,
      name: input.name,
      userId: input.userId,
      unitId: input.unitId ?? null,
      metadata: (input.metadata ?? undefined) as any,
    },
    include: { user: { select: { id: true, name: true, email: true } }, unit: true },
  });

  await recordAudit({
    userId: input.userId,
    deviceId: device.id,
    entityType: 'Device',
    entityId: device.id,
    action: 'CREATE',
    metadata: { fingerprint: input.deviceFingerprint },
  });

  return device;
}

/**
 * Get all devices, optionally filtered by unit.
 */
export async function getDevices(unitId?: string) {
  return prisma.device.findMany({
    where: unitId ? { unitId } : undefined,
    include: { user: { select: { id: true, name: true, email: true } }, unit: true },
    orderBy: { lastSeenAt: 'desc' },
  });
}

/**
 * Get a single device by ID.
 */
export async function getDeviceById(id: string) {
  const device = await prisma.device.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, name: true, email: true } },
      unit: true,
    },
  });
  if (!device) throw new NotFoundError('Device', id);
  return device;
}

/**
 * Update device heartbeat (last seen).
 */
export async function touchDevice(deviceId: string) {
  return prisma.device.update({
    where: { id: deviceId },
    data: { lastSeenAt: new Date() },
  });
}
