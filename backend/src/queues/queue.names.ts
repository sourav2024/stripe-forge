// Central registry of queue names. Kept as a single source of truth so
// producers, workers, and observability all reference the same strings.
export const QUEUE_NAMES = {
  WEBHOOK: 'webhook',
  RECEIPT: 'receipt',
  EMAIL: 'email',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];
