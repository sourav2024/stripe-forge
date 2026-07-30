import http from 'node:http';
import { app } from './app';
import { env } from './config/env';
import { logger } from './config/logger';
import { prisma } from './config/prisma';
import { redis } from './config/redis';
import { closeQueues } from './queues';

const server = http.createServer(app);

server.listen(env.PORT, () => {
  logger.info({ port: env.PORT, env: env.NODE_ENV }, 'StripeForge API listening');
});

// Ensure a slow/stuck shutdown never hangs the process indefinitely.
const SHUTDOWN_TIMEOUT_MS = 10_000;
let shuttingDown = false;

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, 'shutting down gracefully');

  const forceExit = setTimeout(() => {
    logger.error('graceful shutdown timed out, forcing exit');
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);
  forceExit.unref();

  // Stop accepting new connections first, then release downstream resources.
  server.close(async () => {
    try {
      // Drain BullMQ producer connections too, otherwise their Redis sockets
      // leak on every deploy and enqueues in flight are lost abruptly.
      await closeQueues();
      await prisma.$disconnect();
      await redis.quit();
      logger.info('shutdown complete');
      clearTimeout(forceExit);
      process.exit(0);
    } catch (err) {
      logger.error({ err }, 'error during shutdown');
      process.exit(1);
    }
  });
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

// A rejected promise or thrown error that escapes all handlers leaves the
// process in an unknown state — log loudly and exit NON-ZERO so an orchestrator
// treats it as a crash (not a clean exit) and restarts a fresh instance.
async function crash(reason: string, detail: unknown): Promise<void> {
  logger.fatal({ reason, detail }, 'fatal error, crashing');
  try {
    await closeQueues();
    await prisma.$disconnect();
    await redis.quit();
  } catch (err) {
    logger.error({ err }, 'error while draining after crash');
  } finally {
    process.exit(1);
  }
}

process.on('unhandledRejection', (reason) => {
  void crash('unhandledRejection', reason);
});

process.on('uncaughtException', (err) => {
  void crash('uncaughtException', err);
});

export { server };
