"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Wallet, Users, Briefcase, ArrowRight, AlertCircle } from "lucide-react";
import { useWallets } from "@/lib/hooks/use-wallet";
import { useWalletStore } from "@/lib/stores/wallet-store";
import { cn, formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { WalletListItem } from "@/types/api";

const WALLET_TYPE_CONFIG: Record<string, { label: string; icon: React.ElementType; iconBg: string; iconColor: string }> = {
  personal: { label: "Pessoal", icon: Wallet, iconBg: "bg-brand-primary-50", iconColor: "text-brand-primary" },
  home: { label: "Casa", icon: Users, iconBg: "bg-blue-50", iconColor: "text-blue-600" },
  custom: { label: "Personalizado", icon: Wallet, iconBg: "bg-slate-100", iconColor: "text-slate-600" },
  business: { label: "Empresarial", icon: Briefcase, iconBg: "bg-orange-50", iconColor: "text-orange-600" },
  family: { label: "Família", icon: Users, iconBg: "bg-green-50", iconColor: "text-green-600" },
  project: { label: "Projeto", icon: Briefcase, iconBg: "bg-purple-50", iconColor: "text-purple-600" },
};

const ROLE_BADGE: Record<string, string> = {
  owner: "bg-purple-50 text-purple-700 border-purple-200",
  editor: "bg-blue-50 text-blue-700 border-blue-200",
  viewer: "bg-slate-100 text-slate-600 border-slate-200",
};

const ROLE_LABELS: Record<string, string> = {
  owner: "Proprietário",
  editor: "Editor",
  viewer: "Visualizador",
};

function WalletCard({ wallet, index }: { wallet: WalletListItem; index: number }) {
  const router = useRouter();
  const { setActiveWallet } = useWalletStore();
  const config = WALLET_TYPE_CONFIG[wallet.type] ?? WALLET_TYPE_CONFIG.personal;
  const Icon = config.icon;

  function handleOpen() {
    setActiveWallet(wallet.id);
    router.push(`/${wallet.id}`);
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleOpen}
      onKeyDown={(e) => e.key === "Enter" && handleOpen()}
      style={{ animationDelay: `${index * 60}ms` }}
      className={cn(
        "group cursor-pointer rounded-xl border border-neutral-border bg-white p-5",
        "shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200",
        "animate-in fade-in-0 slide-in-from-bottom-2 duration-300 fill-mode-both",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
      )}
    >
      {/* Top row: icon + role badge */}
      <div className="flex items-start justify-between mb-4">
        <div
          className={cn(
            "w-11 h-11 rounded-xl flex items-center justify-center shrink-0",
            config.iconBg
          )}
        >
          <Icon className={cn("h-5 w-5", config.iconColor)} />
        </div>
        {wallet.role && (
          <Badge
            variant="outline"
            className={cn("text-xs font-medium", ROLE_BADGE[wallet.role] ?? ROLE_BADGE.viewer)}
          >
            {ROLE_LABELS[wallet.role] ?? wallet.role}
          </Badge>
        )}
      </div>

      {/* Name */}
      <p className="text-base font-semibold text-foreground leading-tight mb-0.5">
        {wallet.name}
      </p>
      <p className="text-xs text-muted-foreground mb-4">
        Criada em {new Date(wallet.createdAt).toLocaleDateString("pt-BR")}
      </p>

      {/* Footer */}
      <div className="flex items-center justify-between pt-3 border-t border-neutral-border">
        <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors duration-150">
          Abrir carteira
        </span>
        <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-brand-primary group-hover:translate-x-0.5 transition-all duration-150" />
      </div>
    </div>
  );
}

function WalletCardSkeleton() {
  return (
    <div className="rounded-xl border border-neutral-border bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between mb-4">
        <Skeleton className="w-11 h-11 rounded-xl" />
        <Skeleton className="h-5 w-20" />
      </div>
      <Skeleton className="h-5 w-40 mb-1.5" />
      <Skeleton className="h-4 w-28 mb-4" />
      <div className="pt-3 border-t border-neutral-border">
        <Skeleton className="h-4 w-24" />
      </div>
    </div>
  );
}

export default function WalletsPage() {
  const { data: wallets, isLoading, isError } = useWallets();

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      {/* Cabeçalho */}
      <div
        className="flex items-center justify-between mb-6 md:mb-8 flex-wrap gap-3
          animate-in fade-in-0 slide-in-from-top-2 duration-400 fill-mode-both"
      >
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
            Minhas Carteiras
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Gerencie suas carteiras financeiras
          </p>
        </div>
        <Button
          asChild
          className="bg-brand-primary hover:bg-brand-primary/90 shadow-sm shadow-brand-primary/20
            hover:shadow-md transition-all duration-200 gap-2"
        >
          <Link href="/wallets/new">
            <Plus className="h-4 w-4" />
            Nova carteira
          </Link>
        </Button>
      </div>

      {/* Grade de carteiras */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <WalletCardSkeleton key={i} />
          ))}
        </div>
      ) : isError ? (
        <div
          className="flex flex-col items-center justify-center py-20 text-center px-4
            animate-in fade-in-0 duration-300 fill-mode-both"
        >
          <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center mb-4">
            <AlertCircle className="h-8 w-8 text-red-400" />
          </div>
          <p className="text-foreground font-medium mb-1">Erro ao carregar carteiras</p>
          <p className="text-muted-foreground text-sm mb-5">Não foi possível carregar as carteiras.</p>
          <Button variant="outline" onClick={() => window.location.reload()}>
            Tentar novamente
          </Button>
        </div>
      ) : wallets && wallets.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {wallets.map((wallet, i) => (
            <WalletCard key={wallet.id} wallet={wallet} index={i} />
          ))}
        </div>
      ) : (
        /* Estado vazio */
        <div
          className="flex flex-col items-center justify-center py-24 text-center px-4
            animate-in fade-in-0 duration-500 fill-mode-both"
        >
          <div className="w-20 h-20 rounded-3xl bg-brand-primary-50 flex items-center justify-center mb-5 shadow-inner">
            <Wallet className="h-10 w-10 text-brand-primary" />
          </div>
          <h2 className="text-xl font-bold text-foreground mb-2">
            Nenhuma carteira ainda
          </h2>
          <p className="text-muted-foreground mb-6 max-w-sm text-sm">
            Crie sua primeira carteira para começar a controlar suas finanças.
          </p>
          <Button
            asChild
            className="bg-brand-primary hover:bg-brand-primary/90 gap-2 shadow-sm shadow-brand-primary/20"
          >
            <Link href="/wallets/new">
              <Plus className="h-4 w-4" />
              Criar carteira
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
}
