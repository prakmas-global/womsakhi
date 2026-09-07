"use client";

import { useCallback, useMemo, useState } from "react";

import { HomeShell } from "@/components/ux/home/HomeShell";
import { Btn, Card, Chip, EmptyState, I, IconTile, Pill, SectionHead, Stat, v } from "@/components/ux/kit";
import { SWAPS, type SwapItem } from "@/components/ux/life/data";

/**
 * Circle swap — the second-hand economy women already run.
 *
 * ── Why this is not a resale marketplace ────────────────────────────────────
 * Resale platforms lose money at the ₹200 price point. Poshmark takes a flat
 * $2.95 under $15, so a $5 item nets $2.05; the whole operational load —
 * sourcing, sizing, hygiene, counterfeits, per-item photography, returns —
 * lands on the seller; and India's entire circular-fashion market was about
 * $272M in 2024, with a Gen-Z thrifter as the buyer, not this user.
 *
 * But there *is* a working women-run second-hand economy in India, and it is
 * nothing like Poshmark: the Waghri *bartanwali* trade, clothes bartered for
 * steel utensils, door to door. Local, trust-based, no shipping, no listings
 * fee, no returns policy.
 *
 * So: no prices, no fees, no delivery, no photography studio. Things people in
 * her circle no longer need, handed over in person. Uniforms are the killer
 * item — outgrown every single year, needed every single June.
 */

const CONDITION: Record<SwapItem["condition"], { tint: string; ink: string }> = {
  "as new": { tint: "--ux-tint-green", ink: "--ux-green-ink" },
  good: { tint: "--ux-tint-blue", ink: "--ux-blue-ink" },
  "worn but fine": { tint: "--ux-surface-2", ink: "--ux-muted" },
};

type Filter = "all" | "free" | "children";

export default function SwapPage() {
  const [rows, setRows] = useState<SwapItem[]>(SWAPS);
  const [filter, setFilter] = useState<Filter>("all");
  const [note, setNote] = useState<string | null>(null);

  const open = useMemo(() => rows.filter((s) => !s.taken), [rows]);
  const shown = useMemo(() => {
    if (filter === "free") return open.filter((s) => s.wants.toLowerCase().startsWith("free"));
    if (filter === "children") return open.filter((s) =>
      /uniform|shoe|baby|child|class/i.test(s.what + s.size));
    return open;
  }, [open, filter]);
  const taken = useMemo(() => rows.filter((s) => s.taken), [rows]);

  const claim = useCallback((id: string) => {
    setRows((r) => r.map((s) => (s.id === id ? { ...s, taken: true } : s)));
    const s = rows.find((x) => x.id === id);
    setNote(`${s?.from} has been told. Collect it from her — nothing is posted, nothing is charged.`);
  }, [rows]);

  return (
    <HomeShell active="/app/swap">
      <div className="flex flex-col gap-5">

        <header className="flex flex-wrap items-end gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-[0.6875rem] font-extrabold uppercase tracking-[0.2em]" style={{ color: v("--ux-brand") }}>
              Circle swap
            </p>
            <h1 className="mt-2 text-[clamp(1.5rem,3.2vw,2.125rem)] font-extrabold leading-[1.1] tracking-[-0.035em]"
                style={{ color: v("--ux-ink") }}>
              What someone near you no longer needs
            </h1>
            <p className="mt-1.5 max-w-[56ch] text-[0.875rem] leading-relaxed" style={{ color: v("--ux-muted") }}>
              Uniforms outgrown, baby things finished with, a lehenga worn once. Collected in
              person from a woman you know. No prices, no posting, no fee.
            </p>
          </div>
          <Btn icon="Plus" onClick={() => setNote("Photograph it where it is. No studio, no measurements, no listing fee.")}>
            Offer something
          </Btn>
        </header>

        <Card>
          <div className="grid gap-4 sm:grid-cols-3">
            <Stat value={String(open.length)} label="Going spare near you" icon="Gift"
                  tint="--ux-tint-pink" ink="--ux-pink-ink" />
            <Stat value={String(open.filter((s) => s.wants.toLowerCase().startsWith("free")).length)}
                  label="Free, no swap wanted" icon="Heart" tint="--ux-tint-green" ink="--ux-green-ink" />
            <Stat value={String(taken.length)} label="Found a new home" icon="Check"
                  tint="--ux-surface-2" ink="--ux-muted" />
          </div>
        </Card>

        {note && (
          <Card pad={16} style={{ background: v("--ux-tint-green"), borderColor: "transparent" }}>
            <p className="flex items-center gap-2 text-[0.8125rem] font-semibold" style={{ color: v("--ux-green-ink") }}>
              <I name="CheckCircle2" className="h-[16px] w-[16px]" />{note}
            </p>
          </Card>
        )}

        <div>
          <SectionHead title="Going spare" sub="All within walking distance" icon="Gift"
                       chip={String(shown.length)} />
          <div className="mb-3.5 flex flex-wrap gap-2">
            <Chip icon="LayoutGrid" selected={filter === "all"} onClick={() => setFilter("all")}>Everything</Chip>
            <Chip icon="Heart" selected={filter === "free"} onClick={() => setFilter("free")}>Free</Chip>
            <Chip icon="Baby" selected={filter === "children"} onClick={() => setFilter("children")}>For children</Chip>
          </div>

          {shown.length === 0 ? (
            <Card><EmptyState icon="Gift" title="Nothing here just now"
                              body="Try another filter, or offer something yourself — someone always needs a uniform in June."
                              action={<Btn size="sm" variant="outline" onClick={() => setFilter("all")}>Show everything</Btn>} /></Card>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {shown.map((s) => {
                const c = CONDITION[s.condition];
                return (
                  <Card key={s.id} pad={16}>
                    <div className="flex items-start gap-3.5">
                      <IconTile icon={s.icon} tint={s.tint} ink={s.ink} size={44} radius={13} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-[0.875rem] font-bold" style={{ color: v("--ux-ink") }}>{s.what}</p>
                          <span className="rounded-full px-2 py-[2px] text-[0.6875rem] font-bold"
                                style={{ background: v(c.tint), color: v(c.ink) }}>{s.condition}</span>
                        </div>
                        <p className="mt-0.5 text-[0.75rem]" style={{ color: v("--ux-muted") }}>
                          {s.from} · {s.km} km{s.size ? ` · ${s.size}` : ""}
                        </p>
                        <p className="mt-2 text-[0.8125rem] leading-relaxed" style={{ color: v("--ux-ink-2") }}>
                          {s.wants}
                        </p>
                      </div>
                    </div>
                    <Btn size="sm" full className="mt-3" onClick={() => claim(s.id)}>
                      Ask her for it
                    </Btn>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {taken.length > 0 && (
          <div>
            <SectionHead title="Already gone" icon="Check" chip={String(taken.length)} />
            <Card pad={0}>
              <ul className="divide-y" style={{ borderColor: v("--ux-line") }}>
                {taken.map((s) => (
                  <li key={s.id} className="flex items-center gap-3 px-4 py-3">
                    <I name="Check" className="h-[15px] w-[15px] shrink-0" style={{ color: v("--ux-green-ink") }} sw={2.6} />
                    <p className="flex-1 text-[0.8125rem]" style={{ color: v("--ux-ink-2") }}>{s.what} · from {s.from}</p>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        )}

        <Card pad={16} style={{ background: v("--ux-surface-2"), borderColor: "transparent" }}>
          <div className="flex items-start gap-3">
            <I name="Info" className="mt-[2px] h-[16px] w-[16px] shrink-0" style={{ color: v("--ux-muted") }} />
            <p className="text-[0.8125rem] leading-relaxed" style={{ color: v("--ux-ink-2") }}>
              Nothing here has a price and nothing is posted. This is the swap women already do at
              the school gate — it just means you know what is going spare before you buy new.
            </p>
          </div>
        </Card>
      </div>
    </HomeShell>
  );
}
