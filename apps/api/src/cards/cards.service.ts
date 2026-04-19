import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCardDto } from './dto/create-card.dto';
import { UpdateCardDto } from './dto/update-card.dto';
import { CardResponseDto, CardListResponseDto } from './dto/card-response.dto';
import { CreditCard } from '@prisma/client';

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
    let availableCreditCents: number | null = null;

    if (card.creditLimitCents !== null) {
      // Open exposure = sum of pending installments in open/closed/overdue faturas
      const result = await this.prisma.installment.aggregate({
        where: {
          cardId: card.id,
          status: 'pending',
          fatura: {
            // Exclude paid faturas: if invoicePaymentTxId is set, it's paid
            invoicePaymentTxId: null,
          },
        },
        _sum: { amountCents: true },
      });

      const openExposure = result._sum.amountCents ?? 0;
      availableCreditCents = card.creditLimitCents - openExposure;
    }

    return {
      id: card.id,
      walletId: card.walletId,
      name: card.name,
      closingDay: card.closingDay,
      dueDay: card.dueDay,
      creditLimitCents: card.creditLimitCents,
      availableCreditCents,
      isArchived: card.isArchived,
      createdAt: card.createdAt,
      updatedAt: card.updatedAt,
    };
  }
}
