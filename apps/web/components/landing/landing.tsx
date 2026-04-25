"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type PropsWithChildren } from "react";
import { ArrowUpRight, Plus, Minus } from "lucide-react";

// ─── Reveal hook ──────────────────────────────────────────────────────────────

function useInView<T extends Element>() {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          obs.disconnect();
        }
      },
      { rootMargin: "0px 0px -12% 0px", threshold: 0.05 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return [ref, inView] as const;
}

function Reveal({
  children,
  delay = 0,
  y = 28,
  className = "",
}: PropsWithChildren<{ delay?: number; y?: number; className?: string }>) {
  const [ref, inView] = useInView<HTMLDivElement>();
  return (
    <div
      ref={ref}
      className={className}
      style={{
        transition:
          "transform 1000ms cubic-bezier(0.2,0.8,0.2,1), opacity 1000ms cubic-bezier(0.2,0.8,0.2,1), filter 1000ms cubic-bezier(0.2,0.8,0.2,1)",
        transitionDelay: `${delay}ms`,
        opacity: inView ? 1 : 0,
        transform: inView ? "translateY(0)" : `translateY(${y}px)`,
        filter: inView ? "blur(0)" : "blur(6px)",
      }}
    >
      {children}
    </div>
  );
}

// ─── Hairline ─────────────────────────────────────────────────────────────────

function Rule({ className = "" }: { className?: string }) {
  const [ref, inView] = useInView<HTMLDivElement>();
  return (
    <div
      ref={ref}
      className={`h-px w-full origin-left bg-[var(--rule)] ${className}`}
      style={{
        transform: inView ? "scaleX(1)" : "scaleX(0)",
        transition: "transform 1200ms cubic-bezier(0.7,0,0.2,1)",
      }}
    />
  );
}

// ─── Ticker ───────────────────────────────────────────────────────────────────

function Ticker() {
  const items = [
    "№ 01 — Whalet — Edição 2026",
    "BRL  R$ 12.540,50",
    "CONFIRMADO ✦ PROJETADO",
    "Receita  +R$ 8.400",
    "Despesa  −R$ 5.180",
    "Saldo  +R$ 3.220",
    "Fatura — fecha dia 05",
  ];
  const all = [...items, ...items, ...items];
  return (
    <div className="border-b border-[var(--rule)] overflow-hidden bg-[var(--cream)] select-none">
      <div
        className="flex gap-10 whitespace-nowrap py-2.5 text-[11px] tracking-[0.2em] uppercase text-[var(--ink)]/70"
        style={{
          fontFamily: "var(--font-mono)",
          animation: "marquee 48s linear infinite",
        }}
      >
        {all.map((x, i) => (
          <span key={i} className="shrink-0 flex items-center gap-10">
            {x}
            <span className="text-[var(--accent)]">✦</span>
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Nav ──────────────────────────────────────────────────────────────────────

function Nav() {
  return (
    <header className="sticky top-0 z-40 border-b border-[var(--rule)] bg-[var(--cream)]/85 backdrop-blur-md">
      <div className="max-w-[1280px] mx-auto px-6 sm:px-10 h-16 flex items-center justify-between">
        <Link
          href="/"
          aria-label="Whalet"
          className="text-[var(--ink)] font-black tracking-[-0.02em] text-xl"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Whalet<span className="text-[var(--accent)]">.</span>
        </Link>

        <nav
          className="hidden md:flex items-center gap-9 text-[13px] text-[var(--ink)]/70"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          <AnchorLink href="#features">I — Recursos</AnchorLink>
          <AnchorLink href="#preview">II — Em Ação</AnchorLink>
          <AnchorLink href="#how">III — Método</AnchorLink>
          <AnchorLink href="#faq">IV — FAQ</AnchorLink>
        </nav>

        <Link
          href="/login"
          className="group inline-flex items-center gap-2 bg-[var(--ink)] text-[var(--cream)] px-4 py-2 text-[13px] font-medium tracking-wide transition-transform duration-300 hover:-translate-y-0.5"
          style={{ fontFamily: "var(--font-body)" }}
        >
          Começar grátis
          <ArrowUpRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:rotate-45" />
        </Link>
      </div>
    </header>
  );
}

function AnchorLink({ href, children }: PropsWithChildren<{ href: string }>) {
  return (
    <a
      href={href}
      className="relative group inline-block py-0.5"
    >
      <span className="transition-colors group-hover:text-[var(--ink)]">{children}</span>
      <span
        className="absolute left-0 -bottom-0.5 h-px w-full origin-right scale-x-0 bg-[var(--accent)] transition-transform duration-500 ease-out group-hover:origin-left group-hover:scale-x-100"
        aria-hidden
      />
    </a>
  );
}

// ─── Animated headline ────────────────────────────────────────────────────────

type WordSpec = { text: string; italic?: boolean; accent?: boolean; nowrap?: boolean };

function HeroHeadline({ rows }: { rows: WordSpec[][] }) {
  let idx = 0;
  return (
    <h1
      className="text-[clamp(2.75rem,7vw,5.75rem)] leading-[0.98] tracking-[-0.02em] text-[var(--ink)]"
      style={{ fontFamily: "var(--font-display)", fontWeight: 500 }}
    >
      {rows.map((row, r) => (
        <span key={r} className="block">
          {row.map((w, i) => {
            const myIdx = idx++;
            return (
              <span
                key={i}
                className="inline-block overflow-hidden align-bottom"
              >
                <span
                  className={[
                    "inline-block",
                    w.italic ? "italic" : "",
                    w.accent ? "text-[var(--accent)]" : "",
                  ].join(" ")}
                  style={{
                    fontWeight: w.italic ? 400 : 500,
                    animation: `wordIn 1100ms cubic-bezier(0.2,0.8,0.2,1) ${80 + myIdx * 80}ms both`,
                  }}
                >
                  {w.text}
                </span>
                {i < row.length - 1 && <span>&nbsp;</span>}
              </span>
            );
          })}
        </span>
      ))}
    </h1>
  );
}

// ─── Hero ─────────────────────────────────────────────────────────────────────

function Hero() {
  return (
    <section className="relative">
      <div className="max-w-[1280px] mx-auto px-6 sm:px-10 pt-14 sm:pt-20 pb-16 sm:pb-24">
        <div
          className="flex items-baseline gap-4 text-[11px] tracking-[0.3em] uppercase text-[var(--ink)]/60 mb-10"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          <span
            className="inline-block w-6 h-px bg-[var(--ink)]/60 origin-left"
            style={{ animation: "grow 900ms cubic-bezier(0.7,0,0.2,1) both" }}
          />
          <span style={{ animation: "fadeIn 900ms ease-out 200ms both" }}>
            № 01 — Manifesto
          </span>
          <span className="ml-auto hidden sm:inline" style={{ animation: "fadeIn 900ms ease-out 400ms both" }}>
            Abril · MMXXVI
          </span>
        </div>

        <div className="grid grid-cols-12 gap-6 sm:gap-8 items-start">
          <div className="col-span-12 lg:col-span-8">
            <HeroHeadline
              rows={[
                [{ text: "Toda" }, { text: "a" }, { text: "verdade" }],
                [{ text: "sobre" }, { text: "o" }, { text: "seu" }, { text: "dinheiro" }, { text: "—", accent: true }],
                [{ text: "em", italic: true }, { text: "uma", italic: true }, { text: "só", italic: true }, { text: "página.", italic: true, accent: true }],
              ]}
            />
          </div>

          <div className="col-span-12 lg:col-span-4 lg:pt-10">
            <div
              className="relative pl-5 border-l border-[var(--ink)]"
              style={{ animation: "fadeIn 1000ms ease-out 900ms both" }}
            >
              <p
                className="text-[15px] sm:text-base leading-[1.55] text-[var(--ink)]/85"
                style={{ fontFamily: "var(--font-body)" }}
              >
                Carteiras, cartões, faturas, recorrências, orçamentos. O saldo{" "}
                <span className="italic" style={{ fontFamily: "var(--font-display)" }}>confirmado</span>{" "}
                e o{" "}
                <span className="italic" style={{ fontFamily: "var(--font-display)" }}>projetado</span>{" "}
                — sempre no mesmo lugar, sempre honestos.
              </p>

              <div className="mt-7 flex items-center gap-4">
                <Link
                  href="/login"
                  className="group relative inline-flex items-center gap-2 bg-[var(--ink)] text-[var(--cream)] px-5 py-3 text-sm font-medium overflow-hidden"
                  style={{ fontFamily: "var(--font-body)" }}
                >
                  <span className="relative z-10 transition-transform duration-500 group-hover:-translate-x-0.5">
                    Abrir minha conta
                  </span>
                  <ArrowUpRight className="relative z-10 h-4 w-4 transition-transform duration-500 group-hover:rotate-45 group-hover:translate-x-0.5" />
                  <span
                    className="absolute inset-0 bg-[var(--accent)] origin-bottom scale-y-0 transition-transform duration-[600ms] ease-[cubic-bezier(0.7,0,0.2,1)] group-hover:scale-y-100"
                    aria-hidden
                  />
                </Link>
              </div>

              <p
                className="mt-5 text-[11px] tracking-[0.2em] uppercase text-[var(--ink)]/50"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                Sem cartão · Sem amarração · Em pt-BR
              </p>
            </div>
          </div>
        </div>

        {/* Floating accent mark */}
        <div
          aria-hidden
          className="pointer-events-none absolute top-24 right-8 sm:right-16 text-[var(--accent)]/90"
          style={{
            animation: "spin 24s linear infinite, fadeIn 1500ms ease-out 400ms both",
          }}
        >
          <svg width="88" height="88" viewBox="0 0 100 100" fill="none">
            <g stroke="currentColor" strokeWidth="1" strokeLinecap="round">
              <circle cx="50" cy="50" r="48" />
              <path d="M50 2 L50 98 M2 50 L98 50 M14.6 14.6 L85.4 85.4 M85.4 14.6 L14.6 85.4" strokeDasharray="2 4" opacity="0.5" />
            </g>
          </svg>
        </div>
      </div>

      <Rule />
    </section>
  );
}

// ─── Features (editorial index) ───────────────────────────────────────────────

const FEATURES: { n: string; title: string; body: string; aside: string }[] = [
  {
    n: "I",
    title: "Múltiplas carteiras, sem zona cinza.",
    body: "Pessoal, família, empresa, projeto paralelo. Cada carteira com saldo, membros e contexto próprios — e um ledger que não se mistura.",
    aside: "pessoal · casa · trabalho",
  },
  {
    n: "II",
    title: "Cartões e faturas, do jeito que deveriam ser.",
    body: "Compras parceladas agrupadas automaticamente na fatura certa, com base no dia de fechamento do seu cartão. Nada de planilha auxiliar.",
    aside: "Fecha → Próximo ciclo",
  },
  {
    n: "III",
    title: "Orçamentos que avisam antes.",
    body: "Defina o teto mensal por categoria. Te alertamos aos 80%, marcamos em vermelho aos 100%. Sem surpresa no fim do mês.",
    aside: "80% · 100% · stop.",
  },
  {
    n: "IV",
    title: "Confirmado. Projetado. Os dois.",
    body: "Troque de visão com um toque. Veja o que já caiu na conta ou o que ainda vai cair — e a diferença entre os dois saldos.",
    aside: "um toque, duas verdades",
  },
  {
    n: "V",
    title: "Recorrências que se cuidam sozinhas.",
    body: "Salário, aluguel, Netflix. Define uma vez, aparece sempre que deveria aparecer — até a data final que você escolher.",
    aside: "set & forget",
  },
  {
    n: "VI",
    title: "Compartilhe sem abrir mão do controle.",
    body: "Convide como editor ou apenas visualizador. O proprietário decide quem muda o quê e quem só acompanha.",
    aside: "owner · editor · viewer",
  },
];

function FeaturesIndex() {
  return (
    <section id="features" className="relative">
      <div className="max-w-[1280px] mx-auto px-6 sm:px-10 py-20 sm:py-28">
        <Reveal>
          <div
            className="flex items-baseline gap-4 text-[11px] tracking-[0.3em] uppercase text-[var(--ink)]/60 mb-8"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            <span className="inline-block w-6 h-px bg-[var(--ink)]/60" />
            <span>№ 02 — Recursos</span>
          </div>
        </Reveal>

        <Reveal delay={100}>
          <h2
            className="text-[clamp(2rem,4.5vw,3.5rem)] leading-[1] tracking-[-0.02em] text-[var(--ink)] max-w-3xl mb-14"
            style={{ fontFamily: "var(--font-display)", fontWeight: 500 }}
          >
            Pensado para quem lê o extrato de cabo a rabo —{" "}
            <span className="italic text-[var(--accent)]">e também</span> para quem prefere não ler.
          </h2>
        </Reveal>

        <Rule />

        <div className="divide-y divide-[var(--rule)]">
          {FEATURES.map((f, i) => (
            <FeatureRow key={f.n} f={f} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}

function FeatureRow({ f, index }: { f: (typeof FEATURES)[number]; index: number }) {
  const [ref, inView] = useInView<HTMLDivElement>();
  return (
    <div
      ref={ref}
      className="group grid grid-cols-12 gap-4 sm:gap-8 py-8 sm:py-10 transition-colors hover:bg-[var(--ink)]/[0.015]"
    >
      <div className="col-span-2 sm:col-span-1">
        <span
          className="block text-[var(--ink)]/30 tracking-[-0.02em]"
          style={{
            fontFamily: "var(--font-display)",
            fontStyle: "italic",
            fontWeight: 400,
            fontSize: "clamp(1.75rem, 3vw, 2.25rem)",
            lineHeight: 1,
            transition: "transform 800ms cubic-bezier(0.2,0.8,0.2,1), opacity 800ms ease-out, color 400ms",
            transitionDelay: `${index * 60}ms`,
            transform: inView ? "translateX(0)" : "translateX(-12px)",
            opacity: inView ? 1 : 0,
          }}
        >
          №{f.n}
        </span>
      </div>

      <div className="col-span-10 sm:col-span-6">
        <h3
          className="text-[var(--ink)] tracking-[-0.01em] transition-colors"
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 500,
            fontSize: "clamp(1.25rem, 2vw, 1.75rem)",
            lineHeight: 1.15,
            transition: "transform 800ms cubic-bezier(0.2,0.8,0.2,1) 60ms, opacity 800ms ease-out 60ms",
            transitionDelay: `${60 + index * 60}ms`,
            transform: inView ? "translateY(0)" : "translateY(16px)",
            opacity: inView ? 1 : 0,
          }}
        >
          {f.title}
        </h3>
        <p
          className="mt-2 text-[15px] leading-[1.6] text-[var(--ink)]/75 max-w-xl"
          style={{
            fontFamily: "var(--font-body)",
            transition: "transform 800ms cubic-bezier(0.2,0.8,0.2,1) 120ms, opacity 800ms ease-out 120ms",
            transitionDelay: `${120 + index * 60}ms`,
            transform: inView ? "translateY(0)" : "translateY(16px)",
            opacity: inView ? 1 : 0,
          }}
        >
          {f.body}
        </p>
      </div>

      <div className="col-span-12 sm:col-span-5 sm:text-right">
        <span
          className="inline-block text-[11px] tracking-[0.25em] uppercase text-[var(--ink)]/50"
          style={{
            fontFamily: "var(--font-mono)",
            transition: "transform 800ms cubic-bezier(0.2,0.8,0.2,1) 180ms, opacity 800ms ease-out 180ms",
            transitionDelay: `${180 + index * 60}ms`,
            transform: inView ? "translateY(0)" : "translateY(16px)",
            opacity: inView ? 1 : 0,
          }}
        >
          {f.aside}
        </span>
      </div>
    </div>
  );
}

// ─── Preview ──────────────────────────────────────────────────────────────────

const formatBRL = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);

function Preview() {
  return (
    <section id="preview" className="relative">
      <div className="max-w-[1280px] mx-auto px-6 sm:px-10 py-20 sm:py-28">
        <Reveal>
          <div
            className="flex items-baseline gap-4 text-[11px] tracking-[0.3em] uppercase text-[var(--ink)]/60 mb-8"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            <span className="inline-block w-6 h-px bg-[var(--ink)]/60" />
            <span>№ 03 — Em Ação</span>
          </div>
        </Reveal>

        <div className="grid grid-cols-12 gap-6 sm:gap-8 items-start">
          <Reveal delay={80} className="col-span-12 lg:col-span-5">
            <h2
              className="text-[clamp(1.75rem,3vw,2.75rem)] leading-[1.05] tracking-[-0.02em] text-[var(--ink)]"
              style={{ fontFamily: "var(--font-display)", fontWeight: 500 }}
            >
              Do <span className="italic text-[var(--accent)]">confirmado</span> ao{" "}
              <span className="italic">projetado</span>, num toque.
            </h2>
            <p
              className="mt-4 text-[15px] leading-[1.6] text-[var(--ink)]/75 max-w-md"
              style={{ fontFamily: "var(--font-body)" }}
            >
              Alterne a visão do painel para ver apenas o que já caiu — ou tudo que está por vir. A diferença entre os dois saldos conta uma história, e a gente te ajuda a lê-la.
            </p>
            <div
              className="mt-8 text-[11px] tracking-[0.25em] uppercase text-[var(--ink)]/60 flex items-center gap-3"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              <span className="inline-block w-10 h-px bg-[var(--ink)]/30" />
              Captura real do painel
            </div>
          </Reveal>

          <Reveal delay={160} className="col-span-12 lg:col-span-7">
            <PreviewFrame />
          </Reveal>
        </div>
      </div>

      <Rule />
    </section>
  );
}

function PreviewFrame() {
  return (
    <div
      className="relative"
      style={{
        animation: "slowTilt 14s ease-in-out infinite",
      }}
    >
      {/* Paper card */}
      <div className="relative bg-white border border-[var(--rule)] shadow-[0_30px_60px_-30px_rgba(17,19,25,0.25),0_10px_20px_-10px_rgba(17,19,25,0.08)] overflow-hidden">
        <div
          className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--rule)]"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          <span className="text-[10px] tracking-[0.25em] uppercase text-[var(--ink)]/50">
            whalet · carteira pessoal
          </span>
          <span className="text-[10px] tracking-[0.2em] uppercase text-[var(--ink)]/40">
            Abr · 2026
          </span>
        </div>

        <div className="p-5 sm:p-6 grid grid-cols-2 gap-4">
          <MockStat label="Saldo Confirmado" value={formatBRL(12540.5)} hint="Apenas transações pagas" />
          <MockStat label="Saldo Projetado" value={formatBRL(9820.1)} hint="Pendentes + faturas" />

          <div className="col-span-2 border border-[var(--rule)] p-4 bg-[var(--cream)]/50">
            <div className="flex items-center justify-between mb-3">
              <span
                className="text-[11px] tracking-[0.2em] uppercase text-[var(--ink)]/60"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                Abril — Resumo
              </span>
              <div
                className="inline-flex items-center gap-1 border border-[var(--ink)]/20 p-0.5 text-[10px]"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                <span className="px-2 py-0.5 bg-[var(--ink)] text-[var(--cream)] tracking-[0.15em] uppercase">
                  Proj.
                </span>
                <span className="px-2 py-0.5 tracking-[0.15em] uppercase text-[var(--ink)]/60">
                  Conf.
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <LedgerRow label="Receitas" amount={`+${formatBRL(8400)}`} positive />
              <LedgerRow label="Despesas" amount={`−${formatBRL(5180)}`} />
              <div className="pt-2 border-t border-[var(--rule)] flex items-center justify-between">
                <span
                  className="text-[13px] text-[var(--ink)]"
                  style={{ fontFamily: "var(--font-body)", fontWeight: 500 }}
                >
                  Saldo
                </span>
                <span
                  className="text-[14px] text-[var(--accent)]"
                  style={{ fontFamily: "var(--font-mono)", fontWeight: 500 }}
                >
                  +{formatBRL(3220)}
                </span>
              </div>
            </div>
          </div>

          <div className="col-span-2 border border-[var(--rule)] p-4">
            <span
              className="text-[11px] tracking-[0.2em] uppercase text-[var(--ink)]/60"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              Tendência · 12 meses
            </span>
            <div className="mt-3 flex items-end gap-1.5 h-24">
              {[42, 55, 63, 50, 70, 78, 60, 72, 88, 82, 65, 75].map((h, i) => (
                <div
                  key={i}
                  className="flex-1 flex flex-col justify-end gap-[2px]"
                  style={{ animation: `barGrow 700ms cubic-bezier(0.2,0.8,0.2,1) ${i * 50}ms both` }}
                >
                  <div className="bg-[var(--ink)]" style={{ height: `${h * 0.5}%` }} />
                  <div className="bg-[var(--accent)]" style={{ height: `${h * 0.3}%` }} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Decorative stamp */}
      <div
        aria-hidden
        className="absolute -top-4 -right-4 sm:-top-6 sm:-right-6 pointer-events-none"
        style={{ animation: "stampIn 900ms cubic-bezier(0.2,0.8,0.2,1) 800ms both" }}
      >
        <div
          className="w-24 h-24 sm:w-28 sm:h-28 rounded-full border-2 border-[var(--accent)] flex items-center justify-center bg-[var(--cream)] rotate-[-12deg] shadow-sm"
        >
          <div
            className="text-center text-[var(--accent)]"
            style={{ fontFamily: "var(--font-display)", fontStyle: "italic" }}
          >
            <div className="text-[10px] tracking-[0.2em] uppercase" style={{ fontFamily: "var(--font-mono)" }}>
              Preview
            </div>
            <div className="text-[20px] font-bold leading-none mt-0.5">real</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MockStat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="border border-[var(--rule)] p-4">
      <div
        className="text-[11px] tracking-[0.2em] uppercase text-[var(--ink)]/60 mb-1.5"
        style={{ fontFamily: "var(--font-mono)" }}
      >
        {label}
      </div>
      <div
        className="text-[22px] tracking-tight text-[var(--ink)]"
        style={{ fontFamily: "var(--font-display)", fontWeight: 500 }}
      >
        {value}
      </div>
      <div
        className="text-[11px] text-[var(--ink)]/50 mt-1"
        style={{ fontFamily: "var(--font-body)" }}
      >
        {hint}
      </div>
    </div>
  );
}

function LedgerRow({
  label,
  amount,
  positive,
}: {
  label: string;
  amount: string;
  positive?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span
        className="text-[13px] text-[var(--ink)]/70"
        style={{ fontFamily: "var(--font-body)" }}
      >
        {label}
      </span>
      <span
        className={`text-[14px] tabular-nums ${positive ? "text-[var(--ink)]" : "text-[var(--ink)]"}`}
        style={{ fontFamily: "var(--font-mono)", fontWeight: 500 }}
      >
        {amount}
      </span>
    </div>
  );
}

// ─── Three Acts (How it works) ────────────────────────────────────────────────

const ACTS = [
  {
    n: "I",
    title: "Abra o ledger.",
    body: "Crie sua primeira carteira — pessoal, casa, trabalho. Defina saldo inicial, membros e estrutura. Um minuto.",
  },
  {
    n: "II",
    title: "Conte a história.",
    body: "Cada entrada e saída vira um registro. Recorrências se repetem sozinhas. Cartões se agrupam em faturas.",
  },
  {
    n: "III",
    title: "Leia a sua própria história.",
    body: "O painel te mostra o confirmado, o projetado, o que cabe no orçamento e o que não cabe. Você decide o próximo capítulo.",
  },
];

function ThreeActs() {
  return (
    <section id="how" className="relative">
      <div className="max-w-[1280px] mx-auto px-6 sm:px-10 py-20 sm:py-28">
        <Reveal>
          <div
            className="flex items-baseline gap-4 text-[11px] tracking-[0.3em] uppercase text-[var(--ink)]/60 mb-8"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            <span className="inline-block w-6 h-px bg-[var(--ink)]/60" />
            <span>№ 04 — Método</span>
          </div>
        </Reveal>

        <Reveal delay={80}>
          <h2
            className="text-[clamp(1.75rem,3vw,2.75rem)] leading-[1.05] tracking-[-0.02em] text-[var(--ink)] max-w-2xl mb-14"
            style={{ fontFamily: "var(--font-display)", fontWeight: 500 }}
          >
            Três atos, nenhum drama.
          </h2>
        </Reveal>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-4">
          {ACTS.map((a, i) => (
            <ActCard key={a.n} act={a} index={i} />
          ))}
        </div>
      </div>

      <Rule />
    </section>
  );
}

function ActCard({ act, index }: { act: (typeof ACTS)[number]; index: number }) {
  const [ref, inView] = useInView<HTMLDivElement>();
  return (
    <div
      ref={ref}
      className="group relative md:border-r md:last:border-r-0 md:border-[var(--rule)] md:pr-6 md:[&:not(:first-child)]:pl-6"
      style={{
        transition: "transform 900ms cubic-bezier(0.2,0.8,0.2,1), opacity 900ms ease-out",
        transitionDelay: `${index * 120}ms`,
        transform: inView ? "translateY(0)" : "translateY(24px)",
        opacity: inView ? 1 : 0,
      }}
    >
      <div
        className="text-[var(--accent)] leading-none mb-4 transition-transform duration-500 group-hover:-translate-y-1"
        style={{
          fontFamily: "var(--font-display)",
          fontStyle: "italic",
          fontWeight: 400,
          fontSize: "clamp(3rem, 6vw, 5rem)",
        }}
      >
        Ato {act.n}
      </div>
      <h3
        className="text-[var(--ink)] mb-2 tracking-[-0.01em]"
        style={{
          fontFamily: "var(--font-display)",
          fontWeight: 500,
          fontSize: "clamp(1.125rem, 1.5vw, 1.375rem)",
        }}
      >
        {act.title}
      </h3>
      <p
        className="text-[14px] leading-[1.6] text-[var(--ink)]/75 max-w-[28ch]"
        style={{ fontFamily: "var(--font-body)" }}
      >
        {act.body}
      </p>
    </div>
  );
}

// ─── FAQ ──────────────────────────────────────────────────────────────────────

const FAQS = [
  {
    q: "É gratuito?",
    a: "É. Para uso pessoal você começa sem custo e sem cartão. Se um dia virar útil demais pra você, a gente conversa.",
  },
  {
    q: "Meus dados estão seguros?",
    a: "Autenticação por OTP no e-mail, tokens assinados, autorização validada pelo servidor em toda requisição. Seus dados ficam isolados por carteira — sem rede social, sem anúncio.",
  },
  {
    q: "Serve para organizar mais de uma carteira?",
    a: "Serve. Você pode separar vida pessoal, casa, trabalho ou projetos em carteiras diferentes, com membros e histórico próprios.",
  },
  {
    q: "Dá pra compartilhar com a família?",
    a: "Dá. Convide como editor (registra transações) ou viewer (só lê). O dono da carteira mantém o controle de quem muda o quê.",
  },
];

function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section id="faq" className="relative">
      <div className="max-w-[1280px] mx-auto px-6 sm:px-10 py-20 sm:py-28 grid grid-cols-12 gap-6 sm:gap-8">
        <div className="col-span-12 lg:col-span-4">
          <Reveal>
            <div
              className="flex items-baseline gap-4 text-[11px] tracking-[0.3em] uppercase text-[var(--ink)]/60 mb-8"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              <span className="inline-block w-6 h-px bg-[var(--ink)]/60" />
              <span>№ 05 — FAQ</span>
            </div>
          </Reveal>
          <Reveal delay={80}>
            <h2
              className="text-[clamp(1.75rem,3vw,2.75rem)] leading-[1.05] tracking-[-0.02em] text-[var(--ink)]"
              style={{ fontFamily: "var(--font-display)", fontWeight: 500 }}
            >
              Perguntas<br />
              <span className="italic text-[var(--accent)]">honestas</span>.
            </h2>
          </Reveal>
        </div>

        <div className="col-span-12 lg:col-span-8">
          <Rule />
          <div>
            {FAQS.map((item, i) => {
              const isOpen = open === i;
              return (
                <FaqRow
                  key={i}
                  item={item}
                  isOpen={isOpen}
                  onToggle={() => setOpen(isOpen ? null : i)}
                  index={i}
                />
              );
            })}
          </div>
        </div>
      </div>

      <Rule />
    </section>
  );
}

function FaqRow({
  item,
  isOpen,
  onToggle,
  index,
}: {
  item: { q: string; a: string };
  isOpen: boolean;
  onToggle: () => void;
  index: number;
}) {
  const [ref, inView] = useInView<HTMLDivElement>();
  return (
    <div
      ref={ref}
      className="border-b border-[var(--rule)]"
      style={{
        transition: "transform 700ms cubic-bezier(0.2,0.8,0.2,1), opacity 700ms ease-out",
        transitionDelay: `${index * 80}ms`,
        transform: inView ? "translateY(0)" : "translateY(16px)",
        opacity: inView ? 1 : 0,
      }}
    >
      <button
        onClick={onToggle}
        className="group w-full flex items-start justify-between gap-6 py-6 text-left"
        aria-expanded={isOpen}
      >
        <span
          className="text-[clamp(1.125rem,1.75vw,1.5rem)] tracking-[-0.01em] text-[var(--ink)] leading-[1.2]"
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 500,
            fontStyle: isOpen ? "italic" : "normal",
            transition: "font-style 400ms",
          }}
        >
          {item.q}
        </span>
        <span
          className="mt-1 shrink-0 w-8 h-8 border border-[var(--ink)]/30 flex items-center justify-center transition-all duration-500 group-hover:bg-[var(--ink)] group-hover:text-[var(--cream)] group-hover:border-[var(--ink)]"
          aria-hidden
        >
          <span
            className="transition-transform duration-500"
            style={{ transform: isOpen ? "rotate(180deg)" : "rotate(0)" }}
          >
            {isOpen ? <Minus className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
          </span>
        </span>
      </button>
      <div
        className="grid transition-all duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)]"
        style={{
          gridTemplateRows: isOpen ? "1fr" : "0fr",
          opacity: isOpen ? 1 : 0,
        }}
      >
        <div className="overflow-hidden">
          <p
            className="pb-6 pr-12 text-[15px] leading-[1.65] text-[var(--ink)]/80 max-w-2xl"
            style={{ fontFamily: "var(--font-body)" }}
          >
            {item.a}
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Final CTA ────────────────────────────────────────────────────────────────

function FinalCta() {
  return (
    <section className="relative">
      <div className="max-w-[1280px] mx-auto px-6 sm:px-10 py-24 sm:py-36 text-center">
        <Reveal>
          <div
            className="text-[11px] tracking-[0.3em] uppercase text-[var(--ink)]/60 mb-10"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            № 06 — Convite
          </div>
        </Reveal>

        <Reveal delay={60} y={40}>
          <h2
            className="text-[clamp(2.5rem,8vw,6.5rem)] leading-[0.95] tracking-[-0.03em] text-[var(--ink)]"
            style={{ fontFamily: "var(--font-display)", fontWeight: 500 }}
          >
            Está na hora de{" "}
            <span className="italic text-[var(--accent)]">abrir</span>{" "}
            o livro.
          </h2>
        </Reveal>

        <Reveal delay={180}>
          <Link
            href="/login"
            className="group mt-12 inline-flex items-center gap-3 bg-[var(--ink)] text-[var(--cream)] px-7 py-4 text-[15px] overflow-hidden relative"
            style={{ fontFamily: "var(--font-body)", fontWeight: 500 }}
          >
            <span className="relative z-10">Começar grátis</span>
            <ArrowUpRight className="relative z-10 h-4 w-4 transition-transform duration-500 group-hover:rotate-45" />
            <span
              className="absolute inset-0 bg-[var(--accent)] origin-left scale-x-0 transition-transform duration-[700ms] ease-[cubic-bezier(0.7,0,0.2,1)] group-hover:scale-x-100"
              aria-hidden
            />
          </Link>
        </Reveal>

        <Reveal delay={280}>
          <p
            className="mt-6 text-[11px] tracking-[0.25em] uppercase text-[var(--ink)]/50"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            Sem cartão · Em menos de um minuto
          </p>
        </Reveal>
      </div>
    </section>
  );
}

// ─── Footer ───────────────────────────────────────────────────────────────────

function Footer() {
  return (
    <footer className="border-t border-[var(--rule)]">
      <div className="max-w-[1280px] mx-auto px-6 sm:px-10 py-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span
            className="text-[var(--ink)] font-black tracking-[-0.02em] text-lg"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Whalet<span className="text-[var(--accent)]">.</span>
          </span>
          <span
            className="text-[10px] tracking-[0.2em] uppercase text-[var(--ink)]/50"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            © MMXXVI — Todos os direitos reservados
          </span>
        </div>
        <div
          className="flex items-center gap-6 text-[11px] tracking-[0.2em] uppercase text-[var(--ink)]/60"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          <span>pt-BR</span>
          <span>Feito à mão</span>
        </div>
      </div>
    </footer>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export function Landing() {
  return (
    <>
      <style>{`
        :root {
          --cream: #ffffff;
          --ink: #0f172a;
          --ink-soft: #475569;
          --rule: #dbe7f5;
          --accent: #1e72db;
        }

        @keyframes marquee {
          from { transform: translateX(0); }
          to { transform: translateX(-33.3333%); }
        }

        @keyframes wordIn {
          from { transform: translateY(100%) rotate(3deg); opacity: 0; }
          to { transform: translateY(0) rotate(0); opacity: 1; }
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes grow {
          from { transform: scaleX(0); }
          to { transform: scaleX(1); }
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        @keyframes slowTilt {
          0%, 100% { transform: rotate(-0.4deg); }
          50% { transform: rotate(0.4deg); }
        }

        @keyframes barGrow {
          from { transform: scaleY(0); transform-origin: bottom; }
          to { transform: scaleY(1); transform-origin: bottom; }
        }

        @keyframes stampIn {
          from { transform: scale(1.6) rotate(8deg); opacity: 0; }
          to { transform: scale(1) rotate(0); opacity: 1; }
        }

        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after {
            animation-duration: 0.001ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.001ms !important;
          }
        }
      `}</style>

      <div
        className="min-h-screen bg-[var(--cream)] text-[var(--ink)] antialiased selection:bg-[var(--accent)] selection:text-[var(--cream)]"
        style={{ fontFamily: "var(--font-body)" }}
      >
        <Ticker />
        <Nav />
        <main>
          <Hero />
          <FeaturesIndex />
          <Preview />
          <ThreeActs />
          <Faq />
          <FinalCta />
        </main>
        <Footer />
      </div>
    </>
  );
}
