CREATE TABLE "budgets" (
    "id" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "budgets_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "budgets_walletId_categoryId_key" ON "budgets"("walletId", "categoryId");
CREATE INDEX "budgets_walletId_idx" ON "budgets"("walletId");

ALTER TABLE "budgets" ADD CONSTRAINT "budgets_walletId_fkey"
    FOREIGN KEY ("walletId") REFERENCES "wallets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "budgets" ADD CONSTRAINT "budgets_categoryId_fkey"
    FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
