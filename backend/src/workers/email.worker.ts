import { Worker, Job } from 'bullmq';
import { redisConnection } from '../config/redis';
import { logger } from '../config/logger';
import { QUEUE_NAMES } from '../queues/queue.names';
import { jobLogRepository } from '../repositories/jobLog.repository';
import type { EmailJobData } from '../types/jobs';

// Consumer for the email queue. Simulates sending a transactional email; a real
// system would call an ESP (SES/SendGrid). JobLog is updated per transition.

export function createEmailWorker(): Worker<EmailJobData> {
  const worker = new Worker<EmailJobData>(
    QUEUE_NAMES.EMAIL,
    async (job: Job<EmailJobData>) => {
      const { to, subject } = job.data;
      logger.info({ to, subject }, 'email sent (simulated)');
    },
    { connection: redisConnection, concurrency: 5 },
  );

  // Email is platform-level (no merchant association), so JobLog.merchantId is
  // left null for these rows.
  worker.on('active', (job) => {
    void jobLogRepository
      .upsertJobLog({
        queue: QUEUE_NAMES.EMAIL,
        jobId: job.id ?? 'unknown',
        name: job.name,
        status: 'active',
        attempts: job.attemptsMade,
      })
      .catch((err) => logger.error({ err, jobId: job.id }, 'jobLog upsert failed (active)'));
  });

  worker.on('completed', (job) => {
    void jobLogRepository
      .upsertJobLog({
        queue: QUEUE_NAMES.EMAIL,
        jobId: job.id ?? 'unknown',
        name: job.name,
        status: 'completed',
        attempts: job.attemptsMade,
        error: null,
      })
      .catch((err) => logger.error({ err, jobId: job.id }, 'jobLog upsert failed (completed)'));
  });

  worker.on('failed', (job, err) => {
    if (!job) return;
    const exhausted = job.attemptsMade >= (job.opts.attempts ?? 3);
    void jobLogRepository
      .upsertJobLog({
        queue: QUEUE_NAMES.EMAIL,
        jobId: job.id ?? 'unknown',
        name: job.name,
        status: exhausted ? 'dead' : 'failed',
        attempts: job.attemptsMade,
        error: err.message,
      })
      .catch((e) => logger.error({ err: e, jobId: job.id }, 'jobLog upsert failed (failed)'));
  });

  return worker;
}
