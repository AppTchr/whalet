/**
 * Reconciliation Snapshot — Fase 0 safety net for the Transaction unification.
 *
 * Captures financial invariants from the current database state into a JSON
 * file. Re-run after each migration phase and diff against the baseline to
 * detect any drift in balances, fatura totals, category breakdowns, or
 * aggregate counts.
 *
 * Usage:
 *   pnpm ts-node scripts/reconciliation/snapshot.ts <label>
 *   # e.g. pnpm ts-node scripts/reconciliation/snapshot.ts pre-fase-1
 *
 * Output: scripts/reconciliation/snapshots/<label>.json
 */

import { PrismaClient, Prisma } from "@prisma/client";
import { createHash } from "crypto";
import { writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";

const prisma = new PrismaClient();

type WalletBalance = {
  walletId: string;
  walletName: string;
  confirmedCents: number;
  projectedCents: number;
};

// Domain rule (per financial-domain-expert):
//   Bank balance reflects ONLY types that move cash. Credit-card purchases
//   and refunds are commitments, not movements — they affect the fatura, not
//   the bank account. Only invoice_payment is the balance-affecting cash
//   event for the card.
const BALANCE_AFFECTING_TYPES = [
  "income",
  "expense",
  "transfer_in",
  "transfer_out",
  "invoice_payment",
] as const;

type FaturaTotal = {
  faturaId: string;
  cardId: string;
  walletId: string;
  referenceMonth: string;
  invoicePaymentTxId: string | null;
  totalFromInstallmentsCents: number;
  totalFromTxCents: number | null; // populated once Fase 2 dual-write is active
  installmentCount: number;
};

type CategoryBreakdown = {
  walletId: string;
  yearMonth: string;
  categoryId: string | null;
  type: string;
  status: string;
  totalCents: number;
  count: number;
};

type TransactionTypeStatus = {
  walletId: string;
  type: string;
  status: string;
  count: number;
  totalCents: number;
};

type Snapshot = {
  label: string;
  capturedAt: string;
  schemaHints: {
    hasInstallmentTable: boolean;
    transactionHasFaturaId: boolean;
    transactionHasPurchaseId: boolean;
  };
  walletBalances: WalletBalance[];
  faturaTotals: FaturaTotal[];
  categoryBreakdown: CategoryBreakdown[];
  transactionMix: TransactionTypeStatus[];
  rowHash: string;
};

// Decimal → cents (integer) — avoids float drift across runs
function decToCents(d: Prisma.Decimal): number {
  return Math.round(Number(d) * 100);
}

// ────────────────────────────────────────────────────────────────────────────
// Schema probing — lets the snapshot adapt as we evolve the schema
// ────────────────────────────────────────────────────────────────────────────

async function probeSchema() {
  const [installmentProbe, faturaIdProbe, purchaseIdProbe] = await Promise.all([
    prisma.$queryRaw<Array<{ exists: boolean }>>(
      Prisma.sql`SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'installments') AS exists`,
    ),
    prisma.$queryRaw<Array<{ exists: boolean }>>(
      Prisma.sql`SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transactions' AND column_name = 'faturaId') AS exists`,
    ),
    prisma.$queryRaw<Array<{ exists: boolean }>>(
      Prisma.sql`SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transactions' AND column_name = 'purchaseId') AS exists`,
    ),
  ]);
  return {
    hasInstallmentTable: installmentProbe[0]?.exists ?? false,
    transactionHasFaturaId: faturaIdProbe[0]?.exists ?? false,
    transactionHasPurchaseId: purchaseIdProbe[0]?.exists ?? false,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Invariant: wallet balances (confirmed + projected)
//
// confirmed = sum(sign * amount) for paid, non-deleted, non-canceled txs
// projected = confirmed + sum(sign * amount) for pending (not canceled) txs
// Both include initialBalance from the wallet.
// ────────────────────────────────────────────────────────────────────────────

async function collectWalletBalances(): Promise<WalletBalance[]> {
  const wallets = await prisma.wallet.findMany({
    select: { id: true, name: true, initialBalance: true },
  });

  const typeList = Prisma.join(
    BALANCE_AFFECTING_TYPES.map((t) => Prisma.sql`${t}::"TransactionType"`),
  );

  const result: WalletBalance[] = [];
  for (const w of wallets) {
    const [paidSigned] = await prisma.$queryRaw<Array<{ sum: string | null }>>(
      Prisma.sql`SELECT COALESCE(SUM(sign::numeric * amount), 0)::text AS sum
                 FROM transactions
                 WHERE "walletId" = ${w.id}
                   AND status = 'paid'
                   AND "deletedAt" IS NULL
                   AND type IN (${typeList})`,
    );
    const [pendingSigned] = await prisma.$queryRaw<
      Array<{ sum: string | null }>
    >(
      Prisma.sql`SELECT COALESCE(SUM(sign::numeric * amount), 0)::text AS sum
                 FROM transactions
                 WHERE "walletId" = ${w.id}
                   AND status = 'pending'
                   AND "deletedAt" IS NULL
                   AND type IN (${typeList})`,
    );

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

// ────────────────────────────────────────────────────────────────────────────
// Invariant: fatura totals (current source: Installment; future source: Transaction)
// ────────────────────────────────────────────────────────────────────────────

async function collectFaturaTotals(
  hints: Awaited<ReturnType<typeof probeSchema>>,
): Promise<FaturaTotal[]> {
  const faturas = await prisma.fatura.findMany({
    select: {
      id: true,
      cardId: true,
      walletId: true,
      referenceMonth: true,
      invoicePaymentTxId: true,
    },
  });

  const result: FaturaTotal[] = [];
  for (const f of faturas) {
    let totalFromInstallmentsCents = 0;
    let installmentCount = 0;
    if (hints.hasInstallmentTable) {
      const [row] = await prisma.$queryRaw<
        Array<{ sum: number | null; count: bigint }>
      >(
        Prisma.sql`SELECT COALESCE(SUM("amountCents"), 0)::int AS sum, COUNT(*)::bigint AS count
                     FROM installments
                    WHERE "faturaId" = ${f.id} AND status <> 'canceled'`,
      );
      totalFromInstallmentsCents = Number(row?.sum ?? 0);
      installmentCount = Number(row?.count ?? 0);
    }

    let totalFromTxCents: number | null = null;
    if (hints.transactionHasFaturaId) {
      const [row] = await prisma.$queryRaw<Array<{ sum: string | null }>>(
        Prisma.sql`SELECT COALESCE(SUM(amount), 0)::text AS sum
                   FROM transactions
                   WHERE "faturaId" = ${f.id}
                     AND type = 'credit_card_purchase'
                     AND status <> 'canceled'
                     AND "deletedAt" IS NULL`,
      );
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

// ────────────────────────────────────────────────────────────────────────────
// Invariant: monthly category breakdown
// ────────────────────────────────────────────────────────────────────────────

async function collectCategoryBreakdown(): Promise<CategoryBreakdown[]> {
  const rows = await prisma.$queryRaw<
    Array<{
      walletId: string;
      yearMonth: string;
      categoryId: string | null;
      type: string;
      status: string;
      total: string;
      count: bigint;
    }>
  >(
    Prisma.sql`SELECT "walletId",
                      TO_CHAR("dueDate", 'YYYY-MM') AS "yearMonth",
                      "categoryId",
                      type::text AS type,
                      status::text AS status,
                      COALESCE(SUM(amount), 0)::text AS total,
                      COUNT(*)::bigint AS count
                 FROM transactions
                 WHERE "deletedAt" IS NULL
                 GROUP BY "walletId", "yearMonth", "categoryId", type, status
                 ORDER BY "walletId", "yearMonth", "categoryId", type, status`,
  );

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

// ────────────────────────────────────────────────────────────────────────────
// Invariant: transaction mix per wallet × type × status
// ────────────────────────────────────────────────────────────────────────────

async function collectTransactionMix(): Promise<TransactionTypeStatus[]> {
  const rows = await prisma.$queryRaw<
    Array<{
      walletId: string;
      type: string;
      status: string;
      count: bigint;
      total: string;
    }>
  >(
    Prisma.sql`SELECT "walletId",
                      type::text AS type,
                      status::text AS status,
                      COUNT(*)::bigint AS count,
                      COALESCE(SUM(amount), 0)::text AS total
                 FROM transactions
                 WHERE "deletedAt" IS NULL
                 GROUP BY "walletId", type, status
                 ORDER BY "walletId", type, status`,
  );

  return rows.map((r) => ({
    walletId: r.walletId,
    type: r.type,
    status: r.status,
    count: Number(r.count),
    totalCents: Math.round(Number(r.total) * 100),
  }));
}

// ────────────────────────────────────────────────────────────────────────────
// Invariant: row-level hash
//
// Ordered SHA-256 over every (id, walletId, amount, sign, status, type,
// paidAt, dueDate) tuple. Picks up ANY row-level change across phases.
// ────────────────────────────────────────────────────────────────────────────

async function collectRowHash(): Promise<string> {
  const rows = await prisma.$queryRaw<
    Array<{
      id: string;
      walletId: string;
      amount: string;
      sign: number;
      status: string;
      type: string;
      paidAt: Date | null;
      dueDate: Date;
    }>
  >(
    Prisma.sql`SELECT id, "walletId", amount::text AS amount, sign,
                      status::text AS status, type::text AS type,
                      "paidAt", "dueDate"
                 FROM transactions
                 WHERE "deletedAt" IS NULL
                 ORDER BY id`,
  );

  const hasher = createHash("sha256");
  for (const r of rows) {
    hasher.update(
      [
        r.id,
        r.walletId,
        r.amount,
        String(r.sign),
        r.status,
        r.type,
        r.paidAt?.toISOString() ?? "",
        r.dueDate.toISOString().slice(0, 10),
      ].join("|"),
    );
    hasher.update("\n");
  }
  return hasher.digest("hex");
}

// ────────────────────────────────────────────────────────────────────────────

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

  const [walletBalances, faturaTotals, categoryBreakdown, transactionMix, rowHash] =
    await Promise.all([
      collectWalletBalances(),
      collectFaturaTotals(schemaHints),
      collectCategoryBreakdown(),
      collectTransactionMix(),
      collectRowHash(),
    ]);

  const snapshot: Snapshot = {
    label,
    capturedAt: new Date().toISOString(),
    schemaHints,
    walletBalances,
    faturaTotals,
    categoryBreakdown,
    transactionMix,
    rowHash,
  };

  const outPath = join(
    __dirname,
    "snapshots",
    `${label}.json`,
  );
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(snapshot, null, 2), "utf8");

  console.log(`snapshot saved: ${outPath}`);
  console.log(
    `  wallets=${walletBalances.length} faturas=${faturaTotals.length} categoryRows=${categoryBreakdown.length} txMixRows=${transactionMix.length}`,
  );
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
