"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { HomeShell } from "@/components/ux/home/HomeShell";
import { Btn, Card, I, IconTile, Pill, SectionHead, Stat, v } from "@/components/ux/kit";
import { formatRupees } from "@/components/ux/kit";
import {
  BULK, BUYERS, LIVES, PREORDERS, PRICES, STREAMS, SUBS,
  fundedUpfront, monthTotal, prepaidHeld, type Stream,
} from "@/components/ux/shopplus/data";

/**
 * Your shops — plural, because she is.
 *
 * A woman who stitches also does mehendi in wedding season and sends out tiffin
 * when the machine is quiet. Every marketplace makes her choose one identity.
 * Here each trade is its own shopfront with its own customers and its own
 * rhythm, and there is one set of books underneath.
 *
 * The tiles below are not a feature menu. They are ordered by how directly each
 * one attacks the binding constraint — capital — which is why "money before you
 * buy cloth" sits above "what to charge", and a listings page appears nowhere.
 */

const TOOLS = [
  { href: "/app/shop/preorders", icon: "HandCoins", label: "Money before you buy cloth",
    note: "Let the order pay for its own materials", tint: "--ux-tint-green", ink: "--ux-green-ink" },
  { href: "/app/shop/subscriptions", icon: "Repeat", label: "Customers who pay every month",
    note: "Predictable money from people who know you", tint: "--ux-tint-violet", ink: "--ux-violet" },
  { href: "/app/shop/buyers", icon: "Handshake", label: "Who comes back",
    note: "One steady buyer beats a hundred lookers", tint: "--ux-tint-blue", ink: "--ux-blue-ink" },
  { href: "/app/shop/pricing", icon: "Tag", label: "What should you charge",
    note: "What other women near you ask for the same work", tint: "--ux-tint-amber", ink: "--ux-amber-ink" },
  { href: "/app/shop/wholesale", icon: "Boxes", label: "Big orders",
    note: "Twenty pieces to one shop, not twenty sales", tint: "--ux-tint-orange", ink: "--ux-orange-ink" },
  { href: "/app/shop/live", icon: "Radio", label: "Show and sell",
    note: "A live half-hour to your own circle", tint: "--ux-tint-pink", ink: "--ux-pink-ink" },
  { href: "/app/shop/voice", icon: "Mic", label: "Say it instead of typing it",
    note: "Speak, and it becomes a listing you can correct", tint: "--ux-brand-tint", ink: "--ux-brand" },
  { href: "/app/shop/slots", icon: "CalendarDays", label: "Sell your time, not just things",
    note: "Customers pick an hour themselves", tint: "--ux-tint-blue", ink: "--ux-blue-ink" },
  { href: "/app/shop/disputes", icon: "Scale", label: "When something goes wrong",
    note: "Sorted by a woman you both know", tint: "--ux-tint-violet", ink: "--ux-violet" },
  { href: "/app/kitchen", icon: "ChefHat", label: "Selling food from home",
    note: "The licence is one hundred rupees a year", tint: "--ux-tint-amber", ink: "--ux-amber-ink" },
];

export default function ShopHub() {
  const router = useRouter();
  const [streams, setStreams] = useState<Stream[]>(STREAMS);
  const [note, setNote] = useState<string | null>(null);

  const month = useMemo(() => monthTotal(streams), [streams]);
  const held = useMemo(() => prepaidHeld(SUBS), []);
  const upfront = useMemo(() => fundedUpfront(PREORDERS), []);
  const asking = useMemo(() => PREORDERS.filter((o) => o.state === "asking").length, []);
  const newBulk = useMemo(() => BULK.filter((b) => b.state === "new").length, []);
  const under = useMemo(() => PRICES.filter((p) => p.yoursMinor < p.typicalMinor).length, []);
  const committed = useMemo(() => BUYERS.filter((b) => b.committed).length, []);
  const nextLive = useMemo(() => LIVES.find((l) => l.state === "scheduled"), []);

  const toggle = useCallback((id: string) => {
    setStreams((rows) => {
      const next = rows.map((s) =>
        s.id === id ? { ...s, live: !s.live, pausedUntil: s.live ? "you say so" : undefined } : s);
      const s = next.find((x) => x.id === id);
      setNote(s?.live
        ? `${s.name} is open again. Nothing was lost while it was closed.`
        : `${s?.name} is closed. Your customers see "back soon" — your place in search does not drop.`);
      return next;
    });
  }, []);

  return (
    <HomeShell active="/app/shop">
      <div className="flex flex-col gap-5">

        <header className="flex flex-wrap items-end gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-[0.6875rem] font-extrabold uppercase tracking-[0.2em]" style={{ color: v("--ux-brand") }}>
              Your shops
            </p>
            <h1 className="mt-2 text-[clamp(1.5rem,3.2vw,2.125rem)] font-extrabold leading-[1.1] tracking-[-0.035em]"
                style={{ color: v("--ux-ink") }}>
              {formatRupees(month)} this month
            </h1>
            <p className="mt-1.5 max-w-[54ch] text-[0.875rem] leading-relaxed" style={{ color: v("--ux-muted") }}>
              Across {streams.filter((s) => s.live).length} open{" "}
              {streams.filter((s) => s.live).length === 1 ? "shop" : "shops"} — one set of books for all of them.
            </p>
          </div>
          <Btn variant="outline" icon="Store" href="/app/documents">What you sell</Btn>
        </header>

        {note && (
          <Card pad={16} style={{ background: v("--ux-tint-green"), borderColor: "transparent" }}>
            <p className="flex items-center gap-2 text-[0.8125rem] font-semibold" style={{ color: v("--ux-green-ink") }}>
              <I name="CheckCircle2" className="h-[16px] w-[16px]" />{note}
            </p>
          </Card>
        )}

        {/* Working capital — the number nobody shows her */}
        <Card>
          <div className="grid gap-4 sm:grid-cols-3">
            <Stat value={formatRupees(upfront)} label="Paid to you before you started"
                  icon="HandCoins" tint="--ux-tint-green" ink="--ux-green-ink" />
            <Stat value={formatRupees(held)} label="Already paid for next month"
                  icon="Repeat" tint="--ux-tint-violet" ink="--ux-violet" />
            <Stat value={String(committed)} label="Buyers with a standing order"
                  icon="Handshake" tint="--ux-tint-blue" ink="--ux-blue-ink" />
          </div>
          <div className="mt-4 flex items-start gap-2.5 border-t pt-3.5" style={{ borderColor: v("--ux-line") }}>
            <I name="Info" className="mt-[2px] h-[15px] w-[15px] shrink-0" style={{ color: v("--ux-muted") }} />
            <p className="text-[0.8125rem] leading-relaxed" style={{ color: v("--ux-ink-2") }}>
              This is money in your hands <b>before</b> you spend on cloth. It is the difference
              between taking an order and being able to afford to.
            </p>
          </div>
        </Card>

        {/* Streams */}
        <div>
          <SectionHead title="Your trades" sub="Open one, close one — closing costs you nothing"
                       icon="LayoutGrid" chip={String(streams.length)} />
          <div className="grid gap-3 lg:grid-cols-3">
            {streams.map((s) => (
              <Card key={s.id} pad={16}>
                <div className="flex items-start gap-3.5">
                  <IconTile icon={s.icon} tint={s.tint} ink={s.ink} size={44} radius={13} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-[0.875rem] font-bold" style={{ color: v("--ux-ink") }}>{s.name}</p>
                      {s.live
                        ? <Pill tone="green" size="sm">Open</Pill>
                        : <Pill tone="neutral" size="sm">Closed</Pill>}
                    </div>
                    <p className="mt-0.5 text-[0.75rem] leading-snug" style={{ color: v("--ux-muted") }}>{s.trade}</p>
                  </div>
                </div>

                {s.live ? (
                  <div className="mt-3.5 flex items-end justify-between">
                    <div>
                      <p className="text-[1.25rem] font-extrabold leading-none tabular-nums"
                         style={{ color: v("--ux-ink") }}>{formatRupees(s.monthMinor)}</p>
                      <p className="mt-1 text-[0.75rem]" style={{ color: v("--ux-muted") }}>
                        {s.orders} orders this month
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="mt-3.5 rounded-[8px] px-3 py-2.5 text-[0.75rem] leading-relaxed"
                     style={{ background: v("--ux-surface-2"), color: v("--ux-ink-2") }}>
                    Closed {s.pausedUntil ? `until ${s.pausedUntil}` : "for now"}. Your customers see
                    &ldquo;back soon&rdquo;, and nothing about your shop is downgraded for it.
                  </p>
                )}

                <div className="mt-3.5 flex gap-2">
                  <Btn size="sm" variant={s.live ? "ghost" : "primary"} full onClick={() => toggle(s.id)}>
                    {s.live ? "Close for now" : "Open again"}
                  </Btn>
                  <Btn size="sm" variant="outline" full href="/app/documents">Open shop</Btn>
                </div>
              </Card>
            ))}

            {/* Add another trade */}
            <button
              type="button"
              onClick={() => setNote("A new trade gets its own shopfront and its own customers — the books stay together.")}
              className="ux-press ux-sq flex min-h-[180px] flex-col items-center justify-center gap-2.5 rounded-[var(--ux-r-card)] border-2 border-dashed p-6 text-center"
              style={{ borderColor: v("--ux-line-strong"), background: v("--ux-surface") }}
            >
              <span className="grid h-[46px] w-[46px] place-items-center rounded-full"
                    style={{ background: v("--ux-brand-tint"), color: v("--ux-brand") }}>
                <I name="Plus" className="h-[21px] w-[21px]" sw={2.4} />
              </span>
              <p className="text-[0.875rem] font-bold" style={{ color: v("--ux-ink") }}>Another trade</p>
              <p className="max-w-[24ch] text-[0.75rem] leading-relaxed" style={{ color: v("--ux-muted") }}>
                Cooking, mehendi, tuition — whatever else you do for money
              </p>
            </button>
          </div>
        </div>

        {/* Tools */}
        <div>
          <SectionHead title="Ways to sell more without spending more"
                       sub="Ordered by what actually holds a small shop back" icon="Sparkles" />
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {TOOLS.map((t) => {
              const badge =
                t.href.endsWith("preorders") && asking ? `${asking} waiting`
                : t.href.endsWith("wholesale") && newBulk ? `${newBulk} new`
                : t.href.endsWith("pricing") && under ? `${under} too low`
                : t.href.endsWith("live") && nextLive ? nextLive.when
                : null;
              return (
                <button key={t.href} type="button" onClick={() => router.push(t.href)}
                        className="ux-press ux-sq flex items-start gap-3.5 rounded-[var(--ux-r-card)] border p-4 text-left"
                        style={{ borderColor: v("--ux-line"), background: v("--ux-surface") }}>
                  <IconTile icon={t.icon} tint={t.tint} ink={t.ink} size={42} radius={12} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[0.875rem] font-bold leading-snug" style={{ color: v("--ux-ink") }}>{t.label}</p>
                      {badge && (
                        <span className="rounded-full px-2 py-[2px] text-[0.6875rem] font-bold"
                              style={{ background: v("--ux-brand-tint"), color: v("--ux-brand") }}>{badge}</span>
                      )}
                    </div>
                    <p className="mt-1 text-[0.75rem] leading-relaxed" style={{ color: v("--ux-muted") }}>{t.note}</p>
                  </div>
                  <I name="ChevronRight" className="mt-1 h-[16px] w-[16px] shrink-0" style={{ color: v("--ux-faint") }} />
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </HomeShell>
  );
}
