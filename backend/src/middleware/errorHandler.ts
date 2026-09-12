// ============================================================
// TacSync Backend — Error Handler Plugin
// ============================================================

import { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { AppError, formatErrorResponse } from '../utils/errors.js';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';

/**
 * Global error handler for Fastify.
 */
export function errorHandler(
  error: FastifyError | Error,
  request: FastifyRequest,
  reply: FastifyReply,
): void {
  request.log.error(error);

  // AppError — our custom errors
  if (error instanceof AppError) {
    reply.status(error.statusCode).send(formatErrorResponse(error));
    return;
  }

  // Zod validation errors
  if (error instanceof ZodError) {
    const appError = new AppError(400, 'VALIDATION_ERROR', 'Invalid request data', {
      issues: error.issues.map((i) => ({
        path: i.path.join('.'),
        message: i.message,
      })),
    });
    reply.status(400).send(formatErrorResponse(appError));
    return;
  }

  // Prisma known errors
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case 'P2002': {
        const target = (error.meta?.target as string[])?.join(', ') || 'field';
        const appError = new AppError(409, 'DUPLICATE', `Duplicate value for: ${target}`);
        reply.status(409).send(formatErrorResponse(appError));
        return;
      }
      case 'P2025': {
        const appError = new AppError(404, 'NOT_FOUND', 'Record not found');
        reply.status(404).send(formatErrorResponse(appError));
        return;
      }
      default: {
        const appError = new AppError(400, 'DATABASE_ERROR', 'Database operation failed');
        reply.status(400).send(formatErrorResponse(appError));
        return;
      }
    }
  }

  // Fastify validation errors
  if ('validation' in error && error.validation) {
    const appError = new AppError(400, 'VALIDATION_ERROR', error.message);
    reply.status(400).send(formatErrorResponse(appError));
    return;
  }

  // Unknown errors
  const appError = new AppError(
    500,
    'INTERNAL_ERROR',
    process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message,
  );
  reply.status(500).send(formatErrorResponse(appError));
}
