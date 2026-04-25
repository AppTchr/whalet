-- Housekeeping after Transaction unification: the audit columns added in
-- Fase 1 to support the backfill (`legacyInstallmentId`, `source`) are no
-- longer needed. The Installment table they referenced is gone.

DROP INDEX IF EXISTS "transactions_legacyInstallmentId_key";

ALTER TABLE "transactions"
  DROP COLUMN IF EXISTS "legacyInstallmentId",
  DROP COLUMN IF EXISTS "source";
