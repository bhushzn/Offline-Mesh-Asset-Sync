// ============================================================
// TacSync Backend — Server Bootstrap
// ============================================================

import { buildApp } from './app.js';
import { config } from './config/index.js';
import { prisma } from './config/database.js';

async function start() {
  try {
    const app = await buildApp();

    // Graceful shutdown handlers
    const shutdown = async (signal: string) => {
      app.log.info(`Received ${signal}. Shutting down gracefully...`);
      try {
        await app.close();
        await prisma.$disconnect();
        app.log.info('Server and database connections closed.');
        process.exit(0);
      } catch (err) {
        app.log.error(err, 'Error during graceful shutdown');
        process.exit(1);
      }
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));

    // Start listening
    await app.listen({ port: config.PORT, host: config.HOST });
    app.log.info(`🚀 TacSync Backend running at http://${config.HOST}:${config.PORT}`);
    app.log.info(`📚 Swagger Documentation at http://${config.HOST}:${config.PORT}/docs`);
    app.log.info(`🩺 Health Check at http://${config.HOST}:${config.PORT}/health`);
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();
