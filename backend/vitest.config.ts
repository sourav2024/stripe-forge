import { defineConfig } from 'vitest/config';

// Test runner configuration for the StripeForge backend.
// - `environment: node` because the backend is a Node service (Express, Prisma,
//   BullMQ) — there is no DOM to emulate, and a node environment is faster.
// - `include` picks up every `*.test.ts` under `tests/` (unit + integration).
//   Integration tests are `describe.skip`-ped by default so a plain `vitest run`
//   never requires Postgres/Redis (see tests/integration/README.md).
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // Keep unit tests isolated and deterministic; no shared global state.
    globals: false,
  },
});
