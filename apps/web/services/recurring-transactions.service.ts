import api from "@/lib/api";
import type {
  RecurringTransaction,
  RecurringTransactionListResponse,
  CreateRecurringTransactionDto,
  UpdateRecurringTransactionDto,
} from "@/types/api";

export async function listRecurringTransactions(
  walletId: string
): Promise<RecurringTransactionListResponse> {
  const response = await api.get<RecurringTransactionListResponse>(
    `/wallets/${walletId}/recurring-transactions`
  );
  return response.data;
}

export async function getRecurringTransaction(
  walletId: string,
  id: string
): Promise<RecurringTransaction> {
  const response = await api.get<RecurringTransaction>(
    `/wallets/${walletId}/recurring-transactions/${id}`
  );
  return response.data;
}

export async function createRecurringTransaction(
  walletId: string,
  dto: CreateRecurringTransactionDto
): Promise<RecurringTransaction> {
  const response = await api.post<RecurringTransaction>(
    `/wallets/${walletId}/recurring-transactions`,
    dto
  );
  return response.data;
}

export async function updateRecurringTransaction(
  walletId: string,
  id: string,
  dto: UpdateRecurringTransactionDto
): Promise<RecurringTransaction> {
  const response = await api.patch<RecurringTransaction>(
    `/wallets/${walletId}/recurring-transactions/${id}`,
    dto
  );
  return response.data;
}

export async function deleteRecurringTransaction(
  walletId: string,
  id: string
): Promise<void> {
  await api.delete(`/wallets/${walletId}/recurring-transactions/${id}`);
}
