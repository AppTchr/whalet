import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { TransactionStatus, TransactionType } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateRecurringTransactionDto,
  RecurrenceFrequency,
  RecurringTransactionType,
} from './dto/create-recurring-transaction.dto';
import { UpdateRecurringTransactionDto } from './dto/update-recurring-transaction.dto';
import {
  RecurringTransactionListResponseDto,
  RecurringTransactionResponseDto,
} from './dto/recurring-transaction-response.dto';
import { TransactionResponseDto } from '../transactions/dto/transaction-response.dto';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RawRecurringTransaction {
  id: string;
  walletId: string;
  type: TransactionType;
  frequency: RecurrenceFrequency;
  description: string;
  amount: Decimal;
  categoryId: string | null;
  bankAccountId: string | null;
  notes: string | null;
  startDate: Date;
  endDate: Date | null;
  maxOccurrences: number | null;
  lastGeneratedDate: Date | null;
  isActive: boolean;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

interface RawTransaction {
  id: string;
  walletId: string;
  type: TransactionType;
  status: TransactionStatus;
  amount: Decimal;
  sign: number;
  description: string | null;
  notes: string | null;
  dueDate: Date;
  paidAt: Date | null;
  categoryId: string | null;
  bankAccountId: string | null;
  transferGroupId: string | null;
  recurrenceId: string | null;
  recurrenceIndex: number | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Max occurrences to generate per template (hard safety ceiling). */
const MAX_GENERATION_CAP = 240;
/** Fallback horizon in months, used only when endDate is not provided. */
const FALLBACK_HORIZON_MONTHS = 60;

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

@Injectable()
export class RecurringTransactionsService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Create ────────────────────────────────────────────────────────────────

  async create(
    walletId: string,
    dto: CreateRecurringTransactionDto,
  ): Promise<RecurringTransactionResponseDto> {
    // Validate category ownership
    if (dto.categoryId) {
      const cat = await this.prisma.category.findFirst({
        where: { id: dto.categoryId, walletId, isArchived: false },
      });
      if (!cat) throw new UnprocessableEntityException('CATEGORY_NOT_IN_WALLET');
    }

    // Validate bank account ownership
    if (dto.bankAccountId) {
      const ba = await this.prisma.bankAccount.findFirst({
        where: { id: dto.bankAccountId, walletId, isArchived: false },
      });
      if (!ba) throw new UnprocessableEntityException('BANK_ACCOUNT_NOT_IN_WALLET');
    }

    const startDate = new Date(dto.startDate);
    const endDate = dto.endDate ? new Date(dto.endDate) : null;

    if (endDate && endDate < startDate) {
      throw new UnprocessableEntityException('END_DATE_BEFORE_START_DATE');
    }

    // Create template
    const template = await this.prisma.recurringTransaction.create({
      data: {
        walletId,
        type: dto.type,
        frequency: dto.frequency as unknown as never, // Prisma enum cast
        description: dto.description,
        amount: dto.amount,
        categoryId: dto.categoryId ?? null,
        bankAccountId: dto.bankAccountId ?? null,
        notes: dto.notes ?? null,
        startDate,
        endDate,
        maxOccurrences: dto.maxOccurrences ?? null,
      },
    });

    // Generate occurrences
    const occurrences = this.computeOccurrenceDates(
      startDate,
      dto.frequency,
      endDate,
      dto.maxOccurrences ?? null,
    );

    const sign = dto.type === 'income' ? 1 : -1;

    if (occurrences.length > 0) {
      await this.prisma.transaction.createMany({
        data: occurrences.map((dueDate, idx) => ({
          walletId,
          type: dto.type,
          status: TransactionStatus.pending,
          amount: dto.amount,
          sign,
          description: dto.description,
          notes: dto.notes ?? null,
          dueDate,
          categoryId: dto.categoryId ?? null,
          bankAccountId: dto.bankAccountId ?? null,
          recurrenceId: template.id,
          recurrenceIndex: idx + 1,
        })),
      });

      // Update lastGeneratedDate on template
      await this.prisma.recurringTransaction.update({
        where: { id: template.id },
        data: { lastGeneratedDate: occurrences[occurrences.length - 1] },
      });
    }

    const refreshed = await this.prisma.recurringTransaction.findUniqueOrThrow({
      where: { id: template.id },
    });

    return this.toDto(refreshed as unknown as RawRecurringTransaction);
  }

  // ── FindAll ───────────────────────────────────────────────────────────────

  async findAll(walletId: string): Promise<RecurringTransactionListResponseDto> {
    const templates = await this.prisma.recurringTransaction.findMany({
      where: { walletId, deletedAt: null },
      orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
    });

    return {
      recurringTransactions: (templates as unknown as RawRecurringTransaction[]).map((t) =>
        this.toDto(t),
      ),
      total: templates.length,
    };
  }

  // ── FindOne ───────────────────────────────────────────────────────────────

  async findOne(walletId: string, id: string): Promise<RecurringTransactionResponseDto> {
    const template = await this.prisma.recurringTransaction.findFirst({
      where: { id, walletId, deletedAt: null },
    });

    if (!template) throw new NotFoundException('RECURRING_TRANSACTION_NOT_FOUND');

    // Upcoming pending occurrences (next 10)
    const upcoming = await this.prisma.transaction.findMany({
      where: {
        recurrenceId: id,
        status: TransactionStatus.pending,
        deletedAt: null,
      },
      orderBy: { dueDate: 'asc' },
      take: 10,
    });

    const dto = this.toDto(template as unknown as RawRecurringTransaction);
    dto.upcomingOccurrences = (upcoming as unknown as RawTransaction[]).map((t) =>
      this.txToDto(t),
    );

    return dto;
  }

  // ── Update ────────────────────────────────────────────────────────────────
  // Updates the template and regenerates all *pending* future occurrences.

  async update(
    walletId: string,
    id: string,
    dto: UpdateRecurringTransactionDto,
  ): Promise<RecurringTransactionResponseDto> {
    const template = await this.prisma.recurringTransaction.findFirst({
      where: { id, walletId, deletedAt: null },
    });

    if (!template) throw new NotFoundException('RECURRING_TRANSACTION_NOT_FOUND');

    if (!template.isActive) {
      throw new UnprocessableEntityException('RECURRING_TRANSACTION_INACTIVE');
    }

    // Validate foreign keys if changing
    if (dto.categoryId !== undefined && dto.categoryId !== null) {
      const cat = await this.prisma.category.findFirst({
        where: { id: dto.categoryId, walletId, isArchived: false },
      });
      if (!cat) throw new UnprocessableEntityException('CATEGORY_NOT_IN_WALLET');
    }

    if (dto.bankAccountId) {
      const ba = await this.prisma.bankAccount.findFirst({
        where: { id: dto.bankAccountId, walletId, isArchived: false },
      });
      if (!ba) throw new UnprocessableEntityException('BANK_ACCOUNT_NOT_IN_WALLET');
    }

    // Determine effective values after update
    const newDescription = dto.description ?? template.description;
    const newAmount = dto.amount !== undefined
      ? new Decimal(dto.amount)
      : template.amount;
    const newCategoryId = 'categoryId' in dto
      ? (dto.categoryId ?? null)
      : template.categoryId;
    const newBankAccountId = dto.bankAccountId !== undefined
      ? dto.bankAccountId
      : template.bankAccountId;
    const newNotes = dto.notes !== undefined ? (dto.notes ?? null) : template.notes;
    const newEndDate = dto.endDate !== undefined
      ? (dto.endDate ? new Date(dto.endDate) : null)
      : template.endDate;
    const newMaxOccurrences = dto.maxOccurrences !== undefined
      ? (dto.maxOccurrences ?? null)
      : template.maxOccurrences;

    // Update template record
    await this.prisma.recurringTransaction.update({
      where: { id },
      data: {
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.amount !== undefined && { amount: dto.amount }),
        ...('categoryId' in dto && { categoryId: dto.categoryId ?? null }),
        ...(dto.bankAccountId !== undefined && { bankAccountId: dto.bankAccountId }),
        ...(dto.notes !== undefined && { notes: dto.notes ?? null }),
        ...(dto.endDate !== undefined && {
          endDate: dto.endDate ? new Date(dto.endDate) : null,
        }),
        ...(dto.maxOccurrences !== undefined && { maxOccurrences: dto.maxOccurrences ?? null }),
      },
    });

    // Find first pending occurrence to determine from which date to regenerate
    const firstPending = await this.prisma.transaction.findFirst({
      where: { recurrenceId: id, status: TransactionStatus.pending, deletedAt: null },
      orderBy: { dueDate: 'asc' },
    });

    // Delete all pending occurrences
    await this.prisma.transaction.updateMany({
      where: { recurrenceId: id, status: TransactionStatus.pending, deletedAt: null },
      data: { deletedAt: new Date() },
    });

    // Count already-paid occurrences to offset recurrenceIndex
    const paidCount = await this.prisma.transaction.count({
      where: { recurrenceId: id, status: TransactionStatus.paid, deletedAt: null },
    });

    // Regenerate from firstPending.dueDate (or template.startDate if no paid ones yet)
    const regenerateFrom = firstPending
      ? firstPending.dueDate
      : template.startDate;

    const remaining = newMaxOccurrences !== null
      ? Math.max(0, newMaxOccurrences - paidCount)
      : null;

    const newOccurrences = this.computeOccurrenceDates(
      regenerateFrom,
      template.frequency as unknown as RecurrenceFrequency,
      newEndDate,
      remaining,
    );

    const sign = template.type === 'income' ? 1 : -1;

    if (newOccurrences.length > 0) {
      await this.prisma.transaction.createMany({
        data: newOccurrences.map((dueDate, idx) => ({
          walletId,
          type: template.type,
          status: TransactionStatus.pending,
          amount: newAmount,
          sign,
          description: newDescription,
          notes: newNotes,
          dueDate,
          categoryId: newCategoryId,
          bankAccountId: newBankAccountId,
          recurrenceId: id,
          recurrenceIndex: paidCount + idx + 1,
        })),
      });

      await this.prisma.recurringTransaction.update({
        where: { id },
        data: { lastGeneratedDate: newOccurrences[newOccurrences.length - 1] },
      });
    }

    return this.findOne(walletId, id);
  }

  // ── SoftDelete ────────────────────────────────────────────────────────────

  async softDelete(walletId: string, id: string): Promise<void> {
    const template = await this.prisma.recurringTransaction.findFirst({
      where: { id, walletId, deletedAt: null },
    });

    if (!template) throw new NotFoundException('RECURRING_TRANSACTION_NOT_FOUND');

    await this.prisma.$transaction([
      // Cancel all pending occurrences
      this.prisma.transaction.updateMany({
        where: { recurrenceId: id, status: TransactionStatus.pending, deletedAt: null },
        data: { status: TransactionStatus.canceled },
      }),
      // Soft-delete the template
      this.prisma.recurringTransaction.update({
        where: { id },
        data: { isActive: false, deletedAt: new Date() },
      }),
    ]);
  }

  // ── EditFollowing (called from transactions service) ───────────────────────
  // Edits a specific occurrence and all subsequent pending ones.

  async editOccurrenceAndFollowing(
    walletId: string,
    transactionId: string,
    dto: {
      description?: string;
      amount?: number;
      dueDate?: string;
      categoryId?: string | null;
      bankAccountId?: string;
      notes?: string;
    },
  ): Promise<void> {
    const tx = await this.prisma.transaction.findFirst({
      where: { id: transactionId, walletId, deletedAt: null, recurrenceId: { not: null } },
    });

    if (!tx || !tx.recurrenceId) throw new NotFoundException('TRANSACTION_NOT_FOUND');
    if (tx.status !== TransactionStatus.pending) {
      throw new UnprocessableEntityException('OCCURRENCE_NOT_PENDING');
    }

    // Find all pending occurrences on or after this one's dueDate
    const targets = await this.prisma.transaction.findMany({
      where: {
        recurrenceId: tx.recurrenceId,
        status: TransactionStatus.pending,
        deletedAt: null,
        dueDate: { gte: tx.dueDate },
      },
    });

    const updateData: Record<string, unknown> = {};
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.amount !== undefined) updateData.amount = dto.amount;
    if (dto.dueDate !== undefined) updateData.dueDate = new Date(dto.dueDate);
    if ('categoryId' in dto) updateData.categoryId = dto.categoryId ?? null;
    if (dto.bankAccountId !== undefined) updateData.bankAccountId = dto.bankAccountId;
    if (dto.notes !== undefined) updateData.notes = dto.notes ?? null;

    if (Object.keys(updateData).length === 0) return;

    await this.prisma.$transaction(
      targets.map((t) =>
        this.prisma.transaction.update({
          where: { id: t.id, walletId },
          data: updateData,
        }),
      ),
    );
  }

  // ── CancelFollowing (called from transactions service) ────────────────────

  async cancelOccurrenceAndFollowing(
    walletId: string,
    transactionId: string,
  ): Promise<void> {
    const tx = await this.prisma.transaction.findFirst({
      where: { id: transactionId, walletId, deletedAt: null, recurrenceId: { not: null } },
    });

    if (!tx || !tx.recurrenceId) throw new NotFoundException('TRANSACTION_NOT_FOUND');
    if (tx.status !== TransactionStatus.pending) {
      throw new UnprocessableEntityException('OCCURRENCE_NOT_PENDING');
    }

    await this.prisma.transaction.updateMany({
      where: {
        recurrenceId: tx.recurrenceId,
        status: TransactionStatus.pending,
        deletedAt: null,
        dueDate: { gte: tx.dueDate },
      },
      data: { status: TransactionStatus.canceled },
    });

    // Mark template inactive if no more pending occurrences remain
    const remainingPending = await this.prisma.transaction.count({
      where: {
        recurrenceId: tx.recurrenceId,
        status: TransactionStatus.pending,
        deletedAt: null,
      },
    });

    if (remainingPending === 0) {
      await this.prisma.recurringTransaction.update({
        where: { id: tx.recurrenceId },
        data: { isActive: false },
      });
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  /**
   * Compute an array of occurrence dates starting from `startDate`,
   * respecting frequency, endDate, maxOccurrences, and the hard cap.
   *
   * When `endDate` is provided, generates all occurrences up to that date
   * (bounded by the hard safety ceiling). When not provided, falls back to
   * a generous horizon so open-ended templates stay usable.
   */
  computeOccurrenceDates(
    startDate: Date,
    frequency: RecurrenceFrequency,
    endDate: Date | null,
    maxOccurrences: number | null,
  ): Date[] {
    let effectiveEnd: Date;
    if (endDate) {
      effectiveEnd = endDate;
    } else {
      effectiveEnd = new Date(startDate);
      effectiveEnd.setMonth(effectiveEnd.getMonth() + FALLBACK_HORIZON_MONTHS);
    }

    const effectiveCap = Math.min(
      maxOccurrences ?? MAX_GENERATION_CAP,
      MAX_GENERATION_CAP,
    );

    const dates: Date[] = [];
    let current = new Date(startDate);

    while (current <= effectiveEnd && dates.length < effectiveCap) {
      dates.push(new Date(current));
      current = this.addInterval(current, frequency);
    }

    return dates;
  }

  private addInterval(date: Date, frequency: RecurrenceFrequency): Date {
    const next = new Date(date);

    switch (frequency) {
      case RecurrenceFrequency.daily:
        next.setDate(next.getDate() + 1);
        break;

      case RecurrenceFrequency.weekly:
        next.setDate(next.getDate() + 7);
        break;

      case RecurrenceFrequency.biweekly:
        next.setDate(next.getDate() + 14);
        break;

      case RecurrenceFrequency.monthly: {
        const originalDay = date.getDate();
        next.setMonth(next.getMonth() + 1);
        // Clamp to last day of month (e.g. Jan 31 → Feb 28)
        const lastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
        next.setDate(Math.min(originalDay, lastDay));
        break;
      }
    }

    return next;
  }

  private toDto(r: RawRecurringTransaction): RecurringTransactionResponseDto {
    return {
      id: r.id,
      walletId: r.walletId,
      type: r.type as RecurringTransactionType,
      frequency: r.frequency,
      description: r.description,
      amount: r.amount instanceof Decimal ? r.amount.toNumber() : Number(r.amount),
      startDate: r.startDate,
      endDate: r.endDate,
      maxOccurrences: r.maxOccurrences,
      categoryId: r.categoryId,
      bankAccountId: r.bankAccountId,
      notes: r.notes,
      isActive: r.isActive,
      lastGeneratedDate: r.lastGeneratedDate,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  }

  private txToDto(t: RawTransaction): TransactionResponseDto {
    return {
      id: t.id,
      walletId: t.walletId,
      type: t.type,
      status: t.status,
      amount: t.amount instanceof Decimal ? t.amount.toNumber() : Number(t.amount),
      sign: t.sign,
      description: t.description,
      notes: t.notes,
      dueDate: t.dueDate,
      paidAt: t.paidAt,
      categoryId: t.categoryId,
      bankAccountId: t.bankAccountId,
      transferGroupId: t.transferGroupId,
      recurrenceId: t.recurrenceId,
      recurrenceIndex: t.recurrenceIndex,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    };
  }
}
