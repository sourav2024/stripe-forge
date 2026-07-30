# Integration Tests

Integration tests exercise the **real Express app over HTTP** (using
[`supertest`](https://github.com/ladjs/supertest)) against a **real Postgres and
Redis**. Unlike the unit tests, they touch the network, the database, and the
queue, so they need infrastructure and are therefore **skipped by default**
(`describe.skip`). A plain `npm test` runs only the fast, deterministic unit
tests and never requires Docker.

## Why they exist

Unit tests prove individual pure functions. Integration tests prove the
**seams** between layers: routing → middleware chain → auth → validation →
service → repository → database, plus the success/error response envelopes the
frontend depends on. `auth.flow.test.ts` is the reference example
(register → login → protected route → refresh).

## Prerequisites

- Docker (for the Postgres + Redis service containers), or a local Postgres 16
  and Redis 7.
- A **separate test database** — never point these at your dev/prod DB, they
  write and truncate data.

## Running locally

1. Start infrastructure from the repo root:

   ```bash
   docker compose up -d postgres redis
   ```

2. Point the backend at a test database and apply migrations:

   ```bash
   cd backend
   export DATABASE_URL="postgresql://stripeforge:stripeforge@localhost:5432/stripeforge_test?schema=public"
   export REDIS_HOST=localhost
   export REDIS_PORT=6379
   export NODE_ENV=test
   export JWT_ACCESS_SECRET=test_access_secret_change_me
   export JWT_REFRESH_SECRET=test_refresh_secret_change_me

   # Create the test DB and apply the schema.
   npx prisma migrate deploy
   ```

3. Enable the suite. In `auth.flow.test.ts` change:

   ```ts
   describe.skip('auth flow (integration)', () => {
   ```

   to:

   ```ts
   describe('auth flow (integration)', () => {
   ```

   (Or, preferred long-term: gate on an env flag such as
   `const runIntegration = process.env.RUN_INTEGRATION === '1';` and use
   `const d = runIntegration ? describe : describe.skip;`.)

4. Run just the integration folder:

   ```bash
   npx vitest run tests/integration
   ```

## In CI

The GitHub Actions workflow (`.github/workflows/ci.yml`) provisions `postgres`
and `redis` **service containers** so that integration tests *can* be enabled in
a dedicated job. By default they remain skipped to keep the pipeline fast and
green; flip the flag / un-skip when you want them enforced.

## Cleanup

Because each run creates records (merchants, tokens, …), either use a throwaway
database, truncate between runs, or wrap each test in a transaction that rolls
back. The example uses unique, timestamped emails to avoid collisions across
runs, but a truncating `beforeEach` is recommended once the suite grows.
