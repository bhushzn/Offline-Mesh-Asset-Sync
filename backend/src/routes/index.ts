// ============================================================
// TacSync Backend — Main Routes Registry
// ============================================================

import { FastifyInstance } from 'fastify';
import { authRoutes } from './authRoutes.js';
import { deviceRoutes } from './deviceRoutes.js';
import { assetRoutes } from './assetRoutes.js';
import { personnelRoutes } from './personnelRoutes.js';
import { rollCallRoutes } from './rollCallRoutes.js';
import { checklistRoutes } from './checklistRoutes.js';
import { incidentRoutes } from './incidentRoutes.js';
import { syncRoutes } from './syncRoutes.js';
import { healthRoutes } from './healthRoutes.js';

export async function registerRoutes(fastify: FastifyInstance): Promise<void> {
  // Top-level health endpoints (/health, /health/ready, /stats)
  await fastify.register(healthRoutes);

  // API v1 prefixed endpoints
  await fastify.register(
    async (v1) => {
      await v1.register(authRoutes, { prefix: '/auth' });
      await v1.register(deviceRoutes, { prefix: '/devices' });
      await v1.register(assetRoutes, { prefix: '/assets' });
      await v1.register(personnelRoutes, { prefix: '/personnel' });
      await v1.register(rollCallRoutes, { prefix: '/rollcalls' });
      await v1.register(checklistRoutes, { prefix: '/checklists' });
      await v1.register(incidentRoutes, { prefix: '/incidents' });
      await v1.register(syncRoutes, { prefix: '/sync' });
      await v1.register(healthRoutes, { prefix: '/health' });
    },
    { prefix: '/api/v1' },
  );
}
