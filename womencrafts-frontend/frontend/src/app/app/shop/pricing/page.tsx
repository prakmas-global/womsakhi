"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { HomeShell } from "@/components/ux/home/HomeShell";
import { Btn, Card, I, IconTile, Pill, SectionHead, Stat, v } from "@/components/ux/kit";
import { formatRupees } from "@/components/ux/kit";
import { CROSSOVERS, PRICES, type PriceCheck } from "@/components/ux/shopplus/data";

/**
 * What should you charge.
 *
 * ── Why this is a number, not advice ────────────────────────────────────────
 * Women systematically underprice, and price is where the money is: in Africa
 * the gender profit gap averages 34% while the gap in business *practices* is
 * less than half the capital gap. Telling her to "value her work" does nothing.
 * Showing her that eleven women within a few streets charge ₹420 for the blouse
 * she sells at ₹280 does the whole job in one line.
 *
 * No coaching, no AI opinion, no scolding. A range, a count of who is in it,
 * and a button that changes her price. The scolding version of this screen was
 * the first thing I cut.
 *
 * ── The honest floor ────────────────────────────────────────────────────────
 * Below four women a range is gossip, not data — so it says so rather than
 * drawing a confident chart over three points.
 */

function Bar({ p }: { p: PriceCheck }) {
  const span = Math.max(1, p.highMinor - p.lowMinor);
  const at = (n: number) => `${Math.min(100, Math.max(0, ((n - p.lowMinor) / span) * 100))}%`;
  const low = p.yoursMinor < p.typicalMinor;

  return (
    <div className="mt-3">
      <div className="relative h-[34px]">
        {/* the range other women occupy */}
        <div className="absolute inset-x-0 top-[12px] h-[8px] rounded-full"
             style={{ background: v("--ux-brand-tint-2") }} />
        {/* typical */}
        <div className="absolute top-[8px] h-[20px] w-[3px] rounded-full"
             style={{ left: at(p.typicalMinor), background: v("--ux-brand"), transform: "translateX(-50%)" }} />
        {/* hers */}
        <div className="absolute top-[3px] grid h-[28px] w-[28px] place-items-center rounded-full border-2"
             style={{
               left: at(p.yoursMinor), transform: "translateX(-50%)",
               background: v("--ux-surface"),
               borderColor: v(low ? "--ux-amber" : "--ux-green-ink"),
             }}>
          <I name={low ? "ArrowUp" : "Check"} className="h-[13px] w-[13px]"
             style={{ color: v(low ? "--ux-amber-ink" : "--ux-green-ink") }} sw={2.8} />
        </div>
      </div>
      <div className="flex items-center justify-between text-[0.6875rem] tabular-nums" style={{ color: v("--ux-muted") }}>
        <span>{formatRupees(p.lowMinor)}</span>
        <span style={{ color: v("--ux-brand") }}>most ask {formatRupees(p.typicalMinor)}</span>
        <span>{formatRupees(p.highMinor)}</span>
      </div>
    </div>
  );
}

export default function PricingPage() {
  const router = useRouter();
  const [rows, setRows] = useState<PriceCheck[]>(PRICES);
  const [note, setNote] = useState<string | null>(null);

  const under = useMemo(() => rows.filter((p) => p.yoursMinor < p.typicalMinor), [rows]);
  const missing = useMemo(
    () => under.reduce((n, p) => n + (p.typicalMinor - p.yoursMinor), 0),
    [under],
  );

  const raise = useCallback((id: string) => {
    setRows((r) => r.map((p) => (p.id === id ? { ...p, yoursMinor: p.typicalMinor } : p)));
    const p = rows.find((x) => x.id === id);
    setNote(`${p?.item} is now ${formatRupees(p?.typicalMinor ?? 0)} — what most women near you ask.`);
  }, [rows]);

  return (
    <HomeShell active="/app/shop">
      <div className="flex flex-col gap-5">
        <Link href={"/app/shop"}
                className="ux-press inline-flex w-fit items-center gap-1.5 text-[0.8125rem] font-semibold"
                style={{ color: v("--ux-muted") }}>
          <I name="ArrowLeft" className="h-[15px] w-[15px]" /> Back to your shops
        </Link>

        <header>
          <p className="text-[0.6875rem] font-extrabold uppercase tracking-[0.2em]" style={{ color: v("--ux-brand") }}>
            Your prices
          </p>
          <h1 className="mt-2 text-[clamp(1.5rem,3.2vw,2.125rem)] font-extrabold leading-[1.1] tracking-[-0.035em]"
              style={{ color: v("--ux-ink") }}>
            What others ask for the same work
          </h1>
          <p className="mt-1.5 max-w-[56ch] text-[0.875rem] leading-relaxed" style={{ color: v("--ux-muted") }}>
            Not what you should charge — what women near you already do. Nobody tells each other,
            which is exactly why everyone charges too little.
          </p>
        </header>

        {under.length > 0 && (
          <Card style={{ borderColor: v("--ux-amber") }}>
            <div className="flex flex-wrap items-center gap-4">
              <IconTile icon="TrendingUp" tint="--ux-tint-amber" ink="--ux-amber-ink" size={46} radius={13} />
              <div className="min-w-0 flex-1">
                <p className="text-[1rem] font-bold" style={{ color: v("--ux-ink") }}>
                  You are asking less than most on {under.length}{" "}
                  {under.length === 1 ? "thing" : "things"}
                </p>
                <p className="mt-1 text-[0.8125rem] leading-relaxed" style={{ color: v("--ux-ink-2") }}>
                  About <b>{formatRupees(missing)}</b> less per item than the women around you.
                  Same cloth, same hours, same skill.
                </p>
              </div>
            </div>
          </Card>
        )}

        {note && (
          <Card pad={16} style={{ background: v("--ux-tint-green"), borderColor: "transparent" }}>
            <p className="flex items-center gap-2 text-[0.8125rem] font-semibold" style={{ color: v("--ux-green-ink") }}>
              <I name="CheckCircle2" className="h-[16px] w-[16px]" />{note}
            </p>
          </Card>
        )}

        <div>
          <SectionHead title="What you sell" icon="Tag" chip={String(rows.length)} />
          <div className="flex flex-col gap-3">
            {rows.map((p) => {
              const low = p.yoursMinor < p.typicalMinor;
              const thin = p.from < 4;
              return (
                <Card key={p.id} pad={16}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[0.875rem] font-bold" style={{ color: v("--ux-ink") }}>{p.item}</p>
                      <p className="mt-0.5 text-[0.75rem]" style={{ color: v("--ux-muted") }}>
                        {thin
                          ? `Only ${p.from} women near you sell this — treat the range as a hint, not a rule`
                          : `From ${p.from} women near you`}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[1.25rem] font-extrabold leading-none tabular-nums"
                         style={{ color: v(low ? "--ux-amber-ink" : "--ux-ink") }}>
                        {formatRupees(p.yoursMinor)}
                      </p>
                      <p className="mt-0.5 text-[0.6875rem]" style={{ color: v("--ux-muted") }}>you ask</p>
                    </div>
                  </div>

                  {!thin && <Bar p={p} />}

                  {low && (
                    <div className="mt-3.5 flex flex-wrap items-center gap-2 border-t pt-3.5"
                         style={{ borderColor: v("--ux-line") }}>
                      <p className="flex-1 text-[0.8125rem]" style={{ color: v("--ux-ink-2") }}>
                        Most ask <b>{formatRupees(p.typicalMinor)}</b>.
                      </p>
                      <Btn size="sm" onClick={() => raise(p.id)}>Ask that too</Btn>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        </div>

        {/* Crossover — the finding that women in better-paid trades earn as
            much as men, and that what moves them is seeing someone like them
            do it, not training. */}
        <div>
          <SectionHead title="Where the bigger money is"
                       sub="Same skill, same machine — women near you who moved across" icon="Crown" />
          <div className="grid gap-3 md:grid-cols-3">
            {CROSSOVERS.map((c) => (
              <Card key={c.id} pad={16}>
                <IconTile icon={c.icon} tint="--ux-tint-violet" ink="--ux-violet" size={40} />
                <p className="mt-3 text-[0.875rem] font-bold" style={{ color: v("--ux-ink") }}>{c.trade}</p>
                <p className="mt-1.5 text-[0.8125rem] leading-relaxed" style={{ color: v("--ux-muted") }}>{c.why}</p>
                <p className="mt-3 text-[1.125rem] font-extrabold tabular-nums" style={{ color: v("--ux-violet") }}>
                  {formatRupees(c.typicalMonthMinor)}
                  <span className="ml-1 text-[0.75rem] font-semibold" style={{ color: v("--ux-muted") }}>a month</span>
                </p>
                <p className="mt-1 text-[0.75rem]" style={{ color: v("--ux-muted") }}>
                  {c.women} {c.women === 1 ? "woman" : "women"} you know already do this
                </p>
                <Btn size="sm" variant="outline" full className="mt-3"
                     onClick={() => setNote(`We will introduce you to a woman doing ${c.trade.toLowerCase()}.`)}>
                  Talk to one of them
                </Btn>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </HomeShell>
  );
}
