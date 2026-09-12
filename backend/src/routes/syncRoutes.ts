// ============================================================
// TacSync Backend — Sync Routes
// ============================================================

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import * as syncService from '../sync/syncService.js';
import { authenticate } from '../middleware/auth.js';
import { ValidationError } from '../utils/errors.js';
import { prisma } from '../config/database.js';
import { hlcNow, hlcToString } from '../crdt/index.js';

const syncOpSchema = z.object({
  operationId: z.string().uuid(),
  deviceId: z.string().min(1),
  entityType: z.string().min(1),
  entityId: z.string().min(1),
  operationType: z.enum(['CREATE', 'UPDATE', 'DELETE']),
  data: z.record(z.unknown()),
  hlcTimestamp: z.string().min(1),
  version: z.number().int().optional(),
});

const syncRequestSchema = z.object({
  deviceId: z.string().min(1),
  unitId: z.string().uuid().optional(),
  lastSyncTimestamp: z.string().default('0000000000000:0000:00000000'),
  knownOperationIds: z.array(z.string()).default([]),
  pendingOperations: z.array(syncOpSchema).default([]),
  crdtMetadata: z.object({
    entityVersions: z.record(z.number()).optional(),
  }).optional(),
});

export async function syncRoutes(fastify: FastifyInstance): Promise<void> {
  // ── Main Sync Endpoint ──────────────────────────────────────
  // Bidirectional sync: push device operations, receive server operations + conflict resolutions
  fastify.post('/', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const parseResult = syncRequestSchema.safeParse(request.body);
    if (!parseResult.success) {
      throw new ValidationError(parseResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', '));
    }

    const syncResponse = await syncService.processSync(
      parseResult.data,
      request.user!.userId,
    );

    return reply.send({
      success: true,
      data: syncResponse,
    });
  });

  // ── Device Sync Status ──────────────────────────────────────
  fastify.get('/status/:deviceId', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { deviceId } = request.params as { deviceId: string };
    const status = await syncService.getDeviceSyncStatus(deviceId);
    if (!status) {
      return reply.status(404).send({ success: false, message: 'Device not found' });
    }
    return reply.send({ success: true, data: status });
  });

  // ── Device Sync Session History ─────────────────────────────
  fastify.get('/history/:deviceId', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { deviceId } = request.params as { deviceId: string };
    const query = request.query as { limit?: string };
    const limit = Math.min(100, Math.max(1, parseInt(query.limit || '20', 10)));
    const history = await syncService.getDeviceSyncHistory(deviceId, limit);
    return reply.send({ success: true, data: history });
  });

  // ── Pending Operations for Device ───────────────────────────
  fastify.get('/pending/:deviceId', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { deviceId } = request.params as { deviceId: string };
    const pendingOps = await syncService.getDevicePendingOps(deviceId);
    return reply.send({ success: true, data: pendingOps });
  });

  // ── Full Recovery Snapshot ──────────────────────────────────
  // Used by freshly provisioned offline devices to bootstrap their local IndexedDB
  fastify.get('/snapshot', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as { unitId?: string };
    const unitId = query.unitId ?? request.user!.unitId ?? undefined;

    const [assets, personnel, rollCalls, checklistTemplates, incidents] = await Promise.all([
      prisma.asset.findMany({
        where: unitId ? { unitId } : undefined,
        include: { deployments: { where: { status: 'ACTIVE' } } },
      }),
      prisma.personnel.findMany({
        where: unitId ? { unitId } : undefined,
      }),
      prisma.rollCall.findMany({
        where: unitId ? { unitId } : undefined,
        include: { entries: true },
        take: 10,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.checklistTemplate.findMany({
        where: { isActive: true },
      }),
      prisma.incident.findMany({
        where: unitId ? { unitId } : undefined,
        include: { personnel: true, assets: true },
        take: 50,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const snapshotTimestamp = hlcToString(hlcNow());

    return reply.send({
      success: true,
      data: {
        snapshotTimestamp,
        unitId,
        assets,
        personnel,
        rollCalls,
        checklistTemplates,
        incidents,
      },
    });
  });
}
