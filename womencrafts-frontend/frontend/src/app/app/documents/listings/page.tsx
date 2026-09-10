"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

import { HomeShell } from "@/components/ux/home/HomeShell";
import * as Icons from "@/components/ux/icons";
import { Back, Btn, Card, DemoNote, EmptyState, IconTile, v } from "@/components/ux/kit";
import {
  LISTINGS, discountPct, type ListingStatus, type SellerListing,
} from "@/components/ux/earn/data";

const money = (n: number) => `₹${n.toLocaleString("en-IN")}`;

const STATUS: Record<ListingStatus, { label: string; tint: string; ink: string }> = {
  active: { label: "Live",   tint: "--ux-tint-green",  ink: "--ux-green-ink" },
  paused: { label: "Paused", tint: "--ux-tint-amber",  ink: "--ux-amber-ink" },
  draft:  { label: "Draft",  tint: "--ux-surface-2",   ink: "--ux-muted" },
};

type Filter = "all" | "product" | "service" | "active" | "paused" | "draft";

/**
 * Everything she sells, in one table she can act on.
 *
 * ── Why a table and not cards ───────────────────────────────────────────────
 * This is the one screen in Earn she opens to COMPARE — which listing is being
 * looked at and not bought, which one is nearly out of stock, which one she
 * paused in June and forgot. Cards are for browsing; a woman auditing her own
 * shop needs the columns to line up so her eye can run down one of them.
 *
 * On a phone the same rows stack, because seven columns at 360px is not a
 * table, it is a puzzle.
 */
export default function MyListingsPage() {
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");

  const all = LISTINGS;

  const counts = useMemo(() => ({
    all: all.length,
    product: all.filter((l) => l.kind === "product").length,
    service: all.filter((l) => l.kind === "service").length,
    active: all.filter((l) => l.status === "active").length,
    paused: all.filter((l) => l.status === "paused").length,
    draft: all.filter((l) => l.status === "draft").length,
  }), [all]);

  const shown = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    return all.filter((l) => {
      if (filter === "product" || filter === "service") { if (l.kind !== filter) return false; }
      else if (filter !== "all" && l.status !== filter) return false;
      if (!words.length) return true;
      const hay = `${l.title} ${l.sku}`.toLowerCase();
      return words.every((w) => hay.includes(w));
    });
  }, [all, filter, q]);

  const totals = useMemo(() => ({
    views: all.reduce((s, l) => s + l.views, 0),
    orders: all.reduce((s, l) => s + l.orders, 0),
  }), [all]);

  const TABS: { id: Filter; label: string; n: number }[] = [
    { id: "all",     label: "All",      n: counts.all },
    { id: "product", label: "Products", n: counts.product },
    { id: "service", label: "Services", n: counts.service },
    { id: "active",  label: "Live",     n: counts.active },
    { id: "paused",  label: "Paused",   n: counts.paused },
    { id: "draft",   label: "Drafts",   n: counts.draft },
  ];

  return (
    <HomeShell
      active="/app/documents"
      rail={
        <div className="space-y-[16px]">
          <div className="relative overflow-hidden rounded-[16px] p-[20px]"
               style={{ background: "linear-gradient(140deg, var(--ux-tint-lilac), var(--ux-tint-pink))" }}>
            <IconTile icon="Package" tint="--ux-surface" ink="--ux-brand" size={38} radius={11} />
            <h3 className="mt-3 text-sm font-bold" style={{ color: v("--ux-ink") }}>Grow your shop</h3>
            <p className="mt-1.5 text-xs leading-relaxed" style={{ color: v("--ux-muted") }}>
              More listings means more ways a buyer can find you.
            </p>
            <div className="mt-3">
              <Btn href="/app/documents/new" size="sm" icon="Plus">Add new</Btn>
            </div>
          </div>

          <Card>
            <h2 className="text-base font-extrabold" style={{ color: v("--ux-ink") }}>
              What sells better
            </h2>
            <ul className="mt-3 space-y-2.5">
              {[
                { t: "Real photographs, not stock pictures", done: true },
                { t: "Say the size, the material, the time it takes", done: true },
                { t: "Price it near what women around you charge", done: true },
                { t: "Say how it reaches the buyer", done: true },
                { t: "Share your shop link where people already talk", done: false },
              ].map((x) => (
                <li key={x.t} className="flex items-start gap-2.5 text-xs leading-snug"
                    style={{ color: v(x.done ? "--ux-muted" : "--ux-ink-2") }}>
                  <Icons.CheckCircle2 className="mt-[1px] h-[15px] w-[15px] shrink-0"
                                      style={{ color: v(x.done ? "--ux-green-ink" : "--ux-faint") }} />
                  {x.t}
                </li>
              ))}
            </ul>
            <div className="mt-3">
              <Btn href="/app/collect" size="sm" variant="outline" full iconEnd="ArrowRight">
                Get my shop link
              </Btn>
            </div>
          </Card>

          <Card>
            <h2 className="text-base font-extrabold" style={{ color: v("--ux-ink") }}>Need a hand?</h2>
            <p className="mt-1.5 text-xs leading-relaxed" style={{ color: v("--ux-muted") }}>
              Sakhi can write a description, suggest a price, or tell you why something is not selling.
            </p>
            <div className="mt-3">
              <Btn href="/app/sakhi" size="sm" variant="outline" full icon="Sparkles" iconEnd="ArrowRight">
                Ask Sakhi
              </Btn>
            </div>
          </Card>
        </div>
      }
    >
      <Back to="/app/documents" label="Your shop" className="mb-4" />

      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-3xl font-extrabold leading-[1.15] tracking-[-0.02em]"
              style={{ color: v("--ux-ink") }}>
            What you sell
          </h1>
          <p className="mt-1.5 text-sm" style={{ color: v("--ux-muted") }}>
            Everything in your shop, and how each one is doing.
          </p>
        </div>
        <Btn href="/app/documents/new" icon="Plus">Add product or service</Btn>
      </div>

      {/* ── The six numbers ──────────────────────────────────────────────── */}
      <div className="mb-4 grid gap-2.5 sm:grid-cols-3 xl:grid-cols-6">
        {[
          { n: counts.all,     label: "Listings",  icon: "Package",   tint: "--ux-tint-violet", ink: "--ux-violet-ink" },
          { n: counts.active,  label: "Live",      icon: "Radio",     tint: "--ux-tint-green",  ink: "--ux-green-ink" },
          { n: counts.paused,  label: "Paused",    icon: "PauseCircle", tint: "--ux-tint-amber", ink: "--ux-amber-ink" },
          { n: counts.draft,   label: "Drafts",    icon: "FileText",  tint: "--ux-surface-2",   ink: "--ux-muted" },
          { n: totals.views,   label: "Views",     icon: "Eye",       tint: "--ux-tint-blue",   ink: "--ux-blue-ink" },
          { n: totals.orders,  label: "Orders",    icon: "ShoppingBasket", tint: "--ux-tint-pink", ink: "--ux-pink-ink" },
        ].map((s) => (
          <Card key={s.label} pad={14}>
            <div className="flex items-center gap-2.5">
              <IconTile icon={s.icon} tint={s.tint} ink={s.ink} size={32} radius={9} />
              <span className="min-w-0">
                <span className="block text-lg font-extrabold leading-none" style={{ color: v("--ux-ink") }}>
                  {s.n}
                </span>
                <span className="mt-1 block truncate text-2xs" style={{ color: v("--ux-muted") }}>{s.label}</span>
              </span>
            </div>
          </Card>
        ))}
      </div>

      {/* ── Filters ──────────────────────────────────────────────────────── */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="ux-noscroll flex items-center gap-1.5 overflow-x-auto">
          {TABS.map((t) => {
            const on = filter === t.id;
            return (
              <button key={t.id} type="button" onClick={() => setFilter(t.id)} aria-pressed={on}
                      className="ux-press ux-sq flex min-h-[34px] shrink-0 items-center gap-1.5 rounded-full px-3.5 text-xs font-semibold"
                      style={{ background: v(on ? "--ux-fill" : "--ux-surface-2"),
                               color: v(on ? "--ux-on-brand" : "--ux-ink-2") }}>
                {t.label} <span style={{ opacity: 0.75 }}>({t.n})</span>
              </button>
            );
          })}
        </div>
        <div className="flex min-w-[220px] flex-1 items-center gap-2 rounded-[10px] border px-3 sm:max-w-[280px]"
             style={{ borderColor: v("--ux-line"), background: v("--ux-surface") }}>
          <Icons.Search className="h-[15px] w-[15px] shrink-0" style={{ color: v("--ux-muted") }} />
          <input value={q} onChange={(e) => setQ(e.target.value)}
                 placeholder="Find in your shop…" aria-label="Find in your shop"
                 className="min-h-[38px] w-full bg-transparent text-xs outline-none"
                 style={{ color: v("--ux-ink") }} />
        </div>
      </div>

      {/* ── The listings ─────────────────────────────────────────────────── */}
      {shown.length ? (
        <Card pad={0} className="overflow-hidden">
          {/* Column names, on a screen wide enough to have columns. */}
          <div className="hidden grid-cols-[minmax(0,2.4fr)_90px_130px_110px_120px_70px_70px_44px] gap-3 border-b px-4 py-3 xl:grid"
               style={{ borderColor: v("--ux-line"), background: v("--ux-surface-2") }}>
            {["What you sell", "Type", "Price", "Status", "Stock", "Views", "Orders", ""].map((h) => (
              <span key={h} className="text-2xs font-bold uppercase tracking-[0.1em]"
                    style={{ color: v("--ux-muted") }}>{h}</span>
            ))}
          </div>

          {shown.map((l) => <Row key={l.id} l={l} />)}
        </Card>
      ) : (
        <Card>
          <EmptyState icon="Package" title="Nothing here yet"
                      body="Add the first thing you sell. It takes about two minutes, and you can change any of it later."
                      action={<Btn href="/app/documents/new" icon="Plus">Add product or service</Btn>} />
        </Card>
      )}

      <DemoNote what="These listings" />

      {/* ── Share it ─────────────────────────────────────────────────────── */}
      <div className="mt-4 flex flex-wrap items-center gap-4 rounded-[16px] p-5"
           style={{ background: v("--ux-brand-tint") }}>
        <IconTile icon="TrendingUp" tint="--ux-surface" ink="--ux-brand" size={40} radius={12} />
        <div className="min-w-[240px] flex-1">
          <p className="text-sm font-bold" style={{ color: v("--ux-ink") }}>
            A shop nobody knows about sells nothing.
          </p>
          <p className="mt-1 text-xsm leading-relaxed" style={{ color: v("--ux-muted") }}>
            Send your link to the groups you are already in. That is where the first orders come from.
          </p>
        </div>
        <Btn href="/app/collect" icon="Share2" iconEnd="ArrowRight">Share my shop</Btn>
      </div>
    </HomeShell>
  );
}

/** One listing — a table row on a desktop, a stacked block on a phone. */
function Row({ l }: { l: SellerListing }) {
  const s = STATUS[l.status];
  const off = discountPct(l);
  return (
    <div className="grid gap-3 border-b px-4 py-3.5 last:border-b-0 xl:grid-cols-[minmax(0,3.2fr)_86px_128px_104px_108px_62px_66px_40px] xl:items-center"
         style={{ borderColor: v("--ux-line") }}>
      {/* What it is */}
      <div className="flex min-w-0 items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={l.photo} alt="" loading="lazy" decoding="async"
             className="h-[52px] w-[52px] shrink-0 rounded-[10px] object-cover"
             style={{ background: v("--ux-surface-2") }} />
        <div className="min-w-0">
          <Link href={`/app/documents/${l.kind}/${l.id}`}
                className="ux-sq block text-xsm font-bold leading-snug" style={{ color: v("--ux-ink") }}>
            {l.title}
          </Link>
          <p className="mt-0.5 text-2xs" style={{ color: v("--ux-faint") }}>
            {l.sku} · added {l.addedOn}
          </p>
        </div>
      </div>

      {/* Type */}
      <div>
        <span className="inline-block rounded-[7px] px-2 py-1 text-2xs font-bold capitalize"
              style={{ background: v(l.kind === "product" ? "--ux-tint-violet" : "--ux-tint-blue"),
                       color: v(l.kind === "product" ? "--ux-violet-ink" : "--ux-blue-ink") }}>
          {l.kind}
        </span>
      </div>

      {/* Price */}
      <div>
        {l.priceMode === "quote" ? (
          <span className="text-xsm font-bold" style={{ color: v("--ux-ink") }}>By quote</span>
        ) : (
          <>
            <span className="text-xsm font-bold" style={{ color: v("--ux-ink") }}>
              {l.priceMode === "range" && l.rangeLow && l.rangeHigh
                ? `${money(l.rangeLow)} – ${money(l.rangeHigh)}`
                : money(l.price)}
            </span>
            {l.wasPrice && (
              <span className="ms-1.5 text-2xs line-through" style={{ color: v("--ux-faint") }}>
                {money(l.wasPrice)}
              </span>
            )}
            {off > 0 && (
              <span className="mt-0.5 block w-fit rounded-full px-1.5 py-0.5 text-2xs font-bold"
                    style={{ background: v("--ux-tint-pink"), color: v("--ux-pink-ink") }}>
                {off}% off
              </span>
            )}
          </>
        )}
      </div>

      {/* Status */}
      <div>
        <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-2xs font-bold"
              style={{ background: v(s.tint), color: v(s.ink) }}>
          <span aria-hidden className="h-[6px] w-[6px] rounded-full" style={{ background: "currentColor" }} />
          {s.label}
        </span>
      </div>

      {/* Stock */}
      <div className="text-xs" style={{ color: v("--ux-ink-2") }}>
        {l.stock === null ? (
          <span style={{ color: v("--ux-muted") }}>By request</span>
        ) : l.stock === 0 ? (
          <span style={{ color: v("--ux-amber-ink") }}>None left</span>
        ) : (
          <span>{l.stock} left</span>
        )}
      </div>

      <div className="text-xs" style={{ color: v("--ux-ink-2") }}>
        <span className="xl:hidden" style={{ color: v("--ux-muted") }}>Views </span>{l.views}
      </div>
      <div className="text-xs" style={{ color: v("--ux-ink-2") }}>
        <span className="xl:hidden" style={{ color: v("--ux-muted") }}>Orders </span>{l.orders}
      </div>

      <div className="flex justify-start xl:justify-end">
        <Link href={`/app/documents/${l.kind}/${l.id}`}
              aria-label={`Edit ${l.title}`}
              className="ux-press ux-sq grid h-[34px] w-[34px] place-items-center rounded-[9px]"
              style={{ background: v("--ux-surface-2"), color: v("--ux-muted") }}>
          <Icons.MoreVertical className="h-[16px] w-[16px]" />
        </Link>
      </div>
    </div>
  );
}
