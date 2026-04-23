-- CreateEnum
CREATE TYPE "RecurrenceFrequency" AS ENUM ('daily', 'weekly', 'biweekly', 'monthly');

-- CreateTable: recurring_transactions
CREATE TABLE "recurring_transactions" (
    "id"                TEXT NOT NULL,
    "walletId"          TEXT NOT NULL,
    "type"              "TransactionType" NOT NULL,
    "frequency"         "RecurrenceFrequency" NOT NULL,
    "description"       VARCHAR(255) NOT NULL,
    "amount"            DECIMAL(14,2) NOT NULL,
    "categoryId"        TEXT,
    "bankAccountId"     TEXT,
    "notes"             TEXT,
    "startDate"         DATE NOT NULL,
    "endDate"           DATE,
    "maxOccurrences"    INTEGER,
    "lastGeneratedDate" DATE,
    "isActive"          BOOLEAN NOT NULL DEFAULT true,
    "deletedAt"         TIMESTAMP(3),
    "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"         TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recurring_transactions_pkey" PRIMARY KEY ("id")
);

-- AddColumns to transactions: recurrenceId + recurrenceIndex
ALTER TABLE "transactions"
    ADD COLUMN "recurrenceId"    TEXT,
    ADD COLUMN "recurrenceIndex" INTEGER;

-- AddForeignKey: recurring_transactions → wallets
ALTER TABLE "recurring_transactions"
    ADD CONSTRAINT "recurring_transactions_walletId_fkey"
    FOREIGN KEY ("walletId") REFERENCES "wallets"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: recurring_transactions → categories
ALTER TABLE "recurring_transactions"
    ADD CONSTRAINT "recurring_transactions_categoryId_fkey"
    FOREIGN KEY ("categoryId") REFERENCES "categories"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: recurring_transactions → bank_accounts
ALTER TABLE "recurring_transactions"
    ADD CONSTRAINT "recurring_transactions_bankAccountId_fkey"
    FOREIGN KEY ("bankAccountId") REFERENCES "bank_accounts"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: transactions → recurring_transactions
ALTER TABLE "transactions"
    ADD CONSTRAINT "transactions_recurrenceId_fkey"
    FOREIGN KEY ("recurrenceId") REFERENCES "recurring_transactions"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- Indexes
CREATE INDEX "recurring_transactions_walletId_idx"          ON "recurring_transactions"("walletId");
CREATE INDEX "recurring_transactions_walletId_isActive_idx" ON "recurring_transactions"("walletId", "isActive");
CREATE INDEX "transactions_recurrenceId_idx"                ON "transactions"("recurrenceId");

-- Check: only income/expense allowed as recurrence type
ALTER TABLE "recurring_transactions"
    ADD CONSTRAINT "chk_recurring_type_allowed"
    CHECK (type IN ('income', 'expense'));

-- Check: amount must be positive
ALTER TABLE "recurring_transactions"
    ADD CONSTRAINT "chk_recurring_amount_positive"
    CHECK (amount > 0);

-- Check: endDate must be >= startDate when set
ALTER TABLE "recurring_transactions"
    ADD CONSTRAINT "chk_recurring_end_after_start"
    CHECK ("endDate" IS NULL OR "endDate" >= "startDate");

-- Check: maxOccurrences must be positive when set
ALTER TABLE "recurring_transactions"
    ADD CONSTRAINT "chk_recurring_max_occurrences_positive"
    CHECK ("maxOccurrences" IS NULL OR "maxOccurrences" > 0);
