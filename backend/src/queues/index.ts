import { Queue, JobsOptions } from 'bullmq';
import { redisConnection } from '../config/redis';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { QUEUE_NAMES } from './queue.names';
import type { WebhookJobData, ReceiptJobData, EmailJobData } from '../types/jobs';

// Producer side of the async platform. Services import the `add*Job` helpers to
// enqueue side effects; workers (src/workers) consume from the same named
// queues. All queues share one Redis connection config.

// Default retry/retention policy. Exponential backoff spreads out retries so a
// briefly-down consumer (e.g. a merchant's webhook host) is not hammered.
function defaultJobOpts(attempts: number): JobsOptions {
  return {
    attempts,
    backoff: { type: 'exponential', delay: 2000 },
    // Retention keeps recent history for the dashboard without growing forever.
    removeOnComplete: 1000,
    // Failed jobs are retained longer so exhausted/dead jobs remain inspectable
    // (this doubles as our lightweight dead-letter record — see workers/README).
    removeOnFail: 5000,
  };
}

export const webhookQueue = new Queue<WebhookJobData>(QUEUE_NAMES.WEBHOOK, {
  connection: redisConnection,
  defaultJobOptions: defaultJobOpts(env.WEBHOOK_MAX_ATTEMPTS),
});

export const receiptQueue = new Queue<ReceiptJobData>(QUEUE_NAMES.RECEIPT, {
  connection: redisConnection,
  defaultJobOptions: defaultJobOpts(3),
});

export const emailQueue = new Queue<EmailJobData>(QUEUE_NAMES.EMAIL, {
  connection: redisConnection,
  defaultJobOptions: defaultJobOpts(3),
});

// A BullMQ Queue emits an 'error' event on Redis connection trouble. With NO
// listener attached, Node treats an EventEmitter 'error' as an uncaughtException
// and kills the whole process on any transient Redis blip. Attaching a listener
// downgrades it to a logged error.
getQueues().forEach((q) => {
  q.on('error', (err) => logger.error({ err, queue: q.name }, 'queue error'));
});

export function addWebhookJob(data: WebhookJobData, opts?: JobsOptions) {
  return webhookQueue.add('deliver', data, opts);
}

export function addReceiptJob(data: ReceiptJobData) {
  return receiptQueue.add('send-receipt', data);
}

export function addEmailJob(data: EmailJobData) {
  return emailQueue.add('send-email', data);
}

/** All queue instances, used for graceful shutdown. */
export function getQueues(): Queue[] {
  return [webhookQueue, receiptQueue, emailQueue];
}

/** Close all queue connections (call on process shutdown). */
export async function closeQueues(): Promise<void> {
  await Promise.all(getQueues().map((q) => q.close()));
}
