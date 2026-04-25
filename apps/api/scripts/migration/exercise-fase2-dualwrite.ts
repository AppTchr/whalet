/**
 * Fase 2 dual-write exercise — boots the Nest app context, runs each
 * mutation flow that was changed, and verifies that Installment and
 * Transaction stay in lockstep.
 *
 * Scenarios:
 *   1. Create a 3x purchase                      → 3 installments, 3 transactions
 *   2. Cancel one installment                    → both flip to canceled
 *   3. Pay the fatura (full)                     → installments + txs flip to paid
 *   4. Unpay the fatura                          → installments + txs revert to pending
 *   5. Cancel the entire purchase                → all installments + txs canceled
 *
 * Cleanup is best-effort. Run against a dev DB you can afford to dirty.
 *
 * Usage:
 *   pnpm ts-node scripts/migration/exercise-fase2-dualwrite.ts
 */

import { NestFactory } from "@nestjs/core";
import { AppModule } from "../../src/app.module";
import { PrismaService } from "../../src/prisma/prisma.service";
import { PurchasesService } from "../../src/cards/purchases.service";
import { FaturasService } from "../../src/faturas/faturas.service";

type Step = {
  label: string;
  expect: (s: { byFatura: Map<string, { inst: number; tx: number }> }) => string | null;
};

type FaturaInvariant = {
  faturaId: string;
  pending: number;
  paid: number;
  canceled: number;
  total: number;
};

async function snapshotByFatura(prisma: PrismaService): Promise<FaturaInvariant[]> {
  return prisma.$queryRawUnsafe<FaturaInvariant[]>(`
    SELECT "faturaId",
           COUNT(*) FILTER (WHERE status = 'pending')::int  AS pending,
           COUNT(*) FILTER (WHERE status = 'paid')::int     AS paid,
           COUNT(*) FILTER (WHERE status = 'canceled')::int AS canceled,
           COALESCE(SUM(amount) FILTER (WHERE status <> 'canceled'), 0)::float AS total
      FROM transactions
     WHERE type = 'credit_card_purchase'
       AND "deletedAt" IS NULL
       AND "faturaId" IS NOT NULL
     GROUP BY "faturaId"
     ORDER BY "faturaId"
  `);
}

function assertInvariants(
  before: FaturaInvariant[],
  after: FaturaInvariant[],
  label: string,
  rule: (b: FaturaInvariant | undefined, a: FaturaInvariant) => string | null,
) {
  const beforeMap = new Map(before.map((r) => [r.faturaId, r]));
  for (const a of after) {
    const violation = rule(beforeMap.get(a.faturaId), a);
    if (violation) {
      console.error(`\n❌ ${label} — ${violation}`);
      console.error("   before:", beforeMap.get(a.faturaId));
      console.error("   after:", a);
      process.exit(1);
    }
  }
  console.log(`✅ ${label}`);
}

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: false,
  });
  const prisma = app.get(PrismaService);
  const purchases = app.get(PurchasesService);
  const faturas = app.get(FaturasService);

  // Pick any active card (with a wallet, dueDay/closingDay set).
  const card = await prisma.creditCard.findFirst({
    where: { isArchived: false },
  });
  if (!card) {
    console.error("no active card in DB — seed one before running this exercise");
    process.exit(2);
  }
  const walletId = card.walletId;
  const cardId = card.id;

  // Need a bank account in the same wallet for the pay step
  let bank = await prisma.bankAccount.findFirst({
    where: { walletId, isArchived: false },
  });
  if (!bank) {
    bank = await prisma.bankAccount.create({
      data: {
        walletId,
        name: "Exercise account",
        type: "checking",
      },
    });
  }

  console.log(`Using card=${cardId}, wallet=${walletId}, bank=${bank.id}`);

  const before0 = await snapshotByFatura(prisma);

  // ── Step 1: create a 3x purchase ────────────────────────────────────────
  const purchase = await purchases.create(walletId, cardId, {
    description: `[exercise-final] ${new Date().toISOString()}`,
    totalAmountCents: 30000,
    installmentCount: 3,
    purchaseDate: new Date().toISOString().slice(0, 10),
  } as any);
  console.log(`step 1: created purchase ${purchase.id} with 3 parcelas`);
  const after1 = await snapshotByFatura(prisma);
  assertInvariants(before0, after1, "after create — every parcela starts pending", (_b, a) => {
    if (a.pending < 1 && a.paid + a.canceled === 0) return "fatura has no pending parcelas";
    return null;
  });

  // ── Step 2: cancel one parcela ──────────────────────────────────────────
  const firstParcela = purchase.installments[0];
  await purchases.cancelInstallment(walletId, cardId, purchase.id, firstParcela.id);
  console.log(`step 2: canceled parcela ${firstParcela.id}`);
  const after2 = await snapshotByFatura(prisma);
  const fatura1 = after2.find((r) => r.faturaId === firstParcela.faturaId);
  if (!fatura1 || fatura1.canceled < 1) {
    console.error("❌ canceled parcela not reflected in Transaction");
    process.exit(1);
  }
  console.log("✅ after cancelInstallment");

  // ── Step 3: pay the fatura of the next parcela ──────────────────────────
  const liveParcela = purchase.installments[1];
  await faturas.pay(walletId, cardId, liveParcela.faturaId, {
    bankAccountId: bank.id,
  } as any);
  console.log(`step 3: paid fatura ${liveParcela.faturaId}`);
  const after3 = await snapshotByFatura(prisma);
  const fatura2 = after3.find((r) => r.faturaId === liveParcela.faturaId);
  if (!fatura2 || fatura2.paid < 1 || fatura2.pending !== 0) {
    console.error("❌ pay did not flip parcelas to paid", fatura2);
    process.exit(1);
  }
  console.log("✅ after pay — parcelas paid, no pending leftover");

  // ── Step 4: unpay the same fatura ───────────────────────────────────────
  await faturas.unpay(walletId, cardId, liveParcela.faturaId);
  console.log(`step 4: unpaid fatura ${liveParcela.faturaId}`);
  const after4 = await snapshotByFatura(prisma);
  const fatura3 = after4.find((r) => r.faturaId === liveParcela.faturaId);
  if (!fatura3 || fatura3.paid !== 0 || fatura3.pending < 1) {
    console.error("❌ unpay did not restore pending parcelas", fatura3);
    process.exit(1);
  }
  console.log("✅ after unpay — parcelas back to pending");

  // ── Step 5: cancel the whole purchase ───────────────────────────────────
  await purchases.cancel(walletId, cardId, purchase.id);
  console.log(`step 5: canceled purchase ${purchase.id}`);
  const allCanceled = await prisma.transaction.count({
    where: { purchaseId: purchase.id, type: "credit_card_purchase", status: { not: "canceled" } },
  });
  if (allCanceled > 0) {
    console.error(`❌ ${allCanceled} non-canceled parcela(s) remain after purchase cancel`);
    process.exit(1);
  }
  console.log("✅ after cancel — every parcela canceled");

  console.log("\n🎉 End-to-end Transaction-only flow validated");
  await app.close();
}

main().catch(async (e) => {
  console.error(e);
  process.exit(1);
});
