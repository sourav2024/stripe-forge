import { type Store } from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { env } from './env';
import { redis } from './redis';

// Back rate limiters with Redis so counts are shared cluster-wide — a per-
// instance memory store would let a client multiply its allowance by the
// number of replicas. Lives in its own leaf module (not app.ts) so both the
// app and the auth routes can import it without a circular dependency.
export function makeStore(prefix: string): Store | undefined {
  // Tests have no Redis available, so fall back to the default MemoryStore.
  if (env.isTest) return undefined;
  return new RedisStore({
    prefix,
    // rate-limit-redis triggers a connect on first command; the ioredis client
    // is lazyConnect, which is fine. Cast through the variadic call overload —
    // ioredis types `call` as (command, ...args), not (...args).
    sendCommand: (command: string, ...args: string[]) =>
      redis.call(command, ...args) as Promise<never>,
  });
}
