# ADR 002 — ORM: Prisma

Status: Accepted · 2026

## Problem

The backend needs type-safe database access, a migration workflow, and a single readable
place to define the data model (merchants, payments, the double-entry ledger, webhooks).
It must handle `BigInt` money columns, JSON fields, `String[]`, and transactions for
atomic money+ledger writes — all under strict TypeScript.

## Options Considered

- **Prisma** — schema-first, generated type-safe client, first-class migrations.
- **TypeORM** — decorator/entity-based, mature but historically inconsistent typings.
- **Drizzle** — lightweight, SQL-first, TS-native, growing ecosystem.
- **Knex / raw `pg`** — full control, hand-written SQL and types.

## Decision

Use **Prisma 6**.

## Pros

- **Excellent type safety** end to end — generated types flow into services/repositories,
  catching money/enum mistakes at compile time.
- One declarative `schema.prisma` doubles as documentation (it drives our
  [`database.md`](../database.md) and ER diagram).
- Built-in **migrations** (`migrate dev`/`deploy`) and Studio for inspection.
- Native `BigInt`, `Json`, `String[]`, and `$transaction` support — exactly what the ledger
  needs for atomic balanced writes.
- Confines all DB access to the repository layer cleanly.

## Cons

- Prisma returns money as `BigInt`, which `JSON.stringify` can't encode — we handle this
  with a `serialize()` boundary (arguably a papercut, but centralised and tested).
- Less flexible for very complex/hand-tuned SQL than a query builder; raw queries are an
  escape hatch when needed.
- Generated client + engine adds build/runtime weight vs. Drizzle.

## Trade-offs

We favour **developer safety and clarity** over maximal SQL control — appropriate for a
teaching codebase where correctness of money handling matters more than shaving query
microseconds. Repositories isolate Prisma, so a future migration to Drizzle/Knex would be
contained.
