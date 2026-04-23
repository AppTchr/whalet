import api from "@/lib/api";
import type { Budget, UpsertBudgetDto } from "@/types/api";

export async function listBudgets(walletId: string): Promise<Budget[]> {
  const res = await api.get<{ budgets: Budget[] }>(`/wallets/${walletId}/budgets`);
  return res.data.budgets;
}

export async function upsertBudget(walletId: string, categoryId: string, dto: UpsertBudgetDto): Promise<Budget> {
  const res = await api.put<Budget>(`/wallets/${walletId}/budgets/${categoryId}`, dto);
  return res.data;
}

export async function deleteBudget(walletId: string, categoryId: string): Promise<void> {
  await api.delete(`/wallets/${walletId}/budgets/${categoryId}`);
}
