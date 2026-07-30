# ADR 005 — Queue/broker backing store: Redis

Status: Accepted · 2026

## Problem

BullMQ (see [ADR-004](./004-bullmq.md)) requires a backing store for job state and
scheduling. We need a fast, reliable, widely-supported data store that BullMQ targets
natively, can be run locally with one command, and can also serve future needs (caching,
rate-limit counters).

## Options Considered

- **Redis** — the store BullMQ is built on; in-memory speed, optional persistence.
- **Postgres-backed queue (pg-boss)** — reuse the existing database, no Redis.
- **KeyDB / Dragonfly / Valkey** — Redis-compatible alternatives.
- **Managed Redis (Elasticache, Upstash, etc.)** — for production.

## Decision

Use **Redis 7** as the BullMQ backing store, via `ioredis` (`src/config/redis.ts`).

## Pros

- **Native BullMQ target** — required for the queue we chose; battle-tested combination.
- Extremely fast; job scheduling/backoff and atomic operations are handled server-side.
- Trivial local run (`redis:7-alpine` in Docker Compose) and ubiquitous managed offerings
  for production.
- Reusable beyond queues: caching, distributed rate limiting, ephemeral counters.
- The connection is configured once as a singleton with `maxRetriesPerRequest: null` (a
  BullMQ requirement) and shared.

## Cons

- **Another moving part** to run and operate.
- In-memory by default — job durability depends on enabling persistence (AOF/RDB); a
  misconfigured Redis could lose queued jobs on restart.
- Memory-bound; large backlogs need capacity planning.

## Trade-offs

We accept operating a second datastore because it is the **direct consequence of choosing
BullMQ** and because Redis is a standard, well-understood component. In production we
mitigate the durability caveat by enabling persistence and by persisting critical state
(`WebhookDelivery`, `JobLog`) in Postgres *before/around* job execution, so Redis loss
degrades gracefully rather than losing events.
