"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CreditCard, Plus, Archive, Sparkles, ChevronRight, TrendingUp } from "lucide-react";
import { toast } from "sonner";

import { useCards, useCreateCard } from "@/lib/hooks/use-cards";
import { useWallet } from "@/lib/hooks/use-wallet";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
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

const createCardSchema = z.object({
  name: z.string().min(1, "Name is required"),
  closingDay: z
    .number({ coerce: true })
    .int()
    .min(1, "Must be between 1 and 28")
    .max(28, "Must be between 1 and 28"),
  dueDay: z
    .number({ coerce: true })
    .int()
    .min(1, "Must be between 1 and 28")
    .max(28, "Must be between 1 and 28"),
  creditLimitReais: z
    .number({ coerce: true })
    .nonnegative("Must be zero or positive")
    .optional()
    .or(z.literal("")),
});

type CreateCardFormValues = z.infer<typeof createCardSchema>;

// ─── Card Gradient Presets ────────────────────────────────────────────────────

const CARD_GRADIENTS = [
  "from-slate-800 to-slate-900",
  "from-violet-800 to-indigo-900",
  "from-sky-700 to-blue-900",
  "from-emerald-700 to-teal-900",
  "from-rose-700 to-red-900",
];

function getCardGradient(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return CARD_GRADIENTS[Math.abs(hash) % CARD_GRADIENTS.length];
}

// ─── Animated bar ─────────────────────────────────────────────────────────────

function useAnimatedWidth(target: number, delay = 300) {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setWidth(target), delay);
    return () => clearTimeout(t);
  }, [target, delay]);
  return width;
}

// ─── Card credit usage bar (inside card visual) ───────────────────────────────

function CreditBar({ used, limit }: { used: number | null; limit: number }) {
  const pct = used !== null ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const animPct = useAnimatedWidth(pct, 400);
  const barColor = pct > 90 ? "bg-red-400" : pct > 70 ? "bg-amber-400" : "bg-emerald-400";

  return (
    <div>
      <div className="flex justify-between text-xs text-slate-400 mb-1">
        <span>Utilizado</span>
        <span className="font-medium text-slate-300">{pct}%</span>
      </div>
      <div className="w-full h-1.5 rounded-full bg-slate-700 overflow-hidden">
        <div
          className={`h-full rounded-full ${barColor}`}
          style={{ width: `${animPct}%`, transition: "width 0.8s cubic-bezier(0.4,0,0.2,1)" }}
        />
      </div>
    </div>
  );
}

// ─── Aggregate credit summary bar ─────────────────────────────────────────────

function formatCents(cents: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

function AggregateCreditBar({ cards }: { cards: import("@/types/api").CreditCard[] }) {
  const activeCards = cards.filter((c) => !c.isArchived && c.creditLimitCents !== null);
  if (activeCards.length === 0) return null;

  const totalLimit = activeCards.reduce((s, c) => s + (c.creditLimitCents ?? 0), 0);
  const totalUsed  = activeCards.reduce((s, c) => s + (c.usedCreditCents ?? 0), 0);
  const totalAvail = totalLimit - totalUsed;
  const pct = totalLimit > 0 ? Math.min(100, Math.round((totalUsed / totalLimit) * 100)) : 0;
  const animPct = useAnimatedWidth(pct, 200);

  const barColor =
    pct > 90 ? "bg-red-500" : pct > 70 ? "bg-amber-500" : "bg-emerald-500";
  const textColor =
    pct > 90 ? "text-red-600" : pct > 70 ? "text-amber-600" : "text-emerald-600";

  return (
    <div
      className="bg-card border border-border rounded-2xl p-5 shadow-sm mb-8
        animate-in fade-in-0 slide-in-from-bottom-2 duration-500 fill-mode-both"
      style={{ animationDelay: "120ms" }}
    >
      <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-brand-primary-50 flex items-center justify-center">
            <TrendingUp className="h-4 w-4 text-brand-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Limite total</p>
            <p className="text-xs text-muted-foreground">{activeCards.length} cartão(s) com limite</p>
          </div>
        </div>
        <span className={`text-2xl font-bold tabular-nums ${textColor}`}>{pct}%</span>
      </div>

      {/* Bar */}
      <div className="w-full h-3 rounded-full bg-muted overflow-hidden mb-3">
        <div
          className={`h-full rounded-full ${barColor}`}
          style={{ width: `${animPct}%`, transition: "width 1s cubic-bezier(0.4,0,0.2,1)" }}
        />
      </div>

      {/* Utilizado / Disponível */}
      <div className="flex items-center justify-between text-xs flex-wrap gap-1">
        <div className="flex items-center gap-1.5">
          <span className={`w-2.5 h-2.5 rounded-full inline-block ${barColor}`} />
          <span className="text-muted-foreground">Utilizado</span>
          <span className="font-semibold text-foreground tabular-nums">{formatCents(totalUsed)}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full inline-block bg-muted-foreground/30" />
          <span className="text-muted-foreground">Disponível</span>
          <span className="font-semibold text-foreground tabular-nums">{formatCents(totalAvail)}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-muted-foreground">Limite total</span>
          <span className="font-semibold text-foreground tabular-nums">{formatCents(totalLimit)}</span>
        </div>
      </div>
    </div>
  );
}

export default function CardsPage() {
  const params = useParams();
  const router = useRouter();
  const walletId = params?.walletId as string;

  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: wallet } = useWallet(walletId);
  const canWrite = wallet?.role === "owner" || wallet?.role === "editor";
  const { data: cards, isLoading } = useCards(walletId);
  const createCard = useCreateCard(walletId);

  const form = useForm<CreateCardFormValues>({
    resolver: zodResolver(createCardSchema),
    defaultValues: {
      name: "",
      closingDay: 1,
      dueDay: 10,
      creditLimitReais: "",
    },
  });

  function handleOpenDialog() {
    form.reset();
    setDialogOpen(true);
  }

  async function onSubmit(values: CreateCardFormValues) {
    const creditLimitCents =
      values.creditLimitReais && values.creditLimitReais !== 0
        ? Math.round(Number(values.creditLimitReais) * 100)
        : undefined;

    try {
      await createCard.mutateAsync({
        name: values.name,
        closingDay: values.closingDay,
        dueDay: values.dueDay,
        ...(creditLimitCents !== undefined && { creditLimitCents }),
      });
      toast.success("Cartão criado com sucesso");
      setDialogOpen(false);
    } catch {
      toast.error("Não foi possível criar o cartão");
    }
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-8 animate-in fade-in-0 slide-in-from-top-2 duration-400 fill-mode-both">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <Sparkles className="h-4 w-4 text-brand-primary opacity-70" />
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Pagamentos
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
            Cartões de Crédito
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Gerencie seus cartões e faturas
          </p>
        </div>
        {canWrite && (
          <Button
            onClick={handleOpenDialog}
            className="gap-2 bg-brand-primary hover:bg-brand-primary/90 shadow-sm shadow-brand-primary/25 transition-all hover:shadow-md"
          >
            <Plus className="h-4 w-4" />
            Adicionar cartão
          </Button>
        )}
      </div>

      {/* ── Aggregate Bar ────────────────────────────────────────────────── */}
      {!isLoading && cards && cards.length > 0 && (
        <AggregateCreditBar cards={cards} />
      )}

      {/* ── Cards Grid ───────────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-52 rounded-2xl" />
          ))}
        </div>
      ) : !cards || cards.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center animate-in fade-in-0 duration-500 fill-mode-both">
          <div className="w-20 h-20 rounded-3xl bg-muted flex items-center justify-center mb-5 shadow-inner">
            <CreditCard className="h-10 w-10 text-muted-foreground" />
          </div>
          <h2 className="text-xl font-bold text-foreground mb-2">
            Nenhum cartão ainda
          </h2>
          <p className="text-muted-foreground max-w-sm mb-6 text-sm">
            Adicione seu primeiro cartão de crédito para começar a controlar compras e faturas.
          </p>
          {canWrite && (
            <Button
              onClick={handleOpenDialog}
              className="gap-2 bg-brand-primary hover:bg-brand-primary/90 shadow-sm shadow-brand-primary/25"
            >
              <Plus className="h-4 w-4" />
              Adicionar cartão
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {cards.map((card, i) => {
            const gradient = getCardGradient(card.name);
            return (
              <button
                key={card.id}
                onClick={() => router.push(`/${walletId}/cards/${card.id}`)}
                style={{ animationDelay: `${i * 60}ms` }}
                className="text-left group animate-in fade-in-0 slide-in-from-bottom-3 duration-500 fill-mode-both"
              >
                <div
                  className={`relative rounded-2xl p-5 bg-gradient-to-br ${gradient} shadow-lg hover:shadow-2xl transition-all duration-300 cursor-pointer h-52 flex flex-col justify-between overflow-hidden group-hover:-translate-y-1`}
                >
                  {/* Decorative circle */}
                  <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-white/5" />
                  <div className="absolute -bottom-6 -left-4 w-24 h-24 rounded-full bg-white/5" />

                  {/* Top section */}
                  <div className="relative">
                    <div className="flex items-start justify-between">
                      <div className="w-9 h-7 rounded-md bg-amber-400/80 shadow-sm" />
                      {card.isArchived ? (
                        <Badge
                          variant="secondary"
                          className="bg-slate-500/30 text-slate-200 border-slate-400/30 border text-xs gap-1"
                        >
                          <Archive className="h-3 w-3" />
                          Arquivado
                        </Badge>
                      ) : (
                        <Badge
                          variant="secondary"
                          className="bg-emerald-500/20 text-emerald-300 border-emerald-400/30 border text-xs gap-1"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                          Ativo
                        </Badge>
                      )}
                    </div>
                    <p className="font-bold text-white text-lg leading-tight mt-4">
                      {card.name}
                    </p>
                    <p className="text-white/50 text-xs mt-0.5">
                      Fechamento: dia {card.closingDay} &nbsp;·&nbsp; Vencimento: dia {card.dueDay}
                    </p>
                  </div>

                  {/* Bottom section */}
                  <div className="relative">
                    {card.creditLimitCents !== null ? (
                      <div className="space-y-2">
                        <CreditBar used={card.usedCreditCents} limit={card.creditLimitCents} />
                        <div className="flex justify-between items-end">
                          <div>
                            <p className="text-white/50 text-xs">Disponível</p>
                            <p className="text-white font-bold text-base tabular-nums">
                              {card.availableCreditCents !== null
                                ? formatCurrency(card.availableCreditCents)
                                : "—"}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-white/50 text-xs">Limite</p>
                            <p className="text-white/80 text-sm font-medium tabular-nums">
                              {formatCurrency(card.creditLimitCents)}
                            </p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <p className="text-white/50 text-sm">Sem limite definido</p>
                        <ChevronRight className="h-4 w-4 text-white/40 group-hover:text-white/70 transition-colors" />
                      </div>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* ── Dialog ───────────────────────────────────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Adicionar cartão de crédito</DialogTitle>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome do cartão</FormLabel>
                    <FormControl>
                      <Input placeholder="Nubank, Itaú..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="closingDay"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Dia do fechamento</FormLabel>
                      <FormControl>
                        <Input type="number" min={1} max={28} placeholder="15" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="dueDay"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Dia do vencimento</FormLabel>
                      <FormControl>
                        <Input type="number" min={1} max={28} placeholder="25" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="creditLimitReais"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Limite de crédito (R$) — opcional</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        placeholder="5000.00"
                        {...field}
                        value={field.value ?? ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter className="gap-2">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  className="bg-brand-primary hover:bg-brand-primary/90"
                  disabled={createCard.isPending}
                >
                  {createCard.isPending ? "Criando..." : "Criar cartão"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
