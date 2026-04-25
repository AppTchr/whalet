import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PayFaturaDto } from './dto/pay-fatura.dto';
import { UpdateFaturaCategoryDto } from './dto/update-fatura-category.dto';
import {
  FaturaResponseDto,
  FaturaListResponseDto,
  FaturaPayResponseDto,
  FaturaStatus,
  FaturaInstallmentDto,
} from './dto/fatura-response.dto';
import { Prisma, PrismaClient, TransactionStatus, TransactionType } from '@prisma/client';

// ---------------------------------------------------------------------------
// Fatura status — computed at read time from stored dates (BRT, UTC-normalized)
// ---------------------------------------------------------------------------
function computeFaturaStatus(
  closingDate: Date,
  dueDate: Date,
  invoicePaymentTxId: string | null,
  todayUTC: Date,
): FaturaStatus {
  // Prisma returns @db.Date as Date objects at midnight UTC — compare as-is
  if (invoicePaymentTxId !== null) return 'paid';
  if (dueDate < todayUTC) return 'overdue';
  if (closingDate <= todayUTC) return 'closed'; // on closing day itself → closed
  return 'open';
}

function todayUTC(): Date {
  const now = new Date();
  // Normalize to midnight UTC of the BRT date
  const brtDateStr = now.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
  return new Date(brtDateStr + 'T00:00:00Z');
}

function isPrismaUniqueError(e: unknown): boolean {
  return (
    typeof e === 'object' &&
    e !== null &&
    'code' in e &&
    (e as { code: string }).code === 'P2002'
  );
}

// ---------------------------------------------------------------------------
// Type alias for Prisma interactive transaction client.
// Prisma.$transaction(async (tx) => ...) provides a PrismaClient instance
// stripped of the top-level transaction/lifecycle methods.
// ---------------------------------------------------------------------------
type PrismaTxClient = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

// ---------------------------------------------------------------------------

@Injectable()
export class FaturasService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    walletId: string,
    cardId: string,
    status?: string,
  ): Promise<FaturaListResponseDto> {
    await this.assertCardExists(walletId, cardId);

    const faturas = await this.prisma.fatura.findMany({
      where: { cardId, walletId },
      orderBy: { closingDate: 'desc' },
    });

    // Fase 3 cutover: totals are now computed from Transaction rows
    // (type=credit_card_purchase). Installment is still written to in dual-write
    // mode but is no longer the source of truth for reads.
    const faturaIds = faturas.map((f) => f.id);
    const totals = await this.prisma.transaction.groupBy({
      by: ['faturaId'],
      where: {
        faturaId: { in: faturaIds },
        type: TransactionType.credit_card_purchase,
        status: { not: TransactionStatus.canceled },
        deletedAt: null,
      },
      _sum: { amount: true },
    });
    const totalMap = new Map(
      totals
        .filter((t): t is typeof t & { faturaId: string } => t.faturaId !== null)
        .map((t) => [t.faturaId, Math.round(Number(t._sum.amount ?? 0) * 100)]),
    );

    const today = todayUTC();

    const result = faturas.map((f) => ({
      id: f.id,
      cardId: f.cardId,
      walletId: f.walletId,
      categoryId: null,
      referenceMonth: f.referenceMonth,
      closingDate: f.closingDate,
      dueDate: f.dueDate,
      status: computeFaturaStatus(f.closingDate, f.dueDate, f.invoicePaymentTxId, today),
      totalCents: totalMap.get(f.id) ?? 0,
      paidAt: f.paidAt,
      invoicePaymentTxId: f.invoicePaymentTxId,
      createdAt: f.createdAt,
      updatedAt: f.updatedAt,
    }));

    // Status filter is applied in memory (status is computed at read time, not persisted)
    const filtered = status
      ? result.filter((f) => f.status === status)
      : result;

    return { faturas: filtered, total: filtered.length };
  }

  async findOne(walletId: string, cardId: string, id: string): Promise<FaturaResponseDto> {
    await this.assertCardExists(walletId, cardId);

    const fatura = await this.prisma.fatura.findFirst({
      where: { id, cardId, walletId },
    });
    if (!fatura) throw new NotFoundException('FATURA_NOT_FOUND');

    // Fase 3 cutover: items come from Transaction (type=credit_card_purchase).
    const txs = await this.prisma.transaction.findMany({
      where: {
        faturaId: id,
        type: TransactionType.credit_card_purchase,
        status: { not: TransactionStatus.canceled },
        deletedAt: null,
      },
      orderBy: [{ dueDate: 'asc' }, { installmentNumber: 'asc' }],
      include: {
        purchase: { select: { description: true, installmentCount: true } },
      },
    });

    const totalCents = txs.reduce(
      (sum, t) => sum + Math.round(Number(t.amount) * 100),
      0,
    );
    const today = todayUTC();

    const installmentDtos: FaturaInstallmentDto[] = txs.map((t) => ({
      id: t.id,
      purchaseId: t.purchaseId ?? '',
      purchaseDescription:
        t.purchase?.description ?? t.description ?? '',
      installmentNumber: t.installmentNumber ?? 1,
      totalInstallments:
        t.totalInstallments ?? t.purchase?.installmentCount ?? 1,
      amountCents: Math.round(Number(t.amount) * 100),
      dueDate: t.dueDate,
      status: t.status,
      categoryId: t.categoryId,
    }));

    return {
      id: fatura.id,
      cardId: fatura.cardId,
      walletId: fatura.walletId,
      categoryId: null,
      referenceMonth: fatura.referenceMonth,
      closingDate: fatura.closingDate,
      dueDate: fatura.dueDate,
      status: computeFaturaStatus(fatura.closingDate, fatura.dueDate, fatura.invoicePaymentTxId, today),
      totalCents,
      paidAt: fatura.paidAt,
      invoicePaymentTxId: fatura.invoicePaymentTxId,
      installments: installmentDtos,
      createdAt: fatura.createdAt,
      updatedAt: fatura.updatedAt,
    };
  }

  async pay(
    walletId: string,
    cardId: string,
    faturaId: string,
    dto: PayFaturaDto,
  ): Promise<FaturaPayResponseDto> {
    // assertCard checks the card is active (not archived) before allowing payment
    await this.assertCardActive(walletId, cardId);

    // Validate paidAt is not in the future (defense in depth — DTO validator also checks)
    const paidAt = dto.paidAt ? new Date(dto.paidAt) : new Date();
    if (paidAt > new Date()) {
      throw new UnprocessableEntityException('PAID_AT_CANNOT_BE_FUTURE');
    }

    // Validate bankAccountId belongs to this wallet
    const bankAccount = await this.prisma.bankAccount.findFirst({
      where: { id: dto.bankAccountId, walletId, isArchived: false },
    });
    if (!bankAccount) {
      throw new UnprocessableEntityException('NO_BANK_ACCOUNT_FOR_PAYMENT');
    }

    let transactionId: string;

    try {
      await this.prisma.$transaction(async (tx) => {
        // Lock the fatura row — serialization point for concurrent pay() calls
        const [lockedFatura] = await tx.$queryRaw<Array<{
          id: string;
          invoicePaymentTxId: string | null;
          closingDate: Date;
          dueDate: Date;
        }>>(
          Prisma.sql`SELECT id, "invoicePaymentTxId", "closingDate", "dueDate" FROM faturas WHERE id = ${faturaId} AND "cardId" = ${cardId} AND "walletId" = ${walletId} FOR UPDATE`,
        );

        if (!lockedFatura) throw new NotFoundException('FATURA_NOT_FOUND');
        if (lockedFatura.invoicePaymentTxId !== null) {
          throw new UnprocessableEntityException('FATURA_ALREADY_PAID');
        }

        // Compute total inside the lock from the unified Transaction source.
        const agg = await tx.transaction.aggregate({
          where: {
            faturaId,
            type: TransactionType.credit_card_purchase,
            status: { not: TransactionStatus.canceled },
            deletedAt: null,
          },
          _sum: { amount: true },
        });
        const totalCents = Math.round(Number(agg._sum.amount ?? 0) * 100);

        if (totalCents === 0) {
          throw new UnprocessableEntityException('FATURA_NOTHING_TO_PAY');
        }

        const amountDecimal = totalCents / 100;

        // Create invoice_payment transaction record atomically.
        // NOTE: Bypasses TransactionsService.create() to maintain transaction atomicity.
        // Invariants enforced here: type=invoice_payment, sign=-1, walletId matches card's wallet.
        const txRecord = await tx.transaction.create({
          data: {
            walletId,
            type: TransactionType.invoice_payment,
            status: TransactionStatus.paid,
            amount: amountDecimal,
            sign: -1,
            description: `Fatura ${lockedFatura.id}`,
            dueDate: lockedFatura.dueDate,
            paidAt,
            bankAccountId: dto.bankAccountId,
          },
        });

        transactionId = txRecord.id;

        await tx.fatura.update({
          where: { id: faturaId },
          data: { invoicePaymentTxId: txRecord.id, paidAt },
        });

        // Mark each installment-Transaction as paid in lockstep with the fatura.
        await tx.transaction.updateMany({
          where: {
            faturaId,
            type: TransactionType.credit_card_purchase,
            status: TransactionStatus.pending,
          },
          data: { status: TransactionStatus.paid, paidAt },
        });

        return totalCents;
      });
    } catch (e: unknown) {
      if (isPrismaUniqueError(e)) {
        // Concurrent payment — the unique constraint on invoicePaymentTxId caught it
        throw new UnprocessableEntityException('FATURA_ALREADY_PAID');
      }
      throw e;
    }

    // Re-fetch totalCents for the response from the unified Transaction source.
    const agg = await this.prisma.transaction.aggregate({
      where: {
        faturaId,
        type: TransactionType.credit_card_purchase,
        status: { not: TransactionStatus.canceled },
        deletedAt: null,
      },
      _sum: { amount: true },
    });

    return {
      faturaId,
      transactionId: transactionId!,
      amountCents: Math.round(Number(agg._sum.amount ?? 0) * 100),
      bankAccountId: dto.bankAccountId,
      paidAt,
    };
  }

  async unpay(walletId: string, cardId: string, faturaId: string): Promise<void> {
    await this.assertCardActive(walletId, cardId);

    await this.prisma.$transaction(async (tx) => {
      const [lockedFatura] = await tx.$queryRaw<Array<{
        id: string;
        invoicePaymentTxId: string | null;
      }>>(
        Prisma.sql`SELECT id, "invoicePaymentTxId" FROM faturas WHERE id = ${faturaId} AND "cardId" = ${cardId} AND "walletId" = ${walletId} FOR UPDATE`,
      );

      if (!lockedFatura) throw new NotFoundException('FATURA_NOT_FOUND');
      if (lockedFatura.invoicePaymentTxId === null) {
        throw new UnprocessableEntityException('FATURA_NOT_PAID');
      }

      const paymentTxId = lockedFatura.invoicePaymentTxId;

      await tx.fatura.update({
        where: { id: faturaId },
        data: { invoicePaymentTxId: null, paidAt: null },
      });

      // Revert each installment-Transaction back to pending.
      await tx.transaction.updateMany({
        where: {
          faturaId,
          type: TransactionType.credit_card_purchase,
          status: TransactionStatus.paid,
        },
        data: { status: TransactionStatus.pending, paidAt: null },
      });

      await tx.transaction.update({
        where: { id: paymentTxId },
        data: { deletedAt: new Date() },
      });
    });
  }

  // ---------------------------------------------------------------------------
  // Bulk-apply a category to every credit_card_purchase Transaction in a fatura.
  // Replaces the legacy `Fatura.categoryId` mechanism — categories now live on
  // each Transaction directly. Useful when the user wants to recategorize an
  // entire fatura at once (e.g. travel month, business reimbursable, etc.).
  // ---------------------------------------------------------------------------
  async updateCategory(
    walletId: string,
    cardId: string,
    faturaId: string,
    dto: UpdateFaturaCategoryDto,
  ): Promise<FaturaResponseDto> {
    await this.assertCardExists(walletId, cardId);

    const fatura = await this.prisma.fatura.findFirst({
      where: { id: faturaId, cardId, walletId },
    });
    if (!fatura) throw new NotFoundException('FATURA_NOT_FOUND');

    if (dto.categoryId !== null) {
      const category = await this.prisma.category.findFirst({
        where: { id: dto.categoryId, walletId },
      });
      if (!category) throw new NotFoundException('CATEGORY_NOT_FOUND');
    }

    const categoryId = dto.categoryId ?? null;

    await this.prisma.transaction.updateMany({
      where: {
        faturaId,
        type: TransactionType.credit_card_purchase,
        deletedAt: null,
      },
      data: { categoryId },
    });

    return this.findOne(walletId, cardId, faturaId);
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /** Validates card exists in wallet (allows archived — for reads). */
  private async assertCardExists(walletId: string, cardId: string): Promise<void> {
    const card = await this.prisma.creditCard.findFirst({
      where: { id: cardId, walletId },
    });
    if (!card) throw new NotFoundException('CARD_NOT_FOUND');
  }

  /** Validates card is active (not archived — for payment). */
  private async assertCardActive(walletId: string, cardId: string): Promise<void> {
    const card = await this.prisma.creditCard.findFirst({
      where: { id: cardId, walletId, isArchived: false },
    });
    if (!card) throw new NotFoundException('CARD_NOT_FOUND');
  }
}
