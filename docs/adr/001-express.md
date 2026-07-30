# ADR 001 — HTTP framework: Express

Status: Accepted · 2026

## Problem

StripeForge needs an HTTP layer for a REST API with middleware (auth, validation, rate
limiting, security headers), a clean way to mount modular routers, and centralised error
handling. It must be approachable for a learning-focused project and interoperate with a
strict-TypeScript, layered (repository/service/controller/route) design.

## Options Considered

- **Express 4** — the de-facto Node web framework; huge ecosystem, simple middleware model.
- **Fastify** — faster, schema-first, built-in validation and serialization.
- **NestJS** — batteries-included, opinionated DI/decorators, structured modules.
- **Koa / Hapi** — smaller/alternative middleware philosophies.

## Decision

Use **Express 4**.

## Pros

- Ubiquitous and **easy to teach** — most Node examples/tutorials use it, lowering the bar
  for contributors of a learning project.
- Minimal and unopinionated: our own layering (controller/service/repository) is imposed by
  us, not the framework — great for demonstrating the pattern explicitly.
- Massive middleware ecosystem (`helmet`, `cors`, `express-rate-limit`, `pino-http`)
  already wired in `app.ts`.
- The `express.json({ verify })` hook cleanly captures the raw body for webhook signature
  verification.

## Cons

- Slower than Fastify and lacks built-in schema validation/serialization (we add Zod
  ourselves).
- Express 4 typings/async-error handling need helpers (`asyncHandler`) rather than native
  promise support.
- No built-in structure — teams can drift without conventions (mitigated by our contract).

## Trade-offs

We trade raw throughput and built-in features for **familiarity, transparency, and
teachability**. Because business logic lives in the framework-agnostic service layer,
swapping to Fastify later would be localised to controllers/routes — so the cost of this
decision is low and reversible.
