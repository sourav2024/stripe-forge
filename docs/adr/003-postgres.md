# ADR 003 — Database: PostgreSQL

Status: Accepted · 2026

## Problem

A payments platform's data store must guarantee **ACID transactions** (money and ledger
legs commit atomically or not at all), enforce integrity (unique/foreign-key constraints
for idempotency and tenancy), store `BigInt` amounts exactly, and support JSON metadata and
array columns (webhook `enabledEvents`). It also needs a mature migration and hosting
story.

## Options Considered

- **PostgreSQL** — feature-rich, strict, first-class Prisma support.
- **MySQL/MariaDB** — popular, capable, but weaker on some types (arrays) and stricter-mode
  nuances.
- **SQLite** — trivial to run, but not suited to concurrent production writes.
- **MongoDB** — flexible documents, but multi-document ACID and relational integrity are
  weaker fits for a ledger.

## Decision

Use **PostgreSQL 16**.

## Pros

- **Strong ACID transactions** — essential for atomic payment + double-entry ledger writes
  via `prisma.$transaction`.
- Rich types used directly in the schema: `BigInt` money, `Json` metadata, `String[]`
  (`enabledEvents`), enums.
- Robust constraints (composite unique `(merchantId, email)`, unique idempotency keys) that
  encode business rules at the database level.
- Excellent Prisma support, mature migrations, ubiquitous managed hosting, and battle-
  tested reliability.

## Cons

- Heavier to run locally than SQLite (mitigated by Docker Compose).
- Requires operational care in production (backups, PITR, connection pooling).
- Horizontal write scaling is non-trivial (see multi-region roadmap).

## Trade-offs

We choose **correctness and integrity over operational simplicity**. For a ledger-centric
system, the database's transactional guarantees and constraints are load-bearing — the very
thing that keeps the books balanced — so the extra operational weight is justified. Docker
Compose keeps local setup one command.
