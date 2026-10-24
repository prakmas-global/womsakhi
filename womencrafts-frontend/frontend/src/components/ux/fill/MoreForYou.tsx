"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import * as Icons from "@/components/ux/icons";
import { trailFor } from "@/components/ux/nav-tree";
import { toast } from "@/components/ux/mobile/Toast";
import { FACTS, QUOTES, SHORTCUTS, dailyIndex, type Quote } from "./content";

/**
 * No empty screen.
 *
 * Every page ends here: a word from a woman worth hearing, and the rest of
 * WomSakhi as pictures — never the module she is already in. Pages without a
 * column of their own also get `DefaultRail` beside them on a wide screen.
 * Both change daily and per screen, so they read as fresh rather than as a
 * footer she learns to ignore.
 */

function useSection(): string {
  const path = usePathname() ?? "";
  return trailFor(path)[0]?.id ?? "";
}

export function QuoteCard({ compact = false }: { compact?: boolean }) {
  const path = usePathname() ?? "";
  const [i, setI] = useState(() => dailyIndex(QUOTES.length, path));
  const q: Quote = QUOTES[i % QUOTES.length];
  const share = async () => {
    const line = `“${q.text}” — ${q.by}`;
    try {
      if (navigator.share) await navigator.share({ text: `${line}\n\nShared from WomSakhi` });
      else { await navigator.clipboard.writeText(line); toast("Quote copied", { tone: "success" }); }
    } catch { /* she closed the share sheet */ }
  };
  return (
    <figure className="relative overflow-hidden rounded-[var(--ux-r-card,18px)] p-5"
            style={{ background: "linear-gradient(135deg, var(--ux-tint-lilac, #f3ecfb), var(--ux-tint-pink, #fbe9f1))",
                     border: "1px solid var(--ux-line)" }}>
      <Icons.Quote aria-hidden className="absolute end-4 top-3 h-10 w-10 opacity-15" style={{ color: "var(--ux-brand)" }} />
      <blockquote className={`relative font-semibold leading-snug ${compact ? "text-[15px]" : "text-[17px] lg:text-lg"}`}
                  style={{ color: "var(--ux-ink)" }}>
        “{q.text}”
      </blockquote>
      <figcaption className="mt-2.5 text-xs" style={{ color: "var(--ux-muted)" }}>
        — <b style={{ color: "var(--ux-brand)" }}>{q.by}</b>{q.who ? `, ${q.who}` : ""}
      </figcaption>
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={() => setI((n) => n + 1)}
                className="ux-press inline-flex min-h-[34px] items-center gap-1.5 rounded-full px-3 text-xs font-bold"
                style={{ background: "var(--ux-surface)", color: "var(--ux-ink-2)", border: "1px solid var(--ux-line)" }}>
          <Icons.RefreshCw className="h-3.5 w-3.5" /> Another
        </button>
        <button type="button" onClick={share}
                className="ux-press inline-flex min-h-[34px] items-center gap-1.5 rounded-full px-3 text-xs font-bold"
                style={{ background: "var(--ux-surface)", color: "var(--ux-ink-2)", border: "1px solid var(--ux-line)" }}>
          <Icons.Share2 className="h-3.5 w-3.5" /> Share
        </button>
      </div>
    </figure>
  );
}

function Tile({ s }: { s: (typeof SHORTCUTS)[number] }) {
  return (
    <Link href={s.href} className="ux-card ux-hov group relative block overflow-hidden" style={{ padding: 0 }}>
      <span className="block aspect-[4/3] w-full overflow-hidden sm:aspect-[16/10]" style={{ background: "var(--ux-surface-2)" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={s.image} alt="" loading="lazy" decoding="async"
             className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.05]" />
      </span>
      <span aria-hidden className="absolute inset-0"
            style={{ background: "linear-gradient(180deg, rgba(16,6,24,0) 40%, rgba(16,6,24,.82) 100%)" }} />
      <span className="absolute inset-x-3 bottom-2.5">
        <span className="flex items-center gap-1 text-sm font-bold text-white">{s.label}<Icons.ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" /></span>
        <span className="block truncate text-2xs text-white/85">{s.note}</span>
      </span>
    </Link>
  );
}

/** The end of every page: other modules as pictures, and a quote. */
export function MoreForYou({ withQuote = true, quoteHiddenXl = false }: { withQuote?: boolean; quoteHiddenXl?: boolean }) {
  const section = useSection();
  const path = usePathname() ?? "";
  const tiles = useMemo(() => {
    const pool = SHORTCUTS.filter((s) => s.section !== section && s.href !== path);
    const start = dailyIndex(pool.length, path);
    return Array.from({ length: Math.min(6, pool.length) }, (_, k) => pool[(start + k * 2) % pool.length])
      .filter((s, k, all) => all.findIndex((x) => x.href === s.href) === k);
  }, [section, path]);
  return (
    <section aria-label="More for you" className="mt-8 border-t pt-6" style={{ borderColor: "var(--ux-line)" }}>
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-extrabold" style={{ color: "var(--ux-ink)" }}>More for you</h2>
          <p className="text-xs" style={{ color: "var(--ux-muted)" }}>The rest of WomSakhi, one tap away.</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:gap-4">
        {tiles.map((s) => <Tile key={s.href} s={s} />)}
      </div>
      {/* On a wide screen with the default column, the quote is already there. */}
      {withQuote && <div className={`mt-4 ${quoteHiddenXl ? "xl:hidden" : ""}`}><QuoteCard /></div>}
    </section>
  );
}

/** The side column for pages that have none: today's quote, quick actions, one true fact. */
export function DefaultRail() {
  const path = usePathname() ?? "";
  const fact = FACTS[dailyIndex(FACTS.length, `fact${path}`)];
  const actions = [
    { href: "/app/health/today", label: "How are you today?", icon: "Smile", tint: "--ux-tint-green", ink: "--ux-green-ink" },
    { href: "/app/health/games", label: "A calm minute", icon: "Flower2", tint: "--ux-tint-violet", ink: "--ux-violet-ink" },
    { href: "/app/opportunities", label: "Work for my skills", icon: "Briefcase", tint: "--ux-tint-pink", ink: "--ux-brand" },
    { href: "/app/sakhi", label: "Ask Sakhi anything", icon: "Sparkles", tint: "--ux-tint-orange", ink: "--ux-orange-ink" },
  ];
  return (
    <div className="space-y-4">
      <QuoteCard compact />
      <div className="ux-card p-4">
        <h2 className="mb-2.5 text-sm font-extrabold" style={{ color: "var(--ux-ink)" }}>Quick actions</h2>
        <div className="grid grid-cols-2 gap-2">
          {actions.map((a) => {
            const I = (Icons as unknown as Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>>)[a.icon] ?? Icons.Sparkles;
            return (
              <Link key={a.href} href={a.href}
                    className="ux-press ux-hov flex min-h-[78px] flex-col justify-between rounded-[12px] p-2.5 text-xs font-bold"
                    style={{ background: `var(${a.tint})`, color: "var(--ux-ink)" }}>
                <I className="h-5 w-5" style={{ color: `var(${a.ink})` }} />
                {a.label}
              </Link>
            );
          })}
        </div>
      </div>
      <div className="ux-card p-4">
        <p className="flex items-center gap-1.5 text-2xs font-bold uppercase tracking-[0.08em]" style={{ color: "var(--ux-brand)" }}>
          <Icons.Lightbulb className="h-3.5 w-3.5" /> Did you know?
        </p>
        <p className="mt-1.5 text-xsm leading-relaxed" style={{ color: "var(--ux-ink-2)" }}>{fact.text}</p>
        <Link href={fact.href} className="mt-2 inline-flex items-center gap-1 text-xs font-bold" style={{ color: "var(--ux-brand)" }}>
          {fact.cta} <Icons.ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}
