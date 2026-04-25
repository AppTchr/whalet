"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const crypto_1 = require("crypto");
const fs_1 = require("fs");
const path_1 = require("path");
const prisma = new client_1.PrismaClient();
const BALANCE_AFFECTING_TYPES = [
    "income",
    "expense",
    "transfer_in",
    "transfer_out",
    "invoice_payment",
];
function decToCents(d) {
    return Math.round(Number(d) * 100);
}
async function probeSchema() {
    const [installmentProbe, faturaIdProbe, purchaseIdProbe] = await Promise.all([
        prisma.$queryRaw(client_1.Prisma.sql `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'installments') AS exists`),
        prisma.$queryRaw(client_1.Prisma.sql `SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transactions' AND column_name = 'faturaId') AS exists`),
        prisma.$queryRaw(client_1.Prisma.sql `SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transactions' AND column_name = 'purchaseId') AS exists`),
    ]);
    return {
        hasInstallmentTable: installmentProbe[0]?.exists ?? false,
        transactionHasFaturaId: faturaIdProbe[0]?.exists ?? false,
        transactionHasPurchaseId: purchaseIdProbe[0]?.exists ?? false,
    };
}
async function collectWalletBalances() {
    const wallets = await prisma.wallet.findMany({
        select: { id: true, name: true, initialBalance: true },
    });
    const typeList = client_1.Prisma.join(BALANCE_AFFECTING_TYPES.map((t) => client_1.Prisma.sql `${t}::"TransactionType"`));
    const result = [];
    for (const w of wallets) {
        const [paidSigned] = await prisma.$queryRaw(client_1.Prisma.sql `SELECT COALESCE(SUM(sign::numeric * amount), 0)::text AS sum
                 FROM transactions
                 WHERE "walletId" = ${w.id}
                   AND status = 'paid'
                   AND "deletedAt" IS NULL
                   AND type IN (${typeList})`);
        const [pendingSigned] = await prisma.$queryRaw(client_1.Prisma.sql `SELECT COALESCE(SUM(sign::numeric * amount), 0)::text AS sum
                 FROM transactions
                 WHERE "walletId" = ${w.id}
                   AND status = 'pending'
                   AND "deletedAt" IS NULL
                   AND type IN (${typeList})`);
        const initialCents = decToCents(w.initialBalance);
        const paidCents = Math.round(Number(paidSigned?.sum ?? 0) * 100);
        const pendingCents = Math.round(Number(pendingSigned?.sum ?? 0) * 100);
        result.push({
            walletId: w.id,
            walletName: w.name,
            confirmedCents: initialCents + paidCents,
            projectedCents: initialCents + paidCents + pendingCents,
        });
    }
    return result.sort((a, b) => a.walletId.localeCompare(b.walletId));
}
async function collectFaturaTotals(hints) {
    const faturas = await prisma.fatura.findMany({
        select: {
            id: true,
            cardId: true,
            walletId: true,
            referenceMonth: true,
            invoicePaymentTxId: true,
        },
    });
    const result = [];
    for (const f of faturas) {
        let totalFromInstallmentsCents = 0;
        let installmentCount = 0;
        if (hints.hasInstallmentTable) {
            const agg = await prisma.installment.aggregate({
                where: { faturaId: f.id, status: { not: "canceled" } },
                _sum: { amountCents: true },
                _count: true,
            });
            totalFromInstallmentsCents = agg._sum.amountCents ?? 0;
            installmentCount = agg._count;
        }
        let totalFromTxCents = null;
        if (hints.transactionHasFaturaId) {
            const [row] = await prisma.$queryRaw(client_1.Prisma.sql `SELECT COALESCE(SUM(amount), 0)::text AS sum
                   FROM transactions
                   WHERE "faturaId" = ${f.id}
                     AND type = 'credit_card_purchase'
                     AND status <> 'canceled'
                     AND "deletedAt" IS NULL`);
            totalFromTxCents = Math.round(Number(row?.sum ?? 0) * 100);
        }
        result.push({
            faturaId: f.id,
            cardId: f.cardId,
            walletId: f.walletId,
            referenceMonth: f.referenceMonth,
            invoicePaymentTxId: f.invoicePaymentTxId,
            totalFromInstallmentsCents,
            totalFromTxCents,
            installmentCount,
        });
    }
    return result.sort((a, b) => a.faturaId.localeCompare(b.faturaId));
}
async function collectCategoryBreakdown() {
    const rows = await prisma.$queryRaw(client_1.Prisma.sql `SELECT "walletId",
                      TO_CHAR("dueDate", 'YYYY-MM') AS "yearMonth",
                      "categoryId",
                      type::text AS type,
                      status::text AS status,
                      COALESCE(SUM(amount), 0)::text AS total,
                      COUNT(*)::bigint AS count
                 FROM transactions
                 WHERE "deletedAt" IS NULL
                 GROUP BY "walletId", "yearMonth", "categoryId", type, status
                 ORDER BY "walletId", "yearMonth", "categoryId", type, status`);
    return rows.map((r) => ({
        walletId: r.walletId,
        yearMonth: r.yearMonth,
        categoryId: r.categoryId,
        type: r.type,
        status: r.status,
        totalCents: Math.round(Number(r.total) * 100),
        count: Number(r.count),
    }));
}
async function collectTransactionMix() {
    const rows = await prisma.$queryRaw(client_1.Prisma.sql `SELECT "walletId",
                      type::text AS type,
                      status::text AS status,
                      COUNT(*)::bigint AS count,
                      COALESCE(SUM(amount), 0)::text AS total
                 FROM transactions
                 WHERE "deletedAt" IS NULL
                 GROUP BY "walletId", type, status
                 ORDER BY "walletId", type, status`);
    return rows.map((r) => ({
        walletId: r.walletId,
        type: r.type,
        status: r.status,
        count: Number(r.count),
        totalCents: Math.round(Number(r.total) * 100),
    }));
}
async function collectRowHash() {
    const rows = await prisma.$queryRaw(client_1.Prisma.sql `SELECT id, "walletId", amount::text AS amount, sign,
                      status::text AS status, type::text AS type,
                      "paidAt", "dueDate"
                 FROM transactions
                 WHERE "deletedAt" IS NULL
                 ORDER BY id`);
    const hasher = (0, crypto_1.createHash)("sha256");
    for (const r of rows) {
        hasher.update([
            r.id,
            r.walletId,
            r.amount,
            String(r.sign),
            r.status,
            r.type,
            r.paidAt?.toISOString() ?? "",
            r.dueDate.toISOString().slice(0, 10),
        ].join("|"));
        hasher.update("\n");
    }
    return hasher.digest("hex");
}
async function main() {
    const label = process.argv[2];
    if (!label) {
        console.error("usage: ts-node scripts/reconciliation/snapshot.ts <label>");
        process.exit(2);
    }
    if (!/^[a-z0-9][a-z0-9-_]*$/i.test(label)) {
        console.error("label must be alphanumeric + dashes/underscores");
        process.exit(2);
    }
    const schemaHints = await probeSchema();
    console.log("schema hints:", schemaHints);
    const [walletBalances, faturaTotals, categoryBreakdown, transactionMix, rowHash] = await Promise.all([
        collectWalletBalances(),
        collectFaturaTotals(schemaHints),
        collectCategoryBreakdown(),
        collectTransactionMix(),
        collectRowHash(),
    ]);
    const snapshot = {
        label,
        capturedAt: new Date().toISOString(),
        schemaHints,
        walletBalances,
        faturaTotals,
        categoryBreakdown,
        transactionMix,
        rowHash,
    };
    const outPath = (0, path_1.join)(__dirname, "snapshots", `${label}.json`);
    (0, fs_1.mkdirSync)((0, path_1.dirname)(outPath), { recursive: true });
    (0, fs_1.writeFileSync)(outPath, JSON.stringify(snapshot, null, 2), "utf8");
    console.log(`snapshot saved: ${outPath}`);
    console.log(`  wallets=${walletBalances.length} faturas=${faturaTotals.length} categoryRows=${categoryBreakdown.length} txMixRows=${transactionMix.length}`);
    console.log(`  rowHash=${rowHash}`);
}
main()
    .catch((e) => {
    console.error(e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
