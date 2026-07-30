import { Worker, Job } from 'bullmq';
import { redisConnection } from '../config/redis';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { QUEUE_NAMES } from '../queues/queue.names';
import { webhookService } from '../services/webhook.service';
import { webhookDeliveryRepository } from '../repositories/webhook.repository';
import { jobLogRepository } from '../repositories/jobLog.repository';
import type { WebhookJobData } from '../types/jobs';

// Consumer for the webhook queue. Delegates the actual HTTP POST to
// webhookService.deliverWebhook, which throws on failure so BullMQ retries with
// the configured exponential backoff. Event handlers keep JobLog in sync and
// implement the dead-letter transition once attempts are exhausted.

// Webhook delivery is I/O-bound (outbound HTTP), so a single-threaded worker
// would idle waiting on the network. 10 concurrent deliveries keeps throughput
// up without overwhelming downstream merchant hosts.
const WEBHOOK_CONCURRENCY = 10;

// Backoff schedule mirrors the queue default (exponential, 2000ms base).
function nextRetryAt(attemptsMade: number): Date {
  const delayMs = 2000 * 2 ** attemptsMade;
  return new Date(Date.now() + delayMs);
}

// WebhookJobData only carries deliveryId; derive the owning merchantId from the
// delivery's endpoint so JobLog rows are tenant-scoped. Best-effort: on any
// failure we tag the row null rather than break bookkeeping.
async function merchantIdForDelivery(deliveryId: string): Promise<string | null> {
  try {
    const delivery = await webhookDeliveryRepository.findByIdWithEndpoint(deliveryId);
    return delivery?.webhookEndpoint.merchantId ?? null;
  } catch (err) {
    logger.error({ err, deliveryId }, 'failed to resolve merchantId for webhook JobLog');
    return null;
  }
}

export function createWebhookWorker(): Worker<WebhookJobData> {
  const worker = new Worker<WebhookJobData>(
    QUEUE_NAMES.WEBHOOK,
    async (job: Job<WebhookJobData>) => {
      await webhookService.deliverWebhook(job.data.deliveryId);
    },
    { connection: redisConnection, concurrency: WEBHOOK_CONCURRENCY },
  );

  worker.on('active', (job) => {
    void merchantIdForDelivery(job.data.deliveryId).then((merchantId) =>
      jobLogRepository.upsertJobLog({
        queue: QUEUE_NAMES.WEBHOOK,
        jobId: job.id ?? 'unknown',
        name: job.name,
        status: 'active',
        attempts: job.attemptsMade,
        merchantId,
        data: { deliveryId: job.data.deliveryId },
      }),
    ).catch((err) => logger.error({ err, jobId: job.id }, 'jobLog upsert failed (active)'));
  });

  worker.on('completed', (job) => {
    void merchantIdForDelivery(job.data.deliveryId).then((merchantId) =>
      jobLogRepository.upsertJobLog({
        queue: QUEUE_NAMES.WEBHOOK,
        jobId: job.id ?? 'unknown',
        name: job.name,
        status: 'completed',
        attempts: job.attemptsMade,
        merchantId,
        error: null,
      }),
    ).catch((err) => logger.error({ err, jobId: job.id }, 'jobLog upsert failed (completed)'));
  });

  worker.on('failed', (job, err) => {
    if (!job) {
      logger.error({ err }, 'webhook job failed with no job reference');
      return;
    }
    const exhausted = job.attemptsMade >= env.WEBHOOK_MAX_ATTEMPTS;
    const deliveryId = job.data.deliveryId;

    void merchantIdForDelivery(deliveryId)
      .then((merchantId) => {
        if (exhausted) {
          // Dead-letter: no more retries. Mark the delivery dead (our DLQ marker)
          // and record the job as dead for the dashboard. This write is critical:
          // losing it silently would leave a delivery stuck "failed" forever, so
          // log at error level if it fails.
          void webhookDeliveryRepository
            .updateDeliveryResult(deliveryId, {
              status: 'dead',
              attempts: job.attemptsMade,
              nextRetryAt: null,
            })
            .catch((e) =>
              logger.error({ err: e, deliveryId }, 'CRITICAL: failed to mark delivery dead (DLQ write lost)'),
            );
          void jobLogRepository
            .upsertJobLog({
              queue: QUEUE_NAMES.WEBHOOK,
              jobId: job.id ?? 'unknown',
              name: job.name,
              status: 'dead',
              attempts: job.attemptsMade,
              merchantId,
              error: err.message,
            })
            .catch((e) => logger.error({ err: e, jobId: job.id }, 'jobLog upsert failed (dead)'));
          logger.warn({ deliveryId, attempts: job.attemptsMade }, 'webhook delivery dead-lettered');
        } else {
          // Retry pending: stamp when the next attempt is expected.
          void webhookDeliveryRepository
            .updateDeliveryResult(deliveryId, {
              status: 'failed',
              attempts: job.attemptsMade,
              nextRetryAt: nextRetryAt(job.attemptsMade),
            })
            .catch((e) => logger.error({ err: e, deliveryId }, 'failed to mark delivery failed'));
          void jobLogRepository
            .upsertJobLog({
              queue: QUEUE_NAMES.WEBHOOK,
              jobId: job.id ?? 'unknown',
              name: job.name,
              status: 'failed',
              attempts: job.attemptsMade,
              merchantId,
              error: err.message,
            })
            .catch((e) => logger.error({ err: e, jobId: job.id }, 'jobLog upsert failed (failed)'));
          logger.info({ deliveryId, attempts: job.attemptsMade }, 'webhook delivery will retry');
        }
      })
      .catch((e) => logger.error({ err: e, deliveryId }, 'webhook failed-handler bookkeeping error'));
  });

  worker.on('stalled', (jobId) => {
    logger.warn({ jobId }, 'webhook job stalled');
  });

  return worker;
}
