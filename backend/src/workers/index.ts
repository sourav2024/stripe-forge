import { Worker } from 'bullmq';
import { logger } from '../config/logger';
import { prisma } from '../config/prisma';
import { redis } from '../config/redis';
import { closeQueues } from '../queues';
import { createWebhookWorker } from './webhook.worker';
import { createReceiptWorker } from './receipt.worker';
import { createEmailWorker } from './email.worker';

// Worker process entrypoint (npm run worker). Starts all queue consumers and
// installs a graceful shutdown so in-flight jobs finish and connections close
// cleanly on SIGTERM/SIGINT (e.g. container stop, Ctrl-C).

const workers: Worker[] = [createWebhookWorker(), createReceiptWorker(), createEmailWorker()];

for (const worker of workers) {
  worker.on('error', (err) => {
    logger.error({ err, queue: worker.name }, 'worker error');
  });
}

logger.info({ queues: workers.map((w) => w.name) }, 'workers ready');

let shuttingDown = false;

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, 'shutting down workers');

  try {
    // Stop pulling new jobs and wait for active ones to settle.
    await Promise.all(workers.map((w) => w.close()));
    await closeQueues();
    await prisma.$disconnect();
    // redis is lazyConnect; quit tolerates a never-opened connection.
    await redis.quit().catch(() => undefined);
    logger.info('workers shut down cleanly');
    process.exit(0);
  } catch (err) {
    logger.error({ err }, 'error during worker shutdown');
    process.exit(1);
  }
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
