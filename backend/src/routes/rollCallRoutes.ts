// ============================================================
// TacSync Backend — Roll Call Routes
// ============================================================

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import * as rollCallService from '../services/rollCallService.js';
import { authenticate } from '../middleware/auth.js';
import { ValidationError, NotFoundError } from '../utils/errors.js';
import { prisma } from '../config/database.js';
import type { MusterStatus, RollCallStatus } from '@prisma/client';

const createRollCallSchema = z.object({
  unitId: z.string().uuid(),
  notes: z.string().optional(),
  entries: z.array(
    z.object({
      personnelId: z.string().uuid(),
      status: z.enum(['PRESENT', 'ABSENT', 'MISSING', 'INJURED', 'ON_MISSION', 'OTHER']),
      notes: z.string().optional(),
    }),
  ).default([]),
});

const updateEntrySchema = z.object({
  personnelId: z.string().uuid(),
  status: z.enum(['PRESENT', 'ABSENT', 'MISSING', 'INJURED', 'ON_MISSION', 'OTHER']),
  notes: z.string().optional(),
});

export async function rollCallRoutes(fastify: FastifyInstance): Promise<void> {
  // List roll calls
  fastify.get('/', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as {
      unitId?: string;
      status?: RollCallStatus;
      page?: string;
      limit?: string;
    };

    const page = Math.max(1, parseInt(query.page || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(query.limit || '20', 10)));
    const skip = (page - 1) * limit;

    const { rollCalls, total } = await rollCallService.getRollCalls({
      unitId: query.unitId ?? request.user!.unitId ?? undefined,
      status: query.status,
      skip,
      take: limit,
    });

    return reply.send({
      success: true,
      data: rollCalls,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  });

  // Get roll call details with entries
  fastify.get('/:id', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const rollCall = await rollCallService.getRollCallById(id);
    return reply.send({
      success: true,
      data: rollCall,
    });
  });

  // Create roll call
  fastify.post('/', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const parseResult = createRollCallSchema.safeParse(request.body);
    if (!parseResult.success) {
      throw new ValidationError(parseResult.error.errors.map(e => e.message).join(', '));
    }

    const deviceId = request.headers['x-device-id'] as string | undefined;
    const rollCall = await rollCallService.createRollCall({
      unitId: parseResult.data.unitId,
      initiatedById: request.user!.userId,
      deviceId,
      notes: parseResult.data.notes,
      entries: parseResult.data.entries,
    });

    return reply.status(201).send({
      success: true,
      data: rollCall,
      message: 'Roll call session created',
    });
  });

  // Update roll call status (e.g. COMPLETED, CANCELLED)
  fastify.patch('/:id/status', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const { status } = request.body as { status: RollCallStatus };

    const rollCall = await prisma.rollCall.update({
      where: { id },
      data: {
        status,
        completedAt: status === 'COMPLETED' ? new Date() : undefined,
        version: { increment: 1 },
      },
      include: {
        entries: { include: { personnel: true } },
      },
    });

    return reply.send({
      success: true,
      data: rollCall,
      message: 'Roll call status updated',
    });
  });

  // Record / update a personnel muster entry inside a roll call
  fastify.post('/:id/entries', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const parseResult = updateEntrySchema.safeParse(request.body);
    if (!parseResult.success) {
      throw new ValidationError(parseResult.error.errors.map(e => e.message).join(', '));
    }

    const deviceId = request.headers['x-device-id'] as string | undefined;

    const entry = await prisma.rollCallEntry.upsert({
      where: {
        rollCallId_personnelId: {
          rollCallId: id,
          personnelId: parseResult.data.personnelId,
        },
      },
      create: {
        rollCallId: id,
        personnelId: parseResult.data.personnelId,
        status: parseResult.data.status,
        notes: parseResult.data.notes,
        deviceId,
      },
      update: {
        status: parseResult.data.status,
        notes: parseResult.data.notes,
        deviceId,
        recordedAt: new Date(),
        version: { increment: 1 },
      },
      include: { personnel: { select: { id: true, name: true, callsign: true } } },
    });

    return reply.send({
      success: true,
      data: entry,
      message: 'Muster entry recorded',
    });
  });
}
