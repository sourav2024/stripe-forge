# Architecture Decision Records (ADRs)

## What is an ADR?

An **Architecture Decision Record** captures a single significant technical decision: the
problem/context, the options considered, the decision made, and its consequences
(pros/cons/trade-offs). ADRs are short, dated, and **immutable** — if a decision changes
later, you write a *new* ADR that supersedes the old one rather than editing history. The
value is durable institutional memory: a new contributor can read *why* the codebase is
the way it is, not just *what* it does. (Format popularised by Michael Nygard.)

Each ADR here uses the sections: **Problem / Options Considered / Decision / Pros / Cons /
Trade-offs**.

## Index

| # | Decision | Status |
| --- | --- | --- |
| [001](./001-express.md) | Use Express as the HTTP framework | Accepted |
| [002](./002-prisma.md) | Use Prisma as the ORM | Accepted |
| [003](./003-postgres.md) | Use PostgreSQL as the database | Accepted |
| [004](./004-bullmq.md) | Use BullMQ for background jobs | Accepted |
| [005](./005-redis.md) | Use Redis as the queue/broker backing store | Accepted |
| [006](./006-react-query.md) | Use TanStack React Query for frontend server state | Accepted |
| [007](./007-tailwind.md) | Use Tailwind CSS for styling | Accepted |

All decisions were made for the initial build (2026) and are consistent with the shared
build contract (strict TypeScript, layered backend, `BigInt` money, relative imports).
