// ============================================================
// TacSync Backend — Authentication Service
// ============================================================

import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/database.js';
import { config } from '../config/env.js';
import { AppError, UnauthorizedError, ConflictError, NotFoundError } from '../utils/errors.js';
import { recordAudit } from '../events/auditService.js';
import type { Role } from '@prisma/client';
import type { JwtPayload } from '../middleware/auth.js';

export interface RegisterInput {
  email: string;
  password: string;
  name: string;
  role?: Role;
  unitId?: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: Role;
    unitId: string | null;
  };
}

/**
 * Register a new user.
 */
export async function registerUser(input: RegisterInput): Promise<AuthTokens> {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    throw new ConflictError(`User with email '${input.email}' already exists`);
  }

  // Verify unit exists if provided
  if (input.unitId) {
    const unit = await prisma.unit.findUnique({ where: { id: input.unitId } });
    if (!unit) throw new NotFoundError('Unit', input.unitId);
  }

  const passwordHash = await bcrypt.hash(input.password, config.BCRYPT_SALT_ROUNDS);

  const user = await prisma.user.create({
    data: {
      email: input.email,
      passwordHash,
      name: input.name,
      role: input.role || 'FIELD_OPERATOR',
      unitId: input.unitId || null,
    },
  });

  await recordAudit({
    userId: user.id,
    entityType: 'User',
    entityId: user.id,
    action: 'CREATE',
    metadata: { email: user.email, role: user.role },
  });

  return generateTokens(user);
}

/**
 * Login with email and password.
 */
export async function loginUser(input: LoginInput): Promise<AuthTokens> {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user || !user.isActive) {
    throw new UnauthorizedError('Invalid email or password');
  }

  const valid = await bcrypt.compare(input.password, user.passwordHash);
  if (!valid) {
    throw new UnauthorizedError('Invalid email or password');
  }

  await recordAudit({
    userId: user.id,
    entityType: 'User',
    entityId: user.id,
    action: 'LOGIN',
  });

  return generateTokens(user);
}

/**
 * Refresh an access token.
 */
export async function refreshAccessToken(refreshToken: string): Promise<AuthTokens> {
  try {
    const payload = jwt.verify(refreshToken, config.JWT_REFRESH_SECRET) as JwtPayload;
    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user || !user.isActive) {
      throw new UnauthorizedError('User not found or inactive');
    }
    return generateTokens(user);
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new UnauthorizedError('Refresh token expired');
    }
    if (error instanceof AppError) throw error;
    throw new UnauthorizedError('Invalid refresh token');
  }
}

/**
 * Generate JWT access + refresh tokens.
 */
function generateTokens(user: {
  id: string;
  email: string;
  name: string;
  role: Role;
  unitId: string | null;
}): AuthTokens {
  const payload: JwtPayload = {
    userId: user.id,
    email: user.email,
    role: user.role,
    unitId: user.unitId,
  };

  const accessToken = jwt.sign(payload, config.JWT_SECRET, {
    expiresIn: config.JWT_EXPIRES_IN,
  } as jwt.SignOptions);

  const refreshToken = jwt.sign(payload, config.JWT_REFRESH_SECRET, {
    expiresIn: config.JWT_REFRESH_EXPIRES_IN,
  } as jwt.SignOptions);

  return {
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      unitId: user.unitId,
    },
  };
}

/**
 * Get user profile by ID.
 */
export async function getUserProfile(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      unitId: true,
      isActive: true,
      unit: { select: { id: true, name: true, callsign: true } },
      devices: { select: { id: true, name: true, lastSeenAt: true, status: true } },
      createdAt: true,
    },
  });

  if (!user) throw new NotFoundError('User', userId);
  return user;
}

// Aliases for route handlers
export const register = registerUser;
export const login = (email: string, password: string, _opts?: Record<string, unknown>) =>
  loginUser({ email, password });
export const refreshToken = refreshAccessToken;


