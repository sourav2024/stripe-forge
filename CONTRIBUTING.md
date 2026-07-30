# Contributing to StripeForge

Thanks for your interest! StripeForge is an educational, Stripe-inspired payment
platform. Contributions that improve clarity, correctness, or teaching value are
very welcome.

## Getting started

1. Fork and clone the repo.
2. Follow **Running Locally** in the [root README](./README.md).
3. Create a branch: `git checkout -b feat/short-description`.

## Ground rules (backend)

These mirror the project's build contract — please keep to them:

- **TypeScript strict mode.** No unused vars/params (prefix intentionally-unused
  params with `_`).
- **Relative imports only** (no `@/` alias).
- **Money is `BigInt` minor units** everywhere. Never use `float`/`number` for
  money in the domain or DB. Serialize to `number` only at the API boundary via
  `serialize()`.
- **Layering:** Repository → Service → Controller → Route. Keep controllers thin;
  business logic and invariants live in services.
- **Comments explain WHY, not WHAT**, and only for non-obvious/architectural
  reasoning.
- **No secrets in code.** Read config from `src/config/env`.
- **Consistent responses:** success is `{ success, data, meta? }`; errors flow
  through the central error handler as `{ success:false, error:{ code, message } }`.

## Before you push

```bash
cd backend
npm run typecheck   # tsc --noEmit
npm run lint        # eslint
npm test            # vitest (unit)
npm run format      # prettier --write
```

For the frontend:

```bash
cd frontend
npm run lint
npm run build
```

CI (`.github/workflows/ci.yml`) runs the same checks on every push/PR.

## Commit & PR

- Use clear, imperative commit messages (`add refund partial-limit guard`).
- Keep PRs focused. Describe the change, the reasoning, and any trade-offs.
- Add/extend tests for behaviour changes. Every test file should start with a
  `WHY THIS TEST EXISTS` comment.
- Update the relevant docs under `docs/` when you change behaviour.

## Adding a new module

See [`docs/backend.md`](./docs/backend.md) → *How to add a new module* for the
step-by-step (repository → service → validator → controller → route → mount →
docs → tests).

## Code of conduct

Be kind and constructive. This is a learning project — assume good intent and
help others learn.
