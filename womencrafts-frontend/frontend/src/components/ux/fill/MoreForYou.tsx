"use client";

import { useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import * as Icons from "@/components/ux/icons";
import { trailFor } from "@/components/ux/nav-tree";
import { FACTS, SHORTCUTS, dailyIndex } from "./content";

/** Related destinations and a supporting rail. Quotes live in the shared shell. */

function useSection(): string {
  const path = usePathname() ?? "";
  return trailFor(path)[0]?.id ?? "";
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

/** Related modules; the shared shell owns the page-specific quote. */
export function MoreForYou() {
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
    </section>
  );
}

/** The side column for pages that have none: quick actions and one useful fact. */
export function DefaultRail() {
  const path = usePathname() ?? "";
  const fact = FACTS[dailyIndex(FACTS.length, `fact${path}`)];
  const actions = [
    // One tint, the brand's: four colours side by side read as four apps.
    { href: "/app/health/today", label: "How are you today?", icon: "Smile", tint: "--ux-brand-tint", ink: "--ux-brand" },
    { href: "/app/health/games", label: "A calm minute", icon: "Flower2", tint: "--ux-brand-tint", ink: "--ux-brand" },
    { href: "/app/opportunities", label: "Work for my skills", icon: "Briefcase", tint: "--ux-brand-tint", ink: "--ux-brand" },
    { href: "/app/sakhi", label: "Ask Sakhi anything", icon: "Sparkles", tint: "--ux-brand-tint", ink: "--ux-brand" },
  ];
  return (
    <div className="space-y-4">
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
