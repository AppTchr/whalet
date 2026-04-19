-- AlterEnum: ADD VALUE cannot run inside a transaction block in PostgreSQL
ALTER TYPE "TransactionType" ADD VALUE 'credit_card_refund';

-- CreateEnum
CREATE TYPE "InstallmentStatus" AS ENUM ('pending', 'paid', 'canceled');

-- CreateEnum
CREATE TYPE "PurchaseStatus" AS ENUM ('active', 'canceled');

-- CreateTable
CREATE TABLE "credit_cards" (
    "id" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "closingDay" INTEGER NOT NULL,
    "dueDay" INTEGER NOT NULL,
    "creditLimitCents" INTEGER,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "credit_cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "faturas" (
    "id" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "referenceMonth" VARCHAR(7) NOT NULL,
    "closingDate" DATE NOT NULL,
    "dueDate" DATE NOT NULL,
    "invoicePaymentTxId" TEXT,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "faturas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_card_purchases" (
    "id" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "description" VARCHAR(255) NOT NULL,
    "totalAmountCents" INTEGER NOT NULL,
    "installmentCount" INTEGER NOT NULL,
    "purchaseDate" DATE NOT NULL,
    "categoryId" TEXT,
    "notes" TEXT,
    "status" "PurchaseStatus" NOT NULL DEFAULT 'active',
    "canceledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "credit_card_purchases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "installments" (
    "id" TEXT NOT NULL,
    "purchaseId" TEXT NOT NULL,
    "faturaId" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "installmentNumber" INTEGER NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "dueDate" DATE NOT NULL,
    "status" "InstallmentStatus" NOT NULL DEFAULT 'pending',
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "installments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "credit_cards_walletId_idx" ON "credit_cards"("walletId");

-- CreateIndex
CREATE INDEX "credit_cards_walletId_isArchived_idx" ON "credit_cards"("walletId", "isArchived");

-- CreateIndex
CREATE UNIQUE INDEX "faturas_invoicePaymentTxId_key" ON "faturas"("invoicePaymentTxId");

-- CreateIndex
CREATE INDEX "faturas_walletId_cardId_idx" ON "faturas"("walletId", "cardId");

-- CreateIndex
CREATE INDEX "faturas_cardId_dueDate_idx" ON "faturas"("cardId", "dueDate");

-- CreateIndex
CREATE UNIQUE INDEX "faturas_cardId_referenceMonth_key" ON "faturas"("cardId", "referenceMonth");

-- CreateIndex
CREATE INDEX "credit_card_purchases_walletId_cardId_idx" ON "credit_card_purchases"("walletId", "cardId");

-- CreateIndex
CREATE INDEX "credit_card_purchases_walletId_status_idx" ON "credit_card_purchases"("walletId", "status");

-- CreateIndex
CREATE INDEX "credit_card_purchases_cardId_purchaseDate_idx" ON "credit_card_purchases"("cardId", "purchaseDate");

-- CreateIndex
CREATE INDEX "installments_purchaseId_idx" ON "installments"("purchaseId");

-- CreateIndex
CREATE INDEX "installments_faturaId_status_idx" ON "installments"("faturaId", "status");

-- CreateIndex
CREATE INDEX "installments_cardId_status_idx" ON "installments"("cardId", "status");

-- CreateIndex
CREATE INDEX "installments_walletId_status_idx" ON "installments"("walletId", "status");

-- AddForeignKey
ALTER TABLE "credit_cards" ADD CONSTRAINT "credit_cards_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "wallets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "faturas" ADD CONSTRAINT "faturas_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "credit_cards"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "faturas" ADD CONSTRAINT "faturas_invoicePaymentTxId_fkey" FOREIGN KEY ("invoicePaymentTxId") REFERENCES "transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_card_purchases" ADD CONSTRAINT "credit_card_purchases_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "credit_cards"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_card_purchases" ADD CONSTRAINT "credit_card_purchases_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "installments" ADD CONSTRAINT "installments_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "credit_card_purchases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "installments" ADD CONSTRAINT "installments_faturaId_fkey" FOREIGN KEY ("faturaId") REFERENCES "faturas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- =============================================================================
-- CHECK constraints (business invariants not expressible in Prisma schema)
-- NOTE: PostgreSQL column names are camelCase (Prisma default — no @map on fields)
-- =============================================================================

ALTER TABLE credit_cards
  ADD CONSTRAINT chk_credit_cards_closing_day CHECK ("closingDay" BETWEEN 1 AND 28),
  ADD CONSTRAINT chk_credit_cards_due_day     CHECK ("dueDay" BETWEEN 1 AND 28),
  ADD CONSTRAINT chk_credit_cards_limit_positive CHECK ("creditLimitCents" IS NULL OR "creditLimitCents" > 0);

ALTER TABLE credit_card_purchases
  ADD CONSTRAINT chk_purchases_installment_count CHECK ("installmentCount" BETWEEN 1 AND 48),
  ADD CONSTRAINT chk_purchases_total_amount      CHECK ("totalAmountCents" > 0);

ALTER TABLE installments
  ADD CONSTRAINT chk_installments_number CHECK ("installmentNumber" >= 1),
  ADD CONSTRAINT chk_installments_amount CHECK ("amountCents" > 0);

ALTER TABLE faturas
  ADD CONSTRAINT chk_faturas_reference_month CHECK ("referenceMonth" ~ '^\d{4}-(0[1-9]|1[0-2])$');

-- Wallet FK enforcement on child tables (walletId is denormalized for query performance)
ALTER TABLE faturas
  ADD CONSTRAINT faturas_walletId_fkey FOREIGN KEY ("walletId") REFERENCES wallets(id) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE installments
  ADD CONSTRAINT installments_walletId_fkey FOREIGN KEY ("walletId") REFERENCES wallets(id) ON DELETE RESTRICT ON UPDATE CASCADE;

-- Also update the transactions sign constraint to include credit_card_refund
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS chk_transactions_sign_type_match;
ALTER TABLE transactions ADD CONSTRAINT chk_transactions_sign_type_match CHECK (
  (type = 'income' AND sign = 1) OR
  (type = 'expense' AND sign = -1) OR
  (type = 'transfer_in' AND sign = 1) OR
  (type = 'transfer_out' AND sign = -1) OR
  (type = 'credit_card_purchase' AND sign = 0) OR
  (type = 'invoice_payment' AND sign = -1) OR
  (type = 'credit_card_refund' AND sign = 0)
);

-- Covering index for fatura total computation (SUM aggregate served from index)
CREATE INDEX idx_installments_fatura_status_covering
  ON installments ("faturaId", status)
  INCLUDE ("amountCents");
