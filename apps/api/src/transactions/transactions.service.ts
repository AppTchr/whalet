import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { TransactionStatus, TransactionType } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { PayTransactionDto } from './dto/pay-transaction.dto';
import { ListTransactionsDto } from './dto/list-transactions.dto';
import {
  TransactionListResponseDto,
  TransactionResponseDto,
} from './dto/transaction-response.dto';

// Avoid circular import — use a token + lazy reference
export const RECURRING_SERVICE_TOKEN = 'RECURRING_TRANSACTIONS_SERVICE';

export interface IRecurringTransactionsService {
  editOccurrenceAndFollowing(
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
  ): Promise<void>;
  cancelOccurrenceAndFollowing(walletId: string, transactionId: string): Promise<void>;
}

// ---------------------------------------------------------------------------
// Raw Prisma transaction shape returned from DB queries
// ---------------------------------------------------------------------------

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

@Injectable()
export class TransactionsService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() @Inject(RECURRING_SERVICE_TOKEN)
    private readonly recurringService: IRecurringTransactionsService | null,
  ) {}

  // ---------------------------------------------------------------------------
  // Public CRUD methods
  // ---------------------------------------------------------------------------

  async create(
    walletId: string,
    dto: CreateTransactionDto,
    callerId: string,
  ): Promise<TransactionResponseDto> {
    // Rule 1: 'canceled' is never a valid initial status
    if ((dto.status as string) === 'canceled') {
      throw new UnprocessableEntityException('TRANSACTION_INVALID_INITIAL_STATUS');
    }

    // Rule 2: some types are managed by the cards domain and cannot be created directly
    const nonDirectTypes: TransactionType[] = [
      TransactionType.transfer_in,
      TransactionType.credit_card_purchase,
      TransactionType.credit_card_refund,
    ];
    if (nonDirectTypes.includes(dto.type)) {
      throw new UnprocessableEntityException('TRANSACTION_TYPE_NOT_DIRECTLY_CREATABLE');
    }

    // Rule 3: transfer_out requires counterpartBankAccountId
    if (dto.type === TransactionType.transfer_out && !dto.counterpartBankAccountId) {
      throw new UnprocessableEntityException('TRANSFER_COUNTERPART_REQUIRED');
    }

    // Rule 4: non-transfer types must NOT supply counterpartBankAccountId
    if (dto.type !== TransactionType.transfer_out && dto.counterpartBankAccountId) {
      throw new UnprocessableEntityException('TRANSFER_COUNTERPART_INVALID');
    }

    // FIX SC-1: Validate categoryId belongs to this wallet
    if (dto.categoryId) {
      const cat = await this.prisma.category.findFirst({
        where: { id: dto.categoryId, walletId, isArchived: false },
      });
      if (!cat) {
        throw new UnprocessableEntityException('CATEGORY_NOT_IN_WALLET');
      }
    }

    // FIX SC-1: Validate bankAccountId belongs to this wallet
    if (dto.bankAccountId) {
      const ba = await this.prisma.bankAccount.findFirst({
        where: { id: dto.bankAccountId, walletId, isArchived: false },
      });
      if (!ba) {
        throw new UnprocessableEntityException('BANK_ACCOUNT_NOT_IN_WALLET');
      }
    }

    const status: TransactionStatus = (dto.status as TransactionStatus) ?? TransactionStatus.pending;
    const paidAt =
      status === TransactionStatus.paid
        ? dto.paidAt
          ? new Date(dto.paidAt)
          : new Date()
        : null;

    const sign = this.getSign(dto.type);

    // Transfer pair: created atomically with correct walletIds
    if (dto.type === TransactionType.transfer_out) {
      // FIX FC-1: Resolve destination wallet from counterpartBankAccountId
      const destinationAccount = await this.prisma.bankAccount.findFirst({
        where: { id: dto.counterpartBankAccountId!, isArchived: false },
      });
      if (!destinationAccount) {
        throw new UnprocessableEntityException('TRANSFER_COUNTERPART_BANK_ACCOUNT_NOT_FOUND');
      }

      // FIX C-2: Caller must be an active member of the destination wallet
      const isMember = await this.prisma.walletMember.findFirst({
        where: { walletId: destinationAccount.walletId, userId: callerId, status: 'active' },
      });
      if (!isMember) throw new ForbiddenException('FORBIDDEN_TRANSFER_DESTINATION');

      const transferGroupId = uuidv4();

      const [outLeg] = await this.prisma.$transaction([
        this.prisma.transaction.create({
          data: {
            walletId,                                          // source wallet
            type: TransactionType.transfer_out,
            status,
            amount: dto.amount,
            sign: this.getSign(TransactionType.transfer_out), // -1
            description: dto.description,
            notes: dto.notes ?? null,
            dueDate: new Date(dto.dueDate),
            paidAt,
            categoryId: dto.categoryId ?? null,
            bankAccountId: dto.bankAccountId ?? null,
            transferGroupId,
          },
        }),
        this.prisma.transaction.create({
          data: {
            walletId: destinationAccount.walletId,             // FIX FC-1: destination wallet
            type: TransactionType.transfer_in,
            status,
            amount: dto.amount,
            sign: this.getSign(TransactionType.transfer_in),   // +1
            description: dto.description,
            notes: dto.notes ?? null,
            dueDate: new Date(dto.dueDate),
            paidAt,
            categoryId: null,
            bankAccountId: dto.counterpartBankAccountId ?? null,
            transferGroupId,
          },
        }),
      ]);

      return this.toDto(outLeg as RawTransaction);
    }

    // Single record for non-transfers
    const transaction = await this.prisma.transaction.create({
      data: {
        walletId,
        type: dto.type,
        status,
        amount: dto.amount,
        sign,
        description: dto.description,
        notes: dto.notes ?? null,
        dueDate: new Date(dto.dueDate),
        paidAt,
        categoryId: dto.categoryId ?? null,
        bankAccountId: dto.bankAccountId ?? null,
        transferGroupId: null,
      },
    });

    return this.toDto(transaction as RawTransaction);
  }

  async findAll(
    walletId: string,
    query: ListTransactionsDto,
  ): Promise<TransactionListResponseDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {
      walletId,
      deletedAt: null, // NEVER return soft-deleted records
    };

    if (query.status !== undefined) {
      where.status = query.status;
    }

    if (query.type !== undefined) {
      where.type = query.type;
    }

    if (query.categoryId !== undefined) {
      where.categoryId = query.categoryId;
    }

    if (query.bankAccountId !== undefined) {
      where.bankAccountId = query.bankAccountId;
    }

    if (query.search !== undefined) {
      where.description = { contains: query.search, mode: 'insensitive' };
    }

    if (query.dueDateFrom !== undefined || query.dueDateTo !== undefined) {
      const dueDateFilter: Record<string, Date> = {};
      if (query.dueDateFrom !== undefined) {
        dueDateFilter.gte = new Date(query.dueDateFrom);
      }
      if (query.dueDateTo !== undefined) {
        dueDateFilter.lte = new Date(query.dueDateTo);
      }
      where.dueDate = dueDateFilter;
    }

    const orderBy = [{ dueDate: 'desc' as const }, { createdAt: 'desc' as const }];

    const [transactions, total] = await this.prisma.$transaction([
      this.prisma.transaction.findMany({ where, orderBy, skip, take: limit }),
      this.prisma.transaction.count({ where }),
    ]);

    return {
      transactions: (transactions as RawTransaction[]).map((t) => this.toDto(t)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / Math.max(limit, 1)),
    };
  }

  async findOne(walletId: string, id: string): Promise<TransactionResponseDto> {
    const transaction = await this.prisma.transaction.findFirst({
      where: { id, walletId, deletedAt: null },
    });

    if (!transaction) {
      throw new NotFoundException('TRANSACTION_NOT_FOUND');
    }

    return this.toDto(transaction as RawTransaction);
  }

  async update(
    walletId: string,
    id: string,
    dto: UpdateTransactionDto,
    applyToFollowing = false,
  ): Promise<TransactionResponseDto> {
    const existing = await this.prisma.transaction.findFirst({
      where: { id, walletId, deletedAt: null },
    });

    if (!existing) {
      throw new NotFoundException('TRANSACTION_NOT_FOUND');
    }

    if (existing.status === TransactionStatus.canceled) {
      throw new UnprocessableEntityException('TRANSACTION_ALREADY_CANCELED');
    }

    // FIX FH-2: Block paidAt mutation on paid transactions — use /pay endpoint instead
    if (existing.status === TransactionStatus.paid && dto.paidAt !== undefined) {
      throw new UnprocessableEntityException('TRANSACTION_PAID_AT_IMMUTABLE');
    }

    // FIX SC-1: Validate categoryId belongs to this wallet
    if (dto.categoryId) {
      const cat = await this.prisma.category.findFirst({
        where: { id: dto.categoryId, walletId, isArchived: false },
      });
      if (!cat) {
        throw new UnprocessableEntityException('CATEGORY_NOT_IN_WALLET');
      }
    }

    // FIX SC-1: Validate bankAccountId belongs to this wallet
    if (dto.bankAccountId) {
      const ba = await this.prisma.bankAccount.findFirst({
        where: { id: dto.bankAccountId, walletId, isArchived: false },
      });
      if (!ba) {
        throw new UnprocessableEntityException('BANK_ACCOUNT_NOT_IN_WALLET');
      }
    }

    // Recurring: apply to this occurrence and all following pending ones
    if (applyToFollowing && existing.recurrenceId && this.recurringService) {
      await this.recurringService.editOccurrenceAndFollowing(walletId, id, {
        description: dto.description,
        dueDate: dto.dueDate,
        ...('categoryId' in dto && { categoryId: dto.categoryId }),
        bankAccountId: dto.bankAccountId,
        notes: dto.notes,
      });
      const refreshed = await this.prisma.transaction.findFirst({
        where: { id, walletId, deletedAt: null },
      });
      if (!refreshed) throw new NotFoundException('TRANSACTION_NOT_FOUND');
      return this.toDto(refreshed as RawTransaction);
    }

    // FIX SC-3: Include walletId in update where clause
    const updated = await this.prisma.transaction.update({
      where: { id, walletId },
      data: {
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
        // categoryId supports null (removal)
        ...('categoryId' in dto && { categoryId: dto.categoryId ?? null }),
        ...(dto.bankAccountId !== undefined && { bankAccountId: dto.bankAccountId }),
        ...(dto.dueDate !== undefined && { dueDate: new Date(dto.dueDate) }),
        ...(dto.paidAt !== undefined && { paidAt: new Date(dto.paidAt) }),
      },
    });

    return this.toDto(updated as RawTransaction);
  }

  async pay(
    walletId: string,
    id: string,
    dto: PayTransactionDto,
  ): Promise<TransactionResponseDto> {
    const existing = await this.prisma.transaction.findFirst({
      where: { id, walletId, deletedAt: null },
    });

    if (!existing) {
      throw new NotFoundException('TRANSACTION_NOT_FOUND');
    }

    if (existing.status === TransactionStatus.paid) {
      throw new UnprocessableEntityException('TRANSACTION_ALREADY_PAID');
    }

    if (existing.status === TransactionStatus.canceled) {
      throw new UnprocessableEntityException('TRANSACTION_ALREADY_CANCELED');
    }

    const paidAt = dto.paidAt ? new Date(dto.paidAt) : new Date();

    // Transfers: pay both legs atomically
    if (existing.transferGroupId) {
      // FIX SC-2: Scope pair fetch — do NOT filter by walletId here because
      // the two legs can belong to different wallets (source and destination).
      // We trust the transferGroupId from an already-verified transaction.
      const pair = await this.prisma.transaction.findMany({
        where: { transferGroupId: existing.transferGroupId, deletedAt: null },
      });

      // FIX QA-C3: Both legs must exist — any other count signals integrity violation
      if (pair.length !== 2) {
        throw new UnprocessableEntityException('TRANSFER_PAIR_INTEGRITY_VIOLATION');
      }

      const hasCanceled = pair.some((t) => t.status === TransactionStatus.canceled);
      if (hasCanceled) {
        throw new UnprocessableEntityException('TRANSFER_PAIR_STATE_CONFLICT');
      }

      await this.prisma.$transaction(
        pair.map((t) =>
          this.prisma.transaction.update({
            where: { id: t.id },
            data: { status: TransactionStatus.paid, paidAt },
          }),
        ),
      );

      // FIX FH-1 / SM-3: Add deletedAt: null to re-fetch
      const updated = await this.prisma.transaction.findFirst({
        where: { id, walletId, deletedAt: null },
      });

      if (!updated) {
        throw new NotFoundException('TRANSACTION_NOT_FOUND');
      }

      return this.toDto(updated as RawTransaction);
    }

    // Invoice-payment transactions are paid through the dedicated fatura
    // endpoint, which handles fatura promotion atomically. Direct /pay on an
    // invoice_payment is no longer supported — the projected-tx mechanism is
    // gone (Fase 4 cleanup).
    if (existing.type === TransactionType.invoice_payment) {
      throw new UnprocessableEntityException('USE_FATURA_PAY_ENDPOINT');
    }

    const updated = await this.prisma.transaction.update({
      where: { id, walletId },
      data: { status: TransactionStatus.paid, paidAt },
    });

    return this.toDto(updated as RawTransaction);
  }

  async unpay(walletId: string, id: string): Promise<TransactionResponseDto> {
    const existing = await this.prisma.transaction.findFirst({
      where: { id, walletId, deletedAt: null },
    });

    if (!existing) {
      throw new NotFoundException('TRANSACTION_NOT_FOUND');
    }

    if (existing.status !== TransactionStatus.paid) {
      throw new UnprocessableEntityException('TRANSACTION_NOT_PAID');
    }

    if (existing.type === TransactionType.invoice_payment) {
      throw new UnprocessableEntityException('USE_FATURA_UNPAY_ENDPOINT');
    }

    if (existing.transferGroupId) {
      const pair = await this.prisma.transaction.findMany({
        where: { transferGroupId: existing.transferGroupId, deletedAt: null },
      });
      if (pair.length !== 2) {
        throw new UnprocessableEntityException('TRANSFER_PAIR_INTEGRITY_VIOLATION');
      }
      await this.prisma.$transaction(
        pair.map((t) =>
          this.prisma.transaction.update({
            where: { id: t.id },
            data: { status: TransactionStatus.pending, paidAt: null },
          }),
        ),
      );
      const updated = await this.prisma.transaction.findFirst({
        where: { id, walletId, deletedAt: null },
      });
      if (!updated) throw new NotFoundException('TRANSACTION_NOT_FOUND');
      return this.toDto(updated as RawTransaction);
    }

    const updated = await this.prisma.transaction.update({
      where: { id, walletId },
      data: { status: TransactionStatus.pending, paidAt: null },
    });

    return this.toDto(updated as RawTransaction);
  }

  async cancel(walletId: string, id: string, applyToFollowing = false): Promise<TransactionResponseDto> {
    const existing = await this.prisma.transaction.findFirst({
      where: { id, walletId, deletedAt: null },
    });

    if (!existing) {
      throw new NotFoundException('TRANSACTION_NOT_FOUND');
    }

    if (existing.status === TransactionStatus.canceled) {
      throw new UnprocessableEntityException('TRANSACTION_ALREADY_CANCELED');
    }

    // Recurring: cancel this occurrence and all following pending ones
    if (applyToFollowing && existing.recurrenceId && this.recurringService) {
      await this.recurringService.cancelOccurrenceAndFollowing(walletId, id);
      const refreshed = await this.prisma.transaction.findFirst({
        where: { id, walletId, deletedAt: null },
      });
      if (!refreshed) throw new NotFoundException('TRANSACTION_NOT_FOUND');
      return this.toDto(refreshed as RawTransaction);
    }

    // Transfers: cancel both legs atomically
    if (existing.transferGroupId) {
      // FIX SC-2: pair may span wallets — scoping by transferGroupId is correct here
      const pair = await this.prisma.transaction.findMany({
        where: { transferGroupId: existing.transferGroupId, deletedAt: null },
      });

      // FIX QA-C3: Both legs must exist
      if (pair.length !== 2) {
        throw new UnprocessableEntityException('TRANSFER_PAIR_INTEGRITY_VIOLATION');
      }

      await this.prisma.$transaction(
        pair.map((t) =>
          this.prisma.transaction.update({
            where: { id: t.id },
            // FIX FC-2: Clear paidAt when canceling a paid transaction
            data: {
              status: TransactionStatus.canceled,
              ...(t.status === TransactionStatus.paid && { paidAt: null }),
            },
          }),
        ),
      );

      // FIX SM-3: Add deletedAt: null to re-fetch
      const updated = await this.prisma.transaction.findFirst({
        where: { id, walletId, deletedAt: null },
      });

      if (!updated) {
        throw new NotFoundException('TRANSACTION_NOT_FOUND');
      }

      return this.toDto(updated as RawTransaction);
    }

    // invoice_payment cancellation must reset fatura state atomically AND
    // revert each parcela-Transaction back to pending.
    if (
      existing.type === TransactionType.invoice_payment &&
      existing.status === TransactionStatus.paid
    ) {
      const fatura = await this.prisma.fatura.findFirst({
        where: { invoicePaymentTxId: id },
      });

      if (fatura) {
        await this.prisma.$transaction([
          this.prisma.transaction.update({
            where: { id, walletId },
            data: { status: TransactionStatus.canceled, paidAt: null },
          }),
          this.prisma.fatura.update({
            where: { id: fatura.id },
            data: { invoicePaymentTxId: null, paidAt: null },
          }),
          this.prisma.transaction.updateMany({
            where: {
              faturaId: fatura.id,
              type: TransactionType.credit_card_purchase,
              status: TransactionStatus.paid,
            },
            data: { status: TransactionStatus.pending, paidAt: null },
          }),
        ]);

        const updated = await this.prisma.transaction.findFirst({
          where: { id, walletId, deletedAt: null },
        });

        if (!updated) {
          throw new NotFoundException('TRANSACTION_NOT_FOUND');
        }

        return this.toDto(updated as RawTransaction);
      }
    }

    // Non-transfer: single update
    // FIX SC-3: Include walletId in update where clause
    // FIX FC-2: Clear paidAt when canceling a paid transaction
    const updated = await this.prisma.transaction.update({
      where: { id, walletId },
      data: {
        status: TransactionStatus.canceled,
        ...(existing.status === TransactionStatus.paid && { paidAt: null }),
      },
    });

    return this.toDto(updated as RawTransaction);
  }

  async softDelete(walletId: string, id: string): Promise<void> {
    const existing = await this.prisma.transaction.findFirst({
      where: { id, walletId },
    });

    if (!existing) {
      throw new NotFoundException('TRANSACTION_NOT_FOUND');
    }
    if (existing.deletedAt) {
      throw new UnprocessableEntityException('TRANSACTION_ALREADY_DELETED');
    }

    if (existing.type === TransactionType.invoice_payment) {
      const linkedFatura = await this.prisma.fatura.findFirst({
        where: { invoicePaymentTxId: id },
      });
      if (linkedFatura) {
        throw new UnprocessableEntityException('INVOICE_PAYMENT_LINKED_TO_FATURA');
      }
    }

    if (existing.transferGroupId) {
      const pair = await this.prisma.transaction.findMany({
        where: { transferGroupId: existing.transferGroupId, deletedAt: null },
      });
      if (pair.length !== 2) {
        throw new UnprocessableEntityException('TRANSFER_PAIR_INTEGRITY_VIOLATION');
      }
      const now = new Date();
      await this.prisma.$transaction(
        pair.map((t) =>
          this.prisma.transaction.update({
            where: { id: t.id },
            data: { deletedAt: now },
          }),
        ),
      );
      return;
    }

    await this.prisma.transaction.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private getSign(type: TransactionType): number {
    const signs: Record<TransactionType, number> = {
      income: 1,
      expense: -1,
      transfer_in: 1,
      transfer_out: -1,
      credit_card_purchase: 0,
      invoice_payment: -1,
      credit_card_refund: 0,
    };
    return signs[type];
  }

  private toDto(transaction: RawTransaction): TransactionResponseDto {
    return {
      id: transaction.id,
      walletId: transaction.walletId,
      type: transaction.type,
      status: transaction.status,
      amount: transaction.amount instanceof Decimal
        ? transaction.amount.toNumber()
        : Number(transaction.amount),
      sign: transaction.sign,
      description: transaction.description,
      notes: transaction.notes,
      dueDate: transaction.dueDate,
      paidAt: transaction.paidAt,
      categoryId: transaction.categoryId,
      bankAccountId: transaction.bankAccountId,
      transferGroupId: transaction.transferGroupId,
      recurrenceId: transaction.recurrenceId ?? null,
      recurrenceIndex: transaction.recurrenceIndex ?? null,
      createdAt: transaction.createdAt,
      updatedAt: transaction.updatedAt,
    };
  }
}
