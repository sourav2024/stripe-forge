import { Redis } from 'ioredis';
import { env } from './env';

// BullMQ requires `maxRetriesPerRequest: null` on its connection so that
// blocking commands (used by workers to wait for jobs) are never aborted.
export const redisConnection = {
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  maxRetriesPerRequest: null as null,
};

// A general-purpose client for non-queue use (caching, health checks).
export const redis = new Redis({
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  maxRetriesPerRequest: null,
  lazyConnect: true,
});
