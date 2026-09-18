"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";

import { HomeShell } from "@/components/ux/home/HomeShell";
import {
  Btn, Card, Chip, EmptyState, I, IconTile, Pill, ScreenError, ScreenSkeleton,
  Stat, v,
} from "@/components/ux/kit";
import { EYEBROW, Section } from "@/components/ux/earn/phone";
import { formatRupees } from "@/components/ux/kit";
import { useMarket } from "@/components/ux/live";
import { lookOf, tieTone } from "@/components/ux/market/data";
import { COPY } from "@/components/ux/copy";
import { apiErrorMessage } from "@/lib/api";
import { apiSave, apiUnsave } from "@/lib/entitlements-api";
import type { MarketListing } from "@/lib/market-api";
import { useT } from "@/i18n";

/**
 * The market — where what she makes actually gets bought.
 *
 * ── This screen used to make no request at all ───────────────────────────────
 * Eight fixtures, seven invented sellers, and a Save button that was a
 * `useState` array — pressed, it lit up; navigated away from, it forgot. The
 * rows below are now `shop_listings` belonging to other women, read through
 * `useMarket()`.
 *
 * ── The ordering IS the product ─────────────────────────────────────────────
 * Her circle first, then women she has bought from before, then everyone else.
 * That sequence is the only advantage this has over any other listings page:
 * buyer and seller already know each other, or know someone who does. A
 * nationwide randomised evaluation of rural e-commerce found no income gains
 * for producers precisely because a crowded market of strangers made it
 * impossible for a small seller to stand out. The rank is computed server-side
 * from real circle memberships and her real order history — see
 * `routes/market.py`.
 *
 * ── No stars, and nothing else invented either ──────────────────────────────
 * Most sellers here have too few ratings for a star to mean anything, and
 * displayed ratings are biased upward. What is shown instead is what buyers
 * did: came back, ordered again, finished an order.
 *
 * Three things the fixtures used to show are simply gone, because nothing in
 * the database knows them and a confident wrong answer is worse than a gap:
 * the distance to each seller ("0.4 km"), whether she is "open right now", and
 * "No complaints, ever" — nothing records a complaint against a seller, so the
 * market cannot say there are none. The pot-payout banner is gone for the same
 * reason: "your pot pays out in 6 days · ₹4,000" was a constant.
 */

type Filter = "all" | "circle" | "product" | "service";

export default function MarketPage() {
  const tr = useT();
  const market = useMarket();
  const [filter, setFilter] = useState<Filter>("all");
  /**
   * What she has pressed since the page loaded, on top of what the server said.
   *
   * The server sends `saved` on every row, so the heart is right on the first
   * paint. This holds only the presses that have happened since — so an
   * optimistic toggle can be put back exactly as it was if the write fails.
   */
  const [pressed, setPressed] = useState<Record<string, boolean>>({});
  const [problem, setProblem] = useState<string | null>(null);

  const rows = market.data;
  const isSaved = useCallback(
    (l: MarketListing) => pressed[l.id] ?? l.saved,
    [pressed],
  );

  const shown = useMemo(() => {
    if (filter === "circle") return rows.filter((l) => l.seller.tie === "circle");
    if (filter === "product") return rows.filter((l) => l.kind === "product");
    if (filter === "service") return rows.filter((l) => l.kind === "service");
    return rows;
  }, [rows, filter]);

  const circleCount = useMemo(() => rows.filter((l) => l.seller.tie === "circle").length, [rows]);
  const sellerCount = useMemo(() => new Set(rows.map((l) => l.seller.id)).size, [rows]);
  const savedCount = useMemo(() => rows.filter(isSaved).length, [rows, isSaved]);

  /**
   * Save, optimistically — and put it back if the server refuses.
   *
   * The heart has to answer the finger immediately; a bookmark that waits for a
   * round trip on 2G reads as a dead button and gets pressed four more times.
   * What must never happen is the heart staying lit when nothing was saved, so
   * the failure path restores the previous state and says so.
   */
  const toggleSave = useCallback(async (l: MarketListing) => {
    const was = pressed[l.id] ?? l.saved;
    setPressed((p) => ({ ...p, [l.id]: !was }));
    setProblem(null);
    try {
      if (was) await apiUnsave("listing", l.id);
      else await apiSave("listing", l.id);
    } catch (e) {
      setPressed((p) => ({ ...p, [l.id]: was }));
      setProblem(apiErrorMessage(e, "That could not be saved. Try again in a moment."));
    }
  }, [pressed]);

  const card = (l: MarketListing) => {
    const look = lookOf(l);
    const saved = isSaved(l);
    const tone = tieTone(l.seller.tie);
    return (
      <Card key={l.id} pad={0} style={{ overflow: "hidden" }}>
        <Link href={`/app/market/${l.id}`} className="ux-press block w-full text-left">
          <div className="flex items-start gap-3.5 p-4">
            <IconTile icon={look.icon} tint={look.tint} ink={look.ink} size={46} radius={13} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-bold leading-snug" style={{ color: v("--ux-ink") }}>{l.title}</p>
                {l.kind === "service" && <Pill tone="blue" size="sm">Someone to do it</Pill>}
                {l.low_stock && <Pill tone="orange" size="sm">{l.stock} left</Pill>}
              </div>
              {l.desc && (
                <p className="mt-1 text-xs leading-relaxed" style={{ color: v("--ux-muted") }}>{l.desc}</p>
              )}

              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold"
                      style={{ color: v("--ux-ink-2") }}>
                  <span className="grid h-[20px] w-[20px] place-items-center rounded-full text-2xs font-bold"
                        style={{ background: v("--ux-brand-tint-2"), color: v("--ux-brand") }}>
                    {l.seller.name.charAt(0)}
                  </span>
                  {l.seller.name}
                </span>
                <span className="rounded-full px-2 py-[2px] text-2xs font-bold"
                      style={{ background: v(tone.bg), color: v(tone.ink) }}>
                  {l.seller.tie_label}
                </span>
                {l.place && <span className="text-xs" style={{ color: v("--ux-muted") }}>{l.place}</span>}
              </div>

              {/* The quiet signals, in place of stars — and only the ones that
                  are actually true of this seller. A woman with no finished
                  orders yet gets no line at all, rather than a zero. */}
              <div className="mt-2 flex flex-wrap gap-x-3.5 gap-y-1">
                {l.bought_by_circle > 0 && (
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold"
                        style={{ color: v("--ux-brand") }}>
                    <I name="Users" className="h-[12px] w-[12px]" />
                    {l.bought_by_circle} {l.bought_by_circle === 1 ? "woman" : "women"} you know bought this
                  </span>
                )}
                {l.seller.repeat_buyers > 0 && (
                  <span className="inline-flex items-center gap-1.5 text-xs" style={{ color: v("--ux-green-ink") }}>
                    <I name="Repeat" className="h-[12px] w-[12px]" />
                    {l.seller.repeat_buyers} come back
                  </span>
                )}
                {l.seller.orders_done > 0 && (
                  <span className="inline-flex items-center gap-1.5 text-xs" style={{ color: v("--ux-muted") }}>
                    <I name="Package" className="h-[12px] w-[12px]" />
                    {l.seller.orders_done} finished
                  </span>
                )}
              </div>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-lg font-extrabold leading-none tabular-nums" style={{ color: v("--ux-ink") }}>
                {/* Minor units in, and only ever through this formatter. */}
                {formatRupees(l.price_minor)}
              </p>
              {l.rate && <p className="mt-1 text-2xs" style={{ color: v("--ux-muted") }}>{l.rate}</p>}
              {l.stock !== null && !l.low_stock && (
                <p className="mt-1 text-2xs" style={{ color: v("--ux-muted") }}>{l.stock} left</p>
              )}
            </div>
          </div>
        </Link>
        <div className="flex gap-2 border-t px-4 py-3" style={{ borderColor: v("--ux-line") }}>
          <Btn size="sm" full href={`/app/market/${l.id}`}>
            {l.kind === "service" ? "Book her" : "See it"}
          </Btn>
          <Btn size="sm" variant={saved ? "soft" : "ghost"} icon="Heart"
               ariaLabel={saved ? `Remove ${l.title} from saved` : `Save ${l.title}`}
               onClick={() => toggleSave(l)}>
            {saved ? "Saved" : "Save"}
          </Btn>
        </div>
      </Card>
    );
  };

  // Nothing has arrived yet. A skeleton rather than an empty market: "no women
  // are selling anything" is a very different sentence from "wait a moment".
  if (market.source === "loading" && rows.length === 0) {
    return <HomeShell active="/app/market"><ScreenSkeleton shape="list" /></HomeShell>;
  }

  // The request failed and there is no fixture behind it on purpose. Saying so
  // is the only honest screen — a market of invented women would let her order
  // from one.
  if (market.error && rows.length === 0) {
    return (
      <HomeShell active="/app/market">
        <ScreenError what="the market" reset={market.refetch} detail={market.error.message} />
      </HomeShell>
    );
  }

  return (
    <HomeShell active="/app/market">
      <div className="flex flex-col gap-6 lg:gap-5">

        <header className="flex flex-wrap items-end gap-4">
          <div className="min-w-0 flex-1">
            <p className={EYEBROW}>{tr("market.theMarket")}</p>
            <h1 className="ux-screen-title mt-2 text-[clamp(1.5rem,3.2vw,2.125rem)] font-extrabold leading-[1.1] tracking-[-0.035em]"
                style={{ color: v("--ux-ink") }}>{tr("market.buyFromWomenYouKnow")}</h1>
            <p className="mt-1.5 max-w-[56ch] text-sm leading-relaxed" style={{ color: v("--ux-muted") }}>
              Your circle first, then women you have bought from, then everyone else. Everything
              here is listed by a WomSakhi member, and none of it is yours.
            </p>
          </div>
          <Btn variant="outline" icon="Store" href="/app/shop" className="max-lg:w-full">{tr("market.yourOwnShop")}</Btn>
        </header>

        {problem && (
          <Card pad={16} style={{ background: v("--ux-tint-orange"), borderColor: "transparent" }}>
            <p className="flex items-start gap-2 text-xsm font-semibold" style={{ color: v("--ux-orange-ink") }}>
              <I name="AlertCircle" className="mt-[1px] h-[16px] w-[16px] shrink-0" />{problem}
            </p>
          </Card>
        )}

        <Card>
          <div className="grid gap-4 sm:grid-cols-3">
            <Stat value={String(circleCount)} label={tr("market.thingsYourCircleSells")} icon="Users"
                  tint="--ux-tint-pink" ink="--ux-pink-ink" />
            <Stat value={String(sellerCount)} label="Women selling here" icon="Store"
                  tint="--ux-tint-green" ink="--ux-green-ink" />
            <Stat value={String(savedCount)} label={tr("market.youHaveSaved")} icon="Heart"
                  tint="--ux-tint-violet" ink="--ux-violet" />
          </div>
        </Card>

        <div>
          <Section title={tr("market.forYou")} sub={tr("market.closestToYouFirstNotWhoever")}
                       icon="ShoppingBasket" chip={String(shown.length)} />
          <div className="mb-3.5 flex flex-wrap gap-2">
            <Chip icon="LayoutGrid" selected={filter === "all"} onClick={() => setFilter("all")}>Everything</Chip>
            <Chip icon="Users" selected={filter === "circle"} onClick={() => setFilter("circle")}>{tr("market.myCircle")}</Chip>
            <Chip icon="Package" selected={filter === "product"} onClick={() => setFilter("product")}>Things</Chip>
            <Chip icon="Scissors" selected={filter === "service"} onClick={() => setFilter("service")}>{tr("market.someoneToDoIt")}</Chip>
          </div>

          {shown.length === 0 ? (
            <Card><EmptyState icon="ShoppingBasket" title={COPY.nothingHereYet}
                              body="Try another filter — or invite a woman whose trade is missing from your circle."
                              action={<Btn size="sm" variant="outline" onClick={() => setFilter("all")}>{tr("market.showEverything")}</Btn>} /></Card>
          ) : (
            <div className="flex flex-col gap-3">{shown.map(card)}</div>
          )}
        </div>

        <Card pad={16} style={{ background: v("--ux-surface-2"), borderColor: "transparent" }}>
          <div className="flex items-start gap-3">
            <I name="Info" className="mt-[2px] h-[16px] w-[16px] shrink-0" style={{ color: v("--ux-muted") }} />
            <p className="text-xsm leading-relaxed" style={{ color: v("--ux-ink-2") }}>
              There are no stars here. Most women selling have sold to too few people for a rating to
              mean anything, and almost every rating anyone has is five. What is shown instead is
              what her buyers actually did — came back, finished an order — counted from her own
              order book. When a woman is new, nothing is shown, rather than a flattering zero.
            </p>
          </div>
        </Card>
      </div>
    </HomeShell>
  );
}
