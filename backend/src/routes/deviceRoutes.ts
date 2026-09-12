// ============================================================
// TacSync Backend — Device Routes
// ============================================================

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import * as deviceService from '../services/deviceService.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { ValidationError } from '../utils/errors.js';

const registerDeviceSchema = z.object({
  deviceFingerprint: z.string().min(4),
  name: z.string().optional(),
  unitId: z.string().uuid().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export async function deviceRoutes(fastify: FastifyInstance): Promise<void> {
  // Device registration (requires auth)
  fastify.post('/register', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const parseResult = registerDeviceSchema.safeParse(request.body);
    if (!parseResult.success) {
      throw new ValidationError(parseResult.error.errors.map(e => e.message).join(', '));
    }

    const device = await deviceService.registerDevice({
      ...parseResult.data,
      userId: request.user!.userId,
      unitId: parseResult.data.unitId ?? request.user!.unitId ?? undefined,
    });

    return reply.status(201).send({
      success: true,
      data: device,
      message: 'Device registered successfully',
    });
  });

  // List devices
  fastify.get('/', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as { unitId?: string };
    const devices = await deviceService.getDevices(query.unitId ?? request.user!.unitId ?? undefined);
    return reply.send({
      success: true,
      data: devices,
    });
  });

  // Get device by ID
  fastify.get('/:id', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const device = await deviceService.getDeviceById(id);
    return reply.send({
      success: true,
      data: device,
    });
  });

  // Heartbeat / Touch
  fastify.post('/:id/heartbeat', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const updated = await deviceService.touchDevice(id);
    return reply.send({
      success: true,
      data: { id: updated.id, lastSeenAt: updated.lastSeenAt },
    });
  });
}
