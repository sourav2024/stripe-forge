# Queues & Background Processing

StripeForge does slow or unreliable work **off the request path** using
[BullMQ](https://docs.bullmq.io/) backed by Redis. The API enqueues jobs and returns
immediately; a **separate worker process** consumes them with retries, backoff, and a
dead-letter path. Job state is mirrored into the `JobLog` table so the dashboard can see
what's happening.

## Why a queue at all

Delivering a webhook, rendering a receipt, or sending an email can be slow and can fail
(the merchant's endpoint might be down). Doing that work synchronously inside a request
would make payments slow and couple their success to third-party availability. A queue
gives us: **low request latency**, **durability** (jobs survive an API restart),
**automatic retries with backoff**, and **isolation** (a flood of webhooks can't starve
the API — you scale workers independently). See [ADR-004](./adr/004-bullmq.md) and
[ADR-005](./adr/005-redis.md).

## The three queues

Names are the single source of truth in `src/queues/queue.names.ts`:

| Constant | Name | Produced by | What the worker does |
| --- | --- | --- | --- |
| `QUEUE_NAMES.WEBHOOK` | `webhook` | event bus (`addWebhookJob`) | Sign + POST an event to a merchant endpoint; record the delivery result |
| `QUEUE_NAMES.RECEIPT` | `receipt` | payment service (`addReceiptJob`) | Generate a payment receipt artifact |
| `QUEUE_NAMES.EMAIL` | `email` | services (`addEmailJob`) | Send transactional email (verify, receipt, alerts) |

Producers are exported from `src/queues/index.ts`: `addWebhookJob(data)`,
`addReceiptJob(data)`, `addEmailJob(data)`. Services call these — they never talk to the
worker directly.

## Architecture

```mermaid
flowchart LR
    subgraph API["API process"]
        SVC["Service"] --> BUS["Event bus / producers"]
        BUS -->|"addWebhookJob / addReceiptJob / addEmailJob"| Q
    end

    subgraph Redis["Redis (BullMQ)"]
        Q1["webhook queue"]
        Q2["receipt queue"]
        Q3["email queue"]
    end
    Q --> Q1 & Q2 & Q3

    subgraph Worker["Worker process (src/workers)"]
        W1["webhook worker"]
        W2["receipt worker"]
        W3["email worker"]
    end
    Q1 --> W1
    Q2 --> W2
    Q3 --> W3

    W1 -->|"signed POST"| EXT["Merchant endpoint"]
    W1 & W2 & W3 -->|"upsert JobLog + update rows"| PG[("PostgreSQL")]
```

## Job processing lifecycle

```mermaid
sequenceDiagram
    participant Svc as Service (API)
    participant Redis as Redis (BullMQ)
    participant Worker
    participant Target as External / DB
    participant JL as JobLog (PostgreSQL)

    Svc->>Redis: add job (data, {attempts, backoff})
    Redis->>JL: status = queued
    Redis->>Worker: dispatch job (status = active)
    Worker->>JL: status = active, attempts++
    Worker->>Target: do work (POST / render / send)
    alt success
        Target-->>Worker: ok
        Worker->>JL: status = completed
    else failure & attempts remain
        Target-->>Worker: error
        Worker->>JL: status = failed (will retry)
        Redis->>Redis: schedule retry (exponential backoff)
        Redis->>Worker: retry
    else attempts exhausted
        Worker->>JL: status = dead (dead-letter)
    end
```

## Retry & backoff

Each job is added with BullMQ retry options, e.g.:

```ts
await webhookQueue.add('deliver', { deliveryId }, {
  attempts: env.WEBHOOK_MAX_ATTEMPTS,     // default 5
  backoff: { type: 'exponential', delay: 1000 }, // 1s, 2s, 4s, 8s, ...
  removeOnComplete: 1000,   // keep recent history, cap Redis growth
  removeOnFail: false,      // keep failed jobs for inspection
});
```

- **`attempts`** caps total tries. For webhooks it is driven by `WEBHOOK_MAX_ATTEMPTS`.
- **Exponential backoff** spaces out retries so a briefly-down endpoint recovers without
  being hammered, and a thundering-herd of failures is spread over time.
- **Idempotency:** because a delivery is keyed by its persisted `WebhookDelivery` row,
  re-running the same job re-sends the same event id — merchants deduplicate on the event
  id (Stripe-style), so retries are safe.

## Dead-letter handling

When a job exhausts its attempts:

1. BullMQ moves it to its **failed** set (kept, since `removeOnFail: false`).
2. The worker's failure handler marks the corresponding `JobLog.status = dead` and, for
   webhooks, sets `WebhookDelivery.status = dead`.
3. Dead items are **not** silently dropped — they are visible on the Jobs / Webhook
   Deliveries dashboards and can be manually re-driven.

```mermaid
stateDiagram-v2
    [*] --> queued
    queued --> active
    active --> completed: success
    active --> failed: error (attempts remain)
    failed --> active: retry (backoff)
    active --> dead: attempts exhausted
    completed --> [*]
    dead --> [*]
```

This mirrors the `JobStatus` enum (`queued/active/completed/failed/dead`) and, for
deliveries, the `WebhookDeliveryStatus` enum (`pending/succeeded/failed/dead`).

## Observability: JobLog

BullMQ keeps live job state in Redis, which is ephemeral and awkward to query for
reporting. The workers **mirror** each transition into the `JobLog` table
(`queue`, `jobId`, `name`, `status`, `attempts`, `data`, `error`). This gives a durable,
SQL-queryable feed for `GET /api/v1/jobs` and the dashboard — e.g. "how many `webhook`
jobs are `dead` in the last 24h?". See [`database.md`](./database.md#joblog-job_logs).

## Running the worker

```bash
cd backend
npm run worker          # dev (tsx)
npm run worker:prod     # prod (node dist/workers/index.js)
```

The worker is a **separate process** from the API (own container in Compose) so it can be
scaled and restarted independently. Graceful shutdown (SIGTERM) lets in-flight jobs finish
before exit — see [`deployment.md`](./deployment.md).
