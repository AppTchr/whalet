-- Fase 1 — Schema additions for credit-card unification.
-- Additive only: nothing removed yet. Old Installment table stays during dual-write.

-- AlterTable
ALTER TABLE "transactions"
  ADD COLUMN "faturaId"            TEXT,
  ADD COLUMN "purchaseId"          TEXT,
  ADD COLUMN "installmentNumber"   INTEGER,
  ADD COLUMN "totalInstallments"   INTEGER,
  ADD COLUMN "source"              VARCHAR(32),
  ADD COLUMN "legacyInstallmentId" TEXT;

-- CreateIndex
CREATE INDEX "transactions_faturaId_idx"   ON "transactions" ("faturaId");
CREATE INDEX "transactions_purchaseId_idx" ON "transactions" ("purchaseId");
CREATE UNIQUE INDEX "transactions_legacyInstallmentId_key" ON "transactions" ("legacyInstallmentId");

-- AddForeignKey
ALTER TABLE "transactions"
  ADD CONSTRAINT "transactions_faturaId_fkey"
  FOREIGN KEY ("faturaId") REFERENCES "faturas" ("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "transactions"
  ADD CONSTRAINT "transactions_purchaseId_fkey"
  FOREIGN KEY ("purchaseId") REFERENCES "credit_card_purchases" ("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
