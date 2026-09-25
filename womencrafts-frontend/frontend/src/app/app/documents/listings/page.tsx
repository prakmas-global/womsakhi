"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";

import { HomeShell } from "@/components/ux/home/HomeShell";
import * as Icons from "@/components/ux/icons";
import { Back, Btn, Card, EmptyState, IconTile, SourceNote, formatRupees, v } from "@/components/ux/kit";
import { GROUP, GROUP_ROW } from "@/components/ux/earn/phone";
import { useResource } from "@/lib/use-resource";
import { apiListings, type Listing } from "@/lib/shop-api";
import { useT } from "@/i18n";

const STATUS: Record<string, { label: string; tint: string; ink: string }> = {
  live:   { label: "Live",   tint: "--ux-tint-green",  ink: "--ux-green-ink" },
  paused: { label: "Paused", tint: "--ux-tint-amber",  ink: "--ux-amber-ink" },
};
const UNKNOWN_STATUS = { label: "—", tint: "--ux-surface-2", ink: "--ux-muted" };

/* No "draft": a listing is live or paused and there is no third state, so the
   tab that offered drafts could never have had anything in it. */
type Filter = "all" | "product" | "service" | "live" | "paused";

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
  const tr = useT();
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");

  /**
   * Her real shop. This table used to render a fixture of six listings —
   * "Handmade cotton kurta, WK-CK-001, 412 views, 9 orders" — for every woman,
   * on the one screen built so she can audit her own shop and find the listing
   * she paused in June and forgot.
   */
  const listings = useResource<Listing[]>(
    useCallback((sig: AbortSignal) => apiListings(sig), []),
    [],
  );
  const all = listings.data;

  const counts = useMemo(() => ({
    all: all.length,
    product: all.filter((l) => l.kind === "product").length,
    service: all.filter((l) => l.kind === "service").length,
    live: all.filter((l) => l.status === "live").length,
    paused: all.filter((l) => l.status === "paused").length,
  }), [all]);

  const shown = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    return all.filter((l) => {
      if (filter === "product" || filter === "service") { if (l.kind !== filter) return false; }
      else if (filter !== "all" && l.status !== filter) return false;
      if (!words.length) return true;
      const hay = `${l.title} ${l.category}`.toLowerCase();
      return words.every((w) => hay.includes(w));
    });
  }, [all, filter, q]);

  const totals = useMemo(() => ({
    views: all.reduce((s, l) => s + l.views, 0),
    orders: all.reduce((s, l) => s + (l.orders ?? 0), 0),
  }), [all]);

  const TABS: { id: Filter; label: string; n: number }[] = [
    { id: "all",     label: "All",      n: counts.all },
    { id: "product", label: "Products", n: counts.product },
    { id: "service", label: "Services", n: counts.service },
    { id: "live",    label: "Live",     n: counts.live },
    { id: "paused",  label: "Paused",   n: counts.paused },
  ];

  return (
    <HomeShell
      active="/app/documents"
      rail={
        <div className="space-y-[16px]">
          <div className="relative overflow-hidden rounded-[16px] p-[20px]"
               style={{ background: "linear-gradient(140deg, var(--ux-tint-lilac), var(--ux-tint-pink))" }}>
            <IconTile icon="Package" tint="--ux-surface" ink="--ux-brand" size={38} radius={11} />
            <h3 className="mt-3 text-sm font-bold" style={{ color: v("--ux-ink") }}>{tr("documentsListings.growYourShop")}</h3>
            <p className="mt-1.5 text-xs leading-relaxed" style={{ color: v("--ux-muted") }}>
              {tr("documentsListings.moreListingsMeansMoreWaysA")}
            </p>
            <div className="mt-3">
              <Btn href="/app/documents/new" size="sm" icon="Plus">{tr("documentsListings.addNew")}</Btn>
            </div>
          </div>

          <Card>
            <h2 className="text-base font-extrabold" style={{ color: v("--ux-ink") }}>
              {tr("documentsListings.whatSellsBetter")}
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
                {tr("documentsListings.getMyShopLink")}
              </Btn>
            </div>
          </Card>

          <Card>
            <h2 className="text-base font-extrabold" style={{ color: v("--ux-ink") }}>{tr("documentsListings.needAHand")}</h2>
            <p className="mt-1.5 text-xs leading-relaxed" style={{ color: v("--ux-muted") }}>
              {tr("documentsListings.sakhiCanWriteADescriptionSuggest")}
            </p>
            <div className="mt-3">
              <Btn href="/app/sakhi" size="sm" variant="outline" full icon="Sparkles" iconEnd="ArrowRight">
                {tr("nav.sakhi")}
              </Btn>
            </div>
          </Card>
        </div>
      }
    >
      <Back to="/app/documents" label={tr("ch.documents.label")} className="mb-4" />

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4 lg:mb-5">
        <div className="min-w-0">
          <h1 className="ux-screen-title text-3xl font-extrabold leading-[1.15] tracking-[-0.02em]"
              style={{ color: v("--ux-ink") }}>
            {tr("documents.whatYouSell")}
          </h1>
          <p className="mt-1.5 text-sm" style={{ color: v("--ux-muted") }}>
            {tr("documentsListings.everythingInYourShopAndHow")}
          </p>
        </div>
        <Btn href="/app/documents/new" icon="Plus" className="ux-action-primary">{tr("documentsListings.addProductOrService")}</Btn>
      </div>

      {/* ── The five numbers ─────────────────────────────────────────────── */}
      {/* On a phone: one group, a row per number, the figure on the end. */}
      <div className={`mb-6 grid gap-2.5 sm:grid-cols-3 lg:mb-4 xl:grid-cols-5 ${GROUP}`}>
        {[
          { n: counts.all,     label: "Listings",  icon: "Package",   tint: "--ux-tint-violet", ink: "--ux-violet-ink" },
          { n: counts.live,    label: "Live",      icon: "Radio",     tint: "--ux-tint-green",  ink: "--ux-green-ink" },
          { n: counts.paused,  label: "Paused",    icon: "PauseCircle", tint: "--ux-tint-amber", ink: "--ux-amber-ink" },
          { n: totals.views,   label: "Views",     icon: "Eye",       tint: "--ux-tint-blue",   ink: "--ux-blue-ink" },
          { n: totals.orders,  label: "Orders",    icon: "ShoppingBasket", tint: "--ux-tint-pink", ink: "--ux-pink-ink" },
        ].map((s) => (
          <Card key={s.label} pad={14} className={`max-lg:py-2.5! ${GROUP_ROW}`}>
            <div className="flex items-center gap-2.5 max-lg:gap-3">
              <IconTile icon={s.icon} tint={s.tint} ink={s.ink} size={32} radius={9} />
              <span className="min-w-0 max-lg:flex max-lg:flex-1 max-lg:flex-row-reverse max-lg:items-center max-lg:justify-between max-lg:gap-3">
                <span className="block text-lg font-extrabold leading-none" style={{ color: v("--ux-ink") }}>
                  {s.n}
                </span>
                <span className="mt-1 block truncate text-2xs max-lg:mt-0 max-lg:text-[15px]" style={{ color: v("--ux-muted") }}>{s.label}</span>
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
        <div className="flex min-w-[220px] flex-1 items-center gap-2 rounded-[12px] border px-4 sm:max-w-[280px] lg:rounded-[10px] lg:px-3"
             style={{ borderColor: v("--ux-line"), background: v("--ux-surface") }}>
          <Icons.Search className="h-[15px] w-[15px] shrink-0" style={{ color: v("--ux-muted") }} />
          <input value={q} onChange={(e) => setQ(e.target.value)}
                 placeholder={tr("documentsListings.findInYourShop")} aria-label={tr("documentsListings.findInYourShop2")}
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
          <EmptyState icon="Package" title={tr("events.emptyAll")}
                      body={tr("documentsListings.addTheFirstThingYouSell")}
                      action={<Btn href="/app/documents/new" icon="Plus">{tr("documentsListings.addProductOrService")}</Btn>} />
        </Card>
      )}

      <SourceNote source={listings.source} what="these listings" />

      {/* ── Share it ─────────────────────────────────────────────────────── */}
      <div className="mt-6 flex flex-wrap items-center gap-4 rounded-[16px] p-4 lg:mt-4 lg:p-5"
           style={{ background: v("--ux-brand-tint") }}>
        <IconTile icon="TrendingUp" tint="--ux-surface" ink="--ux-brand" size={40} radius={12} />
        <div className="min-w-[240px] flex-1">
          <p className="text-sm font-bold" style={{ color: v("--ux-ink") }}>
            {tr("documentsListings.aShopNobodyKnowsAboutSells")}
          </p>
          <p className="mt-1 text-xsm leading-relaxed" style={{ color: v("--ux-muted") }}>
            {tr("documentsListings.sendYourLinkToTheGroups")}
          </p>
        </div>
        <Btn href="/app/collect" icon="Share2" iconEnd="ArrowRight" className="max-lg:w-full">{tr("documentsListings.shareMyShop")}</Btn>
      </div>
    </HomeShell>
  );
}

/** One listing — a table row on a desktop, a stacked block on a phone. */
function Row({ l }: { l: Listing }) {
  const tr = useT();
  const s = STATUS[l.status] ?? UNKNOWN_STATUS;
  return (
    /* On a phone the eight cells run as ONE wrapped line of facts under the
       title — two or three lines a row, not eight stacked cells. */
    <div className="grid gap-3 border-b px-4 py-3.5 last:border-b-0 max-lg:relative max-lg:flex max-lg:flex-wrap max-lg:items-center max-lg:gap-x-3 max-lg:gap-y-2 xl:grid-cols-[minmax(0,3.2fr)_86px_128px_104px_108px_62px_66px_40px] xl:items-center"
         style={{ borderColor: v("--ux-line") }}>
      {/* What it is */}
      <div className="flex min-w-0 items-center gap-3 max-lg:basis-full max-lg:pe-12">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={l.photo} alt="" loading="lazy" decoding="async"
             className="h-[52px] w-[52px] shrink-0 rounded-[10px] object-cover"
             style={{ background: v("--ux-surface-2") }} />
        <div className="min-w-0">
          <Link href={`/app/documents/${l.kind}/${l.id}`}
                className="ux-sq block text-xsm font-bold leading-snug" style={{ color: v("--ux-ink") }}>
            {l.title}
          </Link>
          {/* Her category and the real date she listed it. There is no SKU
              on a listing, so the code that used to sit here was invented. */}
          <p className="mt-0.5 text-2xs" style={{ color: v("--ux-faint") }}>
            {[l.category, l.created_at ? `added ${addedOn(l.created_at)}` : ""]
              .filter(Boolean).join(" · ")}
          </p>
        </div>
      </div>

      {/* Type */}
      <div>
        <span className="inline-block rounded-full px-2.5 py-1 text-2xs font-bold capitalize lg:rounded-[8px] lg:px-2"
              style={{ background: v(l.kind === "product" ? "--ux-tint-violet" : "--ux-tint-blue"),
                       color: v(l.kind === "product" ? "--ux-violet-ink" : "--ux-blue-ink") }}>
          {l.kind}
        </span>
      </div>

      {/* Price */}
      <div>
        {/* Amounts are paise, like everywhere else. The struck-through "was"
            price and the discount badge are gone: nothing records a previous
            price, so both were computed from numbers that did not exist. */}
        {l.price_mode === "quote" ? (
          <span className="text-xsm font-bold" style={{ color: v("--ux-ink") }}>{tr("documentsListings.byQuote")}</span>
        ) : (
          <span className="text-xsm font-bold" style={{ color: v("--ux-ink") }}>
            {l.price_label || formatRupees(l.price_minor)}
          </span>
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
      <div className="text-[13px] lg:text-xs" style={{ color: v("--ux-ink-2") }}>
        {l.stock === null ? (
          <span style={{ color: v("--ux-muted") }}>{tr("documentsListings.byRequest")}</span>
        ) : l.stock === 0 ? (
          <span style={{ color: v("--ux-amber-ink") }}>{tr("documentsListings.noneLeft")}</span>
        ) : (
          <span>{l.stock} left</span>
        )}
      </div>

      <div className="text-[13px] lg:text-xs" style={{ color: v("--ux-ink-2") }}>
        <span className="xl:hidden" style={{ color: v("--ux-muted") }}>Views </span>{l.views}
      </div>
      <div className="text-[13px] lg:text-xs" style={{ color: v("--ux-ink-2") }}>
        <span className="xl:hidden" style={{ color: v("--ux-muted") }}>Orders </span>{l.orders ?? 0}
      </div>

      <div className="flex justify-start max-lg:absolute max-lg:end-4 max-lg:top-[18px] xl:justify-end">
        <Link href={`/app/documents/${l.kind}/${l.id}`}
              aria-label={`Edit ${l.title}`}
              className="ux-press ux-sq grid h-[34px] w-[34px] place-items-center rounded-[10px]"
              style={{ background: v("--ux-surface-2"), color: v("--ux-muted") }}>
          <Icons.MoreVertical className="h-[16px] w-[16px]" />
        </Link>
      </div>
    </div>
  );
}

/** "13 Aug 2026", from the ISO date the server returns. */
function addedOn(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}
