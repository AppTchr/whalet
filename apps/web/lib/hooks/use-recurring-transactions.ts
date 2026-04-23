"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listRecurringTransactions,
  createRecurringTransaction,
  updateRecurringTransaction,
  deleteRecurringTransaction,
} from "@/services/recurring-transactions.service";
import type {
  RecurringTransaction,
  RecurringTransactionListResponse,
  CreateRecurringTransactionDto,
  UpdateRecurringTransactionDto,
} from "@/types/api";

export function useRecurringTransactions(walletId: string) {
  return useQuery<RecurringTransactionListResponse, Error>({
    queryKey: ["recurring-transactions", walletId],
    queryFn: () => listRecurringTransactions(walletId),
    enabled: !!walletId,
    staleTime: 1000 * 60,
  });
}

export function useCreateRecurringTransaction(walletId: string) {
  const queryClient = useQueryClient();
  return useMutation<RecurringTransaction, Error, CreateRecurringTransactionDto>({
    mutationFn: (dto) => createRecurringTransaction(walletId, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recurring-transactions", walletId] });
      queryClient.invalidateQueries({ queryKey: ["transactions", walletId] });
    },
  });
}

export function useUpdateRecurringTransaction(walletId: string) {
  const queryClient = useQueryClient();
  return useMutation<
    RecurringTransaction,
    Error,
    { id: string; dto: UpdateRecurringTransactionDto }
  >({
    mutationFn: ({ id, dto }) => updateRecurringTransaction(walletId, id, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recurring-transactions", walletId] });
      queryClient.invalidateQueries({ queryKey: ["transactions", walletId] });
    },
  });
}

export function useDeleteRecurringTransaction(walletId: string) {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (id) => deleteRecurringTransaction(walletId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recurring-transactions", walletId] });
      queryClient.invalidateQueries({ queryKey: ["transactions", walletId] });
    },
  });
}
