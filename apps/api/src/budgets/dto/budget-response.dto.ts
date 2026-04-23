export class BudgetResponseDto {
  id: string;
  walletId: string;
  categoryId: string;
  categoryName: string | null;
  amountCents: number;
  spentCents: number;
  pct: number;
  createdAt: Date;
  updatedAt: Date;
}

export class BudgetListResponseDto {
  budgets: BudgetResponseDto[];
  total: number;
}
