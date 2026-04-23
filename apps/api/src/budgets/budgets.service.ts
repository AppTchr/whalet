import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpsertBudgetDto } from './dto/upsert-budget.dto';
import { BudgetResponseDto, BudgetListResponseDto } from './dto/budget-response.dto';

@Injectable()
export class BudgetsService {
  constructor(private readonly prisma: PrismaService) {}

  async upsert(
    walletId: string,
    categoryId: string,
    dto: UpsertBudgetDto,
  ): Promise<BudgetResponseDto> {
    // Validate category belongs to this wallet
    const category = await this.prisma.category.findFirst({
      where: { id: categoryId, walletId },
      select: { id: true, name: true },
    });
    if (!category) throw new NotFoundException('CATEGORY_NOT_FOUND');
    if (category === null) throw new NotFoundException('CATEGORY_NOT_FOUND');

    const budget = await this.prisma.budget.upsert({
      where: { walletId_categoryId: { walletId, categoryId } },
      create: { walletId, categoryId, amountCents: dto.amountCents },
      update: { amountCents: dto.amountCents },
    });

    const spentCents = await this.computeSpentCents(walletId, categoryId);
    return this.toDto(budget, category.name, spentCents);
  }

  async findAll(walletId: string): Promise<BudgetListResponseDto> {
    const budgets = await this.prisma.budget.findMany({
      where: { walletId },
      include: { category: { select: { name: true } } },
      orderBy: { createdAt: 'asc' },
    });

    // Batch-compute spent for all categories
    const categoryIds = budgets.map((b) => b.categoryId);
    const spentMap = await this.computeSpentCentsMap(walletId, categoryIds);

    return {
      budgets: budgets.map((b) =>
        this.toDto(b, b.category.name, spentMap.get(b.categoryId) ?? 0),
      ),
      total: budgets.length,
    };
  }

  async delete(walletId: string, categoryId: string): Promise<void> {
    const budget = await this.prisma.budget.findFirst({
      where: { walletId, categoryId },
    });
    if (!budget) throw new NotFoundException('BUDGET_NOT_FOUND');
    await this.prisma.budget.delete({ where: { id: budget.id } });
  }

  // ---------------------------------------------------------------------------

  private async computeSpentCents(walletId: string, categoryId: string): Promise<number> {
    const map = await this.computeSpentCentsMap(walletId, [categoryId]);
    return map.get(categoryId) ?? 0;
  }

  private async computeSpentCentsMap(
    walletId: string,
    categoryIds: string[],
  ): Promise<Map<string, number>> {
    if (categoryIds.length === 0) return new Map();

    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

    const txs = await this.prisma.transaction.findMany({
      where: {
        walletId,
        categoryId: { in: categoryIds },
        deletedAt: null,
        status: { not: 'canceled' },
        sign: -1,
        dueDate: { gte: monthStart, lt: monthEnd },
      },
      select: { categoryId: true, amount: true },
    });

    const map = new Map<string, number>();
    for (const tx of txs) {
      if (!tx.categoryId) continue;
      const prev = map.get(tx.categoryId) ?? 0;
      map.set(tx.categoryId, prev + Math.round(Number(tx.amount) * 100));
    }
    return map;
  }

  private toDto(
    budget: { id: string; walletId: string; categoryId: string; amountCents: number; createdAt: Date; updatedAt: Date },
    categoryName: string,
    spentCents: number,
  ): BudgetResponseDto {
    const pct = budget.amountCents > 0
      ? Math.min(Math.round((spentCents / budget.amountCents) * 100), 999)
      : 0;
    return {
      id: budget.id,
      walletId: budget.walletId,
      categoryId: budget.categoryId,
      categoryName,
      amountCents: budget.amountCents,
      spentCents,
      pct,
      createdAt: budget.createdAt,
      updatedAt: budget.updatedAt,
    };
  }
}
