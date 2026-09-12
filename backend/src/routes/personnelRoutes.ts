// ============================================================
// TacSync Backend — Personnel Routes
// ============================================================

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import * as personnelService from '../services/personnelService.js';
import { authenticate } from '../middleware/auth.js';
import { ValidationError } from '../utils/errors.js';
import type { PersonnelStatus } from '@prisma/client';

const createPersonnelSchema = z.object({
  name: z.string().min(1),
  callsign: z.string().optional(),
  role: z.string().optional(),
  rank: z.string().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'ON_LEAVE', 'DEPLOYED']).optional(),
  unitId: z.string().uuid(),
  contactInfo: z.record(z.unknown()).optional(),
  notes: z.string().optional(),
});

const updatePersonnelSchema = z.object({
  name: z.string().min(1).optional(),
  callsign: z.string().optional(),
  role: z.string().optional(),
  rank: z.string().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'ON_LEAVE', 'DEPLOYED']).optional(),
  contactInfo: z.record(z.unknown()).optional(),
  notes: z.string().optional(),
});

export async function personnelRoutes(fastify: FastifyInstance): Promise<void> {
  // List personnel
  fastify.get('/', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as {
      unitId?: string;
      status?: PersonnelStatus;
      role?: string;
      search?: string;
      page?: string;
      limit?: string;
    };

    const page = Math.max(1, parseInt(query.page || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(query.limit || '20', 10)));
    const skip = (page - 1) * limit;

    const { personnel, total } = await personnelService.getPersonnel({
      unitId: query.unitId ?? request.user!.unitId ?? undefined,
      status: query.status,
      role: query.role,
      search: query.search,
      skip,
      take: limit,
    });

    return reply.send({
      success: true,
      data: personnel,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  });

  // Get personnel by ID
  fastify.get('/:id', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const personnel = await personnelService.getPersonnelById(id);
    return reply.send({
      success: true,
      data: personnel,
    });
  });

  // Create personnel
  fastify.post('/', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const parseResult = createPersonnelSchema.safeParse(request.body);
    if (!parseResult.success) {
      throw new ValidationError(parseResult.error.errors.map(e => e.message).join(', '));
    }

    const deviceId = request.headers['x-device-id'] as string | undefined;
    const personnel = await personnelService.createPersonnel(parseResult.data, request.user!.userId, deviceId);

    return reply.status(201).send({
      success: true,
      data: personnel,
      message: 'Personnel created successfully',
    });
  });

  // Update personnel
  fastify.patch('/:id', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const parseResult = updatePersonnelSchema.safeParse(request.body);
    if (!parseResult.success) {
      throw new ValidationError(parseResult.error.errors.map(e => e.message).join(', '));
    }

    const deviceId = request.headers['x-device-id'] as string | undefined;
    const personnel = await personnelService.updatePersonnel(id, parseResult.data, request.user!.userId, deviceId);

    return reply.send({
      success: true,
      data: personnel,
      message: 'Personnel updated successfully',
    });
  });
}
