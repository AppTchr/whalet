"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listTransactions,
  createTransaction,
  updateTransaction,
  payTransaction,
  unpayTransaction,
  cancelTransaction,
  deleteTransaction,
} from "@/services/transactions.service";
import type {
  TransactionListResponse,
  Transaction,
  CreateTransactionDto,
  UpdateTransactionDto,
} from "@/types/api";

interface TransactionParams {
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

export function useTransactions(walletId: string, params?: TransactionParams) {
  return useQuery<TransactionListResponse, Error>({
    queryKey: ["transactions", walletId, params?.page, params?.limit, params?.status, params?.type, params?.dueDateFrom, params?.dueDateTo, params?.search, params?.categoryId, params?.bankAccountId],
    queryFn: () => listTransactions(walletId, params),
    enabled: !!walletId,
    staleTime: 1000 * 30,
  });
}

export function useCreateTransaction(walletId: string) {
  const queryClient = useQueryClient();
  return useMutation<Transaction, Error, CreateTransactionDto>({
    mutationFn: (dto) => createTransaction(walletId, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions", walletId] });
      queryClient.invalidateQueries({ queryKey: ["wallets"] });
    },
  });
}

export function useUpdateTransaction(walletId: string) {
  const queryClient = useQueryClient();
  return useMutation<
    Transaction,
    Error,
    { id: string; dto: UpdateTransactionDto; applyToFollowing?: boolean }
  >({
    mutationFn: ({ id, dto, applyToFollowing }) =>
      updateTransaction(walletId, id, dto, applyToFollowing),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions", walletId] });
      queryClient.invalidateQueries({ queryKey: ["wallets"] });
    },
  });
}

export function usePayTransaction(walletId: string) {
  const queryClient = useQueryClient();
  return useMutation<Transaction, Error, { id: string; paidAt?: string }>({
    mutationFn: ({ id, paidAt }) => payTransaction(walletId, id, paidAt),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions", walletId] });
      queryClient.invalidateQueries({ queryKey: ["wallets"] });
    },
  });
}

export function useUnpayTransaction(walletId: string) {
  const queryClient = useQueryClient();
  return useMutation<Transaction, Error, string>({
    mutationFn: (id) => unpayTransaction(walletId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions", walletId] });
      queryClient.invalidateQueries({ queryKey: ["wallets"] });
    },
  });
}

export function useCancelTransaction(walletId: string) {
  const queryClient = useQueryClient();
  return useMutation<
    Transaction,
    Error,
    { id: string; applyToFollowing?: boolean }
  >({
    mutationFn: ({ id, applyToFollowing }) =>
      cancelTransaction(walletId, id, applyToFollowing),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions", walletId] });
      queryClient.invalidateQueries({ queryKey: ["wallets"] });
    },
  });
}

export function useDeleteTransaction(walletId: string) {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (id) => deleteTransaction(walletId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions", walletId] });
      queryClient.invalidateQueries({ queryKey: ["wallets"] });
    },
  });
}
