// ============================================================
// TacSync Backend — Health & Stats Routes
// ============================================================

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../config/database.js';

export async function healthRoutes(fastify: FastifyInstance): Promise<void> {
  // Liveness probe
  fastify.get('/health', async (request: FastifyRequest, reply: FastifyReply) => {
    return reply.send({
      status: 'ok',
      service: 'tacsync-backend',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  });

  // Readiness probe with DB ping
  fastify.get('/health/ready', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return reply.send({
        status: 'ready',
        database: 'connected',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Database error';
      return reply.status(503).send({
        status: 'unhealthy',
        database: 'disconnected',
        error: msg,
      });
    }
  });

  // Tactical operational overview / dashboard stats
  fastify.get('/stats', async (request: FastifyRequest, reply: FastifyReply) => {
    const [
      totalPersonnel,
      activePersonnel,
      totalAssets,
      deployedAssets,
      openIncidents,
      criticalIncidents,
      activeDevices,
      totalSyncSessions,
    ] = await Promise.all([
      prisma.personnel.count(),
      prisma.personnel.count({ where: { status: 'ACTIVE' } }),
      prisma.asset.count(),
      prisma.asset.count({ where: { status: 'DEPLOYED' } }),
      prisma.incident.count({ where: { status: { in: ['OPEN', 'IN_PROGRESS'] } } }),
      prisma.incident.count({ where: { status: { in: ['OPEN', 'IN_PROGRESS'] }, severity: 'SEV5_CRITICAL' } }),
      prisma.device.count({ where: { status: 'ACTIVE' } }),
      prisma.syncSession.count(),
    ]);

    return reply.send({
      success: true,
      data: {
        personnel: { total: totalPersonnel, active: activePersonnel },
        assets: { total: totalAssets, deployed: deployedAssets },
        incidents: { open: openIncidents, critical: criticalIncidents },
        mesh: { activeDevices, totalSyncSessions },
        timestamp: new Date().toISOString(),
      },
    });
  });
}
