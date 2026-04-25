"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const path_1 = require("path");
function loadSnapshot(label) {
    const path = (0, path_1.join)(__dirname, "snapshots", `${label}.json`);
    if (!(0, fs_1.existsSync)(path)) {
        console.error(`snapshot not found: ${path}`);
        process.exit(2);
    }
    return JSON.parse((0, fs_1.readFileSync)(path, "utf8"));
}
function diffWalletBalances(a, b) {
    const issues = [];
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
function diffFaturaTotals(a, b) {
    const issues = [];
    const byIdA = new Map(a.map((f) => [f.faturaId, f]));
    const byIdB = new Map(b.map((f) => [f.faturaId, f]));
    for (const [id, fA] of byIdA) {
        const fB = byIdB.get(id);
        if (!fB) {
            issues.push({ severity: "error", message: `fatura ${id} disappeared` });
            continue;
        }
        if (fA.totalFromInstallmentsCents !== fB.totalFromInstallmentsCents) {
            issues.push({
                severity: "error",
                message: `fatura ${id} installment total drift: ${fA.totalFromInstallmentsCents} → ${fB.totalFromInstallmentsCents}`,
            });
        }
        if (fB.totalFromTxCents !== null) {
            if (fB.totalFromTxCents !== fB.totalFromInstallmentsCents) {
                issues.push({
                    severity: "error",
                    message: `fatura ${id} dual-source mismatch: installments=${fB.totalFromInstallmentsCents} vs transactions=${fB.totalFromTxCents}`,
                });
            }
        }
    }
    for (const [id] of byIdB) {
        if (!byIdA.has(id)) {
            issues.push({ severity: "warn", message: `new fatura ${id}` });
        }
    }
    return issues;
}
function keyCategoryRow(r) {
    return `${r.walletId}|${r.yearMonth}|${r.categoryId ?? "∅"}|${r.type}|${r.status}`;
}
function diffCategoryBreakdown(a, b) {
    const issues = [];
    const mapA = new Map(a.map((r) => [keyCategoryRow(r), r]));
    const mapB = new Map(b.map((r) => [keyCategoryRow(r), r]));
    for (const [k, rA] of mapA) {
        const rB = mapB.get(k);
        if (!rB) {
            issues.push({ severity: "error", message: `category row missing: ${k} (was ${rA.totalCents}¢, count=${rA.count})` });
            continue;
        }
        if (rA.totalCents !== rB.totalCents || rA.count !== rB.count) {
            issues.push({
                severity: "error",
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
function diffRowHash(a, b) {
    if (a === b)
        return [];
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
    const issues = [
        ...diffWalletBalances(baseline.walletBalances, current.walletBalances),
        ...diffFaturaTotals(baseline.faturaTotals, current.faturaTotals),
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
    for (const e of errors)
        console.log(`❌ ${e.message}`);
    for (const w of warns)
        console.log(`⚠️  ${w.message}`);
    console.log(`\n${errors.length} error(s), ${warns.length} warning(s)`);
    if (errors.length > 0)
        process.exit(1);
}
main();
