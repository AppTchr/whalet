import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWalletDto } from './dto/create-wallet.dto';
import { UpdateWalletDto } from './dto/update-wallet.dto';
import {
  WalletDetailDto,
  WalletListItemDto,
  WalletListResponseDto,
  ArchiveWalletResponseDto,
} from './dto/wallet-response.dto';
import { IBalanceService, BALANCE_SERVICE } from './balance/balance.interface';
import { WalletMemberRole, WalletType } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

export interface CanArchiveResult {
  allowed: boolean;
  warnings: string[];
}

@Injectable()
export class WalletsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(BALANCE_SERVICE) private readonly balanceService: IBalanceService,
  ) {}

  async create(
    userId: string,
    dto: CreateWalletDto,
  ): Promise<WalletDetailDto> {
    const wallet = await this.prisma.$transaction(async (tx) => {
      const created = await tx.wallet.create({
        data: {
          ownerUserId: userId,
          name: dto.name,
          type: dto.type,
          currencyCode: dto.currencyCode ?? 'BRL',
          initialBalance: dto.initialBalance ?? 0,
          description: dto.description ?? null,
        },
      });

      await tx.walletMember.create({
        data: {
          walletId: created.id,
          userId,
          role: 'owner',
          status: 'active',
        },
      });

      return created;
    });

    const balances = await this.balanceService.getBatchBalances([wallet.id]);
    const balance = balances.get(wallet.id);

    return this.toDetailDto(
      wallet,
      'owner',
      balance?.settled ?? new Decimal(0),
      balance?.projected ?? new Decimal(0),
      1,
    );
  }

  async findAll(
    userId: string,
    includeArchived: boolean,
  ): Promise<WalletListResponseDto> {
    const memberships = await this.prisma.walletMember.findMany({
      where: {
        userId,
        status: 'active',
        wallet: includeArchived ? undefined : { isArchived: false },
      },
      include: {
        wallet: {
          include: {
            _count: { select: { members: { where: { status: 'active' } } } },
          },
        },
      },
    });

    if (memberships.length === 0) {
      return { wallets: [], total: 0 };
    }

    const walletIds = memberships.map((m) => m.walletId);
    const balances = await this.balanceService.getBatchBalances(walletIds);

    const wallets: WalletListItemDto[] = memberships.map((membership) => {
      const wallet = membership.wallet;
      const balance = balances.get(wallet.id);

      return {
        id: wallet.id,
        name: wallet.name,
        type: wallet.type,
        currencyCode: wallet.currencyCode,
        isArchived: wallet.isArchived,
        role: membership.role,
        settledBalance: balance?.settled.toNumber() ?? 0,
        projectedBalance: balance?.projected.toNumber() ?? 0,
        memberCount: wallet._count.members,
        createdAt: wallet.createdAt,
      };
    });

    return { wallets, total: wallets.length };
  }

  async findOne(
    walletId: string,
    memberRole: WalletMemberRole,
  ): Promise<WalletDetailDto> {
    const wallet = await this.prisma.wallet.findUnique({
      where: { id: walletId },
      include: {
        _count: { select: { members: { where: { status: 'active' } } } },
      },
    });

    if (!wallet) {
      throw new NotFoundException('WALLET_NOT_FOUND');
    }

    const balances = await this.balanceService.getBatchBalances([walletId]);
    const balance = balances.get(walletId);

    return this.toDetailDto(
      wallet,
      memberRole,
      balance?.settled ?? new Decimal(0),
      balance?.projected ?? new Decimal(0),
      wallet._count.members,
    );
  }

  async update(
    walletId: string,
    dto: UpdateWalletDto,
    callerRole: WalletMemberRole = 'owner',
  ): Promise<WalletDetailDto> {
    const wallet = await this.prisma.wallet.findUnique({
      where: { id: walletId },
      include: {
        _count: { select: { members: { where: { status: 'active' } } } },
      },
    });

    if (!wallet) {
      throw new NotFoundException('WALLET_NOT_FOUND');
    }

    const updated = await this.prisma.wallet.update({
      where: { id: walletId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.type !== undefined && { type: dto.type }),
      },
      include: {
        _count: { select: { members: { where: { status: 'active' } } } },
      },
    });

    const balances = await this.balanceService.getBatchBalances([walletId]);
    const balance = balances.get(walletId);

    // FIX H3: use actual caller role, not hardcoded 'owner'
    return this.toDetailDto(
      updated,
      callerRole,
      balance?.settled ?? new Decimal(0),
      balance?.projected ?? new Decimal(0),
      updated._count.members,
    );
  }

  async canArchive(walletId: string): Promise<CanArchiveResult> {
    return { allowed: true, warnings: [] };
  }

  async archive(walletId: string, confirm: boolean): Promise<ArchiveWalletResponseDto> {
    if (!confirm) {
      throw new BadRequestException('ARCHIVE_CONFIRMATION_REQUIRED');
    }

    const canArchiveResult = await this.canArchive(walletId);
    if (!canArchiveResult.allowed) {
      throw new UnprocessableEntityException('WALLET_CANNOT_BE_ARCHIVED');
    }

    const wallet = await this.prisma.wallet.findUnique({
      where: { id: walletId },
    });

    if (!wallet) {
      throw new NotFoundException('WALLET_NOT_FOUND');
    }

    // FIX M1: prevent silent timestamp overwrite on already-archived wallet
    if (wallet.isArchived) {
      throw new UnprocessableEntityException('WALLET_ALREADY_ARCHIVED');
    }

    const updated = await this.prisma.wallet.update({
      where: { id: walletId },
      data: { isArchived: true, archivedAt: new Date() },
    });

    return { id: updated.id, isArchived: updated.isArchived };
  }

  async unarchive(walletId: string): Promise<ArchiveWalletResponseDto> {
    const wallet = await this.prisma.wallet.findUnique({
      where: { id: walletId },
    });

    if (!wallet) {
      throw new NotFoundException('WALLET_NOT_FOUND');
    }

    // FIX M2: prevent silent no-op on non-archived wallet
    if (!wallet.isArchived) {
      throw new UnprocessableEntityException('WALLET_NOT_ARCHIVED');
    }

    const updated = await this.prisma.wallet.update({
      where: { id: walletId },
      data: { isArchived: false, archivedAt: null },
    });

    return { id: updated.id, isArchived: updated.isArchived };
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private toDetailDto(
    wallet: {
      id: string;
      ownerUserId: string;
      name: string;
      type: import('@prisma/client').WalletType;
      currencyCode: string;
      initialBalance: Decimal;
      description: string | null;
      isArchived: boolean;
      archivedAt: Date | null;
      createdAt: Date;
      updatedAt: Date;
    },
    role: WalletMemberRole,
    settled: Decimal,
    projected: Decimal,
    memberCount: number,
  ): WalletDetailDto {
    return {
      id: wallet.id,
      ownerUserId: wallet.ownerUserId,
      name: wallet.name,
      type: wallet.type,
      currencyCode: wallet.currencyCode,
      initialBalance: wallet.initialBalance.toNumber(),
      description: wallet.description,
      isArchived: wallet.isArchived,
      archivedAt: wallet.archivedAt,
      role,
      settledBalance: settled.toNumber(),
      projectedBalance: projected.toNumber(),
      memberCount,
      createdAt: wallet.createdAt,
      updatedAt: wallet.updatedAt,
    };
  }
}
