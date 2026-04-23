/*
  Warnings:

  - You are about to drop the column `signed_amount` on the `transactions` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "idx_installments_fatura_status_covering";

-- AlterTable
ALTER TABLE "transactions" DROP COLUMN "signed_amount";

-- RenameForeignKey
ALTER TABLE "faturas" RENAME CONSTRAINT "faturas_walletid_fkey" TO "faturas_walletId_fkey";

-- RenameForeignKey
ALTER TABLE "installments" RENAME CONSTRAINT "installments_walletid_fkey" TO "installments_walletId_fkey";
