import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCardDto } from './dto/create-card.dto';
import { UpdateCardDto } from './dto/update-card.dto';
import { CardResponseDto, CardListResponseDto } from './dto/card-response.dto';
import { CreditCard, TransactionStatus, TransactionType } from '@prisma/client';

@Injectable()
export class CardsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(walletId: string, includeArchived = false): Promise<CardListResponseDto> {
    const cards = await this.prisma.creditCard.findMany({
      where: {
        walletId,
        ...(includeArchived ? {} : { isArchived: false }),
      },
      orderBy: { name: 'asc' },
    });

    const withLimits = await Promise.all(
      cards.map((c) => this.computeAvailableCredit(c)),
    );

    return { cards: withLimits, total: withLimits.length };
  }

  async findOne(walletId: string, id: string): Promise<CardResponseDto> {
    const card = await this.prisma.creditCard.findFirst({
      where: { id, walletId },
    });

    if (!card) {
      throw new NotFoundException('CARD_NOT_FOUND');
    }

    return this.computeAvailableCredit(card);
  }

  async create(walletId: string, dto: CreateCardDto): Promise<CardResponseDto> {
    const card = await this.prisma.creditCard.create({
      data: {
        walletId,
        name: dto.name,
        closingDay: dto.closingDay,
        dueDay: dto.dueDay,
        creditLimitCents: dto.creditLimitCents ?? null,
      },
    });

    return this.computeAvailableCredit(card);
  }

  async update(walletId: string, id: string, dto: UpdateCardDto): Promise<CardResponseDto> {
    const existing = await this.prisma.creditCard.findFirst({
      where: { id, walletId },
    });

    if (!existing) {
      throw new NotFoundException('CARD_NOT_FOUND');
    }

    if (existing.isArchived && dto.isArchived !== false) {
      throw new UnprocessableEntityException('CARD_ALREADY_ARCHIVED');
    }

    if ('creditLimitCents' in dto && dto.creditLimitCents !== null && dto.creditLimitCents !== undefined) {
      // Fase 3: open exposure now sourced from Transaction (type=credit_card_purchase).
      const usedCents = await this.computeOpenExposureCents(id);
      if (dto.creditLimitCents < usedCents) {
        throw new UnprocessableEntityException('CARD_LIMIT_BELOW_USED_CREDIT');
      }
    }

    const updated = await this.prisma.creditCard.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.closingDay !== undefined && { closingDay: dto.closingDay }),
        ...(dto.dueDay !== undefined && { dueDay: dto.dueDay }),
        ...('creditLimitCents' in dto && { creditLimitCents: dto.creditLimitCents ?? null }),
        ...(dto.isArchived !== undefined && { isArchived: dto.isArchived }),
      },
    });

    return this.computeAvailableCredit(updated);
  }

  async archive(walletId: string, id: string): Promise<CardResponseDto> {
    const existing = await this.prisma.creditCard.findFirst({
      where: { id, walletId },
    });

    if (!existing) {
      throw new NotFoundException('CARD_NOT_FOUND');
    }

    if (existing.isArchived) {
      throw new UnprocessableEntityException('CARD_ALREADY_ARCHIVED');
    }

    const openFaturasCount = await this.prisma.fatura.count({
      where: { cardId: id, invoicePaymentTxId: null },
    });

    if (openFaturasCount > 0) {
      throw new UnprocessableEntityException('CARD_HAS_OPEN_FATURAS');
    }

    const updated = await this.prisma.creditCard.update({
      where: { id },
      data: { isArchived: true },
    });

    return this.computeAvailableCredit(updated);
  }

  // ---------------------------------------------------------------------------
  // Public helper used by FaturasService and PurchasesService
  // ---------------------------------------------------------------------------

  async assertCardBelongsToWallet(id: string, walletId: string): Promise<CreditCard> {
    const card = await this.prisma.creditCard.findFirst({
      where: { id, walletId, isArchived: false },
    });

    if (!card) {
      throw new NotFoundException('CARD_NOT_FOUND');
    }

    return card;
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private async computeAvailableCredit(card: CreditCard): Promise<CardResponseDto> {
    let usedCreditCents: number | null = null;
    let availableCreditCents: number | null = null;

    if (card.creditLimitCents !== null) {
      usedCreditCents = await this.computeOpenExposureCents(card.id);
      availableCreditCents = card.creditLimitCents - usedCreditCents;
    }

    return {
      id: card.id,
      walletId: card.walletId,
      name: card.name,
      closingDay: card.closingDay,
      dueDay: card.dueDay,
      creditLimitCents: card.creditLimitCents,
      usedCreditCents,
      availableCreditCents,
      isArchived: card.isArchived,
      createdAt: card.createdAt,
      updatedAt: card.updatedAt,
    };
  }

  /**
   * Open credit-card exposure (Fase 3): sum of credit_card_purchase
   * Transactions on this card whose fatura is not yet paid. Paid faturas
   * are excluded — their parcelas have been settled and no longer consume
   * the limit.
   */
  private async computeOpenExposureCents(cardId: string): Promise<number> {
    const result = await this.prisma.transaction.aggregate({
      where: {
        type: TransactionType.credit_card_purchase,
        status: TransactionStatus.pending,
        deletedAt: null,
        purchase: { cardId },
        fatura: { invoicePaymentTxId: null },
      },
      _sum: { amount: true },
    });
    return Math.round(Number(result._sum.amount ?? 0) * 100);
  }
}
