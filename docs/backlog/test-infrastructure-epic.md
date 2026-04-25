# Epic — Backend Test Infrastructure

**Status:** backlog
**Created:** 2026-04-24
**Related:** Transaction unification migration (see `docs/plans/transaction-unification.md` — pending)

## Problem

The API has `jest` configured in `package.json` but zero `*.spec.ts` or
`*.test.ts` files. Every non-trivial change — including the multi-phase
Transaction unification migration — has to be validated by ad-hoc scripts,
manual QA, or reconciliation snapshots (see
`apps/api/scripts/reconciliation/`).

This works for the migration at hand (financial invariants are aggregate,
not behavioral), but it is not a durable base for ongoing product work.

## Scope

1. Pick a test DB strategy:
   - **Option 1:** `testcontainers` spinning up a dedicated Postgres per
     test run. Slower, hermetic.
   - **Option 2:** Shared test database with transactional rollback per
     test. Faster, requires care with parallelism.
2. Establish a `test/` folder convention: unit vs. integration vs. e2e.
3. Factor out a `TestPrismaModule` that overrides `PrismaService` for tests
   and resets state between runs.
4. Write fixtures / factories (`makeWallet`, `makeTransaction`, …).
5. Target an initial coverage floor: every service method in
   `transactions`, `faturas`, `purchases`, `recurring-transactions`,
   `cards`.
6. Wire into CI.

## Why deferred

The Transaction unification migration is time-sensitive and the
reconciliation snapshots already cover the invariants that matter for it.
Building test infra *with the old dual model*, then refactoring every test
once the model is unified, would be duplicate work.

Preferred sequencing: complete the migration (Fases 1–4), let the new
schema stabilize one release, then pick this epic up with the definitive
model in place.

## Acceptance criteria

- `pnpm test` runs >30 tests against a real (test) database, all green.
- CI fails the build if tests fail.
- New service methods added to the codebase after the epic lands ship
  with at least one integration test each.
- Documented in the root README and `CLAUDE.md` workflow.
