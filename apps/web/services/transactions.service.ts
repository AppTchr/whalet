import api from "@/lib/api";
import type {
  Transaction,
  TransactionListResponse,
  CreateTransactionDto,
  UpdateTransactionDto,
} from "@/types/api";

export async function listTransactions(
  walletId: string,
  params?: {
    page?: number;
    limit?: number;
    status?: string;
    type?: string;
    dueDateFrom?: string;
    dueDateTo?: string;
    search?: string;
    categoryId?: string;
    bankAccountId?: string;
  }
): Promise<TransactionListResponse> {
  const response = await api.get<TransactionListResponse>(
    `/wallets/${walletId}/transactions`,
    { params }
  );
  return response.data;
}

export async function createTransaction(
  walletId: string,
  dto: CreateTransactionDto
): Promise<Transaction> {
  const response = await api.post<Transaction>(
    `/wallets/${walletId}/transactions`,
    dto
  );
  return response.data;
}

export async function updateTransaction(
  walletId: string,
  id: string,
  dto: UpdateTransactionDto,
  applyToFollowing = false
): Promise<Transaction> {
  const response = await api.patch<Transaction>(
    `/wallets/${walletId}/transactions/${id}`,
    dto,
    applyToFollowing ? { params: { applyToFollowing: "true" } } : undefined
  );
  return response.data;
}

export async function payTransaction(
  walletId: string,
  id: string,
  paidAt?: string
): Promise<Transaction> {
  const response = await api.post<Transaction>(
    `/wallets/${walletId}/transactions/${id}/pay`,
    paidAt ? { paidAt } : {}
  );
  return response.data;
}

export async function cancelTransaction(
  walletId: string,
  id: string,
  applyToFollowing = false
): Promise<Transaction> {
  const response = await api.post<Transaction>(
    `/wallets/${walletId}/transactions/${id}/cancel`,
    {},
    applyToFollowing ? { params: { applyToFollowing: "true" } } : undefined
  );
  return response.data;
}

export async function deleteTransaction(
  walletId: string,
  id: string
): Promise<void> {
  await api.delete(`/wallets/${walletId}/transactions/${id}`);
}
