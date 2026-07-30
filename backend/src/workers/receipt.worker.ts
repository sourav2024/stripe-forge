import { Worker, Job } from 'bullmq';
import { redisConnection } from '../config/redis';
import { logger } from '../config/logger';
import { QUEUE_NAMES } from '../queues/queue.names';
import { jobLogRepository } from '../repositories/jobLog.repository';
import type { ReceiptJobData } from '../types/jobs';

// Consumer for the receipt queue. In this educational build we simulate
// generating and sending a receipt (a real system would render a PDF/email).
// JobLog is updated on each transition for dashboard visibility.

export function createReceiptWorker(): Worker<ReceiptJobData> {
  const worker = new Worker<ReceiptJobData>(
    QUEUE_NAMES.RECEIPT,
    async (job: Job<ReceiptJobData>) => {
      const { paymentId, merchantId, to, amount, currency } = job.data;
      logger.info(
        { paymentId, merchantId, to, amount, currency },
        'receipt generated and sent (simulated)',
      );
    },
    { connection: redisConnection, concurrency: 5 },
  );

  worker.on('active', (job) => {
    void jobLogRepository
      .upsertJobLog({
        queue: QUEUE_NAMES.RECEIPT,
        jobId: job.id ?? 'unknown',
        name: job.name,
        status: 'active',
        attempts: job.attemptsMade,
        merchantId: job.data.merchantId,
      })
      .catch((err) => logger.error({ err, jobId: job.id }, 'jobLog upsert failed (active)'));
  });

  worker.on('completed', (job) => {
    void jobLogRepository
      .upsertJobLog({
        queue: QUEUE_NAMES.RECEIPT,
        jobId: job.id ?? 'unknown',
        name: job.name,
        status: 'completed',
        attempts: job.attemptsMade,
        merchantId: job.data.merchantId,
        error: null,
      })
      .catch((err) => logger.error({ err, jobId: job.id }, 'jobLog upsert failed (completed)'));
  });

  worker.on('failed', (job, err) => {
    if (!job) return;
    const exhausted = job.attemptsMade >= (job.opts.attempts ?? 3);
    void jobLogRepository
      .upsertJobLog({
        queue: QUEUE_NAMES.RECEIPT,
        jobId: job.id ?? 'unknown',
        name: job.name,
        status: exhausted ? 'dead' : 'failed',
        attempts: job.attemptsMade,
        merchantId: job.data.merchantId,
        error: err.message,
      })
      .catch((e) => logger.error({ err: e, jobId: job.id }, 'jobLog upsert failed (failed)'));
  });

  return worker;
}
