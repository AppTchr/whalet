-- Fase 4 cleanup — drop the legacy dual model now that all reads/writes go
-- through Transaction.

-- Drop the projected-tx FK and the unique constraint before dropping the column.
ALTER TABLE "faturas" DROP CONSTRAINT IF EXISTS "faturas_projectedTxId_fkey";
ALTER TABLE "faturas" DROP CONSTRAINT IF EXISTS "faturas_projectedTxId_key";
ALTER TABLE "faturas" DROP COLUMN IF EXISTS "projectedTxId";

-- Fatura.categoryId — categories now live on each Transaction.
ALTER TABLE "faturas" DROP CONSTRAINT IF EXISTS "faturas_categoryId_fkey";
ALTER TABLE "faturas" DROP COLUMN IF EXISTS "categoryId";

-- Drop the installments table and its enum.
DROP TABLE IF EXISTS "installments";
DROP TYPE IF EXISTS "InstallmentStatus";
