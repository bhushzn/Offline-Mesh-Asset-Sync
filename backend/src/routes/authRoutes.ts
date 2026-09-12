// ============================================================
// TacSync Backend — Authentication Routes
// ============================================================

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import * as authService from '../services/authService.js';
import { authenticate } from '../middleware/auth.js';
import { ValidationError } from '../utils/errors.js';

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(2),
  role: z.enum(['ADMIN', 'COMMANDER', 'TEAM_LEADER', 'FIELD_OPERATOR', 'VIEWER']).optional(),
  unitId: z.string().uuid().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  deviceId: z.string().optional(),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

export async function authRoutes(fastify: FastifyInstance): Promise<void> {
  // Register
  fastify.post('/register', async (request: FastifyRequest, reply: FastifyReply) => {
    const parseResult = registerSchema.safeParse(request.body);
    if (!parseResult.success) {
      throw new ValidationError(parseResult.error.errors.map(e => e.message).join(', '));
    }

    const result = await authService.register(parseResult.data);
    return reply.status(201).send({
      success: true,
      data: result,
      message: 'User registered successfully',
    });
  });

  // Login
  fastify.post('/login', async (request: FastifyRequest, reply: FastifyReply) => {
    const parseResult = loginSchema.safeParse(request.body);
    if (!parseResult.success) {
      throw new ValidationError(parseResult.error.errors.map(e => e.message).join(', '));
    }

    const { email, password, deviceId } = parseResult.data;
    const ipAddress = request.ip;
    const userAgent = request.headers['user-agent'];

    const result = await authService.login(email, password, {
      deviceId,
      ipAddress,
      userAgent,
    });

    return reply.send({
      success: true,
      data: result,
      message: 'Login successful',
    });
  });

  // Refresh Token
  fastify.post('/refresh', async (request: FastifyRequest, reply: FastifyReply) => {
    const parseResult = refreshSchema.safeParse(request.body);
    if (!parseResult.success) {
      throw new ValidationError('Refresh token is required');
    }

    const result = await authService.refreshToken(parseResult.data.refreshToken);
    return reply.send({
      success: true,
      data: result,
      message: 'Token refreshed',
    });
  });

  // Me / Profile
  fastify.get('/me', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = request.user!.userId;
    const user = await authService.getUserProfile(userId);
    return reply.send({
      success: true,
      data: user,
    });
  });
}
