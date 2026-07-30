# ADR 004 — Background jobs: BullMQ

Status: Accepted · 2026

## Problem

Webhook delivery, receipt generation, and email must happen **off the request path**: they
are slow and can fail (a merchant's endpoint may be down). We need durable jobs, automatic
retries with backoff, a dead-letter path for exhausted jobs, and a way to scale processing
independently of the API — all in the Node/TypeScript ecosystem.

## Options Considered

- **BullMQ** — modern Redis-backed queue for Node; retries, backoff, repeatable jobs,
  multiple workers.
- **BeeQueue / Bull (v3)** — older, less maintained predecessors.
- **Agenda / pg-boss** — MongoDB / Postgres-backed queues (no separate Redis).
- **Cloud queues (SQS, Cloud Tasks)** — managed, but add vendor coupling and less local
  fidelity.
- **In-process (no queue)** — simplest, but couples request latency to third-party
  availability and loses durability.

## Decision

Use **BullMQ 5** (backed by Redis — see [ADR-005](./005-redis.md)).

## Pros

- **Durable** jobs survive an API restart; **automatic retries with exponential backoff**
  and a configurable attempt cap (`WEBHOOK_MAX_ATTEMPTS`).
- Clean separation: the API enqueues (`addWebhookJob`, …); a **separate worker process**
  consumes, so we can scale workers independently.
- First-class TypeScript, multiple named queues (`webhook`/`receipt`/`email`), and support
  for repeatable/cron jobs (useful for the subscriptions roadmap).
- Dead-letter behaviour via retained failed jobs, mirrored into `JobLog` for observability.

## Cons

- Requires **running Redis** (an extra dependency — see ADR-005).
- Job state lives in Redis, which is ephemeral; we mirror it to `JobLog` for durable
  reporting (extra write per transition).
- Less "just works with the DB you already have" than pg-boss.

## Trade-offs

We accept an extra infrastructure component (Redis) in exchange for a **mature, feature-
rich, well-documented** queue whose retry/backoff/DLQ semantics are exactly what reliable
webhook delivery needs — and which demonstrates real background-processing patterns for a
learning project. pg-boss would avoid Redis but with a less rich feature set and worse fit
for high-throughput fan-out.
