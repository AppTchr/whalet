# Transaction Unification — Release Notes

**Status:** completed 2026-04-25
**Migration ID:** `20260425000000_fase1` … `20260425100000_fase4`
**Author:** AI engineering team
**Related:** `docs/backlog/test-infrastructure-epic.md`

## Summary

Unified the credit-card domain so that every parcela of every purchase is a
first-class `Transaction` row, replacing the legacy parallel `Installment`
table. Brings credit-card spending to the same model as recurring
transactions: each event is one transaction, fatura is a query/agreement
over those transactions.

## What changed

### Data model
- `Transaction` gained `faturaId`, `purchaseId`, `installmentNumber`,
  `totalInstallments`, `source`, `legacyInstallmentId`. New FKs to
  `Fatura` and `CreditCardPurchase`.
- `Installment` table dropped.
- `Fatura.projectedTxId` and `Fatura.categoryId` dropped — categories now
  live on each `Transaction`.
- `CreditCardPurchase` survives as the header of grouped parcelas
  (description, total, installmentCount, default categoryId).
- `chk_transactions_sign_type_match` already enforced `sign=0` for
  `credit_card_purchase` — leveraged to keep parcelas out of bank-balance
  aggregations automatically.

### Domain rules (from financial-domain-expert)
1. Bank balance is moved by `income`, `expense`, `transfer_*`,
   `invoice_payment` only. `credit_card_purchase` and
   `credit_card_refund` never affect bank balance (sign=0).
2. Categoria de cada parcela é independente; o header
   (`CreditCardPurchase.categoryId`) é apenas default — edição não
   cascateia.
3. Para fatura paga: `Σ parcelas == invoice_payment.amount`, tolerância 0.
4. `invoice_payment` existe se e somente se `Fatura.invoicePaymentTxId` é
   não-nulo.

### Behavior changes (intentional)
- Listagem `/transactions` agora mostra **cada parcela** individualmente
  (antes: 1 linha agregada por fatura).
- Dashboard breakdown por categoria agora usa a categoria de **cada
  compra**, não mais a categoria agregada da fatura. `invoice_payment`
  saiu da query de breakdown para evitar dupla contagem.
- Endpoint `PATCH /faturas/:id/category` agora aplica a categoria a todas
  as transações `credit_card_purchase` da fatura (era um campo no header
  da fatura).
- `POST /transactions/:id/pay` em transações `invoice_payment` passa a
  rejeitar com `USE_FATURA_PAY_ENDPOINT` (o caminho oficial é o endpoint
  da fatura).

## Phases executed

| Fase | Entregas |
|---|---|
| 0 | Reconciliation snapshot/diff scripts (`pnpm recon:*`) capturando saldos, totais por fatura, breakdown por categoria, mix por type×status, hash row-level. Baseline `pre-fase-0` capturado. |
| 1 | Schema additivo + migration + backfill idempotente (`pnpm migrate:backfill-installments`). Reconciliação automática por fatura. |
| 2 | Dual-write em `purchases.create/cancelInstallment/cancel` e `faturas.pay/unpay`. E2E exercise via `pnpm migrate:exercise-fase2` validou lockstep. |
| 3 | Cutover das leituras: `faturas.findAll/findOne`, `cards.computeAvailableCredit`, `purchases.create` (limit check), dashboard breakdown. |
| 4 | DROP `installments`, DROP `Fatura.projectedTxId/categoryId`, remoção de `upsertProjectedTransaction`. |
| 5 | Typecheck + lint + reconciliation final + release notes. |

## Validação final

- `pnpm tsc --noEmit -p tsconfig.build.json` — clean (api)
- `pnpm tsc --noEmit` — clean (web)
- `pnpm next lint` — 0 warnings (web)
- `pnpm migrate:exercise-fase2` — 5 cenários ponta-a-ponta (create, cancel
  parcela, pay, unpay, cancel) ✅
- Snapshot diffs: `walletBalances` inalterados em todas as fases.
- Idle stability check após cada fase: `no drift detected`.

## Reversibilidade

- `prisma migrate resolve --rolled-back <name>` foi exercitado durante a
  Fase 4 (uma execução parcial do migration foi resetada limpamente).
- O dump pré-Fase 4 está em `scripts/reconciliation/snapshots/post-fase-3.json`.
- Rollback do schema requer recriar `installments` + repopular a partir de
  `transactions WHERE type=credit_card_purchase` — não é reversível com
  zero-downtime, mas é factível offline.

## Conhecidos / follow-ups

- API não tem `eslint` instalado localmente (script `lint` no
  package.json mas dependência ausente). Pré-existente, não relacionado a
  esta migração.
- `legacyInstallmentId` permanece no schema da `Transaction` apesar de
  `Installment` ter sido removida — útil como rastreabilidade do backfill.
  Pode ser removido em uma migration de housekeeping futura.
- Test infrastructure: ver `docs/backlog/test-infrastructure-epic.md`.

## Como auditar

```bash
# Snapshot atual
cd apps/api && pnpm recon:snapshot agora

# Comparar com qualquer baseline
pnpm recon:diff post-fase-3 agora    # apenas warnings esperados

# Re-validar fluxo end-to-end
pnpm migrate:exercise-fase2
```
