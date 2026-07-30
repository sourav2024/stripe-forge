# StripeForge Backend Tests

Tests run with [Vitest](https://vitest.dev) (`node` environment). Config lives in
`backend/vitest.config.ts` and picks up every `tests/**/*.test.ts`.

```bash
cd backend

npm test                 # run everything once (unit; integration is skipped)
npm run test:watch       # watch mode
npx vitest run tests/unit          # only the fast unit tests
npx vitest run tests/integration   # only integration (skipped by default)
```

## Philosophy

- **Unit tests** target **pure, deterministic** functions — no DB, no Redis, no
  network. They are fast, run everywhere (including a clean CI checkout with no
  services), and pin down the exact behavioural contracts other code relies on.
- **Integration tests** exercise the real app over HTTP against real Postgres +
  Redis. They prove the layers fit together. They are **skipped by default** so
  the default test run needs zero infrastructure. See
  [`integration/README.md`](./integration/README.md).

Every test file opens with a `WHY THIS TEST EXISTS` comment — tests are
documentation of intent, not just regression nets.

## What each test covers, and why

### `unit/money.test.ts` — the money serialization boundary
Money is stored as `BigInt` minor units. `JSON.stringify` throws on `BigInt`, so
`serialize()` converts `BigInt → number` recursively at the API boundary. It is
the **single point** that keeps every money-carrying endpoint JSON-safe; a
regression here breaks every amount in the API. Tests cover nesting, arrays,
zero, large-but-safe integers, and pass-through of non-BigInt values.

### `unit/pagination.test.ts` — list-endpoint safety
`parsePagination` clamps `page`/`pageSize` (min 1, max 100) and computes `skip`.
It is the guard that stops a client from requesting an unbounded page and
exhausting memory. Tests pin the bounds, coercion of string query params, and
`skip` arithmetic (easy to break with an off-by-one).

### `unit/jwt.test.ts` — authentication trust
`requireAuth` trusts whatever `verifyAccessToken` returns, so the sign→verify
round trip must preserve `sub`/`email`/`role`, and a tampered/wrong-secret token
must be rejected. Also checks that refresh tokens are opaque (not JWTs) with a
future expiry. Guarded so it self-skips if `config/env` can't load with no
`.env`/DB present.

### `unit/webhookSignature.test.ts` — webhook authenticity & replay defense
Merchants verify deliveries with a Stripe-style `t=..,v1=..` HMAC-SHA256
signature over `${timestamp}.${payload}`. Tests prove: valid signatures verify,
tampered payloads and wrong secrets are rejected, malformed headers are rejected,
and stale timestamps are rejected (replay defense) while a generous tolerance
re-accepts them (proving it was the timestamp, not the HMAC).

### `unit/ledger.invariant.test.ts` — the accounting invariant
The double-entry ledger must always satisfy `SUM(DEBIT) === SUM(CREDIT)` per
transaction; merchant balances are *derived* from it. The service builds its legs
inside a Prisma transaction, so this test **replicates the exact leg shape** the
service produces (documented against `src/services/ledger.service.ts`) and
asserts the invariant without needing a DB — including the derived-balance
calculation and a dropped-leg regression guard.

### `integration/auth.flow.test.ts` — end-to-end seam check (skipped)
Register → login → protected route → refresh over real HTTP. Proves routing,
middleware, auth, validation, services, repositories, and the response envelope
all fit together. Requires Postgres + Redis; skipped by default.
