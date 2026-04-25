"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
const DRY_RUN = process.argv.includes("--dry-run");
const SOURCE_TAG = "migration_v1";
async function loadInstallments() {
    return prisma.$queryRaw(client_1.Prisma.sql `SELECT i.id, i."purchaseId", i."faturaId", i."cardId", i."walletId",
                      i."installmentNumber", i."amountCents", i."dueDate",
                      i.status::text AS status, i."paidAt",
                      p."categoryId" AS "purchaseCategoryId",
                      p.description AS "purchaseDescription",
                      p."installmentCount" AS "purchaseInstallmentCount"
                 FROM installments i
                 JOIN credit_card_purchases p ON p.id = i."purchaseId"
                 ORDER BY i."faturaId", i."installmentNumber"`);
}
async function backfill(installments) {
    let inserted = 0;
    let skipped = 0;
    for (const i of installments) {
        const description = `${i.purchaseDescription} (${i.installmentNumber}/${i.purchaseInstallmentCount})`;
        const amount = (i.amountCents / 100).toFixed(2);
        if (DRY_RUN) {
            const [{ count }] = await prisma.$queryRaw(client_1.Prisma.sql `SELECT COUNT(*)::bigint AS count FROM transactions WHERE "legacyInstallmentId" = ${i.id}`);
            if (Number(count) === 0)
                inserted++;
            else
                skipped++;
            continue;
        }
        const result = await prisma.$executeRaw(client_1.Prisma.sql `
        INSERT INTO transactions (
          id, "walletId", "categoryId", "bankAccountId", type, status,
          amount, sign, description, "dueDate", "paidAt",
          "faturaId", "purchaseId", "installmentNumber", "totalInstallments",
          source, "legacyInstallmentId",
          "createdAt", "updatedAt"
        ) VALUES (
          gen_random_uuid(), ${i.walletId}, ${i.purchaseCategoryId}, NULL,
          'credit_card_purchase'::"TransactionType",
          ${i.status}::"TransactionStatus",
          ${client_1.Prisma.raw(`'${amount}'::numeric(14,2)`)}, 0,
          ${description}, ${i.dueDate}, ${i.paidAt},
          ${i.faturaId}, ${i.purchaseId}, ${i.installmentNumber}, ${i.purchaseInstallmentCount},
          ${SOURCE_TAG}, ${i.id},
          NOW(), NOW()
        )
        ON CONFLICT ("legacyInstallmentId") DO NOTHING
      `);
        if (result === 1)
            inserted++;
        else
            skipped++;
    }
    return { inserted, skipped };
}
async function reconcile() {
    const rows = await prisma.$queryRaw(client_1.Prisma.sql `
      WITH inst AS (
        SELECT "faturaId", COALESCE(SUM("amountCents"), 0) AS sum
          FROM installments
          WHERE status <> 'canceled'
          GROUP BY "faturaId"
      ),
      tx AS (
        SELECT "faturaId", COALESCE(SUM(amount * 100), 0)::bigint AS sum
          FROM transactions
          WHERE type = 'credit_card_purchase'
            AND status <> 'canceled'
            AND "deletedAt" IS NULL
            AND "faturaId" IS NOT NULL
          GROUP BY "faturaId"
      )
      SELECT COALESCE(inst."faturaId", tx."faturaId") AS "faturaId",
             COALESCE(inst.sum, 0)::bigint            AS "installmentSum",
             COALESCE(tx.sum,   0)::bigint            AS "txSum"
        FROM inst
        FULL OUTER JOIN tx ON tx."faturaId" = inst."faturaId"
    `);
    const mismatches = rows.filter((r) => Number(r.installmentSum) !== Number(r.txSum));
    if (mismatches.length > 0) {
        console.error("\n❌ Reconciliation failed — fatura totals diverged:");
        for (const m of mismatches) {
            console.error(`  fatura=${m.faturaId} installments=${m.installmentSum}¢ transactions=${m.txSum}¢ (Δ ${Number(m.txSum) - Number(m.installmentSum)}¢)`);
        }
        process.exit(1);
    }
    console.log(`✅ Reconciliation clean across ${rows.length} fatura(s).`);
}
async function main() {
    console.log(`${DRY_RUN ? "[DRY RUN] " : ""}Loading installments…`);
    const installments = await loadInstallments();
    console.log(`  found ${installments.length} installment(s)`);
    if (installments.length === 0) {
        console.log("Nothing to backfill.");
        return;
    }
    const { inserted, skipped } = await backfill(installments);
    console.log(`${DRY_RUN ? "[DRY RUN] would insert" : "inserted"}=${inserted} skipped=${skipped}`);
    if (!DRY_RUN) {
        await reconcile();
    }
    else {
        console.log("[DRY RUN] reconciliation skipped");
    }
}
main()
    .catch((e) => {
    console.error(e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
