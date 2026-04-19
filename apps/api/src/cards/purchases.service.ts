import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePurchaseDto } from './dto/create-purchase.dto';
import {
  PurchaseResponseDto,
  PurchaseListResponseDto,
  InstallmentSummaryDto,
} from './dto/purchase-response.dto';
import { Prisma } from '@prisma/client';

// ---------------------------------------------------------------------------
// BRT date helpers (IANA zone: America/Sao_Paulo)
// ---------------------------------------------------------------------------
function toBRTDateStr(date: Date): string {
  return date.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}

function toBRTDate(date: Date): Date {
  return new Date(toBRTDateStr(date) + 'T00:00:00Z');
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d;
}

// Compute the closing date for a given installment cycle offset.
// offset = 0 → cycle that contains the purchaseDate.
function computeFaturaClosingDate(
  closingDay: number,
  purchaseDateBRT: Date,
  cycleOffset: number,
): Date {
  const year = purchaseDateBRT.getUTCFullYear();
  const month = purchaseDateBRT.getUTCMonth();
  const day = purchaseDateBRT.getUTCDate();

  // Closing date in the same month as the purchase (UTC midnight, date-only)
  const closingThisMonth = new Date(Date.UTC(year, month, closingDay));

  // If purchaseDate.day <= closingDay → belongs to this month's cycle; else → next month
  const baseCycleClosing =
    day <= closingDay ? closingThisMonth : new Date(Date.UTC(year, month + 1, closingDay));

  return addMonths(baseCycleClosing, cycleOffset);
}

function computeFaturaDueDate(dueDay: number, closingDate: Date): Date {
  const y = closingDate.getUTCFullYear();
  const m = closingDate.getUTCMonth();
  return new Date(Date.UTC(y, m + 1, dueDay));
}

function toReferenceMonth(closingDate: Date): string {
  const y = closingDate.getUTCFullYear();
  const m = String(closingDate.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

// ---------------------------------------------------------------------------

// Raw DB row from SELECT FOR UPDATE (matches actual camelCase column names)
interface RawCreditCard {
  id: string;
  walletId: string;
  name: string;
  closingDay: number;
  dueDay: number;
  creditLimitCents: number | null;
  isArchived: boolean;
}

@Injectable()
export class PurchasesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    walletId: string,
    cardId: string,
    dto: CreatePurchaseDto,
  ): Promise<PurchaseResponseDto> {
    const purchase = await this.prisma.$transaction(
      async (tx) => {
        // 1. Lock the card row first — this is the serialization point for all concurrent purchases
        const rows = await tx.$queryRaw<RawCreditCard[]>(
          Prisma.sql`SELECT * FROM credit_cards WHERE id = ${cardId} AND "walletId" = ${walletId} FOR UPDATE`,
        );
        const card = rows[0];
        if (!card) throw new NotFoundException('CARD_NOT_FOUND');
        if (card.isArchived) throw new UnprocessableEntityException('CARD_ALREADY_ARCHIVED');

        // 2. Validate categoryId inside the transaction for a consistent snapshot
        if (dto.categoryId) {
          const cat = await tx.category.findFirst({
            where: { id: dto.categoryId, walletId, isArchived: false },
          });
          if (!cat) throw new NotFoundException('CATEGORY_NOT_FOUND');
        }

        const purchaseDateBRT = toBRTDate(new Date(dto.purchaseDate));

        // 3. Compute installment distribution (remainder → installment 1)
        const base = Math.floor(dto.totalAmountCents / dto.installmentCount);
        const remainder = dto.totalAmountCents % dto.installmentCount;

        // 4. Resolve (find or create) faturas for each installment cycle — inside the lock
        const installmentFaturas: Array<{
          faturaId: string;
          dueDate: Date;
          amountCents: number;
        }> = [];

        for (let i = 0; i < dto.installmentCount; i++) {
          const amountCents = i === 0 ? base + remainder : base;
          const closingDate = computeFaturaClosingDate(card.closingDay, purchaseDateBRT, i);
          const referenceMonth = toReferenceMonth(closingDate);
          const dueDate = computeFaturaDueDate(card.dueDay, closingDate);

          const existingFatura = await tx.fatura.findUnique({
            where: { cardId_referenceMonth: { cardId, referenceMonth } },
          });

          // Block purchase if installment would land in an already-paid fatura
          if (existingFatura?.invoicePaymentTxId) {
            throw new UnprocessableEntityException('PURCHASE_DATE_IN_PAID_FATURA');
          }

          const fatura = existingFatura ?? (await tx.fatura.create({
            data: { cardId, walletId, referenceMonth, closingDate, dueDate },
          }));

          installmentFaturas.push({ faturaId: fatura.id, dueDate, amountCents });
        }

        // 5. Credit limit check — card is locked, exposure is consistent
        if (card.creditLimitCents !== null) {
          const agg = await tx.installment.aggregate({
            where: {
              cardId,
              status: 'pending',
              fatura: { invoicePaymentTxId: null },
            },
            _sum: { amountCents: true },
          });
          const openExposure = agg._sum.amountCents ?? 0;
          const available = card.creditLimitCents - openExposure;

          if (dto.totalAmountCents > available) {
            throw new UnprocessableEntityException('CREDIT_LIMIT_EXCEEDED');
          }
        }

        // 6. Create the purchase record + all installments
        const newPurchase = await tx.creditCardPurchase.create({
          data: {
            cardId,
            walletId,
            description: dto.description,
            totalAmountCents: dto.totalAmountCents,
            installmentCount: dto.installmentCount,
            purchaseDate: new Date(dto.purchaseDate),
            categoryId: dto.categoryId ?? null,
            notes: dto.notes ?? null,
          },
        });

        await tx.installment.createMany({
          data: installmentFaturas.map(({ faturaId, dueDate, amountCents }, idx) => ({
            purchaseId: newPurchase.id,
            faturaId,
            cardId,
            walletId,
            installmentNumber: idx + 1,
            amountCents,
            dueDate,
          })),
        });

        return newPurchase;
      },
      { timeout: 10_000 },
    );

    return this.findOne(walletId, cardId, purchase.id);
  }

  async findAll(
    walletId: string,
    cardId: string,
    faturaId?: string,
    status?: string,
  ): Promise<PurchaseListResponseDto> {
    const card = await this.prisma.creditCard.findFirst({
      where: { id: cardId, walletId },
    });
    if (!card) throw new NotFoundException('CARD_NOT_FOUND');

    // Validate faturaId belongs to this card and wallet
    if (faturaId) {
      const fatura = await this.prisma.fatura.findFirst({
        where: { id: faturaId, cardId, walletId },
      });
      if (!fatura) throw new NotFoundException('FATURA_NOT_FOUND');
    }

    // Validate status value at runtime
    if (status && !['active', 'canceled'].includes(status)) {
      throw new UnprocessableEntityException('INVALID_STATUS_FILTER');
    }

    const where: Prisma.CreditCardPurchaseWhereInput = {
      cardId,
      walletId,
      ...(status && { status: status as 'active' | 'canceled' }),
      ...(faturaId && { installments: { some: { faturaId } } }),
    };

    const purchases = await this.prisma.creditCardPurchase.findMany({
      where,
      include: {
        installments: {
          include: { fatura: { select: { closingDate: true } } },
          orderBy: { installmentNumber: 'asc' },
        },
      },
      orderBy: { purchaseDate: 'desc' },
    });

    return {
      purchases: purchases.map((p) => this.toDto(p)),
      total: purchases.length,
    };
  }

  async findOne(walletId: string, cardId: string, id: string): Promise<PurchaseResponseDto> {
    const purchase = await this.prisma.creditCardPurchase.findFirst({
      where: { id, cardId, walletId },
      include: {
        installments: {
          include: { fatura: { select: { closingDate: true } } },
          orderBy: { installmentNumber: 'asc' },
        },
      },
    });

    if (!purchase) throw new NotFoundException('PURCHASE_NOT_FOUND');

    return this.toDto(purchase);
  }

  async cancel(walletId: string, cardId: string, id: string): Promise<PurchaseResponseDto> {
    const purchase = await this.prisma.creditCardPurchase.findFirst({
      where: { id, cardId, walletId },
      include: {
        installments: {
          include: { fatura: true },
        },
      },
    });

    if (!purchase) throw new NotFoundException('PURCHASE_NOT_FOUND');
    if (purchase.status === 'canceled') {
      throw new UnprocessableEntityException('PURCHASE_ALREADY_CANCELED');
    }

    // Block if any installment belongs to a paid fatura
    const hasPaidFatura = purchase.installments.some(
      (i) => i.fatura.invoicePaymentTxId !== null,
    );
    if (hasPaidFatura) {
      throw new UnprocessableEntityException('PURCHASE_HAS_PAID_INSTALLMENTS');
    }

    await this.prisma.$transaction([
      this.prisma.installment.updateMany({
        where: { purchaseId: id },
        data: { status: 'canceled' },
      }),
      this.prisma.creditCardPurchase.update({
        where: { id },
        data: { status: 'canceled', canceledAt: new Date() },
      }),
    ]);

    return this.findOne(walletId, cardId, id);
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private toDto(purchase: {
    id: string;
    cardId: string;
    walletId: string;
    description: string;
    totalAmountCents: number;
    installmentCount: number;
    purchaseDate: Date;
    categoryId: string | null;
    notes: string | null;
    status: string;
    canceledAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    installments: Array<{
      id: string;
      installmentNumber: number;
      amountCents: number;
      faturaId: string;
      dueDate: Date;
      status: string;
      fatura: { closingDate: Date };
    }>;
  }): PurchaseResponseDto {
    return {
      id: purchase.id,
      cardId: purchase.cardId,
      walletId: purchase.walletId,
      description: purchase.description,
      totalAmountCents: purchase.totalAmountCents,
      installmentCount: purchase.installmentCount,
      purchaseDate: purchase.purchaseDate,
      categoryId: purchase.categoryId,
      notes: purchase.notes,
      status: purchase.status,
      canceledAt: purchase.canceledAt,
      installments: purchase.installments.map((i): InstallmentSummaryDto => ({
        id: i.id,
        installmentNumber: i.installmentNumber,
        amountCents: i.amountCents,
        faturaId: i.faturaId,
        faturaClosingDate: i.fatura.closingDate,
        dueDate: i.dueDate,
        status: i.status,
      })),
      createdAt: purchase.createdAt,
      updatedAt: purchase.updatedAt,
    };
  }
}
