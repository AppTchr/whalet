"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  ArrowLeft,
  CreditCard,
  ShoppingBag,
  FileText,
  ChevronDown,
  ChevronUp,
  Plus,
  Receipt,
  Archive,
  X,
  Pencil,
  CheckCircle2,
  Clock,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";

import { useCard, useArchiveCard } from "@/lib/hooks/use-cards";
import { useWallet } from "@/lib/hooks/use-wallet";
import { useFaturas, useFatura, usePayFatura, useUpdateFaturaCategory } from "@/lib/hooks/use-faturas";
import { usePurchases, useCreatePurchase, useCancelPurchase, useUpdatePurchase, useCancelInstallment } from "@/lib/hooks/use-purchases";
import { useBankAccounts } from "@/lib/hooks/use-bank-accounts";
import { useCategories } from "@/lib/hooks/use-categories";
import { formatCurrency } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
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
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Fatura, FaturaStatus, CreditCardPurchase, Category, InstallmentSummary } from "@/types/api";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatReferenceMonth(referenceMonth: string): string {
  const date = new Date(referenceMonth + "-01T00:00:00Z");
  return date.toLocaleDateString("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" });
}

type FaturaStatusConfig = { label: string; className: string; icon: React.ElementType; dotColor: string };

function getFaturaStatusConfig(status: FaturaStatus): FaturaStatusConfig {
  switch (status) {
    case "open":
      return { label: "Aberta", className: "bg-blue-100 text-blue-700 border-blue-200 font-medium", icon: Clock, dotColor: "bg-blue-500" };
    case "closed":
      return { label: "Fechada", className: "bg-amber-100 text-amber-700 border-amber-200 font-medium", icon: AlertCircle, dotColor: "bg-amber-500" };
    case "overdue":
      return { label: "Vencida", className: "bg-red-100 text-red-700 border-red-200 font-medium", icon: AlertCircle, dotColor: "bg-red-500" };
    case "paid":
      return { label: "Paga", className: "bg-emerald-100 text-emerald-700 border-emerald-200 font-medium", icon: CheckCircle2, dotColor: "bg-emerald-500" };
  }
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────

type Tab = "faturas" | "purchases";

// ─── Pay Fatura Dialog Schema ─────────────────────────────────────────────────

const payFaturaSchema = z.object({
  bankAccountId: z.string().min(1, "Conta bancária é obrigatória"),
  paidAt: z.string().optional(),
});
type PayFaturaFormValues = z.infer<typeof payFaturaSchema>;

// ─── New Purchase Dialog Schema ───────────────────────────────────────────────

const createPurchaseSchema = z.object({
  description: z.string().min(1, "Descrição é obrigatória"),
  totalAmountReais: z
    .number({ coerce: true, invalid_type_error: "Informe um valor válido" })
    .positive("O valor deve ser positivo"),
  installmentCount: z
    .number({ coerce: true })
    .int()
    .min(1, "Mínimo 1 parcela")
    .max(48, "Máximo 48 parcelas"),
  purchaseDate: z.string().min(1, "Data da compra é obrigatória"),
  categoryId: z.string().optional(),
  notes: z.string().optional(),
});
type CreatePurchaseFormValues = z.infer<typeof createPurchaseSchema>;

// ─── Fatura Row ───────────────────────────────────────────────────────────────

function FaturaRow({
  fatura,
  walletId,
  cardId,
  canWrite,
  categories,
  onPay,
  index,
}: {
  fatura: Fatura;
  walletId: string;
  cardId: string;
  canWrite: boolean;
  categories: Category[];
  onPay: (fatura: Fatura) => void;
  index: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const statusConfig = getFaturaStatusConfig(fatura.status);
  const canPay = fatura.status !== "paid";
  const StatusIcon = statusConfig.icon;

  const updateCategory = useUpdateFaturaCategory(walletId, cardId);

  const { data: detail, isLoading: detailLoading } = useFatura(
    walletId,
    cardId,
    expanded ? fatura.id : ""
  );
  const installments = detail?.installments ?? [];

  const assignedCategory = fatura.categoryId
    ? categories.find((c) => c.id === fatura.categoryId)
    : null;

  function handleCategoryChange(value: string) {
    const newCategoryId = value === "__none__" ? null : value;
    updateCategory.mutate({ faturaId: fatura.id, dto: { categoryId: newCategoryId } });
  }

  const staggerClass = `stagger-${Math.min(index + 1, 8)}`;

  return (
    <div
      className={`border border-border rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-200 animate-in fade-in-0 slide-in-from-bottom-2 duration-400 fill-mode-both ${staggerClass}`}
    >
      <button
        type="button"
        className="w-full flex items-center justify-between px-4 py-4 hover:bg-muted/30 transition-colors text-left gap-3"
        onClick={() => setExpanded((prev) => !prev)}
      >
        {/* Left: icon + date info */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
            <FileText className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-sm capitalize text-foreground">
              {formatReferenceMonth(fatura.referenceMonth)}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Venc:{" "}
              {new Date(fatura.dueDate).toLocaleDateString("pt-BR")}
            </p>
          </div>
        </div>

        {/* Right: category + amount + status + pay + chevron */}
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap justify-end flex-shrink-0">
          <div onClick={(e) => e.stopPropagation()}>
            {canWrite ? (
              <Select
                value={fatura.categoryId ?? "__none__"}
                onValueChange={handleCategoryChange}
                disabled={updateCategory.isPending}
              >
                <SelectTrigger className="h-7 text-xs w-32 border-dashed bg-transparent">
                  <SelectValue placeholder="Categoria..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">
                    <span className="text-muted-foreground">Sem categoria</span>
                  </SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : assignedCategory ? (
              <Badge variant="outline" className="text-xs">
                {assignedCategory.name}
              </Badge>
            ) : null}
          </div>

          <span className="font-bold text-sm tabular-nums text-foreground">
            {formatCurrency(fatura.totalCents)}
          </span>

          <Badge variant="outline" className={cn("text-xs gap-1.5", statusConfig.className)}>
            <StatusIcon className="h-3 w-3" />
            {statusConfig.label}
          </Badge>

          {canPay && canWrite && (
            <Button
              size="sm"
              variant="outline"
              className="text-xs h-7 text-emerald-700 border-emerald-200 hover:bg-emerald-50 font-medium"
              onClick={(e) => {
                e.stopPropagation();
                onPay(fatura);
              }}
            >
              Pagar
            </Button>
          )}

          <div className="text-muted-foreground transition-transform duration-200">
            {expanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </div>
        </div>
      </button>

      {/* Installments expanded */}
      {expanded && detailLoading && (
        <div className="border-t bg-muted/20 px-4 py-4">
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-4 w-20" />
              </div>
            ))}
          </div>
        </div>
      )}

      {expanded && !detailLoading && installments.length > 0 && (
        <div className="border-t bg-muted/20 animate-in fade-in-0 slide-in-from-top-1 duration-200">
          <div className="px-4 py-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Parcelas desta fatura
            </p>
            <div className="space-y-1.5">
              {installments.map((installment) => (
                <div
                  key={installment.id}
                  className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-background/80 transition-colors text-sm"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-xs text-muted-foreground font-medium flex-shrink-0 bg-muted px-1.5 py-0.5 rounded">
                      {installment.installmentNumber}/{installment.totalInstallments}
                    </span>
                    <span className="truncate text-foreground font-medium">
                      {installment.purchaseDescription}
                    </span>
                  </div>
                  <div className="flex items-center gap-2.5 flex-shrink-0 ml-4">
                    <span className="font-bold tabular-nums">
                      {formatCurrency(installment.amountCents)}
                    </span>
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-xs font-medium",
                        installment.status === "paid"
                          ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                          : installment.status === "canceled"
                          ? "bg-slate-100 text-slate-500 border-slate-200"
                          : "bg-blue-100 text-blue-700 border-blue-200"
                      )}
                    >
                      {installment.status === "paid"
                        ? "Pago"
                        : installment.status === "canceled"
                        ? "Cancelado"
                        : "Pendente"}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {expanded && !detailLoading && installments.length === 0 && (
        <div className="border-t bg-muted/20 px-4 py-6 text-center">
          <p className="text-sm text-muted-foreground">
            Nenhuma parcela encontrada para esta fatura.
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Edit Purchase Dialog ─────────────────────────────────────────────────────

const editPurchaseSchema = z.object({
  description: z.string().min(1, "Descrição é obrigatória").max(255),
  categoryId: z.string().optional(),
  notes: z.string().optional(),
});
type EditPurchaseValues = z.infer<typeof editPurchaseSchema>;

function EditPurchaseDialog({
  walletId,
  cardId,
  purchase,
  categories,
  open,
  onOpenChange,
}: {
  walletId: string;
  cardId: string;
  purchase: CreditCardPurchase | null;
  categories: Category[];
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { mutate: updatePurchase, isPending } = useUpdatePurchase(walletId, cardId);
  const { register, handleSubmit, control, reset, formState: { errors } } = useForm<EditPurchaseValues>({
    resolver: zodResolver(editPurchaseSchema),
  });

  useEffect(() => {
    if (purchase && open) {
      reset({
        description: purchase.description,
        categoryId: purchase.categoryId ?? "",
        notes: purchase.notes ?? "",
      });
    }
  }, [purchase, open, reset]);

  function onSubmit(values: EditPurchaseValues) {
    if (!purchase) return;
    updatePurchase(
      {
        purchaseId: purchase.id,
        dto: {
          description: values.description,
          notes: values.notes || undefined,
          ...(values.categoryId && values.categoryId !== "none"
            ? { categoryId: values.categoryId }
            : { categoryId: null }),
        },
      },
      {
        onSuccess: () => { toast.success("Compra atualizada."); onOpenChange(false); },
        onError: () => toast.error("Não foi possível atualizar a compra."),
      }
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Editar Compra</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Descrição</label>
            <Input {...register("description")} />
            {errors.description && <p className="text-xs text-destructive">{errors.description.message}</p>}
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Categoria (opcional)</label>
            <Controller
              name="categoryId"
              control={control}
              render={({ field }) => (
                <Select
                  value={field.value ?? "none"}
                  onValueChange={(v) => field.onChange(v === "none" ? "" : v)}
                  disabled={categories.filter(c => !c.isArchived).length === 0}
                >
                  <SelectTrigger className="w-full"><SelectValue placeholder="Sem categoria" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem categoria</SelectItem>
                    {categories.filter(c => !c.isArchived).map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Observações (opcional)</label>
            <Textarea rows={2} {...register("notes")} />
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" className="w-full sm:w-auto" disabled={isPending}>
              {isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Purchase Row ─────────────────────────────────────────────────────────────

function PurchaseRow({
  purchase,
  canWrite,
  onCancel,
  onEdit,
  onCancelInstallment,
  index,
}: {
  purchase: CreditCardPurchase;
  canWrite: boolean;
  onCancel: (id: string) => void;
  onEdit: (p: CreditCardPurchase) => void;
  onCancelInstallment: (purchaseId: string, installmentId: string) => void;
  index: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const staggerClass = `stagger-${Math.min(index + 1, 8)}`;

  return (
    <div
      className={`border border-border rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-200 animate-in fade-in-0 slide-in-from-bottom-2 duration-400 fill-mode-both ${staggerClass}`}
    >
      <button
        type="button"
        className="w-full flex items-center justify-between px-4 py-4 hover:bg-muted/30 transition-colors text-left gap-3"
        onClick={() => setExpanded((prev) => !prev)}
      >
        {/* Left: icon + description */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
            <ShoppingBag className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-sm truncate text-foreground">
              {purchase.description}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {new Date(purchase.purchaseDate).toLocaleDateString("pt-BR")}
              {" · "}
              <span className="font-medium">{purchase.installmentCount}×</span>
            </p>
          </div>
        </div>

        {/* Right: amount + status + actions + chevron */}
        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
          <span className="font-bold text-sm tabular-nums text-foreground">
            {formatCurrency(purchase.totalAmountCents)}
          </span>

          <Badge
            variant="outline"
            className={cn(
              "text-xs font-medium",
              purchase.status === "active"
                ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                : "bg-slate-100 text-slate-500 border-slate-200"
            )}
          >
            {purchase.status === "active" ? "Ativo" : "Cancelado"}
          </Badge>

          {canWrite && purchase.status === "active" && (
            <>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-muted-foreground hover:text-foreground flex-shrink-0 transition-colors"
                title="Editar compra"
                onClick={(e) => { e.stopPropagation(); onEdit(purchase); }}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-muted-foreground hover:text-destructive flex-shrink-0 transition-colors"
                title="Cancelar compra"
                onClick={(e) => { e.stopPropagation(); onCancel(purchase.id); }}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </>
          )}

          <div className="text-muted-foreground">
            {expanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </div>
        </div>
      </button>

      {expanded && purchase.installments.length > 0 && (
        <div className="border-t bg-muted/20 animate-in fade-in-0 slide-in-from-top-1 duration-200">
          <div className="px-4 py-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Parcelas
            </p>
            <div className="space-y-1.5">
              {purchase.installments.map((inst: InstallmentSummary) => (
                <div
                  key={inst.id}
                  className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-background/80 transition-colors text-sm group/inst"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground font-medium bg-muted px-1.5 py-0.5 rounded">
                      {inst.installmentNumber}/{purchase.installmentCount}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      Venc.: {new Date(inst.dueDate).toLocaleDateString("pt-BR")}
                    </span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <span className="font-bold tabular-nums">
                      {formatCurrency(inst.amountCents)}
                    </span>
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-xs font-medium",
                        inst.status === "paid"
                          ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                          : inst.status === "canceled"
                          ? "bg-slate-100 text-slate-500 border-slate-200"
                          : "bg-blue-100 text-blue-700 border-blue-200"
                      )}
                    >
                      {inst.status === "paid" ? "Pago" : inst.status === "canceled" ? "Cancelado" : "Pendente"}
                    </Badge>
                    {canWrite && inst.status === "pending" && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6 text-muted-foreground hover:text-destructive opacity-0 group-hover/inst:opacity-100 transition-all"
                        title="Cancelar parcela"
                        onClick={() => onCancelInstallment(purchase.id, inst.id)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CardDetailPage() {
  const params = useParams();
  const router = useRouter();
  const walletId = params?.walletId as string;
  const cardId = params?.cardId as string;

  const [activeTab, setActiveTab] = useState<Tab>("faturas");

  const [payDialogOpen, setPayDialogOpen] = useState(false);
  const [selectedFatura, setSelectedFatura] = useState<Fatura | null>(null);

  const [purchaseDialogOpen, setPurchaseDialogOpen] = useState(false);
  const [editPurchase, setEditPurchase] = useState<CreditCardPurchase | null>(null);

  const { data: wallet } = useWallet(walletId);
  const canWrite = wallet?.role === "owner" || wallet?.role === "editor";

  const { data: card, isLoading: cardLoading } = useCard(walletId, cardId);

  const { data: faturas, isLoading: faturasLoading } = useFaturas(walletId, cardId);
  const { data: purchases, isLoading: purchasesLoading } = usePurchases(walletId, cardId);
  const { data: bankAccountsRaw } = useBankAccounts(walletId);
  const bankAccounts = bankAccountsRaw?.filter((a) => !a.isArchived);

  const { data: categoriesRaw } = useCategories(walletId);
  const categories = (categoriesRaw ?? []).filter((c) => !c.isArchived);

  const payFatura = usePayFatura(walletId, cardId);
  const createPurchase = useCreatePurchase(walletId, cardId);
  const cancelPurchase = useCancelPurchase(walletId, cardId);
  const cancelInstallmentMutation = useCancelInstallment(walletId, cardId);
  const archiveCard = useArchiveCard(walletId);

  const payForm = useForm<PayFaturaFormValues>({
    resolver: zodResolver(payFaturaSchema),
    defaultValues: {
      bankAccountId: "",
      paidAt: new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }),
    },
  });

  const purchaseForm = useForm<CreatePurchaseFormValues>({
    resolver: zodResolver(createPurchaseSchema),
    defaultValues: {
      description: "",
      totalAmountReais: 0,
      installmentCount: 1,
      purchaseDate: new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }),
      categoryId: "",
      notes: "",
    },
  });

  function handleOpenPayDialog(fatura: Fatura) {
    setSelectedFatura(fatura);
    payForm.reset({
      bankAccountId: "",
      paidAt: new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }),
    });
    setPayDialogOpen(true);
  }

  async function onPaySubmit(values: PayFaturaFormValues) {
    if (!selectedFatura) return;
    try {
      await payFatura.mutateAsync({
        faturaId: selectedFatura.id,
        dto: {
          bankAccountId: values.bankAccountId,
          ...(values.paidAt ? { paidAt: values.paidAt } : {}),
        },
      });
      toast.success("Fatura paga com sucesso");
      setPayDialogOpen(false);
    } catch {
      toast.error("Não foi possível pagar a fatura");
    }
  }

  function handleOpenPurchaseDialog() {
    purchaseForm.reset({
      description: "",
      totalAmountReais: 0,
      installmentCount: 1,
      purchaseDate: new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }),
      categoryId: "",
      notes: "",
    });
    setPurchaseDialogOpen(true);
  }

  async function onPurchaseSubmit(values: CreatePurchaseFormValues) {
    try {
      await createPurchase.mutateAsync({
        description: values.description,
        totalAmountCents: Math.round(values.totalAmountReais * 100),
        installmentCount: values.installmentCount,
        purchaseDate: values.purchaseDate,
        ...(values.categoryId ? { categoryId: values.categoryId } : {}),
        ...(values.notes ? { notes: values.notes } : {}),
      });
      toast.success("Compra criada com sucesso");
      setPurchaseDialogOpen(false);
    } catch {
      toast.error("Não foi possível criar a compra");
    }
  }

  const sortedFaturas = faturas
    ? [...faturas].sort(
        (a, b) =>
          new Date(b.referenceMonth).getTime() - new Date(a.referenceMonth).getTime()
      )
    : [];

  // Credit usage percentage for the header card
  const usagePct =
    card?.creditLimitCents && card?.usedCreditCents !== null
      ? Math.min(100, Math.round((card.usedCreditCents / card.creditLimitCents) * 100))
      : 0;
  const barColor =
    usagePct > 90 ? "bg-red-400" : usagePct > 70 ? "bg-amber-400" : "bg-emerald-400";

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-4xl mx-auto">

      {/* ── Back button ─────────────────────────────────────────────────── */}
      <button
        type="button"
        onClick={() => router.push(`/${walletId}/cards`)}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6 group animate-in fade-in-0 duration-300"
      >
        <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5 duration-150" />
        Todos os cartões
      </button>

      {/* ── Card Header ─────────────────────────────────────────────────── */}
      {cardLoading ? (
        <div className="rounded-2xl p-6 bg-gradient-to-br from-slate-800 to-slate-900 mb-8 h-44">
          <Skeleton className="h-6 w-48 bg-slate-700 mb-2" />
          <Skeleton className="h-4 w-32 bg-slate-700" />
        </div>
      ) : card ? (
        <div className="rounded-2xl p-5 sm:p-6 bg-gradient-to-br from-slate-800 to-slate-900 mb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-5 shadow-xl relative overflow-hidden animate-in fade-in-0 slide-in-from-bottom-3 duration-500 fill-mode-both">
          {/* Decorative elements */}
          <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-white/5" />
          <div className="absolute -bottom-8 -left-6 w-32 h-32 rounded-full bg-white/5" />

          {/* Card info */}
          <div className="relative">
            <div className="w-10 h-8 rounded-md bg-amber-400/80 shadow-sm mb-4" />
            <p className="font-bold text-white text-xl sm:text-2xl">{card.name}</p>
            <p className="text-slate-400 text-sm mt-1">
              Fechamento: dia {card.closingDay}
              <span className="mx-2 text-slate-600">·</span>
              Vencimento: dia {card.dueDay}
            </p>
          </div>

          {/* Credit info + archive */}
          <div className="relative flex flex-col items-start sm:items-end gap-3">
            {card.creditLimitCents !== null && (
              <div className="w-full sm:min-w-[200px]">
                <div className="flex justify-between text-xs text-slate-400 mb-1.5">
                  <span>Utilizado</span>
                  <span className="font-medium text-slate-300">{usagePct}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-700 overflow-hidden mb-2">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${barColor}`}
                    style={{ width: `${usagePct}%` }}
                  />
                </div>
                <div className="flex justify-between">
                  <div>
                    <p className="text-slate-400 text-xs">Disponível</p>
                    <p className="text-white font-bold text-base tabular-nums">
                      {card.availableCreditCents !== null
                        ? formatCurrency(card.availableCreditCents)
                        : "—"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-slate-400 text-xs">Limite</p>
                    <p className="text-slate-300 font-medium text-sm tabular-nums">
                      {formatCurrency(card.creditLimitCents)}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {canWrite && wallet?.role === "owner" && (
              <Button
                size="sm"
                variant="ghost"
                className="text-slate-400 hover:text-white hover:bg-slate-700 h-7 text-xs gap-1.5 transition-colors"
                disabled={archiveCard.isPending}
                onClick={() => {
                  if (confirm("Arquivar este cartão? Esta ação não pode ser desfeita.")) {
                    archiveCard.mutate(cardId, {
                      onSuccess: () => { toast.success("Cartão arquivado."); router.push(`/${walletId}/cards`); },
                      onError: (err: unknown) => {
                        const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
                        if (msg === "CARD_HAS_OPEN_FATURAS") {
                          toast.error("Quite todas as faturas em aberto antes de arquivar o cartão.");
                        } else {
                          toast.error("Não foi possível arquivar o cartão.");
                        }
                      },
                    });
                  }
                }}
              >
                <Archive className="h-3.5 w-3.5" />
                Arquivar cartão
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div className="rounded-2xl p-6 bg-muted mb-8 h-44 flex items-center justify-center">
          <div className="text-center">
            <CreditCard className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-muted-foreground text-sm">Cartão não encontrado</p>
          </div>
        </div>
      )}

      {/* ── Tabs ────────────────────────────────────────────────────────── */}
      <div className="flex gap-0 mb-6 bg-muted rounded-xl p-1 w-fit">
        {(["faturas", "purchases"] as Tab[]).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={cn(
              "flex items-center gap-2 px-5 py-2 text-sm font-medium rounded-lg transition-all duration-200 whitespace-nowrap",
              activeTab === tab
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {tab === "faturas" ? (
              <><FileText className="h-3.5 w-3.5" /> Faturas</>
            ) : (
              <><ShoppingBag className="h-3.5 w-3.5" /> Compras</>
            )}
          </button>
        ))}
      </div>

      {/* ── Faturas Tab ─────────────────────────────────────────────────── */}
      {activeTab === "faturas" && (
        <div className="animate-in fade-in-0 duration-200 fill-mode-both">
          {faturasLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-[70px] rounded-xl" />
              ))}
            </div>
          ) : !sortedFaturas || sortedFaturas.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center px-4">
              <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
                <Receipt className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-bold mb-1">Nenhuma fatura ainda</h3>
              <p className="text-muted-foreground text-sm max-w-xs">
                As faturas aparecerão aqui após compras serem realizadas neste cartão.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {sortedFaturas.map((fatura, i) => (
                <FaturaRow
                  key={fatura.id}
                  fatura={fatura}
                  walletId={walletId}
                  cardId={cardId}
                  canWrite={canWrite}
                  categories={categories}
                  onPay={handleOpenPayDialog}
                  index={i}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Purchases Tab ───────────────────────────────────────────────── */}
      {activeTab === "purchases" && (
        <div className="animate-in fade-in-0 duration-200 fill-mode-both">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-muted-foreground">
              {purchases ? (
                <><span className="font-semibold text-foreground">{purchases.length}</span> compra(s)</>
              ) : ""}
            </p>
            {canWrite && (
              <Button
                size="sm"
                onClick={handleOpenPurchaseDialog}
                className="gap-2 bg-brand-primary hover:bg-brand-primary/90"
              >
                <Plus className="h-4 w-4" />
                Nova compra
              </Button>
            )}
          </div>

          {purchasesLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-[70px] rounded-xl" />
              ))}
            </div>
          ) : !purchases || purchases.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center px-4">
              <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
                <ShoppingBag className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-bold mb-1">Nenhuma compra ainda</h3>
              <p className="text-muted-foreground text-sm max-w-xs mb-6">
                Registre sua primeira compra neste cartão.
              </p>
              {canWrite && (
                <Button
                  onClick={handleOpenPurchaseDialog}
                  className="gap-2 bg-brand-primary hover:bg-brand-primary/90"
                >
                  <Plus className="h-4 w-4" />
                  Nova compra
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {purchases.map((purchase, i) => (
                <PurchaseRow
                  key={purchase.id}
                  purchase={purchase}
                  canWrite={canWrite}
                  index={i}
                  onCancel={(id) => {
                    if (confirm("Cancelar esta compra? Todas as parcelas pendentes serão removidas.")) {
                      cancelPurchase.mutate(id, {
                        onSuccess: () => toast.success("Compra cancelada."),
                        onError: () => toast.error("Não foi possível cancelar a compra."),
                      });
                    }
                  }}
                  onEdit={(p) => setEditPurchase(p)}
                  onCancelInstallment={(purchaseId, installmentId) => {
                    if (confirm("Cancelar esta parcela?")) {
                      cancelInstallmentMutation.mutate({ purchaseId, installmentId }, {
                        onSuccess: () => toast.success("Parcela cancelada."),
                        onError: (err: unknown) => {
                          const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
                          if (msg === "INSTALLMENT_FATURA_ALREADY_PAID") {
                            toast.error("Não é possível cancelar uma parcela de fatura já paga.");
                          } else {
                            toast.error("Não foi possível cancelar a parcela.");
                          }
                        },
                      });
                    }
                  }}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Pay Fatura Dialog ────────────────────────────────────────────── */}
      <Dialog open={payDialogOpen} onOpenChange={setPayDialogOpen}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Pagar fatura{" "}
              {selectedFatura ? formatReferenceMonth(selectedFatura.referenceMonth) : ""}
            </DialogTitle>
          </DialogHeader>

          {selectedFatura && (
            <div className="rounded-xl bg-muted/60 border border-border p-4 mb-2">
              <div className="flex justify-between text-sm mb-1.5">
                <span className="text-muted-foreground">Valor da fatura</span>
                <span className="font-bold text-foreground tabular-nums">
                  {formatCurrency(selectedFatura.totalCents)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Vencimento</span>
                <span className="font-medium">
                  {new Date(selectedFatura.dueDate).toLocaleDateString("pt-BR")}
                </span>
              </div>
            </div>
          )}

          {!bankAccounts || bankAccounts.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-6 text-center">
              <p className="text-sm font-semibold text-foreground mb-1">
                Nenhuma conta bancária configurada
              </p>
              <p className="text-xs text-muted-foreground mb-4">
                É necessário ter ao menos uma conta bancária para pagar uma fatura.
              </p>
              <div className="flex gap-2 justify-center flex-wrap">
                <Button variant="outline" size="sm" onClick={() => setPayDialogOpen(false)}>
                  Fechar
                </Button>
                <Button
                  size="sm"
                  className="bg-brand-primary hover:bg-brand-primary/90"
                  onClick={() => { setPayDialogOpen(false); router.push(`/${walletId}/settings`); }}
                >
                  Ir para configurações
                </Button>
              </div>
            </div>
          ) : (
            <Form {...payForm}>
              <form onSubmit={payForm.handleSubmit(onPaySubmit)} className="space-y-4">
                <FormField
                  control={payForm.control}
                  name="bankAccountId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Conta bancária</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Selecione a conta..." />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {bankAccounts.map((account) => (
                            <SelectItem key={account.id} value={account.id}>
                              {account.name}
                              {account.institution ? ` — ${account.institution}` : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={payForm.control}
                  name="paidAt"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Data do pagamento (opcional)</FormLabel>
                      <FormControl>
                        <Input type="date" className="w-full" {...field} value={field.value ?? ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <DialogFooter className="flex-col sm:flex-row gap-2">
                  <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={() => setPayDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    className="w-full sm:w-auto bg-brand-primary hover:bg-brand-primary/90"
                    disabled={payFatura.isPending}
                  >
                    {payFatura.isPending ? "Processando..." : "Confirmar pagamento"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          )}
        </DialogContent>
      </Dialog>

      {/* ── New Purchase Dialog ──────────────────────────────────────────── */}
      <Dialog open={purchaseDialogOpen} onOpenChange={setPurchaseDialogOpen}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nova compra no cartão</DialogTitle>
          </DialogHeader>

          <Form {...purchaseForm}>
            <form onSubmit={purchaseForm.handleSubmit(onPurchaseSubmit)} className="space-y-4">
              <FormField
                control={purchaseForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descrição</FormLabel>
                    <FormControl>
                      <Input className="w-full" placeholder="Amazon, Netflix..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={purchaseForm.control}
                  name="totalAmountReais"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Valor (R$)</FormLabel>
                      <FormControl>
                        <Input type="number" min={0.01} step="0.01" placeholder="150.00" className="w-full" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={purchaseForm.control}
                  name="installmentCount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Parcelas</FormLabel>
                      <FormControl>
                        <Input type="number" min={1} max={48} placeholder="1" className="w-full" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={purchaseForm.control}
                name="purchaseDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data da compra</FormLabel>
                    <FormControl>
                      <Input type="date" className="w-full" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter className="flex-col sm:flex-row gap-2">
                <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={() => setPurchaseDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  className="w-full sm:w-auto bg-brand-primary hover:bg-brand-primary/90"
                  disabled={createPurchase.isPending}
                >
                  {createPurchase.isPending ? "Criando..." : "Adicionar compra"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <EditPurchaseDialog
        walletId={walletId}
        cardId={cardId}
        purchase={editPurchase}
        categories={categories}
        open={editPurchase !== null}
        onOpenChange={(v) => { if (!v) setEditPurchase(null); }}
      />
    </div>
  );
}
