"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { HomeShell } from "@/components/ux/home/HomeShell";
import { Btn, Card, Chip, EmptyState, I, IconTile, Pill, SectionHead, Stat, v } from "@/components/ux/kit";
import { formatRupees } from "@/components/ux/kit";
import {
  ITEMS, POT_PAYOUT, SELLERS, TIE_LABEL, sellerOf, sortedItems, type Item,
} from "@/components/ux/market/data";
import { COPY } from "@/components/ux/copy";

/**
 * The market — where what she makes actually gets bought.
 *
 * ── The ordering IS the product ─────────────────────────────────────────────
 * Her circle first, then women she has bought from before, then near her, then
 * everyone else. That sequence is the only advantage this has over any other
 * listings page: buyer and seller already know each other, or know someone who
 * does. A nationwide randomised evaluation of rural e-commerce found no income
 * gains for producers precisely because a crowded market of strangers made it
 * impossible for a small seller to stand out. Sorting by relevance to a
 * stranger would reproduce exactly that.
 *
 * ── No stars, anywhere ──────────────────────────────────────────────────────
 * Most sellers here have too few ratings for a star to mean anything, and
 * displayed ratings are biased upward. What is shown instead is what buyers did
 * not do: came back, did not complain — plus the one signal that matters most
 * in a trust market, "six women you know have bought this."
 */

type Filter = "all" | "circle" | "food" | "made" | "service";

export default function MarketPage() {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("all");
  const [saved, setSaved] = useState<string[]>([]);
  const [note, setNote] = useState<string | null>(null);

  const ranked = useMemo(() => sortedItems(), []);
  const shown = useMemo(() => {
    if (filter === "circle") return ranked.filter((i) => sellerOf(i).tie === "circle");
    if (filter === "food") return ranked.filter((i) => i.kind === "food");
    if (filter === "service") return ranked.filter((i) => i.kind === "service");
    if (filter === "made") return ranked.filter((i) => i.madeToOrder);
    return ranked;
  }, [ranked, filter]);

  const circleCount = useMemo(() => ranked.filter((i) => sellerOf(i).tie === "circle").length, [ranked]);
  const openSellers = useMemo(() => SELLERS.filter((s) => s.open).length, []);

  const save = useCallback((id: string) => {
    setSaved((r) => (r.includes(id) ? r.filter((x) => x !== id) : [...r, id]));
  }, []);

  const card = (i: Item) => {
    const s = sellerOf(i);
    const isSaved = saved.includes(i.id);
    return (
      <Card key={i.id} pad={0} style={{ overflow: "hidden" }}>
        <Link href={`/app/market/${i.id}`} className="ux-press block w-full text-left">
          <div className="flex items-start gap-3.5 p-4">
            <IconTile icon={i.icon} tint={i.tint} ink={i.ink} size={46} radius={13} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-bold leading-snug" style={{ color: v("--ux-ink") }}>{i.title}</p>
                {i.madeToOrder && <Pill tone="green" size="sm">Made for you</Pill>}
                {!s.open && <Pill tone="neutral" size="sm">Closed just now</Pill>}
              </div>
              <p className="mt-1 text-xs leading-relaxed" style={{ color: v("--ux-muted") }}>{i.detail}</p>

              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold"
                      style={{ color: v("--ux-ink-2") }}>
                  <span className="grid h-[20px] w-[20px] place-items-center rounded-full text-2xs font-bold"
                        style={{ background: v("--ux-brand-tint-2"), color: v("--ux-brand") }}>
                    {s.name.charAt(0)}
                  </span>
                  {s.name}
                </span>
                <span className="rounded-full px-2 py-[2px] text-2xs font-bold"
                      style={{
                        background: v(s.tie === "circle" ? "--ux-tint-pink" : "--ux-surface-2"),
                        color: v(s.tie === "circle" ? "--ux-pink-ink" : "--ux-muted"),
                      }}>
                  {TIE_LABEL[s.tie]}
                </span>
                <span className="text-xs" style={{ color: v("--ux-muted") }}>{s.km} km</span>
              </div>

              {/* The quiet signals, in place of stars */}
              <div className="mt-2 flex flex-wrap gap-x-3.5 gap-y-1">
                {i.boughtByCircle > 0 && (
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold"
                        style={{ color: v("--ux-brand") }}>
                    <I name="Users" className="h-[12px] w-[12px]" />
                    {i.boughtByCircle} women you know bought this
                  </span>
                )}
                <span className="inline-flex items-center gap-1.5 text-xs"
                      style={{ color: v(s.complaints === 0 ? "--ux-green-ink" : "--ux-muted") }}>
                  <I name={s.complaints === 0 ? "Check" : "Minus"} className="h-[12px] w-[12px]" sw={2.6} />
                  {s.complaints === 0 ? "No complaints, ever" : `${s.complaints} complaint`}
                </span>
                <span className="inline-flex items-center gap-1.5 text-xs" style={{ color: v("--ux-muted") }}>
                  <I name="Repeat" className="h-[12px] w-[12px]" />
                  {s.repeatBuyers} come back
                </span>
              </div>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-lg font-extrabold leading-none tabular-nums" style={{ color: v("--ux-ink") }}>
                {formatRupees(i.minor)}
              </p>
              {i.stock !== null && (
                <p className="mt-1 text-2xs" style={{ color: v("--ux-muted") }}>{i.stock} left</p>
              )}
            </div>
          </div>
        </Link>
        <div className="flex gap-2 border-t px-4 py-3" style={{ borderColor: v("--ux-line") }}>
          <Btn size="sm" full href={`/app/market/${i.id}`}>
            {i.kind === "service" ? "Book her" : i.madeToOrder ? "Ask her to make it" : "Buy"}
          </Btn>
          <Btn size="sm" variant={isSaved ? "soft" : "ghost"} icon={isSaved ? "Heart" : "Heart"}
               onClick={() => save(i.id)}>
            {isSaved ? "Saved" : "Save"}
          </Btn>
        </div>
      </Card>
    );
  };

  return (
    <HomeShell active="/app/market">
      <div className="flex flex-col gap-5">

        <header className="flex flex-wrap items-end gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-2xs font-extrabold uppercase tracking-[0.2em]" style={{ color: v("--ux-brand") }}>
              The market
            </p>
            <h1 className="mt-2 text-[clamp(1.5rem,3.2vw,2.125rem)] font-extrabold leading-[1.1] tracking-[-0.035em]"
                style={{ color: v("--ux-ink") }}>
              Buy from women you know
            </h1>
            <p className="mt-1.5 max-w-[56ch] text-sm leading-relaxed" style={{ color: v("--ux-muted") }}>
              Your circle first, then women you have bought from, then women near you. Everything
              here is made or sold by someone whose name you can say.
            </p>
          </div>
          <Btn variant="outline" icon="Store" href="/app/shop">Your own shop</Btn>
        </header>

        {/* Pot payout — surfaced, never pushed */}
        {POT_PAYOUT.due && (
          <Card style={{ borderColor: v("--ux-brand") }}>
            <div className="flex flex-wrap items-start gap-4">
              <IconTile icon="Coins" tint="--ux-brand-tint" ink="--ux-brand" size={46} radius={13} />
              <div className="min-w-0 flex-1">
                <p className="text-base font-bold" style={{ color: v("--ux-ink") }}>
                  Your pot pays out {POT_PAYOUT.whenText}
                </p>
                <p className="mt-1 max-w-[54ch] text-xsm leading-relaxed" style={{ color: v("--ux-ink-2") }}>
                  {formatRupees(POT_PAYOUT.minor)} is yours to do whatever you like with. If some
                  of it is going to be spent anyway, spending it here keeps it among women you know.
                  <b> Nobody will ask you to.</b>
                </p>
              </div>
              <Btn variant="outline" href="/app/circles">See the pot</Btn>
            </div>
          </Card>
        )}

        {note && (
          <Card pad={16} style={{ background: v("--ux-tint-green"), borderColor: "transparent" }}>
            <p className="flex items-center gap-2 text-xsm font-semibold" style={{ color: v("--ux-green-ink") }}>
              <I name="CheckCircle2" className="h-[16px] w-[16px]" />{note}
            </p>
          </Card>
        )}

        <Card>
          <div className="grid gap-4 sm:grid-cols-3">
            <Stat value={String(circleCount)} label="Things your circle sells" icon="Users"
                  tint="--ux-tint-pink" ink="--ux-pink-ink" />
            <Stat value={String(openSellers)} label="Women open right now" icon="Store"
                  tint="--ux-tint-green" ink="--ux-green-ink" />
            <Stat value={String(saved.length)} label="You have saved" icon="Heart"
                  tint="--ux-tint-violet" ink="--ux-violet" />
          </div>
        </Card>

        <div>
          <SectionHead title="For you" sub="Closest to you first — not whoever paid to be at the top"
                       icon="ShoppingBasket" chip={String(shown.length)} />
          <div className="mb-3.5 flex flex-wrap gap-2">
            <Chip icon="LayoutGrid" selected={filter === "all"} onClick={() => setFilter("all")}>Everything</Chip>
            <Chip icon="Users" selected={filter === "circle"} onClick={() => setFilter("circle")}>My circle</Chip>
            <Chip icon="UtensilsCrossed" selected={filter === "food"} onClick={() => setFilter("food")}>Food</Chip>
            <Chip icon="Scissors" selected={filter === "service"} onClick={() => setFilter("service")}>Someone to do it</Chip>
            <Chip icon="Sparkles" selected={filter === "made"} onClick={() => setFilter("made")}>Made for you</Chip>
          </div>

          {shown.length === 0 ? (
            <Card><EmptyState icon="ShoppingBasket" title={COPY.nothingHereYet}
                              body="Try another filter — or invite a woman whose trade is missing from your circle."
                              action={<Btn size="sm" variant="outline" onClick={() => setFilter("all")}>Show everything</Btn>} /></Card>
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
              whether buyers came back and whether anyone complained — much harder to fake, and there
              from the very first order.
            </p>
          </div>
        </Card>
      </div>
    </HomeShell>
  );
}
