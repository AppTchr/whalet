import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PayFaturaDto } from './dto/pay-fatura.dto';
import {
  FaturaResponseDto,
  FaturaListResponseDto,
  FaturaPayResponseDto,
  FaturaStatus,
  FaturaInstallmentDto,
} from './dto/fatura-response.dto';
import { Prisma, TransactionStatus, TransactionType } from '@prisma/client';

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

    // Compute totals in bulk (one query for all faturas)
    const faturaIds = faturas.map((f) => f.id);
    const totals = await this.prisma.installment.groupBy({
      by: ['faturaId'],
      where: {
        faturaId: { in: faturaIds },
        status: { not: 'canceled' },
      },
      _sum: { amountCents: true },
    });
    const totalMap = new Map(totals.map((t) => [t.faturaId, t._sum.amountCents ?? 0]));

    const today = todayUTC();

    const result = faturas.map((f) => ({
      id: f.id,
      cardId: f.cardId,
      walletId: f.walletId,
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
      include: {
        installments: {
          where: { status: { not: 'canceled' } },
          include: {
            purchase: {
              select: { description: true, installmentCount: true, categoryId: true },
            },
          },
          orderBy: { installmentNumber: 'asc' },
        },
      },
    });

    if (!fatura) throw new NotFoundException('FATURA_NOT_FOUND');

    const totalCents = fatura.installments.reduce((sum, i) => sum + i.amountCents, 0);
    const today = todayUTC();

    const installmentDtos: FaturaInstallmentDto[] = fatura.installments.map((i) => ({
      id: i.id,
      purchaseId: i.purchaseId,
      purchaseDescription: i.purchase.description,
      installmentNumber: i.installmentNumber,
      totalInstallments: i.purchase.installmentCount,
      amountCents: i.amountCents,
      dueDate: i.dueDate,
      status: i.status,
      categoryId: i.purchase.categoryId,
    }));

    return {
      id: fatura.id,
      cardId: fatura.cardId,
      walletId: fatura.walletId,
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

        const today = todayUTC();
        const status = computeFaturaStatus(
          lockedFatura.closingDate,
          lockedFatura.dueDate,
          null,
          today,
        );
        if (status === 'open') {
          throw new UnprocessableEntityException('FATURA_NOT_CLOSED');
        }

        // Compute total inside the lock — consistent with installment state
        const agg = await tx.installment.aggregate({
          where: { faturaId, status: { not: 'canceled' } },
          _sum: { amountCents: true },
        });
        const totalCents = agg._sum.amountCents ?? 0;

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

        await tx.installment.updateMany({
          where: { faturaId, status: 'pending' },
          data: { status: 'paid', paidAt },
        });

        // Return total for the response (captured from inside the tx)
        return totalCents;
      });
    } catch (e: unknown) {
      if (isPrismaUniqueError(e)) {
        // Concurrent payment — the unique constraint on invoicePaymentTxId caught it
        throw new UnprocessableEntityException('FATURA_ALREADY_PAID');
      }
      throw e;
    }

    // Re-fetch totalCents for the response (outside tx is fine — fatura is now locked/paid)
    const agg = await this.prisma.installment.aggregate({
      where: { faturaId, status: { not: 'canceled' } },
      _sum: { amountCents: true },
    });

    return {
      faturaId,
      transactionId: transactionId!,
      amountCents: agg._sum.amountCents ?? 0,
      bankAccountId: dto.bankAccountId,
      paidAt,
    };
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
