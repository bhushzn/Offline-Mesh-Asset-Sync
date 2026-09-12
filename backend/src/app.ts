// ============================================================
// TacSync Backend — Fastify Application Setup
// ============================================================

import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { config } from './config/index.js';
import { errorHandler } from './middleware/errorHandler.js';
import { registerRoutes } from './routes/index.js';

import websocket from '@fastify/websocket';
import { signalingRoutes } from './routes/signalingRoutes.js';

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: config.LOG_LEVEL,
    },
  });

  // Global Error Handler
  app.setErrorHandler(errorHandler);

  // WebSocket support for P2P Mesh signaling
  await app.register(websocket);
  await app.register(signalingRoutes, { prefix: '/ws' });

  // Security Headers
  await app.register(helmet, {
    contentSecurityPolicy: false, // Swagger UI compatibility
  });

  // CORS
  await app.register(cors, {
    origin: config.CORS_ORIGIN.split(',').map((o) => o.trim()),
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-device-id', 'x-unit-id'],
    credentials: true,
  });

  // Rate Limiting
  await app.register(rateLimit, {
    max: config.RATE_LIMIT_MAX,
    timeWindow: config.RATE_LIMIT_WINDOW_MS,
  });

  // OpenAPI / Swagger Documentation
  await app.register(swagger, {
    openapi: {
      info: {
        title: 'TacSync API',
        description: 'Zero-Bandwidth Tactical Asset & Checklist Sync Backend API',
        version: '1.0.0',
      },
      servers: [
        {
          url: `http://${config.HOST === '0.0.0.0' ? 'localhost' : config.HOST}:${config.PORT}`,
          description: 'Development Server',
        },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
        },
      },
    },
  });

  await app.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: true,
    },
  });

  // Register All Routes
  await registerRoutes(app);

  return app;
}
