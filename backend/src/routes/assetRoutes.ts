// ============================================================
// TacSync Backend — Asset Routes
// ============================================================

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import * as assetService from '../services/assetService.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { ValidationError } from '../utils/errors.js';
import type { AssetCondition, AssetStatus, DeploymentStatus } from '@prisma/client';

const createAssetSchema = z.object({
  name: z.string().min(1),
  serialNumber: z.string().optional(),
  category: z.string().min(1),
  condition: z.enum(['SERVICEABLE', 'UNSERVICEABLE', 'DAMAGED', 'LOST', 'UNDER_REPAIR']).optional(),
  status: z.enum(['AVAILABLE', 'DEPLOYED', 'MAINTENANCE', 'LOST', 'DECOMMISSIONED']).optional(),
  unitId: z.string().uuid(),
  location: z.string().optional(),
  notes: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

const updateAssetSchema = z.object({
  name: z.string().min(1).optional(),
  serialNumber: z.string().optional(),
  category: z.string().optional(),
  condition: z.enum(['SERVICEABLE', 'UNSERVICEABLE', 'DAMAGED', 'LOST', 'UNDER_REPAIR']).optional(),
  status: z.enum(['AVAILABLE', 'DEPLOYED', 'MAINTENANCE', 'LOST', 'DECOMMISSIONED']).optional(),
  location: z.string().optional(),
  notes: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

const deployAssetSchema = z.object({
  assignedToId: z.string().uuid(),
  location: z.string().optional(),
  notes: z.string().optional(),
});

const updateDeploymentSchema = z.object({
  status: z.enum(['ACTIVE', 'RETURNED', 'TRANSFERRED', 'LOST']).optional(),
  notes: z.string().optional(),
  returnedAt: z.string().datetime().optional(),
});

export async function assetRoutes(fastify: FastifyInstance): Promise<void> {
  // List assets
  fastify.get('/', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as {
      unitId?: string;
      category?: string;
      status?: AssetStatus;
      search?: string;
      page?: string;
      limit?: string;
    };

    const page = Math.max(1, parseInt(query.page || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(query.limit || '20', 10)));
    const skip = (page - 1) * limit;

    const { assets, total } = await assetService.getAssets({
      unitId: query.unitId ?? request.user!.unitId ?? undefined,
      category: query.category,
      status: query.status,
      search: query.search,
      skip,
      take: limit,
    });

    return reply.send({
      success: true,
      data: assets,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  });

  // Get asset by ID
  fastify.get('/:id', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const asset = await assetService.getAssetById(id);
    return reply.send({
      success: true,
      data: asset,
    });
  });

  // Create asset
  fastify.post('/', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const parseResult = createAssetSchema.safeParse(request.body);
    if (!parseResult.success) {
      throw new ValidationError(parseResult.error.errors.map(e => e.message).join(', '));
    }

    const deviceId = request.headers['x-device-id'] as string | undefined;
    const asset = await assetService.createAsset(parseResult.data, request.user!.userId, deviceId);

    return reply.status(201).send({
      success: true,
      data: asset,
      message: 'Asset created successfully',
    });
  });

  // Update asset
  fastify.patch('/:id', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const parseResult = updateAssetSchema.safeParse(request.body);
    if (!parseResult.success) {
      throw new ValidationError(parseResult.error.errors.map(e => e.message).join(', '));
    }

    const deviceId = request.headers['x-device-id'] as string | undefined;
    const asset = await assetService.updateAsset(id, parseResult.data, request.user!.userId, deviceId);

    return reply.send({
      success: true,
      data: asset,
      message: 'Asset updated successfully',
    });
  });

  // Delete / decommission asset
  fastify.delete('/:id', { preHandler: [authenticate, authorize(['ADMIN', 'COMMANDER'])] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const deviceId = request.headers['x-device-id'] as string | undefined;
    const asset = await assetService.deleteAsset(id, request.user!.userId, deviceId);

    return reply.send({
      success: true,
      data: asset,
      message: 'Asset decommissioned',
    });
  });

  // Deploy asset
  fastify.post('/:id/deploy', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const parseResult = deployAssetSchema.safeParse(request.body);
    if (!parseResult.success) {
      throw new ValidationError(parseResult.error.errors.map(e => e.message).join(', '));
    }

    const deviceId = request.headers['x-device-id'] as string | undefined;
    const deployment = await assetService.createDeployment(
      {
        assetId: id,
        assignedToId: parseResult.data.assignedToId,
        assignedById: request.user!.userId,
        location: parseResult.data.location,
        notes: parseResult.data.notes,
      },
      deviceId,
    );

    return reply.status(201).send({
      success: true,
      data: deployment,
      message: 'Asset deployed successfully',
    });
  });

  // List deployments
  fastify.get('/deployments/list', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as {
      assetId?: string;
      assignedToId?: string;
      status?: DeploymentStatus;
      page?: string;
      limit?: string;
    };

    const page = Math.max(1, parseInt(query.page || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(query.limit || '20', 10)));
    const skip = (page - 1) * limit;

    const { deployments, total } = await assetService.getDeployments({
      assetId: query.assetId,
      assignedToId: query.assignedToId,
      status: query.status,
      skip,
      take: limit,
    });

    return reply.send({
      success: true,
      data: deployments,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  });

  // Update deployment (e.g. Return)
  fastify.patch('/deployments/:deploymentId', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { deploymentId } = request.params as { deploymentId: string };
    const parseResult = updateDeploymentSchema.safeParse(request.body);
    if (!parseResult.success) {
      throw new ValidationError(parseResult.error.errors.map(e => e.message).join(', '));
    }

    const deviceId = request.headers['x-device-id'] as string | undefined;
    const deployment = await assetService.updateDeployment(
      deploymentId,
      {
        status: parseResult.data.status,
        notes: parseResult.data.notes,
        returnedAt: parseResult.data.returnedAt ? new Date(parseResult.data.returnedAt) : undefined,
      },
      request.user!.userId,
      deviceId,
    );

    return reply.send({
      success: true,
      data: deployment,
      message: 'Deployment updated',
    });
  });
}
