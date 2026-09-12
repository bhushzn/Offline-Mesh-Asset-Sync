// ============================================================
// TacSync Backend — Checklist Routes
// ============================================================

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import * as checklistService from '../services/checklistService.js';
import { authenticate } from '../middleware/auth.js';
import { ValidationError } from '../utils/errors.js';
import type { ChecklistStatus } from '@prisma/client';

const checklistItemDefSchema = z.object({
  id: z.string(),
  label: z.string().min(1),
  required: z.boolean().default(true),
  order: z.number().int().default(0),
});

const createTemplateSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  unitId: z.string().uuid().optional(),
  items: z.array(checklistItemDefSchema).min(1, 'At least one item is required'),
});

const updateTemplateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  items: z.array(checklistItemDefSchema).optional(),
});

const createRecordSchema = z.object({
  templateId: z.string().uuid(),
  assignedToId: z.string().uuid().optional(),
  deviceId: z.string().optional(),
});

const updateRecordSchema = z.object({
  entries: z.array(
    z.object({
      itemId: z.string(),
      checked: z.boolean(),
      checkedAt: z.string().optional(),
      checkedById: z.string().optional(),
    }),
  ).optional(),
  status: z.enum(['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED']).optional(),
  notes: z.string().optional(),
});

export async function checklistRoutes(fastify: FastifyInstance): Promise<void> {
  // ── Template Routes ─────────────────────────────────────────

  // List templates
  fastify.get('/templates', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as { unitId?: string; page?: string; limit?: string };
    const page = Math.max(1, parseInt(query.page || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(query.limit || '20', 10)));
    const skip = (page - 1) * limit;

    const { templates, total } = await checklistService.getTemplates({
      unitId: query.unitId ?? request.user!.unitId ?? undefined,
      skip,
      take: limit,
    });

    return reply.send({
      success: true,
      data: templates,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  });

  // Create template
  fastify.post('/templates', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const parseResult = createTemplateSchema.safeParse(request.body);
    if (!parseResult.success) {
      throw new ValidationError(parseResult.error.errors.map(e => e.message).join(', '));
    }

    const template = await checklistService.createTemplate(parseResult.data, request.user!.userId);
    return reply.status(201).send({
      success: true,
      data: template,
      message: 'Template created successfully',
    });
  });

  // Update template
  fastify.patch('/templates/:id', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const parseResult = updateTemplateSchema.safeParse(request.body);
    if (!parseResult.success) {
      throw new ValidationError(parseResult.error.errors.map(e => e.message).join(', '));
    }

    const template = await checklistService.updateTemplate(id, parseResult.data, request.user!.userId);
    return reply.send({
      success: true,
      data: template,
      message: 'Template updated successfully',
    });
  });

  // ── Record Routes ───────────────────────────────────────────

  // List records
  fastify.get('/records', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as {
      templateId?: string;
      assignedToId?: string;
      status?: ChecklistStatus;
      page?: string;
      limit?: string;
    };

    const page = Math.max(1, parseInt(query.page || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(query.limit || '20', 10)));
    const skip = (page - 1) * limit;

    const { records, total } = await checklistService.getRecords({
      templateId: query.templateId,
      assignedToId: query.assignedToId,
      status: query.status,
      skip,
      take: limit,
    });

    return reply.send({
      success: true,
      data: records,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  });

  // Create record (instantiate checklist)
  fastify.post('/records', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const parseResult = createRecordSchema.safeParse(request.body);
    if (!parseResult.success) {
      throw new ValidationError(parseResult.error.errors.map(e => e.message).join(', '));
    }

    const deviceId = request.headers['x-device-id'] as string | undefined;
    const record = await checklistService.createRecord(
      {
        templateId: parseResult.data.templateId,
        assignedToId: parseResult.data.assignedToId ?? request.user!.userId,
        deviceId: parseResult.data.deviceId ?? deviceId,
      },
      request.user!.userId,
    );

    return reply.status(201).send({
      success: true,
      data: record,
      message: 'Checklist instance created',
    });
  });

  // Update record (check items, change status)
  fastify.patch('/records/:id', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const parseResult = updateRecordSchema.safeParse(request.body);
    if (!parseResult.success) {
      throw new ValidationError(parseResult.error.errors.map(e => e.message).join(', '));
    }

    const record = await checklistService.updateRecord(id, parseResult.data, request.user!.userId);
    return reply.send({
      success: true,
      data: record,
      message: 'Checklist record updated',
    });
  });
}
