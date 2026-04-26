"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  TrendingUp,
  TrendingDown,
  ArrowLeftRight,
  Plus,
  ChevronLeft,
  ChevronRight,
  Search,
  X,
  Pencil,
  Receipt,
  Repeat2,
  Trash2,
} from "lucide-react";
import { useWallet, useWallets } from "@/lib/hooks/use-wallet";
import { useTransactions, useCreateTransaction, useUpdateTransaction, usePayTransaction, useUnpayTransaction, useCancelTransaction, useDeleteTransaction } from "@/lib/hooks/use-transactions";
import { useBankAccounts } from "@/lib/hooks/use-bank-accounts";
import { useCategories } from "@/lib/hooks/use-categories";
import { useCards } from "@/lib/hooks/use-cards";
import { useCreateRecurringTransaction } from "@/lib/hooks/use-recurring-transactions";
import { createPurchase } from "@/services/purchases.service";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type {
  Transaction,
  TransactionType,
  TransactionStatus,
  RecurrenceFrequency,
} from "@/types/api";

// ─── Constants ────────────────────────────────────────────────────────────────

const TRANSACTION_TYPE_LABELS: Record<TransactionType, string> = {
  income: "Receita",
  expense: "Despesa",
  transfer_in: "Transferência entrada",
  transfer_out: "Transferência saída",
  credit_card_purchase: "Compra no cartão",
  credit_card_refund: "Estorno no cartão",
  invoice_payment: "Pagamento de fatura",
};

const STATUS_LABELS: Record<TransactionStatus, string> = {
  pending: "Pendente",
  paid: "Pago",
  canceled: "Cancelado",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function firstDayOfCurrentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function lastDayOfCurrentMonth(): string {
  const d = new Date();
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, "0")}-${String(last.getDate()).padStart(2, "0")}`;
}

function formatAmount(amount: number, currencyCode: string): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: currencyCode,
  }).format(amount);
}

function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split("T")[0].split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

function statusBadgeClass(status: TransactionStatus): string {
  switch (status) {
    case "paid":
      return "bg-emerald-100 text-emerald-700 border-emerald-200 font-medium";
    case "pending":
      return "bg-amber-100 text-amber-700 border-amber-200 font-medium";
    case "canceled":
      return "bg-slate-100 text-slate-500 border-slate-200 font-medium";
  }
}

// ─── Create Transaction Form ──────────────────────────────────────────────────

const PAYMENT_TYPES = [
  { value: "expense", label: "Despesa (dinheiro / pix / débito)" },
  { value: "income", label: "Receita" },
  { value: "credit_card_purchase", label: "Compra no cartão de crédito" },
] as const;

type PaymentType = (typeof PAYMENT_TYPES)[number]["value"];

const FREQUENCY_LABELS: Record<RecurrenceFrequency, string> = {
  daily: "Diária",
  weekly: "Semanal",
  biweekly: "Quinzenal",
  monthly: "Mensal",
};

const regularSchema = z.object({
  mode: z.literal("regular"),
  type: z.enum(["income", "expense"] as const),
  description: z.string().min(1, "Descrição é obrigatória"),
  amount: z.coerce.number({ invalid_type_error: "Informe um valor válido" }).positive("O valor deve ser positivo"),
  dueDate: z.string().min(1, "Vencimento é obrigatório"),
  status: z.enum(["pending", "paid"] as const).optional(),
  bankAccountId: z.string().min(1, "Conta bancária é obrigatória"),
  categoryId: z.string().optional(),
  notes: z.string().optional(),
  // Recurrence fields (optional)
  isRecurring: z.boolean().optional(),
  frequency: z.enum(["daily", "weekly", "biweekly", "monthly"] as const).optional(),
  endDate: z.string().optional(),
});

const cardPurchaseSchema = z.object({
  mode: z.literal("card"),
  cardId: z.string().min(1, "Selecione um cartão"),
  description: z.string().min(1, "Descrição é obrigatória"),
  amount: z.coerce.number({ invalid_type_error: "Informe um valor válido" }).positive("O valor deve ser positivo"),
  purchaseDate: z.string().min(1, "Data da compra é obrigatória"),
  installmentCount: z.coerce.number().int().min(1).max(48),
  categoryId: z.string().optional(),
  notes: z.string().optional(),
});

const createSchema = z.discriminatedUnion("mode", [regularSchema, cardPurchaseSchema]);
type CreateFormValues = z.infer<typeof createSchema>;

const INSTALLMENT_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 18, 24, 36, 48];

function CreateTransactionDialog({
  walletId,
  open,
  onOpenChange,
}: {
  walletId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [paymentType, setPaymentType] = useState<PaymentType>("expense");

  const { data: bankAccountsRaw } = useBankAccounts(walletId);
  const { data: categories } = useCategories(walletId);
  const { data: cards } = useCards(walletId);
  const bankAccounts = bankAccountsRaw?.filter((a) => !a.isArchived);
  const activeCards = cards?.filter((c) => !c.isArchived);

  const { mutate: createTx, isPending: txPending } = useCreateTransaction(walletId);
  const { mutate: createRecurring, isPending: recurringPending } = useCreateRecurringTransaction(walletId);
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    control,
    reset,
    watch,
    formState: { errors },
  } = useForm<CreateFormValues>({
    resolver: zodResolver(createSchema),
    defaultValues: {
      mode: "regular",
      type: "expense",
      status: "pending",
      installmentCount: 1,
      purchaseDate: new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }),
    } as unknown as CreateFormValues,
  });

  const filteredCategories = categories?.filter(
    (c) => !c.isArchived && (c.type === (paymentType === "income" ? "income" : "expense") || c.type === "any")
  );

  // Default the bank account to the first available one as soon as the list
  // loads, so the user doesn't have to remember to pick it. Only writes
  // when the field is empty (preserves manual choices on subsequent renders).
  const watchedBankAccount = watch("bankAccountId" as never) as unknown as string | undefined;
  useEffect(() => {
    if (paymentType === "credit_card_purchase") return;
    if (!bankAccounts || bankAccounts.length === 0) return;
    if (!watchedBankAccount) {
      reset(
        (prev) => ({ ...prev, bankAccountId: bankAccounts[0].id }) as unknown as CreateFormValues,
        { keepDirtyValues: true, keepTouched: true },
      );
    }
  }, [bankAccounts, watchedBankAccount, paymentType, reset]);

  function handlePaymentTypeChange(val: PaymentType) {
    setPaymentType(val);
    reset({
      mode: val === "credit_card_purchase" ? "card" : "regular",
      type: val === "income" ? "income" : "expense",
      status: "pending",
      installmentCount: 1,
      purchaseDate: new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }),
    } as unknown as CreateFormValues);
  }

  function onSubmit(values: CreateFormValues) {
    if (values.mode === "card") {
      createPurchase(walletId, values.cardId, {
        description: values.description,
        totalAmountCents: Math.round(values.amount * 100),
        installmentCount: values.installmentCount,
        purchaseDate: values.purchaseDate,
        ...(values.categoryId ? { categoryId: values.categoryId } : {}),
        ...(values.notes ? { notes: values.notes } : {}),
      }).then(() => {
        queryClient.invalidateQueries({ queryKey: ["transactions", walletId] });
        queryClient.invalidateQueries({ queryKey: ["faturas", walletId] });
        queryClient.invalidateQueries({ queryKey: ["cards", walletId] });
        toast.success(
          values.installmentCount > 1
            ? `Compra parcelada em ${values.installmentCount}x. Confira as faturas do cartão.`
            : "Compra registrada no cartão."
        );
        reset();
        onOpenChange(false);
      }).catch(() => toast.error("Não foi possível criar a compra."));
      return;
    }

    // Recurrence path
    if (values.mode === "regular" && values.isRecurring && values.frequency) {
      createRecurring(
        {
          type: values.type as "income" | "expense",
          frequency: values.frequency as RecurrenceFrequency,
          description: values.description,
          amount: values.amount,
          startDate: values.dueDate,
          endDate: values.endDate || undefined,
          categoryId: values.categoryId || undefined,
          bankAccountId: values.bankAccountId || undefined,
          notes: values.notes || undefined,
        },
        {
          onSuccess: () => {
            toast.success("Transação recorrente criada e ocorrências geradas.");
            reset();
            onOpenChange(false);
          },
          onError: () => toast.error("Não foi possível criar a recorrência."),
        }
      );
      return;
    }

    createTx(
      {
        type: values.type,
        description: values.description,
        amount: values.amount,
        dueDate: values.dueDate,
        status: values.status,
        bankAccountId: values.bankAccountId || undefined,
        categoryId: values.categoryId || undefined,
        notes: values.notes || undefined,
      },
      {
        onSuccess: () => {
          toast.success("Transação criada com sucesso.");
          reset();
          onOpenChange(false);
        },
        onError: (err: unknown) => {
          const msg = (err as { response?: { data?: { message?: string } } })
            ?.response?.data?.message;
          if (msg === "INSUFFICIENT_FUNDS") {
            toast.error("Saldo insuficiente na conta selecionada.");
          } else if (msg === "BANK_ACCOUNT_REQUIRED") {
            toast.error("Selecione a conta bancária para esta transação.");
          } else {
            toast.error("Não foi possível criar a transação. Tente novamente.");
          }
        },
      }
    );
  }

  const isCard = paymentType === "credit_card_purchase";
  const isPending = txPending || recurringPending;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { reset(); setPaymentType("expense"); } onOpenChange(v); }}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova Transação</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Tipo</Label>
            <Select value={paymentType} onValueChange={(v) => handlePaymentTypeChange(v as PaymentType)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_TYPES.map((pt) => (
                  <SelectItem key={pt.value} value={pt.value}>{pt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isCard && (
            <div className="space-y-1.5">
              <Label>Cartão de Crédito</Label>
              <Controller
                name={"cardId" as never}
                control={control}
                render={({ field }: { field: { value: string; onChange: (v: string) => void } }) => (
                  <Select value={field.value ?? ""} onValueChange={field.onChange}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Selecione o cartão" />
                    </SelectTrigger>
                    <SelectContent>
                      {(!activeCards || activeCards.length === 0) ? (
                        <SelectItem value="_none" disabled>Nenhum cartão — adicione primeiro</SelectItem>
                      ) : activeCards.map((card) => (
                        <SelectItem key={card.id} value={card.id}>{card.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {"cardId" in errors && errors.cardId && (
                <p className="text-xs text-destructive">{(errors.cardId as { message?: string }).message}</p>
              )}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="description">Descrição</Label>
            <Input id="description" className="w-full" placeholder="Ex: Supermercado" {...register("description")} />
            {errors.description && <p className="text-xs text-destructive">{errors.description.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="amount">Valor total (R$)</Label>
            <Input id="amount" type="number" step="0.01" min="0.01" placeholder="0.00" className="w-full" {...register("amount")} />
            {errors.amount && <p className="text-xs text-destructive">{errors.amount.message}</p>}
          </div>

          {isCard && (
            <div className="space-y-1.5">
              <Label>Parcelas</Label>
              <Controller
                name={"installmentCount" as never}
                control={control}
                render={({ field }: { field: { value: number; onChange: (v: string) => void } }) => (
                  <Select value={String(field.value ?? 1)} onValueChange={field.onChange}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {INSTALLMENT_OPTIONS.map((n) => (
                        <SelectItem key={n} value={String(n)}>
                          {n === 1 ? "1× (à vista)" : `${n}× parcelas`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="date">{isCard ? "Data da compra" : "Vencimento"}</Label>
            <Input
              id="date"
              type="date"
              className="w-full"
              {...register(isCard ? "purchaseDate" as never : "dueDate" as never)}
            />
            {"dueDate" in errors && errors.dueDate && (
              <p className="text-xs text-destructive">{(errors.dueDate as { message?: string }).message}</p>
            )}
            {"purchaseDate" in errors && errors.purchaseDate && (
              <p className="text-xs text-destructive">{(errors.purchaseDate as { message?: string }).message}</p>
            )}
          </div>

          {!isCard && (
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Controller
                name={"status" as never}
                control={control}
                render={({ field }: { field: { value: string; onChange: (v: string) => void } }) => (
                  <Select value={field.value ?? "pending"} onValueChange={field.onChange}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pendente</SelectItem>
                      <SelectItem value="paid">Pago</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          )}

          {!isCard && (
            <div className="space-y-1.5">
              <Label>
                {paymentType === "income"
                  ? "Conta de destino"
                  : "Conta de origem"}
                <span className="text-destructive ml-0.5">*</span>
              </Label>
              {bankAccounts && bankAccounts.length > 0 ? (
                <Controller
                  name={"bankAccountId" as never}
                  control={control}
                  render={({ field }: { field: { value: string; onChange: (v: string) => void } }) => (
                    <Select value={field.value ?? ""} onValueChange={field.onChange}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Selecione a conta" />
                      </SelectTrigger>
                      <SelectContent>
                        {bankAccounts.map((account) => (
                          <SelectItem key={account.id} value={account.id}>
                            <span className="flex items-center justify-between gap-3 w-full">
                              <span>
                                {account.name}
                                {account.institution ? ` — ${account.institution}` : ""}
                              </span>
                              {typeof account.balanceCents === "number" && (
                                <span className="text-xs text-muted-foreground tabular-nums">
                                  {formatAmount(account.balanceCents / 100, "BRL")}
                                </span>
                              )}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              ) : (
                <p className="text-xs text-muted-foreground py-2 px-3 border rounded-md bg-muted/30">
                  Crie uma conta bancária nas configurações antes de registrar transações.
                </p>
              )}
              {(errors as { bankAccountId?: { message?: string } }).bankAccountId?.message && (
                <p className="text-xs text-destructive">
                  {(errors as { bankAccountId?: { message?: string } }).bankAccountId?.message}
                </p>
              )}
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Categoria (opcional)</Label>
            <Controller
              name={"categoryId" as never}
              control={control}
              render={({ field }: { field: { value: string; onChange: (v: string) => void } }) => (
                <Select
                  value={field.value ?? "none"}
                  onValueChange={(v) => field.onChange(v === "none" ? "" : v)}
                  disabled={!filteredCategories || filteredCategories.length === 0}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={!filteredCategories || filteredCategories.length === 0 ? "Sem categorias — adicione nas configurações" : "Sem categoria"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem categoria</SelectItem>
                    {filteredCategories?.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes">Observações (opcional)</Label>
            <Textarea id="notes" placeholder="Observações adicionais..." rows={2} className="w-full" {...register("notes")} />
          </div>

          {/* ── Recurrence toggle (only for income/expense) ── */}
          {!isCard && (
            <div className="space-y-3 pt-1 border-t border-border/50">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium">Transação recorrente</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">Repete automaticamente</p>
                </div>
                <Controller
                  name={"isRecurring" as never}
                  control={control}
                  render={({ field }: { field: { value: boolean; onChange: (v: boolean) => void } }) => (
                    <button
                      type="button"
                      role="switch"
                      aria-checked={!!field.value}
                      onClick={() => field.onChange(!field.value)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${field.value ? "bg-brand-primary" : "bg-muted"}`}
                    >
                      <span className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${field.value ? "translate-x-6" : "translate-x-1"}`} />
                    </button>
                  )}
                />
              </div>

              {watch("isRecurring" as never) && (
                <div className="space-y-3 pl-1">
                  <div className="space-y-1.5">
                    <Label>Frequência</Label>
                    <Controller
                      name={"frequency" as never}
                      control={control}
                      render={({ field }: { field: { value: string; onChange: (v: string) => void } }) => (
                        <Select value={field.value ?? "monthly"} onValueChange={field.onChange}>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Selecionar frequência" />
                          </SelectTrigger>
                          <SelectContent>
                            {(Object.keys(FREQUENCY_LABELS) as RecurrenceFrequency[]).map((f) => (
                              <SelectItem key={f} value={f}>{FREQUENCY_LABELS[f]}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="endDate">Data de término (opcional)</Label>
                    <Input id="endDate" type="date" className="w-full" {...register("endDate" as never)} />
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" className="w-full sm:w-auto bg-brand-primary hover:bg-brand-primary/90" disabled={isPending}>
              {isPending ? "Criando..." : isCard ? "Adicionar ao cartão" : "Criar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Edit Transaction Dialog ──────────────────────────────────────────────────

const editSchema = z.object({
  description: z.string().min(1, "Descrição é obrigatória").max(255),
  dueDate: z.string().min(1, "Vencimento é obrigatório"),
  categoryId: z.string().optional(),
  bankAccountId: z.string().optional(),
  notes: z.string().optional(),
});
type EditFormValues = z.infer<typeof editSchema>;

const EDITABLE_TYPES: TransactionType[] = ["income", "expense", "credit_card_refund"];

function EditTransactionDialog({
  walletId,
  tx,
  open,
  onOpenChange,
  applyToFollowing = false,
}: {
  walletId: string;
  tx: Transaction | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  applyToFollowing?: boolean;
}) {
  const { data: bankAccountsRaw } = useBankAccounts(walletId);
  const { data: categories } = useCategories(walletId);
  const { mutate: updateTx, isPending } = useUpdateTransaction(walletId);

  const bankAccounts = bankAccountsRaw?.filter((a) => !a.isArchived);
  const allCategories = categories ?? [];

  const { register, handleSubmit, control, reset, formState: { errors } } = useForm<EditFormValues>({
    resolver: zodResolver(editSchema),
  });

  useEffect(() => {
    if (tx && open) {
      reset({
        description: tx.description ?? "",
        dueDate: tx.dueDate?.split("T")[0] ?? "",
        categoryId: tx.categoryId ?? "",
        bankAccountId: tx.bankAccountId ?? "",
        notes: tx.notes ?? "",
      });
    }
  }, [tx, open, reset]);

  function handleOpenChange(v: boolean) {
    if (!v) reset();
    onOpenChange(v);
  }

  function onSubmit(values: EditFormValues) {
    if (!tx) return;
    updateTx(
      {
        id: tx.id,
        dto: {
          description: values.description,
          dueDate: values.dueDate,
          ...(values.categoryId && values.categoryId !== "none" ? { categoryId: values.categoryId } : { categoryId: null }),
          ...(values.bankAccountId && values.bankAccountId !== "none" ? { bankAccountId: values.bankAccountId } : {}),
          notes: values.notes || undefined,
        },
        applyToFollowing,
      },
      {
        onSuccess: () => {
          toast.success(
            applyToFollowing
              ? "Transação e seguintes atualizadas."
              : "Transação atualizada."
          );
          handleOpenChange(false);
        },
        onError: () => toast.error("Não foi possível atualizar a transação."),
      }
    );
  }

  const showBankAccount = tx ? EDITABLE_TYPES.includes(tx.type) : false;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {applyToFollowing && tx?.recurrenceId && (
              <Repeat2 className="h-4 w-4 text-brand-primary flex-shrink-0" />
            )}
            Editar {applyToFollowing && tx?.recurrenceId ? "esta e as seguintes" : "Transação"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="edit-description">Descrição</Label>
            <Input id="edit-description" {...register("description")} />
            {errors.description && <p className="text-xs text-destructive">{errors.description.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-dueDate">Vencimento</Label>
            <Input id="edit-dueDate" type="date" {...register("dueDate")} />
            {errors.dueDate && <p className="text-xs text-destructive">{errors.dueDate.message}</p>}
          </div>

          {showBankAccount && (
            <div className="space-y-1.5">
              <Label>Conta bancária (opcional)</Label>
              <Controller
                name="bankAccountId"
                control={control}
                render={({ field }) => (
                  <Select value={field.value ?? "none"} onValueChange={(v) => field.onChange(v === "none" ? "" : v)}>
                    <SelectTrigger className="w-full"><SelectValue placeholder="Sem conta" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sem conta</SelectItem>
                      {bankAccounts?.map((a) => (
                        <SelectItem key={a.id} value={a.id}>{a.name}{a.institution ? ` — ${a.institution}` : ""}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Categoria (opcional)</Label>
            <Controller
              name="categoryId"
              control={control}
              render={({ field }) => (
                <Select
                  value={field.value ?? "none"}
                  onValueChange={(v) => field.onChange(v === "none" ? "" : v)}
                  disabled={allCategories.length === 0}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={allCategories.length === 0 ? "Sem categorias" : "Sem categoria"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem categoria</SelectItem>
                    {allCategories.filter((c) => !c.isArchived).map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-notes">Observações (opcional)</Label>
            <Textarea id="edit-notes" rows={2} {...register("notes")} />
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={() => handleOpenChange(false)}>Cancelar</Button>
            <Button type="submit" className="w-full sm:w-auto" disabled={isPending}>
              {isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Transaction List Item ────────────────────────────────────────────────────

function TransactionListItem({
  tx,
  currencyCode,
  categoryName,
  canWrite,
  onPay,
  onUnpay,
  onEdit,
  onCancel,
  onDelete,
  index,
}: {
  tx: Transaction;
  currencyCode: string;
  categoryName?: string;
  canWrite: boolean;
  onPay: (id: string) => void;
  onUnpay: (tx: Transaction) => void;
  onEdit: (tx: Transaction) => void;
  onCancel: (id: string) => void;
  onDelete: (tx: Transaction) => void;
  index: number;
}) {
  const isIncome = tx.sign === 1;
  const isExpense = tx.sign === -1;
  const isPending = tx.status === "pending";
  const isPaid = tx.status === "paid";
  const isCanceled = tx.status === "canceled";
  const isInvoicePayment = tx.type === "invoice_payment";
  const staggerClass = `stagger-${Math.min(index + 1, 8)}`;

  return (
    <div
      className={`flex items-center gap-3 p-3 rounded-xl transition-colors hover:bg-muted/50 group animate-in fade-in-0 slide-in-from-left-2 duration-300 fill-mode-both ${staggerClass}`}
    >
      {/* Icon */}
      <div
        className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-105 duration-200 ${
          isIncome
            ? "bg-emerald-100 shadow-sm shadow-emerald-100"
            : isExpense
            ? "bg-red-100 shadow-sm shadow-red-100"
            : "bg-slate-100"
        }`}
      >
        {isIncome ? (
          <TrendingUp className="h-4 w-4 text-emerald-600" />
        ) : isExpense ? (
          <TrendingDown className="h-4 w-4 text-red-500" />
        ) : (
          <ArrowLeftRight className="h-4 w-4 text-slate-500" />
        )}
      </div>

      {/* Description */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <p className={`text-sm font-semibold truncate ${
            isCanceled ? "line-through text-muted-foreground" : "text-foreground"
          }`}>
            {tx.description ?? TRANSACTION_TYPE_LABELS[tx.type]}
          </p>
          {tx.recurrenceId && (
            <span title="Transação recorrente">
              <Repeat2 className="h-3 w-3 text-brand-primary flex-shrink-0 opacity-70" />
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground truncate mt-0.5">
          {categoryName ?? TRANSACTION_TYPE_LABELS[tx.type]}
        </p>
      </div>

      {/* Amount + Date */}
      <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
        <p className={`text-sm font-bold tabular-nums ${
          isIncome ? "text-emerald-600" : isExpense ? "text-red-500" : "text-foreground"
        }`}>
          {isExpense ? "−" : isIncome ? "+" : ""}
          {formatAmount(tx.amount, currencyCode)}
        </p>
        <p className="text-xs text-muted-foreground">{formatDate(tx.dueDate)}</p>
      </div>

      {/* Status badge */}
      <Badge
        variant="outline"
        className={`text-xs flex-shrink-0 hidden sm:inline-flex px-2 py-0.5 ${statusBadgeClass(tx.status)}`}
      >
        {STATUS_LABELS[tx.status]}
      </Badge>

      {/* Actions */}
      {canWrite && (
        <div className="flex gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-all duration-150 translate-x-1 group-hover:translate-x-0">
          {!isCanceled && isPending && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs text-emerald-700 border-emerald-200 hover:bg-emerald-50 font-medium"
              onClick={() => onPay(tx.id)}
            >
              Pagar
            </Button>
          )}
          {isPaid && !isInvoicePayment && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs text-amber-700 border-amber-200 hover:bg-amber-50 font-medium"
              onClick={() => onUnpay(tx)}
              title="Desmarcar pago"
            >
              Desmarcar
            </Button>
          )}
          {!isCanceled && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
              onClick={() => onEdit(tx)}
              title="Editar"
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          )}
          {!isCanceled && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs text-muted-foreground hover:text-destructive px-2"
              onClick={() => onCancel(tx.id)}
            >
              Cancelar
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
            onClick={() => onDelete(tx)}
            title="Excluir"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Transfer Dialog ──────────────────────────────────────────────────────────

const transferSchema = z.object({
  fromBankAccountId: z.string().min(1, "Conta de origem é obrigatória"),
  toWalletId: z.string().min(1, "Selecione a carteira de destino"),
  toBankAccountId: z.string().min(1, "Selecione a conta de destino"),
  amount: z.coerce.number({ invalid_type_error: "Informe um valor válido" }).positive("O valor deve ser positivo"),
  description: z.string().min(1, "Descrição é obrigatória"),
  dueDate: z.string().min(1, "Data é obrigatória"),
  status: z.enum(["pending", "paid"] as const),
  notes: z.string().optional(),
});
type TransferFormValues = z.infer<typeof transferSchema>;

function TransferDialog({
  walletId,
  open,
  onOpenChange,
}: {
  walletId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: fromAccountsRaw } = useBankAccounts(walletId);
  const fromAccounts = fromAccountsRaw?.filter((a) => !a.isArchived);
  const { data: wallets } = useWallets();
  const otherWallets = wallets?.filter((w) => w.id !== walletId);

  const { mutate: createTx, isPending } = useCreateTransaction(walletId);

  const form = useForm<TransferFormValues>({
    resolver: zodResolver(transferSchema),
    defaultValues: {
      fromBankAccountId: "",
      toWalletId: "",
      toBankAccountId: "",
      amount: 0,
      description: "Transferência",
      dueDate: new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }),
      status: "paid",
      notes: "",
    },
  });

  const toWalletId = form.watch("toWalletId");
  const fromBankAccountId = form.watch("fromBankAccountId");
  const transferAmount = form.watch("amount");
  const { data: toAccountsRaw } = useBankAccounts(toWalletId);
  const toAccounts = toAccountsRaw?.filter((a) => !a.isArchived);

  const fromAccount = fromAccounts?.find((a) => a.id === fromBankAccountId);
  const fromBalanceCents = fromAccount?.balanceCents ?? 0;
  const fromBalanceReais = fromBalanceCents / 100;
  const overdraft =
    typeof transferAmount === "number" && transferAmount > fromBalanceReais;

  // Pre-select the only account when the wallet has just one.
  useEffect(() => {
    if (!open) return;
    if (!fromAccounts || fromAccounts.length !== 1) return;
    if (!fromBankAccountId) form.setValue("fromBankAccountId", fromAccounts[0].id);
  }, [open, fromAccounts, fromBankAccountId, form]);

  useEffect(() => {
    if (!open) return;
    form.reset({
      fromBankAccountId: "",
      toWalletId: "",
      toBankAccountId: "",
      amount: 0,
      description: "Transferência",
      dueDate: new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }),
      status: "paid",
      notes: "",
    });
  }, [open, form]);

  function onSubmit(values: TransferFormValues) {
    createTx(
      {
        type: "transfer_out",
        description: values.description,
        amount: values.amount,
        dueDate: values.dueDate,
        status: values.status,
        bankAccountId: values.fromBankAccountId,
        counterpartBankAccountId: values.toBankAccountId,
        notes: values.notes || undefined,
      },
      {
        onSuccess: () => {
          toast.success("Transferência criada.");
          onOpenChange(false);
        },
        onError: (err: unknown) => {
          const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
          if (msg === "FORBIDDEN_TRANSFER_DESTINATION") {
            toast.error("Você não tem acesso à carteira de destino.");
          } else if (msg === "TRANSFER_COUNTERPART_BANK_ACCOUNT_NOT_FOUND") {
            toast.error("Conta de destino não encontrada.");
          } else if (msg === "INSUFFICIENT_FUNDS") {
            toast.error("Saldo insuficiente na conta de origem.");
          } else if (msg === "BANK_ACCOUNT_REQUIRED") {
            toast.error("Selecione a conta de origem.");
          } else {
            toast.error("Não foi possível criar a transferência.");
          }
        },
      }
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowLeftRight className="h-4 w-4 text-brand-primary" />
            Nova transferência
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Origem (conta desta carteira)</Label>
            <Controller
              name="fromBankAccountId"
              control={form.control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecione a conta de origem" />
                  </SelectTrigger>
                  <SelectContent>
                    {(!fromAccounts || fromAccounts.length === 0) ? (
                      <SelectItem value="_none" disabled>Nenhuma conta disponível</SelectItem>
                    ) : fromAccounts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        <span className="flex items-center justify-between gap-3 w-full">
                          <span>
                            {a.name}
                            {a.institution ? ` — ${a.institution}` : ""}
                          </span>
                          {typeof a.balanceCents === "number" && (
                            <span className="text-xs text-muted-foreground tabular-nums">
                              {formatAmount(a.balanceCents / 100, "BRL")}
                            </span>
                          )}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {fromAccount && (
              <p className="text-xs text-muted-foreground">
                Saldo disponível:{" "}
                <span className="font-medium tabular-nums text-foreground">
                  {formatAmount(fromBalanceReais, "BRL")}
                </span>
              </p>
            )}
            {form.formState.errors.fromBankAccountId && (
              <p className="text-xs text-destructive">{form.formState.errors.fromBankAccountId.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Carteira de destino</Label>
            <Controller
              name="toWalletId"
              control={form.control}
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={(v) => {
                    field.onChange(v);
                    form.setValue("toBankAccountId", "");
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecione a carteira" />
                  </SelectTrigger>
                  <SelectContent>
                    {(!otherWallets || otherWallets.length === 0) ? (
                      <SelectItem value="_none" disabled>Nenhuma outra carteira</SelectItem>
                    ) : otherWallets.map((w) => (
                      <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {form.formState.errors.toWalletId && (
              <p className="text-xs text-destructive">{form.formState.errors.toWalletId.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Conta de destino</Label>
            <Controller
              name="toBankAccountId"
              control={form.control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange} disabled={!toWalletId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={toWalletId ? "Selecione a conta" : "Escolha a carteira primeiro"} />
                  </SelectTrigger>
                  <SelectContent>
                    {(!toAccounts || toAccounts.length === 0) ? (
                      <SelectItem value="_none" disabled>Nenhuma conta disponível</SelectItem>
                    ) : toAccounts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name}{a.institution ? ` — ${a.institution}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {form.formState.errors.toBankAccountId && (
              <p className="text-xs text-destructive">{form.formState.errors.toBankAccountId.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="transfer-description">Descrição</Label>
            <Input id="transfer-description" className="w-full" {...form.register("description")} />
            {form.formState.errors.description && (
              <p className="text-xs text-destructive">{form.formState.errors.description.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <div className="flex items-baseline justify-between">
                <Label htmlFor="transfer-amount">Valor (R$)</Label>
                {fromAccount && fromBalanceReais > 0 && (
                  <button
                    type="button"
                    className="text-xs text-brand-primary hover:underline"
                    onClick={() =>
                      form.setValue("amount", fromBalanceReais, {
                        shouldValidate: true,
                        shouldDirty: true,
                      })
                    }
                  >
                    Usar tudo
                  </button>
                )}
              </div>
              <Input
                id="transfer-amount"
                type="number"
                step="0.01"
                min="0.01"
                className={`w-full ${overdraft ? "border-destructive focus-visible:ring-destructive" : ""}`}
                {...form.register("amount")}
              />
              {overdraft ? (
                <p className="text-xs text-destructive">
                  Excede o saldo disponível ({formatAmount(fromBalanceReais, "BRL")}).
                </p>
              ) : form.formState.errors.amount ? (
                <p className="text-xs text-destructive">{form.formState.errors.amount.message}</p>
              ) : null}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="transfer-date">Data</Label>
              <Input id="transfer-date" type="date" className="w-full" {...form.register("dueDate")} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Status</Label>
            <Controller
              name="status"
              control={form.control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="paid">Já realizada</SelectItem>
                    <SelectItem value="pending">Agendada</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="transfer-notes">Observações (opcional)</Label>
            <Textarea id="transfer-notes" rows={2} className="w-full" {...form.register("notes")} />
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              type="submit"
              className="w-full sm:w-auto bg-brand-primary hover:bg-brand-primary/90"
              disabled={isPending || overdraft}
            >
              {isPending ? "Enviando..." : "Transferir"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Recurring Scope Dialog ───────────────────────────────────────────────────
// Shown when the user tries to edit/cancel a recurring occurrence.

type ScopeAction = "edit" | "cancel";

function RecurringScopeDialog({
  open,
  action,
  onClose,
  onJustThis,
  onThisAndFollowing,
}: {
  open: boolean;
  action: ScopeAction;
  onClose: () => void;
  onJustThis: () => void;
  onThisAndFollowing: () => void;
}) {
  const isEdit = action === "edit";
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Repeat2 className="h-4 w-4 text-brand-primary" />
            {isEdit ? "Editar recorrência" : "Cancelar recorrência"}
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Esta é uma transação recorrente. Deseja {isEdit ? "editar" : "cancelar"} apenas esta ocorrência ou esta e todas as seguintes?
        </p>
        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={() => { onJustThis(); onClose(); }}
          >
            Apenas esta ocorrência
          </Button>
          <Button
            variant="default"
            className="w-full justify-start bg-brand-primary hover:bg-brand-primary/90"
            onClick={() => { onThisAndFollowing(); onClose(); }}
          >
            Esta e as seguintes
          </Button>
          <Button variant="ghost" className="w-full" onClick={onClose}>
            Voltar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function TransactionsPage() {
  const params = useParams();
  const walletId = params?.walletId as string;

  const [dialogOpen, setDialogOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [editTx, setEditTx] = useState<Transaction | null>(null);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<string>(() => firstDayOfCurrentMonth());
  const [dateTo, setDateTo] = useState<string>(() => lastDayOfCurrentMonth());
  const [search, setSearch] = useState<string>("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [accountFilter, setAccountFilter] = useState<string>("all");

  // Recurring scope state
  const [scopeAction, setScopeAction] = useState<ScopeAction>("cancel");
  const [pendingScopeTx, setPendingScopeTx] = useState<Transaction | null>(null);

  const { data: wallet } = useWallet(walletId);
  const canWrite = wallet?.role === "owner" || wallet?.role === "editor";
  const { data: categories } = useCategories(walletId);
  const { data: bankAccountsRaw } = useBankAccounts(walletId);
  const activeBankAccounts = bankAccountsRaw?.filter((a) => !a.isArchived);

  const queryParams = {
    page,
    limit: 20,
    ...(statusFilter !== "all" && { status: statusFilter }),
    ...(typeFilter !== "all" && { type: typeFilter }),
    ...(dateFrom && { dueDateFrom: dateFrom }),
    ...(dateTo && { dueDateTo: dateTo }),
    ...(search.trim() && { search: search.trim() }),
    ...(categoryFilter !== "all" && { categoryId: categoryFilter }),
    ...(accountFilter !== "all" && { bankAccountId: accountFilter }),
  };

  const { data, isLoading } = useTransactions(walletId, queryParams);
  const { mutate: payTx } = usePayTransaction(walletId);
  const { mutate: unpayTx } = useUnpayTransaction(walletId);
  const { mutate: cancelTx } = useCancelTransaction(walletId);
  const { mutate: deleteTx } = useDeleteTransaction(walletId);

  function handleUnpayClick(tx: Transaction) {
    const isTransfer = tx.type === "transfer_in" || tx.type === "transfer_out";
    const msg = isTransfer
      ? "Desmarcar este pagamento? Ambas as pernas da transferência voltarão para 'pendente'."
      : "Desmarcar este pagamento? A transação voltará para 'pendente'.";
    if (!confirm(msg)) return;
    unpayTx(tx.id, {
      onSuccess: () => toast.success("Pagamento desmarcado."),
      onError: (err: unknown) => {
        const errMsg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
        if (errMsg === "USE_FATURA_UNPAY_ENDPOINT") {
          toast.error("Para desmarcar fatura, use o botão da fatura no cartão.");
        } else {
          toast.error("Não foi possível desmarcar o pagamento.");
        }
      },
    });
  }

  function handleDeleteClick(tx: Transaction) {
    if (!confirm("Excluir esta transação? Esta ação remove o registro do histórico.")) return;
    deleteTx(tx.id, {
      onSuccess: () => toast.success("Transação excluída."),
      onError: (err: unknown) => {
        const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
        if (msg === "INVOICE_PAYMENT_LINKED_TO_FATURA") {
          toast.error("Desmarque o pagamento da fatura antes de excluir.");
        } else {
          toast.error("Não foi possível excluir a transação.");
        }
      },
    });
  }

  const currencyCode = wallet?.currencyCode ?? "BRL";
  const categoryMap = new Map(categories?.map((c) => [c.id, c.name]) ?? []);
  const totalPages = data?.totalPages ?? 1;

  // ── Recurring scope helpers ────────────────────────────────────────────────

  // editTxFollowing: when user chose "esta e as seguintes" for an edit
  const [editTxFollowing, setEditTxFollowing] = useState<Transaction | null>(null);

  function handleEditClick(tx: Transaction) {
    if (tx.recurrenceId) {
      // open scope dialog with this tx pending
      setScopeAction("edit");
      setPendingScopeTx(tx);
    } else {
      setEditTx(tx);
    }
  }

  function handleCancelClick(tx: Transaction) {
    if (tx.recurrenceId) {
      setScopeAction("cancel");
      setPendingScopeTx(tx);
    } else {
      cancelTx(
        { id: tx.id },
        {
          onSuccess: () => toast.success("Transação cancelada."),
          onError: () => toast.error("Não foi possível cancelar a transação."),
        }
      );
    }
  }

  function executeCancelWithScope(applyToFollowing: boolean) {
    if (!pendingScopeTx) return;
    const txToCancel = pendingScopeTx;
    setPendingScopeTx(null);
    cancelTx(
      { id: txToCancel.id, applyToFollowing },
      {
        onSuccess: () =>
          toast.success(
            applyToFollowing ? "Ocorrências canceladas." : "Transação cancelada."
          ),
        onError: () => toast.error("Não foi possível cancelar a transação."),
      }
    );
  }

  const hasActiveFilters =
    statusFilter !== "all" ||
    typeFilter !== "all" ||
    dateFrom !== "" ||
    dateTo !== "" ||
    search !== "" ||
    categoryFilter !== "all" ||
    accountFilter !== "all";

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-4xl mx-auto">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap animate-in fade-in-0 slide-in-from-top-2 duration-400 fill-mode-both">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <Receipt className="h-4 w-4 text-brand-primary opacity-70" />
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Finanças
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">Transações</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Receitas, despesas e transferências
          </p>
        </div>
        {canWrite && (
          <div className="flex gap-2 flex-wrap">
            <Button
              variant="outline"
              className="gap-2 min-h-10"
              onClick={() => setTransferOpen(true)}
            >
              <ArrowLeftRight className="h-4 w-4" />
              Transferir
            </Button>
            <Button
              className="gap-2 min-h-10 bg-brand-primary hover:bg-brand-primary/90 shadow-sm shadow-brand-primary/25 transition-all hover:shadow-md"
              onClick={() => setDialogOpen(true)}
            >
              <Plus className="h-4 w-4" />
              Nova transação
            </Button>
          </div>
        )}
      </div>

      {/* ── Filters ────────────────────────────────────────────────────────── */}
      <div
        className="space-y-2 mb-5 animate-in fade-in-0 slide-in-from-top-1 duration-400 fill-mode-both"
        style={{ animationDelay: "80ms" }}
      >
        {/* Row 1: Search + clear */}
        <div className="flex gap-2 items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              className="pl-9 pr-9 h-10 w-full bg-muted/40 border-muted focus:bg-background transition-colors"
              placeholder="Buscar por descrição..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
            {search && (
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => { setSearch(""); setPage(1); }}
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              className="h-10 px-3 text-xs text-muted-foreground hover:text-foreground gap-1.5 shrink-0"
              onClick={() => {
                setStatusFilter("all"); setTypeFilter("all");
                setDateFrom(""); setDateTo(""); setSearch("");
                setCategoryFilter("all"); setAccountFilter("all"); setPage(1);
              }}
            >
              <X className="h-3.5 w-3.5" />
              Limpar
            </Button>
          )}
        </div>

        {/* Row 2: Selects */}
        <div className="flex flex-wrap gap-2 items-center">
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
            <SelectTrigger className="w-auto min-w-[120px] h-8 text-xs">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              <SelectItem value="pending">Pendente</SelectItem>
              <SelectItem value="paid">Pago</SelectItem>
              <SelectItem value="canceled">Cancelado</SelectItem>
            </SelectContent>
          </Select>

          <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setPage(1); }}>
            <SelectTrigger className="w-auto min-w-[120px] h-8 text-xs">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              <SelectItem value="income">Receita</SelectItem>
              <SelectItem value="expense">Despesa</SelectItem>
              <SelectItem value="transfer_in">Transferência entrada</SelectItem>
              <SelectItem value="transfer_out">Transferência saída</SelectItem>
              <SelectItem value="credit_card_purchase">Compra no cartão</SelectItem>
              <SelectItem value="credit_card_refund">Estorno no cartão</SelectItem>
              <SelectItem value="invoice_payment">Pagamento de fatura</SelectItem>
            </SelectContent>
          </Select>

          {categories && categories.filter(c => !c.isArchived).length > 0 && (
            <Select value={categoryFilter} onValueChange={(v) => { setCategoryFilter(v); setPage(1); }}>
              <SelectTrigger className="w-auto min-w-[120px] h-8 text-xs">
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as categorias</SelectItem>
                {categories.filter(c => !c.isArchived).map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {activeBankAccounts && activeBankAccounts.length > 0 && (
            <Select value={accountFilter} onValueChange={(v) => { setAccountFilter(v); setPage(1); }}>
              <SelectTrigger className="w-auto min-w-[120px] h-8 text-xs">
                <SelectValue placeholder="Conta" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as contas</SelectItem>
                {activeBankAccounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Date range */}
          <div className="flex items-center gap-1.5 ml-auto">
            <Input
              type="date"
              className="w-32 h-8 text-xs"
              value={dateFrom}
              onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
            />
            <span className="text-muted-foreground text-xs">—</span>
            <Input
              type="date"
              className="w-32 h-8 text-xs"
              value={dateTo}
              onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
            />
          </div>
        </div>
      </div>

      {/* ── Transaction List ────────────────────────────────────────────────── */}
      <div
        className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm animate-in fade-in-0 duration-400 fill-mode-both"
        style={{ animationDelay: "150ms" }}
      >
        {isLoading ? (
          <div className="p-4 space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-2">
                <Skeleton className="w-10 h-10 rounded-xl flex-shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-56" />
                  <Skeleton className="h-3 w-32" />
                </div>
                <div className="space-y-1.5 text-right">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-16" />
                </div>
                <Skeleton className="h-5 w-16 rounded-full hidden sm:block" />
              </div>
            ))}
          </div>
        ) : !data?.transactions?.length ? (
          <div className="flex flex-col items-center justify-center py-16 text-center px-4">
            <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
              <ArrowLeftRight className="h-7 w-7 text-muted-foreground" />
            </div>
            <h3 className="text-base font-semibold text-foreground mb-1.5">
              Nenhuma transação encontrada
            </h3>
            <p className="text-sm text-muted-foreground max-w-xs">
              {hasActiveFilters
                ? "Tente ajustar ou limpar os filtros."
                : "Crie sua primeira transação para começar."}
            </p>
            {canWrite && !hasActiveFilters && (
              <Button
                className="mt-5 gap-2 bg-brand-primary hover:bg-brand-primary/90"
                size="sm"
                onClick={() => setDialogOpen(true)}
              >
                <Plus className="h-3.5 w-3.5" />
                Nova transação
              </Button>
            )}
            {hasActiveFilters && (
              <Button
                variant="outline"
                size="sm"
                className="mt-4 gap-1.5"
                onClick={() => {
                  setStatusFilter("all");
                  setTypeFilter("all");
                  setDateFrom("");
                  setDateTo("");
                  setSearch("");
                  setCategoryFilter("all");
                  setAccountFilter("all");
                  setPage(1);
                }}
              >
                <X className="h-3.5 w-3.5" />
                Limpar filtros
              </Button>
            )}
          </div>
        ) : (
          <div className="p-2">
            {data.transactions.map((tx, i) => (
              <TransactionListItem
                key={tx.id}
                tx={tx}
                currencyCode={currencyCode}
                categoryName={tx.categoryId ? categoryMap.get(tx.categoryId) : undefined}
                canWrite={canWrite}
                index={i}
                onPay={(id) =>
                  payTx(
                    { id },
                    {
                      onSuccess: () => toast.success("Marcado como pago."),
                      onError: (err: unknown) => {
                        const msg = (err as { response?: { data?: { message?: string } } })
                          ?.response?.data?.message;
                        if (msg === "INSUFFICIENT_FUNDS") {
                          toast.error("Saldo insuficiente na conta de origem.");
                        } else {
                          toast.error("Não foi possível marcar como pago.");
                        }
                      },
                    }
                  )
                }
                onEdit={(t) => handleEditClick(t)}
                onCancel={(id) => {
                  const t = data.transactions.find((x) => x.id === id);
                  if (t) handleCancelClick(t);
                }}
                onUnpay={handleUnpayClick}
                onDelete={handleDeleteClick}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Pagination ─────────────────────────────────────────────────────── */}
      {!isLoading && data && data.totalPages > 1 && (
        <div className="flex items-center justify-between mt-5 flex-wrap gap-2">
          <p className="text-sm text-muted-foreground">
            Página{" "}
            <span className="font-semibold text-foreground">{data.page}</span>
            {" "}de{" "}
            <span className="font-semibold text-foreground">{data.totalPages}</span>
            {" "}—{" "}
            <span className="font-semibold text-foreground">{data.total}</span> transações
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-9 gap-1 transition-all"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="h-4 w-4" />
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-9 gap-1 transition-all"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Próxima
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      <CreateTransactionDialog
        walletId={walletId}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />

      <TransferDialog
        walletId={walletId}
        open={transferOpen}
        onOpenChange={setTransferOpen}
      />

      {/* Edit — single occurrence */}
      <EditTransactionDialog
        walletId={walletId}
        tx={editTx}
        open={editTx !== null}
        onOpenChange={(v) => { if (!v) setEditTx(null); }}
        applyToFollowing={false}
      />

      {/* Edit — this and following */}
      <EditTransactionDialog
        walletId={walletId}
        tx={editTxFollowing}
        open={editTxFollowing !== null}
        onOpenChange={(v) => { if (!v) setEditTxFollowing(null); }}
        applyToFollowing={true}
      />

      {/* Scope chooser — shown for any recurring edit or cancel */}
      <RecurringScopeDialog
        open={pendingScopeTx !== null}
        action={scopeAction}
        onClose={() => setPendingScopeTx(null)}
        onJustThis={() => {
          if (scopeAction === "edit") {
            setEditTx(pendingScopeTx);
          } else {
            executeCancelWithScope(false);
          }
        }}
        onThisAndFollowing={() => {
          if (scopeAction === "edit") {
            setEditTxFollowing(pendingScopeTx);
          } else {
            executeCancelWithScope(true);
          }
        }}
      />
    </div>
  );
}
