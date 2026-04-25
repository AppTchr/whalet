# Reconciliation Snapshots — Transaction Unification Safety Net

Lightweight, test-free invariants check used to guard the multi-phase
migration that unifies credit card installments into `Transaction` rows.

## Why

No automated test suite exists yet (tracked separately as the test-infra
epic). Financial migrations don't really need unit tests anyway — what
matters is that aggregates (balances, fatura totals, category breakdowns)
stay identical across each phase. These scripts capture and compare exactly
that.

## Invariants captured

| Invariant | Must hold across |
|---|---|
| Wallet `confirmedCents` / `projectedCents` | Every phase |
| Fatura total from `Installment` | Phases 0 → 3 (table still exists) |
| Fatura dual-source equality (installment sum == tx sum) | Phase 2 onwards |
| Monthly category breakdown by type × status | Phases 0 → 2 (Phase 3 changes it by design) |
| Transaction mix per (wallet, type, status) | Drift expected (new rows) — warns only |
| Row-level SHA-256 hash | Drift expected — warns only |

## Usage

```bash
# Capture baseline before touching anything
pnpm recon:snapshot pre-fase-0

# … run migrations for Fase 1 …
pnpm recon:snapshot post-fase-1
pnpm recon:diff pre-fase-0 post-fase-1   # must be clean

# … run dual-write changes for Fase 2 …
pnpm recon:snapshot post-fase-2
pnpm recon:diff post-fase-1 post-fase-2  # must be clean

# Phase 3 cutover changes category attribution intentionally.
# Expect category breakdown diffs; wallet balances must still match.
pnpm recon:snapshot post-fase-3
pnpm recon:diff post-fase-2 post-fase-3
```

Snapshots land in `scripts/reconciliation/snapshots/*.json` — commit the
important ones (pre-fase-0, post-fase-X) so the team can reproduce.

## Exit codes

- `0` — clean or warnings only
- `1` — at least one MUST-match invariant drifted
- `2` — usage/argument error

## What this does NOT cover

- Per-request correctness of the API (future test-infra epic)
- UI regressions (manual QA for now)
- Performance (flagged in the plan as a risk to monitor)
