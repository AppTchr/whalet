"use client";

import React from "react";
import { useParams, useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Settings,
  Users,
  UserX,
  UserPlus,
  Loader2,
  Crown,
  Edit2,
  Eye,
  Landmark,
  Plus,
  Archive,
  Trash2,
  AlertTriangle,
  Banknote,
  PiggyBank,
  TrendingUp,
  Coins,
  Layers,
} from "lucide-react";

import { useWallet } from "@/lib/hooks/use-wallet";
import { useBankAccounts, useCreateBankAccount } from "@/lib/hooks/use-bank-accounts";
import { deleteBankAccount } from "@/services/bank-accounts.service";
import { useCategories, useCreateCategory, useArchiveCategory } from "@/lib/hooks/use-categories";
import { useBudgets, useUpsertBudget, useDeleteBudget } from "@/lib/hooks/use-budgets";
import { updateWallet, listMembers, inviteMember, revokeMember, changeMemberRole, canDeleteWallet, deleteWallet } from "@/services/wallets.service";
import { useAuthContext } from "@/components/providers/auth-provider";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { WalletMember, BankAccountType, CategoryType } from "@/types/api";
import { useState } from "react";

// ─── Budget schema ────────────────────────────────────────────────────────────

const budgetSchema = z.object({
  amountReais: z.coerce.number({ invalid_type_error: "Informe um valor válido" }).positive("O valor deve ser positivo"),
});
type BudgetFormValues = z.infer<typeof budgetSchema>;

// ─── Schemas ──────────────────────────────────────────────────────────────────

const generalSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório").max(80),
  description: z.string().max(500).optional(),
});

const inviteSchema = z.object({
  email: z.string().email("E-mail válido é obrigatório"),
  role: z.enum(["editor", "viewer"]),
});

const categorySchema = z.object({
  name: z.string().min(1, "Nome é obrigatório").max(80),
  type: z.enum(["income", "expense", "any"] as const),
});

const bankAccountSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório").max(80),
  type: z.enum(["checking", "savings", "investment", "credit_card", "cash", "other"] as const),
  institution: z.string().max(100).optional(),
});

type GeneralFormValues = z.infer<typeof generalSchema>;
type InviteFormValues = z.infer<typeof inviteSchema>;
type CategoryFormValues = z.infer<typeof categorySchema>;
type BankAccountFormValues = z.infer<typeof bankAccountSchema>;

// ─── Role icon helper ──────────────────────────────────────────────────────────

function RoleIcon({ role }: { role: string }) {
  if (role === "owner") return <Crown className="h-3.5 w-3.5" />;
  if (role === "editor") return <Edit2 className="h-3.5 w-3.5" />;
  return <Eye className="h-3.5 w-3.5" />;
}

const ROLE_COLORS: Record<string, string> = {
  owner: "bg-purple-50 text-purple-700 border-purple-200",
  editor: "bg-blue-50 text-blue-700 border-blue-200",
  viewer: "bg-slate-100 text-slate-600 border-slate-200",
};

const STATUS_COLORS: Record<string, string> = {
  active: "bg-emerald-50 text-emerald-700 border-emerald-200",
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  revoked: "bg-red-50 text-red-700 border-red-200",
};

const ROLE_LABELS: Record<string, string> = {
  owner: "Proprietário",
  editor: "Editor",
  viewer: "Visualizador",
};

const STATUS_LABELS: Record<string, string> = {
  active: "Ativo",
  pending: "Pendente",
  revoked: "Revogado",
};

// ─── Bank account type config ─────────────────────────────────────────────────

const BANK_ACCOUNT_TYPE_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  checking: { label: "Conta Corrente", icon: Banknote, color: "text-blue-600", bg: "bg-blue-50" },
  savings: { label: "Poupança", icon: PiggyBank, color: "text-green-600", bg: "bg-green-50" },
  investment: { label: "Investimento", icon: TrendingUp, color: "text-purple-600", bg: "bg-purple-50" },
  credit_card: { label: "Cartão de Crédito", icon: Layers, color: "text-orange-600", bg: "bg-orange-50" },
  cash: { label: "Dinheiro", icon: Coins, color: "text-amber-600", bg: "bg-amber-50" },
  other: { label: "Outro", icon: Landmark, color: "text-slate-600", bg: "bg-slate-100" },
};

// ─── Category type config ─────────────────────────────────────────────────────

const CATEGORY_TYPE_CONFIG: Record<string, { label: string; dotColor: string; badgeClass: string }> = {
  income: { label: "Receita", dotColor: "bg-emerald-500", badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  expense: { label: "Despesa", dotColor: "bg-red-500", badgeClass: "bg-red-50 text-red-700 border-red-200" },
  any: { label: "Qualquer", dotColor: "bg-slate-400", badgeClass: "bg-slate-100 text-slate-600 border-slate-200" },
};

// ─── Member row ───────────────────────────────────────────────────────────────

function MemberRow({
  member,
  canManage,
  onRevoke,
  onChangeRole,
  isRevoking,
  index,
}: {
  member: WalletMember;
  canManage: boolean;
  onRevoke: (id: string) => void;
  onChangeRole: (id: string, role: "editor" | "viewer") => void;
  isRevoking: boolean;
  index: number;
}) {
  const initials = (member.invitedEmail ?? "?").slice(0, 2).toUpperCase();

  return (
    <div
      style={{ animationDelay: `${index * 50}ms` }}
      className="flex items-center gap-3 py-3 flex-wrap animate-in fade-in-0 slide-in-from-bottom-1 duration-250 fill-mode-both"
    >
      {/* Avatar */}
      <div className="w-9 h-9 rounded-full bg-brand-primary-50 flex items-center justify-center text-xs font-bold text-brand-primary shrink-0 ring-2 ring-white">
        {initials}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">
          {member.invitedEmail ?? "—"}
        </p>
        <Badge
          variant="outline"
          className={cn("text-xs gap-1 mt-0.5", STATUS_COLORS[member.status])}
        >
          {STATUS_LABELS[member.status] ?? member.status}
        </Badge>
      </div>

      {/* Role */}
      {canManage && member.role !== "owner" ? (
        <Select
          value={member.role}
          onValueChange={(v) => onChangeRole(member.id, v as "editor" | "viewer")}
        >
          <SelectTrigger className="h-7 w-32 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="editor">Editor</SelectItem>
            <SelectItem value="viewer">Visualizador</SelectItem>
          </SelectContent>
        </Select>
      ) : (
        <Badge
          variant="outline"
          className={cn("text-xs gap-1 shrink-0", ROLE_COLORS[member.role])}
        >
          <RoleIcon role={member.role} />
          {ROLE_LABELS[member.role] ?? member.role}
        </Badge>
      )}

      {/* Revoke */}
      {canManage && member.role !== "owner" && (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-red-50 shrink-0 transition-colors duration-150"
          onClick={() => onRevoke(member.id)}
          disabled={isRevoking}
        >
          <UserX className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const params = useParams();
  const router = useRouter();
  const walletId = params?.walletId as string;
  const queryClient = useQueryClient();
  const { user } = useAuthContext();

  const { data: wallet, isLoading: walletLoading } = useWallet(walletId);
  const { data: bankAccountsRaw, isLoading: bankAccountsLoading } = useBankAccounts(walletId);
  const bankAccounts = bankAccountsRaw?.filter((a) => !a.isArchived);
  const { data: members, isLoading: membersLoading } = useQuery<WalletMember[]>({
    queryKey: ["members", walletId],
    queryFn: () => listMembers(walletId),
    enabled: !!walletId,
    staleTime: 1000 * 30,
  });

  const [inviteOpen, setInviteOpen] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [addAccountOpen, setAddAccountOpen] = useState(false);
  const [addCategoryOpen, setAddCategoryOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirmName, setDeleteConfirmName] = useState("");
  const [budgetEditId, setBudgetEditId] = useState<string | null>(null);

  const isOwner = wallet?.role === "owner";

  // ── Formulário geral ──
  const generalForm = useForm<GeneralFormValues>({
    resolver: zodResolver(generalSchema),
    values: {
      name: wallet?.name ?? "",
      description: wallet?.description ?? "",
    },
  });

  const updateMutation = useMutation({
    mutationFn: (dto: GeneralFormValues) => updateWallet(walletId, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wallets"] });
      toast.success("Carteira atualizada.");
    },
    onError: () => toast.error("Não foi possível atualizar a carteira."),
  });

  // ── Formulário de convite ──
  const inviteForm = useForm<InviteFormValues>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { email: "", role: "editor" },
  });

  const inviteMutation = useMutation({
    mutationFn: (dto: InviteFormValues) => inviteMember(walletId, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["members", walletId] });
      toast.success("Membro convidado.");
      setInviteOpen(false);
      inviteForm.reset();
    },
    onError: () => toast.error("Não foi possível convidar o membro."),
  });

  // ── Categorias ──
  const { data: categoriesRaw, isLoading: categoriesLoading } = useCategories(walletId);
  const activeCategories = categoriesRaw?.filter((c) => !c.isArchived);
  const createCategory = useCreateCategory(walletId);
  const archiveCategory = useArchiveCategory(walletId);

  // ── Orçamentos ──
  const { data: budgets } = useBudgets(walletId);
  const upsertBudget = useUpsertBudget(walletId);
  const deleteBudgetMut = useDeleteBudget(walletId);
  const budgetMap = new Map(budgets?.map((b) => [b.categoryId, b]) ?? []);

  const budgetForm = useForm<BudgetFormValues>({ resolver: zodResolver(budgetSchema) });

  function openBudgetEdit(categoryId: string) {
    const existing = budgetMap.get(categoryId);
    budgetForm.reset({ amountReais: existing ? existing.amountCents / 100 : undefined });
    setBudgetEditId(categoryId);
  }

  async function onSaveBudget(values: BudgetFormValues) {
    if (!budgetEditId) return;
    try {
      await upsertBudget.mutateAsync({ categoryId: budgetEditId, dto: { amountCents: Math.round(values.amountReais * 100) } });
      toast.success("Orçamento salvo.");
      setBudgetEditId(null);
    } catch { toast.error("Não foi possível salvar o orçamento."); }
  }

  const categoryForm = useForm<CategoryFormValues>({
    resolver: zodResolver(categorySchema),
    defaultValues: { name: "", type: "expense" },
  });

  async function onAddCategory(values: CategoryFormValues) {
    try {
      await createCategory.mutateAsync({ name: values.name, type: values.type as CategoryType });
      toast.success("Categoria adicionada.");
      setAddCategoryOpen(false);
      categoryForm.reset();
    } catch {
      toast.error("Não foi possível adicionar a categoria.");
    }
  }

  // ── Contas bancárias ──
  const createBankAccount = useCreateBankAccount(walletId);
  const archiveBankAccountMutation = useMutation({
    mutationFn: (id: string) => deleteBankAccount(walletId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bank-accounts", walletId] });
      toast.success("Conta arquivada.");
    },
    onError: () => toast.error("Não foi possível arquivar a conta."),
  });

  const bankAccountForm = useForm<BankAccountFormValues>({
    resolver: zodResolver(bankAccountSchema),
    defaultValues: { name: "", type: "checking", institution: "" },
  });

  async function onAddAccount(values: BankAccountFormValues) {
    try {
      await createBankAccount.mutateAsync({
        name: values.name,
        type: values.type as BankAccountType,
        ...(values.institution ? { institution: values.institution } : {}),
      });
      toast.success("Conta bancária adicionada.");
      setAddAccountOpen(false);
      bankAccountForm.reset();
    } catch {
      toast.error("Não foi possível adicionar a conta bancária.");
    }
  }

  // ── Alterar permissão ──
  const changeRoleMutation = useMutation({
    mutationFn: ({ memberId, role }: { memberId: string; role: "editor" | "viewer" }) =>
      changeMemberRole(walletId, memberId, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["members", walletId] });
      toast.success("Permissão atualizada.");
    },
    onError: () => toast.error("Não foi possível atualizar a permissão."),
  });

  // ── Revogar acesso ──
  const revokeMutation = useMutation({
    mutationFn: (memberId: string) => revokeMember(walletId, memberId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["members", walletId] });
      toast.success("Acesso revogado.");
      setRevokingId(null);
    },
    onError: () => {
      toast.error("Não foi possível revogar o acesso.");
      setRevokingId(null);
    },
  });

  function handleRevoke(memberId: string) {
    setRevokingId(memberId);
    revokeMutation.mutate(memberId);
  }

  // ── Excluir carteira ──
  const canDeleteQuery = useQuery({
    queryKey: ["wallet-can-delete", walletId],
    queryFn: () => canDeleteWallet(walletId),
    enabled: deleteOpen && isOwner,
    staleTime: 0,
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteWallet(walletId, true),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wallets"] });
      toast.success("Carteira excluída.");
      router.push("/wallets");
    },
    onError: () => toast.error("Não foi possível excluir a carteira."),
  });

  const canDelete = canDeleteQuery.data;
  const deleteNameMatch = deleteConfirmName === wallet?.name;

  return (
    <div className="p-4 md:p-8 w-full max-w-5xl space-y-6">
      {/* Cabeçalho */}
      <div
        className="flex items-center gap-3 mb-2
          animate-in fade-in-0 slide-in-from-top-2 duration-400 fill-mode-both"
      >
        <div className="w-10 h-10 rounded-xl bg-brand-primary-50 flex items-center justify-center shrink-0">
          <Settings className="h-5 w-5 text-brand-primary" />
        </div>
        <div>
          {walletLoading ? (
            <Skeleton className="h-7 w-48" />
          ) : (
            <h1 className="text-xl sm:text-2xl font-bold text-foreground leading-tight">
              {wallet?.name}
            </h1>
          )}
          <p className="text-muted-foreground text-sm mt-0.5">
            Configurações e membros da carteira
          </p>
        </div>
      </div>

      <Tabs defaultValue="geral" className="space-y-6">
        <TabsList className="w-full sm:w-auto grid grid-cols-4 sm:flex h-auto gap-1 p-1 rounded-xl">
          <TabsTrigger value="geral" className="rounded-lg text-xs sm:text-sm gap-1.5 py-2">
            <Settings className="h-3.5 w-3.5 hidden sm:block" />
            Geral
          </TabsTrigger>
          <TabsTrigger value="categorias" className="rounded-lg text-xs sm:text-sm gap-1.5 py-2">
            <Layers className="h-3.5 w-3.5 hidden sm:block" />
            Categorias
          </TabsTrigger>
          <TabsTrigger value="contas" className="rounded-lg text-xs sm:text-sm gap-1.5 py-2">
            <Landmark className="h-3.5 w-3.5 hidden sm:block" />
            Contas
          </TabsTrigger>
          <TabsTrigger value="membros" className="rounded-lg text-xs sm:text-sm gap-1.5 py-2">
            <Users className="h-3.5 w-3.5 hidden sm:block" />
            Membros
          </TabsTrigger>
        </TabsList>

        {/* ── Aba Geral ── */}
        <TabsContent value="geral" className="space-y-6 mt-0">

      {/* ── Geral ── */}
      <Card
        className="border-neutral-border rounded-xl shadow-sm
          animate-in fade-in-0 slide-in-from-bottom-2 duration-300 fill-mode-both"
        style={{ animationDelay: "50ms" }}
      >
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Geral</CardTitle>
          <CardDescription>Nome e descrição da carteira</CardDescription>
        </CardHeader>
        <CardContent>
          {walletLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (
            <form
              onSubmit={generalForm.handleSubmit((v) => {
                if (!isOwner) return;
                updateMutation.mutate(v);
              })}
              className="space-y-4"
            >
              <div className="space-y-1.5">
                <Label htmlFor="name">Nome</Label>
                <Input
                  id="name"
                  className="w-full"
                  disabled={!isOwner}
                  {...generalForm.register("name")}
                />
                {generalForm.formState.errors.name && (
                  <p className="text-xs text-destructive">
                    {generalForm.formState.errors.name.message}
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="description">Descrição</Label>
                <Input
                  id="description"
                  placeholder="Opcional"
                  className="w-full"
                  disabled={!isOwner}
                  {...generalForm.register("description")}
                />
              </div>
              <div className="flex items-center gap-3 pt-1 flex-wrap">
                <Badge variant="outline" className="text-xs capitalize">
                  {wallet?.type}
                </Badge>
                <Badge variant="outline" className="text-xs uppercase">
                  {wallet?.currencyCode}
                </Badge>
                {isOwner && (
                  <Button
                    type="submit"
                    size="sm"
                    className="ml-auto bg-brand-primary hover:bg-brand-primary/90"
                    disabled={updateMutation.isPending}
                  >
                    {updateMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Salvar"
                    )}
                  </Button>
                )}
              </div>
            </form>
          )}
        </CardContent>
      </Card>

      {/* ── Zona de Perigo ── */}
      {isOwner && (
        <Card
          className="border-red-200 bg-red-50/30 rounded-xl shadow-sm
            animate-in fade-in-0 slide-in-from-bottom-2 duration-300 fill-mode-both"
          style={{ animationDelay: "250ms" }}
        >
          <CardHeader className="pb-4">
            <CardTitle className="text-base text-destructive flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-red-100 flex items-center justify-center">
                <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
              </div>
              Zona de Perigo
            </CardTitle>
            <CardDescription>
              Ações irreversíveis. Proceda com cuidado.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between flex-wrap gap-3 p-4 rounded-lg bg-white border border-red-200">
              <div>
                <p className="text-sm font-medium text-foreground">Excluir esta carteira</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Remove permanentemente todas as transações, cartões, faturas e membros.
                </p>
              </div>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setDeleteOpen(true)}
                className="shrink-0"
              >
                <Trash2 className="mr-1.5 h-4 w-4" />
                Excluir carteira
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

        </TabsContent>

        {/* ── Aba Categorias ── */}
        <TabsContent value="categorias" className="space-y-6 mt-0">

      {/* ── Categorias ── */}
      <Card
        className="border-neutral-border rounded-xl shadow-sm
          animate-in fade-in-0 slide-in-from-bottom-2 duration-300 fill-mode-both"
        style={{ animationDelay: "100ms" }}
      >
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-rose-50 flex items-center justify-center">
                  <Layers className="h-3.5 w-3.5 text-rose-600" />
                </div>
                Categorias
              </CardTitle>
              <CardDescription className="mt-0.5">Categorias de receita e despesa</CardDescription>
            </div>
            {isOwner && (
              <Button size="sm" variant="outline" onClick={() => setAddCategoryOpen(true)}
                className="hover:border-brand-primary hover:text-brand-primary transition-colors duration-150"
              >
                <Plus className="mr-1.5 h-4 w-4" />
                Adicionar
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {categoriesLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-4 flex-1" />
                  <Skeleton className="h-5 w-16" />
                </div>
              ))}
            </div>
          ) : !activeCategories || activeCategories.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-12 h-12 rounded-xl bg-slate-50 flex items-center justify-center mx-auto mb-3">
                <Layers className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground mb-3">Nenhuma categoria ainda.</p>
              {isOwner && (
                <Button size="sm" onClick={() => setAddCategoryOpen(true)}>
                  <Plus className="mr-1.5 h-4 w-4" />
                  Adicionar primeira categoria
                </Button>
              )}
            </div>
          ) : (
            (() => {
              const expenses = activeCategories.filter((c) => c.type === "expense");
              const incomes  = activeCategories.filter((c) => c.type === "income");
              const any      = activeCategories.filter((c) => c.type === "any");

              const renderGroup = (cats: typeof activeCategories, label: string, dotColor: string, barColor: string) =>
                cats.length === 0 ? null : (
                  <div className="space-y-0.5">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1 pb-1 flex items-center gap-1.5">
                      <span className={cn("w-2 h-2 rounded-full inline-block", dotColor)} />
                      {label} <span className="ml-auto font-normal normal-case">{cats.length}</span>
                    </p>
                    <div className="divide-y divide-neutral-border">
                      {cats.map((cat, i) => {
                        const budget = budgetMap.get(cat.id);
                        const pct = budget?.pct ?? 0;
                        const overBudget = pct >= 100;
                        const nearBudget = pct >= 80 && pct < 100;
                        return (
                          <div
                            key={cat.id}
                            style={{ animationDelay: `${i * 35}ms` }}
                            className="py-2.5 group animate-in fade-in-0 slide-in-from-bottom-1 duration-200 fill-mode-both"
                          >
                            <div className="flex items-center gap-3">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-foreground truncate">{cat.name}</p>
                                {budget && (
                                  <p className="text-xs text-muted-foreground mt-0.5 tabular-nums">
                                    R$ {(budget.spentCents / 100).toFixed(2)} / R$ {(budget.amountCents / 100).toFixed(2)}
                                    {overBudget && <span className="ml-1.5 text-red-500 font-semibold">Excedido!</span>}
                                    {nearBudget && <span className="ml-1.5 text-amber-500 font-semibold">{pct}%</span>}
                                  </p>
                                )}
                              </div>
                              {isOwner && (
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all duration-150 shrink-0">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-muted-foreground hover:text-brand-primary hover:bg-brand-primary-50"
                                    onClick={() => openBudgetEdit(cat.id)}
                                    title={budget ? "Editar orçamento" : "Definir orçamento"}
                                  >
                                    <TrendingUp className="h-3.5 w-3.5" />
                                  </Button>
                                  {budget && (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7 text-muted-foreground hover:text-amber-600 hover:bg-amber-50"
                                      onClick={() => deleteBudgetMut.mutate(cat.id, {
                                        onSuccess: () => toast.success("Orçamento removido."),
                                      })}
                                      title="Remover orçamento"
                                    >
                                      <Coins className="h-3.5 w-3.5" />
                                    </Button>
                                  )}
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-red-50"
                                    onClick={() => archiveCategory.mutate(cat.id, {
                                      onSuccess: () => toast.success("Categoria arquivada."),
                                      onError: () => toast.error("Não foi possível arquivar a categoria."),
                                    })}
                                    title="Arquivar categoria"
                                  >
                                    <Archive className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              )}
                            </div>
                            {budget && (
                              <div className="mt-1.5 w-full h-1.5 rounded-full bg-muted overflow-hidden">
                                <div
                                  className={cn("h-full rounded-full transition-all duration-700", overBudget ? "bg-red-500" : nearBudget ? "bg-amber-400" : barColor)}
                                  style={{ width: `${Math.min(pct, 100)}%` }}
                                />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );

              return (
                <div className="space-y-4">
                  {renderGroup(expenses, "Despesas", "bg-red-500",     "bg-red-400")}
                  {renderGroup(incomes,  "Receitas", "bg-emerald-500", "bg-emerald-400")}
                  {renderGroup(any,      "Qualquer", "bg-slate-400",   "bg-slate-400")}
                </div>
              );
            })()
          )}
        </CardContent>
      </Card>

        </TabsContent>

        {/* ── Aba Contas ── */}
        <TabsContent value="contas" className="space-y-6 mt-0">

      {/* ── Contas Bancárias ── */}
      <Card
        className="border-neutral-border rounded-xl shadow-sm
          animate-in fade-in-0 slide-in-from-bottom-2 duration-300 fill-mode-both"
        style={{ animationDelay: "150ms" }}
      >
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-blue-50 flex items-center justify-center">
                  <Landmark className="h-3.5 w-3.5 text-blue-600" />
                </div>
                Contas Bancárias
              </CardTitle>
              <CardDescription className="mt-0.5">
                Contas usadas para pagamentos e transações
              </CardDescription>
            </div>
            {isOwner && (
              <Button size="sm" variant="outline" onClick={() => setAddAccountOpen(true)}
                className="hover:border-brand-primary hover:text-brand-primary transition-colors duration-150"
              >
                <Plus className="mr-1.5 h-4 w-4" />
                Adicionar
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {bankAccountsLoading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-8 w-8 rounded-lg" />
                  <Skeleton className="h-4 flex-1" />
                  <Skeleton className="h-5 w-20" />
                </div>
              ))}
            </div>
          ) : !bankAccounts || bankAccounts.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-12 h-12 rounded-xl bg-slate-50 flex items-center justify-center mx-auto mb-3">
                <Landmark className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground mb-3">Nenhuma conta bancária ainda.</p>
              {isOwner && (
                <Button size="sm" onClick={() => setAddAccountOpen(true)}>
                  <Plus className="mr-1.5 h-4 w-4" />
                  Adicionar primeira conta
                </Button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-neutral-border">
              {bankAccounts.map((account, i) => {
                const typeConfig = BANK_ACCOUNT_TYPE_CONFIG[account.type] ?? BANK_ACCOUNT_TYPE_CONFIG.other;
                const TypeIcon = typeConfig.icon;
                return (
                  <div
                    key={account.id}
                    style={{ animationDelay: `${i * 40}ms` }}
                    className="flex items-center gap-3 py-3 group
                      animate-in fade-in-0 slide-in-from-bottom-1 duration-200 fill-mode-both"
                  >
                    <div
                      className={cn(
                        "w-9 h-9 rounded-lg flex items-center justify-center shrink-0",
                        typeConfig.bg
                      )}
                    >
                      <TypeIcon className={cn("h-4 w-4", typeConfig.color)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{account.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {typeConfig.label}{account.institution ? ` · ${account.institution}` : ""}
                      </p>
                    </div>
                    {isOwner && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-red-50
                          opacity-0 group-hover:opacity-100 shrink-0 transition-all duration-150"
                        onClick={() => archiveBankAccountMutation.mutate(account.id)}
                        disabled={archiveBankAccountMutation.isPending}
                        title="Arquivar conta"
                      >
                        <Archive className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

        </TabsContent>

        {/* ── Aba Membros ── */}
        <TabsContent value="membros" className="space-y-6 mt-0">

      {/* ── Membros ── */}
      <Card
        className="border-neutral-border rounded-xl shadow-sm
          animate-in fade-in-0 slide-in-from-bottom-2 duration-300 fill-mode-both"
        style={{ animationDelay: "200ms" }}
      >
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-green-50 flex items-center justify-center">
                  <Users className="h-3.5 w-3.5 text-green-600" />
                </div>
                Membros
              </CardTitle>
              <CardDescription className="mt-0.5">
                {members?.length ?? 0} membro(s)
              </CardDescription>
            </div>
            {isOwner && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setInviteOpen(true)}
                className="hover:border-brand-primary hover:text-brand-primary transition-colors duration-150"
              >
                <UserPlus className="mr-1.5 h-4 w-4" />
                Convidar
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {membersLoading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-9 w-9 rounded-full" />
                  <Skeleton className="h-4 flex-1" />
                  <Skeleton className="h-5 w-16" />
                </div>
              ))}
            </div>
          ) : members && members.length > 0 ? (
            <div className="divide-y divide-neutral-border">
              {members.map((m, i) => (
                <MemberRow
                  key={m.id}
                  member={m}
                  index={i}
                  canManage={isOwner && m.userId !== user?.id}
                  onRevoke={handleRevoke}
                  onChangeRole={(id, role) => changeRoleMutation.mutate({ memberId: id, role })}
                  isRevoking={revokingId === m.id && revokeMutation.isPending}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="w-12 h-12 rounded-xl bg-slate-50 flex items-center justify-center mx-auto mb-3">
                <Users className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">Nenhum membro ainda.</p>
            </div>
          )}
        </CardContent>
      </Card>

        </TabsContent>
      </Tabs>

      {/* Diálogo excluir carteira */}
      <Dialog open={deleteOpen} onOpenChange={(o) => { setDeleteOpen(o); if (!o) setDeleteConfirmName(""); }}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <Trash2 className="h-5 w-5" /> Excluir carteira
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {canDeleteQuery.isLoading ? (
              <div className="flex justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : canDelete?.blockers && canDelete.blockers.length > 0 ? (
              <div className="rounded-md bg-destructive/10 border border-destructive/30 p-4 space-y-1">
                <p className="text-sm font-medium text-destructive">Não é possível excluir esta carteira</p>
                {canDelete.blockers.includes("WALLET_IS_LAST_WALLET") && (
                  <p className="text-sm text-muted-foreground">Você precisa ter ao menos uma carteira. Crie outra antes de excluir esta.</p>
                )}
              </div>
            ) : (
              <>
                {canDelete?.warnings && canDelete.warnings.length > 0 && (
                  <div className="rounded-md bg-amber-50 border border-amber-200 p-3 space-y-1">
                    <p className="text-sm font-medium text-amber-800 flex items-center gap-1.5">
                      <AlertTriangle className="h-4 w-4" /> Avisos
                    </p>
                    <ul className="text-sm text-amber-700 space-y-0.5 pl-1">
                      {canDelete.warnings.includes("WALLET_HAS_NONZERO_BALANCE") && (
                        <li>· O saldo não é zero (realizado: {canDelete.meta.settledBalance})</li>
                      )}
                      {canDelete.warnings.includes("WALLET_HAS_PENDING_INSTALLMENTS") && (
                        <li>· {canDelete.meta.pendingInstallmentsCount} parcela(s) pendente(s) serão perdidas</li>
                      )}
                      {canDelete.warnings.includes("WALLET_HAS_OPEN_FATURAS") && (
                        <li>· {canDelete.meta.openFaturasCount} fatura(s) em aberto serão perdidas</li>
                      )}
                      {canDelete.warnings.includes("WALLET_HAS_TRANSFERS") && (
                        <li>· {canDelete.meta.transferPairsCount} transferência(s) serão excluídas</li>
                      )}
                    </ul>
                  </div>
                )}
                <div className="space-y-1.5">
                  <p className="text-sm text-muted-foreground">
                    Digite <span className="font-semibold text-foreground">{wallet?.name}</span> para confirmar a exclusão permanente.
                  </p>
                  <Input
                    className="w-full"
                    placeholder={wallet?.name}
                    value={deleteConfirmName}
                    onChange={(e) => setDeleteConfirmName(e.target.value)}
                    autoFocus
                  />
                </div>
              </>
            )}
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" className="w-full sm:w-auto" onClick={() => { setDeleteOpen(false); setDeleteConfirmName(""); }}>
              Cancelar
            </Button>
            {(!canDelete?.blockers || canDelete.blockers.length === 0) && (
              <Button
                variant="destructive"
                className="w-full sm:w-auto"
                disabled={!deleteNameMatch || deleteMutation.isPending || canDeleteQuery.isLoading}
                onClick={() => deleteMutation.mutate()}
              >
                {deleteMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Excluir permanentemente"
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo adicionar categoria */}
      <Dialog open={addCategoryOpen} onOpenChange={setAddCategoryOpen}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Adicionar categoria</DialogTitle>
          </DialogHeader>
          <form onSubmit={categoryForm.handleSubmit(onAddCategory)} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Nome</Label>
              <Input className="w-full" placeholder="Alimentação, Transporte..." autoFocus {...categoryForm.register("name")} />
              {categoryForm.formState.errors.name && (
                <p className="text-xs text-destructive">{categoryForm.formState.errors.name.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select
                defaultValue="expense"
                onValueChange={(v) => categoryForm.setValue("type", v as CategoryFormValues["type"])}
              >
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="expense">Despesa</SelectItem>
                  <SelectItem value="income">Receita</SelectItem>
                  <SelectItem value="any">Qualquer (receita e despesa)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={() => setAddCategoryOpen(false)}>Cancelar</Button>
              <Button type="submit" className="w-full sm:w-auto" disabled={createCategory.isPending}>
                {createCategory.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Adicionar categoria"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Diálogo adicionar conta bancária */}
      <Dialog open={addAccountOpen} onOpenChange={setAddAccountOpen}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Adicionar conta bancária</DialogTitle>
          </DialogHeader>
          <form onSubmit={bankAccountForm.handleSubmit(onAddAccount)} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Nome</Label>
              <Input className="w-full" placeholder="Nubank, Bradesco..." autoFocus {...bankAccountForm.register("name")} />
              {bankAccountForm.formState.errors.name && (
                <p className="text-xs text-destructive">{bankAccountForm.formState.errors.name.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select
                defaultValue="checking"
                onValueChange={(v) => bankAccountForm.setValue("type", v as BankAccountFormValues["type"])}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="checking">Conta Corrente</SelectItem>
                  <SelectItem value="savings">Poupança</SelectItem>
                  <SelectItem value="credit_card">Cartão de Crédito</SelectItem>
                  <SelectItem value="investment">Investimento</SelectItem>
                  <SelectItem value="cash">Dinheiro</SelectItem>
                  <SelectItem value="other">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Instituição (opcional)</Label>
              <Input className="w-full" placeholder="Nubank, Itaú..." {...bankAccountForm.register("institution")} />
            </div>
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={() => setAddAccountOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" className="w-full sm:w-auto" disabled={createBankAccount.isPending}>
                {createBankAccount.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Adicionar conta"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Diálogo convidar membro */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Convidar membro</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={inviteForm.handleSubmit((v) => inviteMutation.mutate(v))}
            className="space-y-4 py-2"
          >
            <div className="space-y-1.5">
              <Label>E-mail</Label>
              <Input
                type="email"
                placeholder="colega@exemplo.com"
                className="w-full"
                autoFocus
                {...inviteForm.register("email")}
              />
              {inviteForm.formState.errors.email && (
                <p className="text-xs text-destructive">
                  {inviteForm.formState.errors.email.message}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Permissão</Label>
              <Select
                defaultValue="editor"
                onValueChange={(v) =>
                  inviteForm.setValue("role", v as "editor" | "viewer")
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="editor">Editor — pode criar transações</SelectItem>
                  <SelectItem value="viewer">Visualizador — somente leitura</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button
                type="button"
                variant="outline"
                className="w-full sm:w-auto"
                onClick={() => setInviteOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                className="w-full sm:w-auto bg-brand-primary hover:bg-brand-primary/90"
                disabled={inviteMutation.isPending}
              >
                {inviteMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Enviar convite"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Diálogo orçamento */}
      <Dialog open={budgetEditId !== null} onOpenChange={(o) => { if (!o) setBudgetEditId(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {budgetEditId && budgetMap.has(budgetEditId) ? "Editar orçamento" : "Definir orçamento"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={budgetForm.handleSubmit(onSaveBudget)} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Limite mensal (R$)</Label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                placeholder="800.00"
                autoFocus
                {...budgetForm.register("amountReais")}
              />
              {budgetForm.formState.errors.amountReais && (
                <p className="text-xs text-destructive">{budgetForm.formState.errors.amountReais.message}</p>
              )}
              <p className="text-xs text-muted-foreground">
                Valor máximo que você pretende gastar nessa categoria por mês.
              </p>
            </div>
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={() => setBudgetEditId(null)}>Cancelar</Button>
              <Button type="submit" className="w-full sm:w-auto" disabled={upsertBudget.isPending}>
                {upsertBudget.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
