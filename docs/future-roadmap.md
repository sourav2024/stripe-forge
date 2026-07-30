# Future Roadmap

Documented placeholders for capabilities StripeForge does **not** yet have. Each entry
explains *what it is*, *how Stripe does it*, and *how you'd approach adding it here* given
the existing architecture. These are learning-oriented design sketches, not commitments.

---

## Subscriptions

- **What it is:** recurring billing on a schedule (monthly/annual), with plans, trials,
  proration, and dunning (retrying failed renewals).
- **How Stripe does it:** `Product` + `Price` + `Subscription` objects; a billing engine
  generates `Invoice`s each cycle, attempts payment, and emits `invoice.*` /
  `customer.subscription.*` events; Smart Retries + dunning emails handle failures.
- **Here:** add `Plan`, `Subscription`, `Invoice` models; a **BullMQ repeatable job**
  (cron-like) to enumerate due subscriptions and create PaymentIntents; reuse the existing
  payment lifecycle + ledger for each charge; new events (`invoice.created`,
  `invoice.paid`, `subscription.canceled`) flow through the same event bus/webhook path.

## Invoicing

- **What it is:** itemised bills sent to customers, payable via a hosted page, with due
  dates and statuses (draft/open/paid/void).
- **How Stripe does it:** `Invoice` + `InvoiceItem`; finalisation locks the invoice;
  hosted invoice page; auto-advance collects payment.
- **Here:** `Invoice` + `InvoiceLineItem` models scoped per merchant; a service to
  finalise (sum line items → PaymentIntent); a `receipt`/`email` queue job to deliver the
  invoice; ledger legs on payment as today.

## Multi-Currency

- **What it is:** accepting/settling in more than one currency with correct rounding and
  FX handling.
- **How Stripe does it:** amounts + `currency` per object; presentment vs settlement
  currency; FX conversion with fees; per-currency balances.
- **Here:** the schema already stores `currency` per money row and the ledger keys balances
  by `currency`. Extend: enforce a per-merchant supported-currency list, add an FX-rate
  source, and split ledger legs so an FX conversion posts a balanced cross-currency
  transaction (e.g. via a `FX` account). `BigInt` minor units already avoid float drift.

## Connect Accounts (marketplaces/platforms)

- **What it is:** platforms that pay out to third-party sellers, splitting each charge into
  a platform fee + a connected-account share.
- **How Stripe does it:** Connect accounts (Standard/Express/Custom), `application_fee`,
  `transfer`s, and separate balances/payout schedules per connected account.
- **Here:** introduce a `ConnectedAccount` model under a merchant; on a charge, post
  additional ledger legs to `PLATFORM_FEES` (already an account!) and a per-account balance
  account; add payout scheduling as a repeatable worker job. The double-entry ledger makes
  fee splits natural — just more balanced legs per transaction.

## Fraud Detection

- **What it is:** scoring/blocking risky payments (velocity, device, geo, rules/ML).
- **How Stripe does it:** Radar — ML risk scoring + customizable rules + 3D Secure step-up;
  Radar for Fraud Teams adds review queues.
- **Here:** a `RiskScore`/`Review` model; a synchronous rules check in the payment service
  before capture (velocity from recent `Payment`s, blocklists), plus an async enrichment
  job. High-risk intents move to a `requires_review` state (a new lifecycle branch) rather
  than auto-capturing.

## Usage Billing (metered)

- **What it is:** charging by consumption (API calls, GB, seats) rather than a flat fee.
- **How Stripe does it:** metered `Price`s + usage records aggregated per period into
  invoices.
- **Here:** a `UsageRecord` model (append-only, like the ledger); an aggregation worker job
  per billing period that sums usage → an invoice/PaymentIntent. Reuse idempotency keys so
  duplicate usage submissions don't double-bill.

## PCI Compliance

- **What it is:** meeting PCI DSS so you can legally handle card data. **StripeForge is
  explicitly not PCI-compliant** (see [`security.md`](./security.md#pci-note)).
- **How Stripe does it:** they *are* the PCI-compliant vault; Stripe.js/Elements keep PANs
  off the merchant's servers; tokenization means merchants only ever see tokens.
- **Here (design sketch):** never let card data touch these servers — integrate a real
  processor/tokenizer client-side and store only tokens; minimise the cardholder-data
  environment; add TLS everywhere, secret rotation, access logging (the `AuditLog` is a
  start), and formal review. This is a large compliance undertaking, intentionally out of
  scope.

## Event Sourcing

- **What it is:** treating the append-only event log as the source of truth and deriving
  all state (read models) from it.
- **How Stripe does it:** internally event-driven; externally, the events API + a
  reconstructable event history.
- **Here:** the ledger is *already* event-sourced in spirit (append-only, derived
  balances). Generalise: persist every domain event in an `events` table, build read models
  via projectors (workers), and rebuild state by replay. Enables full audit + time-travel
  debugging. Would replace some mutable status columns with projections.

## Distributed Workers

- **What it is:** scaling background processing across many machines with fair scheduling,
  priorities, and rate limits.
- **How Stripe does it:** large-scale internal job systems with sharding and backpressure.
- **Here:** BullMQ already supports multiple workers across hosts sharing Redis. Extend
  with per-queue concurrency, job priorities, per-merchant rate limiting (BullMQ groups /
  rate limiter), and separate worker pools per queue so a webhook flood can't starve email.
  Add Redis Cluster for horizontal scale.

## Multi-Region Deployment

- **What it is:** running close to users across regions with low latency and failover.
- **How Stripe does it:** multi-region infrastructure with data replication and careful
  consistency boundaries.
- **Here:** stateless API/worker containers make horizontal scale easy; the hard part is
  data. Approach: a primary Postgres with read replicas per region (route reads locally,
  writes to primary), regional Redis for queues, and a strategy for the money-critical
  ledger writes (single-writer region or partition by merchant). Idempotency keys become
  even more important across regions.

## GraphQL API

- **What it is:** a typed graph query layer alongside (or instead of) REST.
- **How Stripe does it:** Stripe is REST-first; GraphQL here would be an additive layer.
- **Here:** add a GraphQL server (e.g. Apollo/Yoga) as a thin layer that calls the existing
  **services** (not repositories directly) so business rules and multi-tenant scoping stay
  in one place. Reuse Zod-validated inputs and the same `AppError` mapping. The service
  layer already being framework-agnostic makes this a clean addition.

## Mobile SDK

- **What it is:** native iOS/Android SDKs so apps can collect payments without handling
  card data.
- **How Stripe does it:** Stripe iOS/Android SDKs with prebuilt payment UIs + tokenization.
- **Here:** publish typed client SDKs (TS/Swift/Kotlin) generated from the API contract;
  they'd use the `clientSecret` + public key to confirm PaymentIntents from the device,
  mirroring Stripe's model. Requires the PCI/tokenization work above to be meaningful for
  real cards; for the educational build it can drive the simulated flow.

---

## Known hardening trade-offs (deliberately deferred)

A production-readiness review (correctness/concurrency, security, and scalability) drove a
round of hardening — see [`docs/security.md`](./security.md) and the concurrency notes in
[`docs/payment-lifecycle.md`](./payment-lifecycle.md). A few items were **consciously
deferred** because they are architectural changes larger than the educational scope, rather
than oversights. They are documented here so a reader knows the boundary of what was built.

### Transactional outbox for domain events

- **Gap:** Events (`payment.succeeded`, `refund.created`, …) are published *after* the money
  transaction commits. If the process crashes in the window between commit and publish, the
  event is lost — the money moved but no webhook fires.
- **Why deferred:** correct at-least-once delivery needs an *outbox* — an `outbox_events`
  row written inside the same DB transaction as the money movement, then a relay
  (poller or Postgres logical replication → queue) that publishes and marks it sent.
- **How Stripe does it:** durable event log; every state change is an event, delivered with
  strong at-least-once semantics and consumer-side idempotency.
- **How to add here:** new `OutboxEvent` model written inside the payment/refund
  `$transaction`; a repeatable BullMQ job (or a dedicated relay) reads unsent rows, calls the
  existing `publishEvent`, and marks them sent. Consumers already dedupe on the `evt_` id.

### Admin/platform plane for operational data

- **Gap:** `/jobs` is now merchant-scoped (JobLog carries `merchantId`), but truly
  platform-wide operational data (all queues, all tenants) has no home.
- **Why deferred:** needs a separate authorization plane (platform-admin role/service token)
  distinct from merchant auth — a second RBAC surface.
- **How to add here:** a `PlatformAdmin` principal + `requirePlatformAdmin` middleware
  guarding an `/admin/*` namespace; merchant endpoints stay tenant-scoped.

### Refresh tokens in httpOnly cookies

- **Gap:** the frontend stores access + refresh tokens in `localStorage`, readable by any XSS.
- **Why deferred:** moving the refresh token to an `httpOnly; Secure; SameSite` cookie
  changes the auth transport (CSRF protection, cookie domain/path, CORS `credentials`) across
  both apps — a cross-cutting change worth doing deliberately.
- **How to add here:** issue the refresh token as an httpOnly cookie from `/auth/*`; keep the
  access token in memory only; add a CSRF token for cookie-authenticated mutations.

### Distributed / observable operations

- **Prisma connection-pool budgeting** across N API replicas + M workers vs Postgres
  `max_connections` (or front with pgbouncer) — see [`docs/deployment.md`](./deployment.md).
- **A dedicated migration step** in the deploy pipeline instead of every API replica running
  `migrate deploy` on boot (Prisma's advisory lock makes this safe but serialized).
- **`/metrics` (Prometheus)** for queue depth, delivery latency, and rate-limit hits.
- **JobLog / webhook-delivery retention** — a periodic cleanup job; today rows are unbounded.

---

Have an idea? See [`CONTRIBUTING.md`](../CONTRIBUTING.md) and open a PR with a short design
note in the same *what / how Stripe does it / how here* format.
