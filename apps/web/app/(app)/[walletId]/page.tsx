"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import {
  TrendingUp,
  TrendingDown,
  ArrowLeftRight,
  Plus,
  CreditCard,
  ArrowUpRight,
  Wallet,
  BarChart3,
  Tag,
  Sparkles,
  Target,
  AlertTriangle,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { useWallet } from "@/lib/hooks/use-wallet";
import { useTransactions } from "@/lib/hooks/use-transactions";
import { useDashboard } from "@/lib/hooks/use-dashboard";
import { useBudgets } from "@/lib/hooks/use-budgets";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DashboardDateFilter,
  filterValueToParams,
  type DateFilterValue,
} from "@/components/dashboard/dashboard-date-filter";
import { cn } from "@/lib/utils";
import type { Transaction, DashboardMonthlyTrendItem } from "@/types/api";

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

const MONTH_NAMES = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];

const WALLET_TYPE_LABELS: Record<string, string> = {
  personal: "Pessoal",
  home: "Casa",
  custom: "Personalizado",
  business: "Empresarial",
  family: "Família",
  project: "Projeto",
};

const ROLE_LABELS: Record<string, string> = {
  owner: "Proprietário",
  editor: "Editor",
  viewer: "Visualizador",
};

const TRANSACTION_TYPE_LABELS: Record<string, string> = {
  income: "Receita",
  expense: "Despesa",
  transfer_in: "Transferência entrada",
  transfer_out: "Transferência saída",
  credit_card_purchase: "Compra no cartão",
  credit_card_refund: "Estorno no cartão",
  invoice_payment: "Pagamento de fatura",
};

// ─── Recent Transaction Row ───────────────────────────────────────────────────

function TransactionRow({
  tx,
  currencyCode,
  index,
}: {
  tx: Transaction;
  currencyCode: string;
  index: number;
}) {
  const isIncome = tx.sign === 1;
  const isExpense = tx.sign === -1;
  const staggerClass = `stagger-${Math.min(index + 1, 8)}`;

  return (
    <div
      className={`flex items-center gap-3 py-3 border-b last:border-b-0 group transition-colors hover:bg-muted/30 -mx-2 px-2 rounded-lg animate-in fade-in-0 slide-in-from-left-2 duration-300 ${staggerClass}`}
    >
      <div
        className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-110 duration-200 ${
          isIncome
            ? "bg-green-100 shadow-sm shadow-green-100"
            : isExpense
            ? "bg-red-100 shadow-sm shadow-red-100"
            : "bg-slate-100 shadow-sm"
        }`}
      >
        {isIncome ? (
          <TrendingUp className="h-4 w-4 text-green-600" />
        ) : isExpense ? (
          <TrendingDown className="h-4 w-4 text-red-500" />
        ) : (
          <ArrowLeftRight className="h-4 w-4 text-slate-500" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground truncate">
          {tx.description ?? TRANSACTION_TYPE_LABELS[tx.type]}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {TRANSACTION_TYPE_LABELS[tx.type]}
        </p>
      </div>
      <div className="text-right flex-shrink-0">
        <p
          className={`text-sm font-bold tabular-nums ${
            isIncome ? "text-green-600" : isExpense ? "text-red-500" : "text-foreground"
          }`}
        >
          {isExpense ? "−" : isIncome ? "+" : ""}
          {formatAmount(tx.amount, currencyCode)}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">{formatDate(tx.dueDate)}</p>
      </div>
    </div>
  );
}

// ─── Recharts Bar Chart ───────────────────────────────────────────────────────

const DONUT_COLORS = ["#ef4444","#f97316","#f59e0b","#84cc16","#22c55e","#06b6d4","#6366f1","#a855f7"];

function MonthlyBarChart({ data, currencyCode }: { data: DashboardMonthlyTrendItem[]; currencyCode: string }) {
  const chartData = data.map((d) => ({
    name: MONTH_NAMES[d.month - 1],
    Receitas: d.income,
    Despesas: d.expenses,
  }));

  const fmt = (v: unknown) => formatAmount(Number(v), currencyCode);

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={chartData} barSize={14} barGap={3} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
        <XAxis dataKey="name" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v >= 1000 ? (v/1000).toFixed(0)+"k" : v}`} />
        <Tooltip
          formatter={fmt}
          contentStyle={{ borderRadius: "12px", border: "1px solid hsl(var(--border))", boxShadow: "0 4px 20px rgba(0,0,0,0.08)", fontSize: 12 }}
          labelStyle={{ fontWeight: 700, marginBottom: 4 }}
        />
        <Bar dataKey="Receitas" fill="#34d399" radius={[4,4,0,0]} />
        <Bar dataKey="Despesas" fill="#f87171" radius={[4,4,0,0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ─── Category Donut Chart ─────────────────────────────────────────────────────

function CategoryDonut({ data, currencyCode }: { data: { categoryId: string | null; categoryName: string | null; totalExpenses: number }[]; currencyCode: string }) {
  const pieData = data.map((c) => ({ name: c.categoryName ?? "Sem categoria", value: c.totalExpenses }));
  const total = data.reduce((s, c) => s + c.totalExpenses, 0);

  return (
    <div className="flex gap-6 items-center flex-wrap">
      <div className="w-[160px] h-[160px] shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={pieData} cx="50%" cy="50%" innerRadius={46} outerRadius={72} paddingAngle={2} dataKey="value" animationBegin={0} animationDuration={800}>
              {pieData.map((_, i) => <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />)}
            </Pie>
            <Tooltip formatter={(v) => formatAmount(Number(v), currencyCode)} contentStyle={{ borderRadius: "10px", fontSize: 12 }} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="flex-1 space-y-2 min-w-0">
        {data.map((cat, i) => {
          const pct = total > 0 ? Math.round((cat.totalExpenses / total) * 100) : 0;
          return (
            <div key={cat.categoryId ?? "none"} className="flex items-center gap-2 text-xs">
              <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: DONUT_COLORS[i % DONUT_COLORS.length] }} />
              <span className="flex-1 truncate text-foreground font-medium">{cat.categoryName ?? "Sem categoria"}</span>
              <span className="text-muted-foreground tabular-nums">{pct}%</span>
              <span className="font-bold text-red-500 tabular-nums shrink-0">{formatAmount(cat.totalExpenses, currencyCode)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── DEPRECATED pure-CSS chart (kept for type reference, replaced above) ─────

function MiniBarChart({
  data,
  currencyCode,
}: {
  data: DashboardMonthlyTrendItem[];
  currencyCode: string;
}) {
  void currencyCode;
  const maxValue = Math.max(...data.flatMap((d) => [d.income, d.expenses]), 1);

  return (
    <div className="flex items-end gap-1.5 h-32 w-full pt-2">
      {data.map((item, i) => {
        const incomeH = Math.round((item.income / maxValue) * 100);
        const expenseH = Math.round((item.expenses / maxValue) * 100);
        const isLast = i === data.length - 1;

        return (
          <div key={`${item.year}-${item.month}`} className="flex-1 flex flex-col items-center gap-1.5 group relative">
            {/* Bars */}
            <div className="flex items-end gap-0.5 w-full h-[100px]">
              <div
                className={`flex-1 rounded-t-sm transition-all duration-700 ${isLast ? "bg-emerald-500" : "bg-emerald-200"}`}
                style={{ height: `${incomeH}%`, minHeight: item.income > 0 ? "3px" : "0" }}
              />
              <div
                className={`flex-1 rounded-t-sm transition-all duration-700 ${isLast ? "bg-red-400" : "bg-red-200"}`}
                style={{ height: `${expenseH}%`, minHeight: item.expenses > 0 ? "3px" : "0" }}
              />
            </div>

            {/* Month label */}
            <span className={`text-[10px] font-medium transition-colors ${
              isLast ? "text-foreground font-bold" : "text-muted-foreground"
            }`}>
              {MONTH_NAMES[item.month - 1]}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Net indicator ────────────────────────────────────────────────────────────

function NetIndicator({ net, currencyCode }: { net: number; currencyCode: string }) {
  const positive = net >= 0;
  return (
    <span className={`text-sm font-bold tabular-nums px-2 py-0.5 rounded-full ${
      positive
        ? "text-emerald-700 bg-emerald-50"
        : "text-red-600 bg-red-50"
    }`}>
      {positive ? "+" : ""}
      {formatAmount(net, currencyCode)}
    </span>
  );
}

// ─── Default date filter ───────────────────────────────────────────────────────

function getDefaultDateFilter(): DateFilterValue {
  const now = new Date();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const fromYear = String(now.getUTCFullYear());
  const toYear = String(now.getUTCFullYear() + 1);
  return { fromMonth: month, fromYear, toMonth: month, toYear };
}

// ─── Balance Card ──────────────────────────────────────────────────────────────

function BalanceCard({
  title,
  icon: Icon,
  amount,
  subtitle,
  accentColor,
  isLoading,
  currencyCode,
  delay,
}: {
  title: string;
  icon: React.ElementType;
  amount: number | undefined;
  subtitle: string;
  accentColor: "indigo" | "slate";
  isLoading: boolean;
  currencyCode: string;
  delay: number;
}) {
  const colorMap = {
    indigo: {
      iconBg: "bg-brand-primary-50",
      iconColor: "text-brand-primary",
      amountColor: "text-foreground",
      border: "border-brand-primary/20",
    },
    slate: {
      iconBg: "bg-slate-100",
      iconColor: "text-slate-600",
      amountColor: "text-foreground",
      border: "border-slate-200",
    },
  };
  const colors = colorMap[accentColor];

  return (
    <Card
      className={`border shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5 animate-in fade-in-0 slide-in-from-bottom-3 duration-500 fill-mode-both`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${colors.iconBg}`}>
            <Icon className={`h-3.5 w-3.5 ${colors.iconColor}`} />
          </div>
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-9 w-40" />
        ) : (
          <p className={`text-3xl font-bold tabular-nums tracking-tight ${colors.amountColor}`}>
            {formatAmount(amount ?? 0, currencyCode)}
          </p>
        )}
        <p className="text-xs text-muted-foreground mt-1.5">{subtitle}</p>
      </CardContent>
    </Card>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function WalletDashboardPage() {
  const params = useParams();
  const walletId = params?.walletId as string;

  const [dateFilter, setDateFilter] = useState<DateFilterValue>(getDefaultDateFilter);
  const dashboardParams = filterValueToParams(dateFilter);

  const { data: wallet, isLoading: walletLoading } = useWallet(walletId);
  const { data: txData, isLoading: txLoading } = useTransactions(walletId, { limit: 5, page: 1 });
  const { data: dashboard, isLoading: dashLoading } = useDashboard(walletId, dashboardParams);
  const { data: budgets } = useBudgets(walletId);

  const currencyCode = wallet?.currencyCode ?? "BRL";
  const canWrite = wallet?.role === "owner" || wallet?.role === "editor";

  const trendTitle = `${dateFilter.fromYear}-${dateFilter.fromMonth} a ${dateFilter.toYear}-${dateFilter.toMonth}`;
  const MONTH_ABBR = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
  const filterLabel = `${MONTH_ABBR[parseInt(dateFilter.fromMonth) - 1]} ${dateFilter.fromYear} – ${MONTH_ABBR[parseInt(dateFilter.toMonth) - 1]} ${dateFilter.toYear}`;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6 sm:space-y-8">

      {/* ── Page Header ───────────────────────────────────────────────────── */}
      <div className="animate-in fade-in-0 slide-in-from-top-2 duration-400 fill-mode-both">
        {walletLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-5 w-40" />
          </div>
        ) : (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Sparkles className="h-4 w-4 text-brand-primary opacity-70" />
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Painel
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
                {wallet?.name ?? "Painel"}
              </h1>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <Badge
                  variant="secondary"
                  className="text-xs font-medium bg-brand-primary-50 text-brand-primary border-0"
                >
                  {WALLET_TYPE_LABELS[wallet?.type ?? ""] ?? wallet?.type}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {ROLE_LABELS[wallet?.role ?? ""] ?? wallet?.role}
                </Badge>
                <span className="text-xs text-muted-foreground font-medium">
                  {wallet?.currencyCode}
                </span>
              </div>
            </div>
            <DashboardDateFilter
              value={dateFilter}
              onChange={(v) => setDateFilter(v)}
              onReset={() => setDateFilter(getDefaultDateFilter())}
            />
          </div>
        )}
      </div>

      {/* ── Balance Cards ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <BalanceCard
          title="Saldo Confirmado"
          icon={Wallet}
          amount={wallet?.settledBalance}
          subtitle="Apenas transações confirmadas"
          accentColor="indigo"
          isLoading={walletLoading}
          currencyCode={currencyCode}
          delay={100}
        />
        <BalanceCard
          title="Saldo Projetado"
          icon={BarChart3}
          amount={wallet?.projectedBalance}
          subtitle="Inclui pendentes e faturas em aberto"
          accentColor="slate"
          isLoading={walletLoading}
          currencyCode={currencyCode}
          delay={160}
        />
      </div>

      {/* ── Monthly + Annual Summary ──────────────────────────────────────── */}
      <div
        className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in-0 slide-in-from-bottom-3 duration-500 fill-mode-both"
        style={{ animationDelay: "220ms" }}
      >
        {/* Last Month */}
        <Card className="shadow-sm hover:shadow-md transition-all duration-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center justify-between">
              <span>Mês Passado</span>
              {!dashLoading && dashboard && (
                <span className="text-xs font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                  {MONTH_NAMES[dashboard.currentMonth.month - 1]} {dashboard.currentMonth.year}
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {dashLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-5 w-full" />
                <Skeleton className="h-5 w-full" />
                <Skeleton className="h-5 w-3/4" />
              </div>
            ) : dashboard ? (
              <>
                <div className="flex items-center justify-between py-2 rounded-lg hover:bg-muted/30 transition-colors -mx-1 px-1">
                  <span className="flex items-center gap-2 text-sm text-muted-foreground">
                    <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center">
                      <TrendingUp className="h-3 w-3 text-emerald-600" />
                    </div>
                    Receitas
                  </span>
                  <span className="font-bold text-sm text-emerald-600 tabular-nums">
                    +{formatAmount(dashboard.currentMonth.income, currencyCode)}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2 rounded-lg hover:bg-muted/30 transition-colors -mx-1 px-1">
                  <span className="flex items-center gap-2 text-sm text-muted-foreground">
                    <div className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center">
                      <TrendingDown className="h-3 w-3 text-red-500" />
                    </div>
                    Despesas
                  </span>
                  <span className="font-bold text-sm text-red-500 tabular-nums">
                    −{formatAmount(dashboard.currentMonth.expenses, currencyCode)}
                  </span>
                </div>
                <div className="pt-2 border-t flex items-center justify-between">
                  <span className="text-sm font-semibold text-foreground">Saldo</span>
                  <NetIndicator net={dashboard.currentMonth.net} currencyCode={currencyCode} />
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground py-4 text-center">Sem dados ainda.</p>
            )}
          </CardContent>
        </Card>

        {/* This Year */}
        <Card className="shadow-sm hover:shadow-md transition-all duration-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center justify-between">
              <span>Este Ano</span>
              {!dashLoading && dashboard && (
                <span className="text-xs font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                  {dashboard.currentYear.year}
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {dashLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-5 w-full" />
                <Skeleton className="h-5 w-full" />
                <Skeleton className="h-5 w-3/4" />
              </div>
            ) : dashboard ? (
              <>
                <div className="flex items-center justify-between py-2 rounded-lg hover:bg-muted/30 transition-colors -mx-1 px-1">
                  <span className="flex items-center gap-2 text-sm text-muted-foreground">
                    <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center">
                      <TrendingUp className="h-3 w-3 text-emerald-600" />
                    </div>
                    Receitas no Ano
                  </span>
                  <span className="font-bold text-sm text-emerald-600 tabular-nums">
                    +{formatAmount(dashboard.currentYear.income, currencyCode)}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2 rounded-lg hover:bg-muted/30 transition-colors -mx-1 px-1">
                  <span className="flex items-center gap-2 text-sm text-muted-foreground">
                    <div className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center">
                      <TrendingDown className="h-3 w-3 text-red-500" />
                    </div>
                    Despesas no Ano
                  </span>
                  <span className="font-bold text-sm text-red-500 tabular-nums">
                    −{formatAmount(dashboard.currentYear.expenses, currencyCode)}
                  </span>
                </div>
                <div className="pt-2 border-t flex items-center justify-between">
                  <span className="text-sm font-semibold text-foreground">Saldo no Ano</span>
                  <NetIndicator net={dashboard.currentYear.net} currencyCode={currencyCode} />
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground py-4 text-center">Sem dados ainda.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Monthly Trend Chart ───────────────────────────────────────────── */}
      <Card
        className="shadow-sm animate-in fade-in-0 slide-in-from-bottom-3 duration-500 fill-mode-both"
        style={{ animationDelay: "300ms" }}
      >
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center">
              <BarChart3 className="h-3.5 w-3.5 text-slate-600" />
            </div>
            Tendência Mensal
            <span className="text-xs font-normal text-muted-foreground ml-auto">
              {trendTitle}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {dashLoading ? (
            <div className="flex items-end gap-2 h-32 pt-2">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <Skeleton className="w-full rounded-t-sm" style={{ height: `${40 + Math.random() * 50}%` }} />
                  <Skeleton className="h-3 w-5" />
                </div>
              ))}
            </div>
          ) : dashboard && dashboard.monthlyTrend.length > 0 ? (
            <>
              <MonthlyBarChart data={dashboard.monthlyTrend} currencyCode={currencyCode} />
              <div className="flex items-center gap-5 mt-1">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <div className="w-3 h-3 rounded-sm bg-emerald-400" />
                  <span>Receitas</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <div className="w-3 h-3 rounded-sm bg-red-300" />
                  <span>Despesas</span>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mb-3">
                <BarChart3 className="h-7 w-7 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-foreground mb-1">Sem histórico de tendências</p>
              <p className="text-xs text-muted-foreground">
                As transações aparecerão aqui ao longo do tempo.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Category Breakdown ────────────────────────────────────────────── */}
      <Card
        className="shadow-sm animate-in fade-in-0 slide-in-from-bottom-3 duration-500 fill-mode-both"
        style={{ animationDelay: "360ms" }}
      >
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-rose-50 flex items-center justify-center">
              <Tag className="h-3.5 w-3.5 text-rose-500" />
            </div>
            Despesas por Categoria
            <span className="text-xs font-normal text-muted-foreground ml-auto">
              {filterLabel}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {dashLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="space-y-1.5">
                  <div className="flex justify-between">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                  <Skeleton className="h-2 w-full rounded-full" />
                </div>
              ))}
            </div>
          ) : dashboard && dashboard.categoryBreakdown.length > 0 ? (
            <CategoryDonut data={dashboard.categoryBreakdown} currencyCode={currencyCode} />
          ) : (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="w-14 h-14 rounded-2xl bg-rose-50 flex items-center justify-center mb-3">
                <Tag className="h-7 w-7 text-rose-300" />
              </div>
              <p className="text-sm font-medium text-foreground mb-1">Nenhuma despesa registrada</p>
              <p className="text-xs text-muted-foreground">
                As categorias aparecerão aqui conforme você lança despesas.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Orçamentos ───────────────────────────────────────────────────── */}
      {budgets && budgets.length > 0 && (
        <Card
          className="shadow-sm animate-in fade-in-0 slide-in-from-bottom-3 duration-500 fill-mode-both"
          style={{ animationDelay: "400ms" }}
        >
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-violet-50 flex items-center justify-center">
                <Target className="h-3.5 w-3.5 text-violet-500" />
              </div>
              Orçamentos do Mês
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {budgets.map((b, i) => {
              const over = b.pct >= 100;
              const near = b.pct >= 80 && b.pct < 100;
              return (
                <div
                  key={b.id}
                  className={`space-y-1.5 animate-in fade-in-0 duration-300 fill-mode-both stagger-${Math.min(i + 1, 8)}`}
                >
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-foreground truncate max-w-[55%] flex items-center gap-1.5">
                      {over && <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0" />}
                      {b.categoryName ?? "Categoria"}
                    </span>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={cn("text-xs font-semibold tabular-nums", over ? "text-red-500" : near ? "text-amber-500" : "text-muted-foreground")}>
                        {b.pct}%
                      </span>
                      <span className="font-bold tabular-nums text-foreground text-xs">
                        {formatAmount(b.spentCents / 100, currencyCode)} / {formatAmount(b.amountCents / 100, currencyCode)}
                      </span>
                    </div>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                    <div
                      className={cn("h-2 rounded-full transition-all duration-700", over ? "bg-red-500" : near ? "bg-amber-400" : "bg-violet-500")}
                      style={{ width: `${Math.min(b.pct, 100)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* ── Recent Transactions ───────────────────────────────────────────── */}
      <Card
        className="shadow-sm animate-in fade-in-0 slide-in-from-bottom-3 duration-500 fill-mode-both"
        style={{ animationDelay: "420ms" }}
      >
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <CardTitle className="text-base font-semibold">
            Transações Recentes
          </CardTitle>
          <Link
            href={`/${walletId}/transactions`}
            className="flex items-center gap-1 text-sm text-brand-primary hover:text-brand-primary/80 font-medium transition-colors group"
          >
            Ver todas
            <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 duration-150" />
          </Link>
        </CardHeader>
        <CardContent className="pt-0">
          {txLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 py-2">
                  <Skeleton className="w-10 h-10 rounded-xl flex-shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-28" />
                  </div>
                  <div className="space-y-1.5 text-right">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                </div>
              ))}
            </div>
          ) : !txData?.transactions?.length ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mb-3">
                <ArrowLeftRight className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-sm font-semibold text-foreground mb-1">
                Nenhuma transação ainda
              </p>
              <p className="text-xs text-muted-foreground">
                Crie sua primeira transação para começar.
              </p>
            </div>
          ) : (
            <div>
              {txData.transactions.map((tx, i) => (
                <TransactionRow key={tx.id} tx={tx} currencyCode={currencyCode} index={i} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Quick Actions ─────────────────────────────────────────────────── */}
      {canWrite && (
        <div
          className="flex flex-wrap items-center gap-3 animate-in fade-in-0 slide-in-from-bottom-2 duration-400 fill-mode-both"
          style={{ animationDelay: "480ms" }}
        >
          <Link href={`/${walletId}/transactions`}>
            <Button className="gap-2 min-h-10 bg-brand-primary hover:bg-brand-primary/90 shadow-sm shadow-brand-primary/25 transition-all hover:shadow-md hover:shadow-brand-primary/25">
              <Plus className="h-4 w-4" />
              Nova transação
            </Button>
          </Link>
          <Link href={`/${walletId}/cards`}>
            <Button variant="outline" className="gap-2 min-h-10 transition-all hover:shadow-sm">
              <CreditCard className="h-4 w-4" />
              Gerenciar cartões
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}
