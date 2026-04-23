"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listBudgets, upsertBudget, deleteBudget } from "@/services/budgets.service";
import type { Budget, UpsertBudgetDto } from "@/types/api";

export function useBudgets(walletId: string) {
  return useQuery<Budget[], Error>({
    queryKey: ["budgets", walletId],
    queryFn: () => listBudgets(walletId),
    enabled: !!walletId,
    staleTime: 1000 * 60,
  });
}

export function useUpsertBudget(walletId: string) {
  const queryClient = useQueryClient();
  return useMutation<Budget, Error, { categoryId: string; dto: UpsertBudgetDto }>({
    mutationFn: ({ categoryId, dto }) => upsertBudget(walletId, categoryId, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["budgets", walletId] });
    },
  });
}

export function useDeleteBudget(walletId: string) {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (categoryId) => deleteBudget(walletId, categoryId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["budgets", walletId] });
    },
  });
}
