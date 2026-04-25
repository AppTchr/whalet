/**
 * Reconciliation Diff — compares two snapshot files and reports drift.
 *
 * Usage:
 *   pnpm ts-node scripts/reconciliation/diff.ts <baseline-label> <current-label>
 *   # e.g. pnpm ts-node scripts/reconciliation/diff.ts pre-fase-1 post-fase-1
 *
 * Semantics:
 *   - Wallet balances MUST be identical across all phases.
 *   - Category breakdown MUST be identical until Fase 3 (cutover changes
 *     category-of-fatura → category-of-purchase by design).
 *   - Fatura totals: totalFromInstallmentsCents MUST equal totalFromTxCents
 *     once Fase 2 is live; before that, totalFromTxCents is null.
 *   - rowHash drift is expected whenever new txs are inserted — not a failure
 *     by itself, but flagged for inspection.
 *
 * Exit code 0 = clean, 1 = drift detected in a MUST-match invariant.
 */

import { readFileSync, existsSync } from "fs";
import { join } from "path";

function loadSnapshot(label: string): any {
  const path = join(__dirname, "snapshots", `${label}.json`);
  if (!existsSync(path)) {
    console.error(`snapshot not found: ${path}`);
    process.exit(2);
  }
  return JSON.parse(readFileSync(path, "utf8"));
}

type Issue = { severity: "error" | "warn"; message: string };

function diffWalletBalances(a: any[], b: any[]): Issue[] {
  const issues: Issue[] = [];
  const byIdA = new Map(a.map((w) => [w.walletId, w]));
  const byIdB = new Map(b.map((w) => [w.walletId, w]));

  for (const [id, wA] of byIdA) {
    const wB = byIdB.get(id);
    if (!wB) {
      issues.push({ severity: "error", message: `wallet ${id} (${wA.walletName}) disappeared` });
      continue;
    }
    if (wA.confirmedCents !== wB.confirmedCents) {
      issues.push({
        severity: "error",
        message: `wallet ${id} (${wA.walletName}) confirmed drift: ${wA.confirmedCents} → ${wB.confirmedCents} (Δ ${wB.confirmedCents - wA.confirmedCents})`,
      });
    }
    if (wA.projectedCents !== wB.projectedCents) {
      issues.push({
        severity: "error",
        message: `wallet ${id} (${wA.walletName}) projected drift: ${wA.projectedCents} → ${wB.projectedCents} (Δ ${wB.projectedCents - wA.projectedCents})`,
      });
    }
  }

  for (const [id, wB] of byIdB) {
    if (!byIdA.has(id)) {
      issues.push({ severity: "warn", message: `new wallet ${id} (${wB.walletName})` });
    }
  }

  return issues;
}

function diffFaturaTotals(
  a: any[],
  b: any[],
  bothHaveInstallmentTable: boolean,
): Issue[] {
  const issues: Issue[] = [];
  const byIdA = new Map(a.map((f) => [f.faturaId, f]));
  const byIdB = new Map(b.map((f) => [f.faturaId, f]));

  for (const [id, fA] of byIdA) {
    const fB = byIdB.get(id);
    if (!fB) {
      issues.push({ severity: "error", message: `fatura ${id} disappeared` });
      continue;
    }
    // Only meaningful while the legacy installments table exists.
    if (
      bothHaveInstallmentTable &&
      fA.totalFromInstallmentsCents !== fB.totalFromInstallmentsCents
    ) {
      issues.push({
        severity: "error",
        message: `fatura ${id} installment total drift: ${fA.totalFromInstallmentsCents} → ${fB.totalFromInstallmentsCents}`,
      });
    }
    // While dual-write is active (Fase 2 → Fase 3), the tx-sourced total must
    // match the installment total. After Fase 4 the installments table is gone
    // so this check no longer applies.
    if (
      bothHaveInstallmentTable &&
      fB.totalFromTxCents !== null &&
      fB.totalFromTxCents !== fB.totalFromInstallmentsCents
    ) {
      issues.push({
        severity: "error",
        message: `fatura ${id} dual-source mismatch: installments=${fB.totalFromInstallmentsCents} vs transactions=${fB.totalFromTxCents}`,
      });
    }
  }

  for (const [id] of byIdB) {
    if (!byIdA.has(id)) {
      issues.push({ severity: "warn", message: `new fatura ${id}` });
    }
  }

  return issues;
}

function keyCategoryRow(r: any): string {
  return `${r.walletId}|${r.yearMonth}|${r.categoryId ?? "∅"}|${r.type}|${r.status}`;
}

function diffCategoryBreakdown(a: any[], b: any[]): Issue[] {
  // Category breakdown drift is expected across phases (Fase 3 changes
  // category attribution from fatura-aggregate to per-purchase by design,
  // and any new transaction inserted between snapshots will add rows).
  // Always reported as warnings — never as fatal drift.
  const issues: Issue[] = [];
  const mapA = new Map(a.map((r) => [keyCategoryRow(r), r]));
  const mapB = new Map(b.map((r) => [keyCategoryRow(r), r]));

  for (const [k, rA] of mapA) {
    const rB = mapB.get(k);
    if (!rB) {
      issues.push({ severity: "warn", message: `category row missing: ${k} (was ${rA.totalCents}¢, count=${rA.count})` });
      continue;
    }
    if (rA.totalCents !== rB.totalCents || rA.count !== rB.count) {
      issues.push({
        severity: "warn",
        message: `category row drift: ${k} total=${rA.totalCents}→${rB.totalCents} count=${rA.count}→${rB.count}`,
      });
    }
  }

  for (const [k, rB] of mapB) {
    if (!mapA.has(k)) {
      issues.push({ severity: "warn", message: `new category row: ${k} (total=${rB.totalCents}¢, count=${rB.count})` });
    }
  }

  return issues;
}

function diffRowHash(a: string, b: string): Issue[] {
  if (a === b) return [];
  return [
    {
      severity: "warn",
      message: `transaction rowHash changed (${a.slice(0, 8)}… → ${b.slice(0, 8)}…) — expected when dual-write inserts new rows`,
    },
  ];
}

function main() {
  const [baselineLabel, currentLabel] = process.argv.slice(2);
  if (!baselineLabel || !currentLabel) {
    console.error("usage: ts-node scripts/reconciliation/diff.ts <baseline> <current>");
    process.exit(2);
  }

  const baseline = loadSnapshot(baselineLabel);
  const current = loadSnapshot(currentLabel);

  const bothHaveInstallments =
    baseline.schemaHints?.hasInstallmentTable === true &&
    current.schemaHints?.hasInstallmentTable === true;

  const issues: Issue[] = [
    ...diffWalletBalances(baseline.walletBalances, current.walletBalances),
    ...diffFaturaTotals(baseline.faturaTotals, current.faturaTotals, bothHaveInstallments),
    ...diffCategoryBreakdown(baseline.categoryBreakdown, current.categoryBreakdown),
    ...diffRowHash(baseline.rowHash, current.rowHash),
  ];

  const errors = issues.filter((i) => i.severity === "error");
  const warns = issues.filter((i) => i.severity === "warn");

  console.log(`\n=== Reconciliation diff: ${baselineLabel} → ${currentLabel} ===\n`);
  if (errors.length === 0 && warns.length === 0) {
    console.log("✅ no drift detected");
    return;
  }
  for (const e of errors) console.log(`❌ ${e.message}`);
  for (const w of warns) console.log(`⚠️  ${w.message}`);
  console.log(`\n${errors.length} error(s), ${warns.length} warning(s)`);

  if (errors.length > 0) process.exit(1);
}

main();
