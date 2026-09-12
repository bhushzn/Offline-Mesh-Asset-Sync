// ============================================================
// TacSync Backend — Incident Routes
// ============================================================

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import * as incidentService from '../services/incidentService.js';
import { authenticate } from '../middleware/auth.js';
import { ValidationError } from '../utils/errors.js';
import type { IncidentSeverity, IncidentStatus } from '@prisma/client';

const createIncidentSchema = z.object({
  type: z.string().min(1),
  severity: z.enum(['SEV1_MINOR', 'SEV2_LOW', 'SEV3_MODERATE', 'SEV4_HIGH', 'SEV5_CRITICAL']).optional(),
  title: z.string().min(1),
  description: z.string().min(1),
  location: z.string().optional(),
  unitId: z.string().uuid().optional(),
  metadata: z.record(z.unknown()).optional(),
  personnelIds: z.array(z.string().uuid()).optional(),
  assetIds: z.array(z.string().uuid()).optional(),
});

const updateIncidentSchema = z.object({
  type: z.string().optional(),
  severity: z.enum(['SEV1_MINOR', 'SEV2_LOW', 'SEV3_MODERATE', 'SEV4_HIGH', 'SEV5_CRITICAL']).optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  location: z.string().optional(),
  status: z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']).optional(),
  metadata: z.record(z.unknown()).optional(),
  personnelIds: z.array(z.string().uuid()).optional(),
  assetIds: z.array(z.string().uuid()).optional(),
});

export async function incidentRoutes(fastify: FastifyInstance): Promise<void> {
  // List incidents
  fastify.get('/', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as {
      unitId?: string;
      severity?: IncidentSeverity;
      status?: IncidentStatus;
      type?: string;
      search?: string;
      page?: string;
      limit?: string;
    };

    const page = Math.max(1, parseInt(query.page || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(query.limit || '20', 10)));
    const skip = (page - 1) * limit;

    const { incidents, total } = await incidentService.getIncidents({
      unitId: query.unitId ?? request.user!.unitId ?? undefined,
      severity: query.severity,
      status: query.status,
      type: query.type,
      search: query.search,
      skip,
      take: limit,
    });

    return reply.send({
      success: true,
      data: incidents,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  });

  // Get incident by ID
  fastify.get('/:id', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const incident = await incidentService.getIncidentById(id);
    return reply.send({
      success: true,
      data: incident,
    });
  });

  // Create incident
  fastify.post('/', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const parseResult = createIncidentSchema.safeParse(request.body);
    if (!parseResult.success) {
      throw new ValidationError(parseResult.error.errors.map(e => e.message).join(', '));
    }

    const deviceId = request.headers['x-device-id'] as string | undefined;
    const incident = await incidentService.createIncident({
      ...parseResult.data,
      reporterId: request.user!.userId,
      unitId: parseResult.data.unitId ?? request.user!.unitId ?? undefined,
      deviceId,
    });

    return reply.status(201).send({
      success: true,
      data: incident,
      message: 'Incident reported successfully',
    });
  });

  // Update incident
  fastify.patch('/:id', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const parseResult = updateIncidentSchema.safeParse(request.body);
    if (!parseResult.success) {
      throw new ValidationError(parseResult.error.errors.map(e => e.message).join(', '));
    }

    const deviceId = request.headers['x-device-id'] as string | undefined;
    const incident = await incidentService.updateIncident(id, parseResult.data, request.user!.userId, deviceId);

    return reply.send({
      success: true,
      data: incident,
      message: 'Incident updated successfully',
    });
  });

  // Close / delete incident
  fastify.delete('/:id', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const deviceId = request.headers['x-device-id'] as string | undefined;
    const incident = await incidentService.deleteIncident(id, request.user!.userId, deviceId);

    return reply.send({
      success: true,
      data: incident,
      message: 'Incident closed',
    });
  });
}
