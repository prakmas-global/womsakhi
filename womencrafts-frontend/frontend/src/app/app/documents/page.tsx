"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import * as Icons from "@/components/ux/icons";

import { HomeShell } from "@/components/ux/home/HomeShell";
import { Btn, EmptyState, formatWholeRupees, plural } from "@/components/ux/kit";
import { useResource } from "@/lib/use-resource";
import {
  apiAdvanceOrder, apiDeleteListing, apiListings, apiPauseListing, apiShopOrders, apiShopSummary, apiUpdateListing,
  type Listing, type ShopOrder, type ShopSummary,
} from "@/lib/shop-api";
import { apiUploadImage } from "@/lib/uploads-api";
import { ListingCard, OrderCard, Storefront } from "./shop-parts";
import {
  Activity, EarnHero, Figure, GrowBanner, Head, Journey, NeedHelp, QuickActions,
  SellTips, SuccessStory, WaysToEarn, type Happening, type Step,
} from "./earn-home";
import { useT } from "@/i18n";

/**
 * My Shop.
 *
 * ── What she came for, in order ────────────────────────────────────────────
 * Orders first, because stock does not go cold and a buyer does. Then what she
 * sells, with every control she uses weekly — stock, pause, photo, share — on
 * the card itself rather than behind an edit screen. Then her own storefront,
 * because a seller choosing prices and photos without seeing what the buyer
 * sees is working blind.
 */

export default function ShopPage() {
  const tr = useT();
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Listing | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: summary, refetch: reSummary } =
    useResource(useCallback((s?: AbortSignal) => apiShopSummary(s), []), null as ShopSummary | null);
  const { data: listings, refetch: reListings } =
    useResource(useCallback((s?: AbortSignal) => apiListings(s), []), [] as Listing[]);
  const { data: orders, refetch: reOrders } =
    useResource(useCallback((s?: AbortSignal) => apiShopOrders(s), []), [] as ShopOrder[]);

  /**
   * One line, in her words, then gone.
   *
   * Two renders of this whole screen per confirmation — one to show the line,
   * one 2.6 seconds later to take it away. Everything below is arranged so
   * that neither of them costs a re-filter of the orders or a re-render of a
   * single card.
   */
  const say = useCallback((msg: string) => {
    setNote(msg);
    window.setTimeout(() => setNote((n) => (n === msg ? null : n)), 2600);
  }, []);

  const needs = useMemo(() => orders.filter((o) => o.needs_her), [orders]);
  const rest = useMemo(() => orders.filter((o) => !o.needs_her), [orders]);
  const live = useMemo(
    () => listings.filter((l) => l.status !== "paused").length, [listings]);

  /**
   * The four figures, every one of them countable by her.
   *
   * `/shop/summary` carries this month and last month; it carries no "pending
   * payments" total, so rather than invent one this adds up the orders that
   * have not finished — money she is owed and can go and see, order by order.
   */
  const figures = useMemo(() => {
    const month = summary?.month_minor ?? 0;
    const last = summary?.last_month_minor ?? 0;
    const change = last > 0 ? Math.round(((month - last) / last) * 100) : 0;

    const open = orders.filter((o) => o.next_state !== null);
    const owed = open.reduce((n, o) => n + o.total_minor, 0);

    const products = listings.filter((l) => l.kind === "product" && l.status !== "paused").length;
    const services = live - products;

    return {
      month: formatWholeRupees(Math.round(month / 100)),
      // "-100% this month" is arithmetically right and cruel: it is what a
      // woman who has not sold anything yet this month would be shown as the
      // first line on the screen. Say the plain fact instead.
      change: month === 0 ? "Nothing yet this month"
            : change > 0 ? `+${change}% on last month`
            : change < 0 ? `${change}% on last month`
            : "Same as last month",
      up: change > 0,
      owed: formatWholeRupees(Math.round(owed / 100)),
      owedNote: `${open.length} ${plural("order", open.length)}`,
      orders: String(orders.length),
      needs: needs.length > 0 ? `${needs.length} waiting on you` : "All up to date",
      live: String(live),
      mix: `${products} ${plural("product", products)} \u00b7 ${services} ${plural("service", services)}`,
    };
  }, [summary, orders, listings, live, needs.length]);

  /**
   * Five steps, checked against her real shop.
   *
   * Not a percentage of profile fields — a form is not a business. Each of
   * these changes how much she sells, and each is true or false from data
   * already on this screen.
   */
  const steps: Step[] = useMemo(() => [
    { label: "Add your first thing to sell",
      done: listings.length > 0 },
    { label: "Put a photo on every listing \u2014 they get looked at three times as often",
      done: listings.length > 0 && listings.every((l) => !!l.photo) },
    { label: "Offer a service as well as products",
      done: listings.some((l) => l.kind === "service") },
    { label: "Take your first order",
      done: orders.length > 0 },
    { label: "Win a buyer who comes back",
      done: (summary?.repeat_buyers_pct ?? 0) > 0 },
  ], [listings, orders.length, summary]);

  /** The last four things that happened, newest first, all of them real. */
  const activity: Happening[] = useMemo(() => orders.slice(0, 4).map((o) => {
    const photo = listings.find((l) => l.id === o.listing_id)?.photo;
    return {
      id: o.id,
      title: o.title,
      what: o.needs_her && o.next_state ? `Waiting on you \u2014 ${o.next_state}` : o.state,
      when: o.placed_on,
      // Green "+ ₹450" beside "Cancelled" is money she never got.
      amount: /cancel|refund/i.test(o.state) ? undefined : o.total_label,
      photo: photo || undefined,
      icon: "Package", tint: "--ux-tint-pink", ink: "--ux-pink-ink",
      href: `/app/documents/order/${o.id}`,
    };
  }), [orders, listings]);

  /** PATCH replaces the whole listing, so every field must be sent back. */
  const patch = useCallback((l: Listing, over: Partial<Listing>) => apiUpdateListing(l.id, {
    kind: l.kind, title: l.title, desc: l.desc, price_minor: l.price_minor,
    rate: l.rate, stock: l.stock, category: l.category, place: l.place,
    travels_km: l.travels_km, photo: l.photo,
    ...over,
  } as Parameters<typeof apiUpdateListing>[1]), []);

  /**
   * Every handler below is stable, and takes the row it acts on.
   *
   * A `ListingCard` is memoised; an inline `onPause={() => onPause(l)}` would
   * hand it a brand-new function on every render and defeat that entirely.
   */
  const onPhoto = useCallback(async (l: Listing, file: File) => {
    setBusy(l.id); setError(null);
    try {
      const up = await apiUploadImage(file, "attachment");
      await patch(l, { photo: up.url });
      reListings();
      say("Photo added — it is live in your shop");
    } catch { setError("That photo did not upload. Try again in a moment."); }
    finally { setBusy(null); }
  }, [patch, reListings, say]);

  const onStock = useCallback(async (l: Listing, next: number) => {
    setBusy(l.id); setError(null);
    try {
      await patch(l, { stock: next });
      reListings();
      say(next === 0 ? "Marked sold out — buyers see it greyed" : `Stock is now ${next}`);
    } catch { setError("Could not change the stock."); }
    finally { setBusy(null); }
  }, [patch, reListings, say]);

  const onPause = useCallback(async (l: Listing) => {
    const paused = l.status !== "paused";
    setBusy(l.id); setError(null);
    try {
      await apiPauseListing(l.id, paused);
      reListings(); reSummary();
      say(paused ? tr("documents.pausedBuyersCannotSeeItNow")
              : tr("documents.backInYourShop"));
    } catch { setError("Could not change that listing."); }
    finally { setBusy(null); }
  }, [reListings, reSummary, say, tr]);

  /**
   * Remove a listing for good.
   *
   * The last missing letter of CRUD here: the shop could pause and edit but
   * never delete, so a thing she stopped making sat in her shop forever, or
   * lived permanently paused where she still had to scroll past it.
   *
   * Asks first, and says what pausing would do instead — for most of what a
   * woman wants to take down, pausing is the right answer and deleting loses
   * the photographs she took.
   */
  const onDelete = useCallback(async (l: Listing) => {
    setBusy(l.id); setError(null);
    try {
      await apiDeleteListing(l.id);
      reListings(); reSummary();
      say(`"${l.title}" removed from your shop`);
    } catch { setError("Could not remove that. It is still in your shop."); }
    finally { setBusy(null); setConfirmDelete(null); }
  }, [reListings, reSummary, say]);

  /**
   * The link a buyer can actually open.
   *
   * `/shop/<id>` did not exist: this copied it anyway and said "Link copied —
   * send it on WhatsApp", so five buttons put a 404 into a customer's chat
   * under her name. The page exists now — `src/app/(open)/shop/[id]` — and it
   * needs no account, which is the point.
   *
   * A paused listing has no page on purpose: a buyer must not be shown
   * something she cannot buy. So the link is still copied, because she may be
   * getting it ready — and the confirmation says what a buyer would see,
   * rather than telling her it is live when it is not.
   */
  const onShare = useCallback(async (l: Listing) => {
    const url = `${window.location.origin}/shop/${l.id}`;
    const paused = l.status === "paused";
    const done = paused
      ? "Link copied — but this is paused, so a buyer opening it sees nothing. Put it back in your shop first."
      : "Link copied — send it on WhatsApp";
    try { await navigator.clipboard.writeText(url); say(done); }
    catch { say(url); }        // no clipboard: show it so she can copy it herself
  }, [say]);

  const onAdvance = useCallback(async (o: ShopOrder) => {
    setBusy(o.id); setError(null);
    try {
      await apiAdvanceOrder(o.id);
      reOrders(); reSummary();
      say(`${o.title} — the buyer has been told`);
    } catch { setError("Could not move that order on."); }
    finally { setBusy(null); }
  }, [reOrders, reSummary, say]);

  const rail = (
    <div className="space-y-4">
      <QuickActions />
      <div>
        <Head icon="Eye" title={tr("documents.whatBuyersSee")} />
        <Storefront summary={summary} listings={listings} />
      </div>
      <SellTips />
      <SuccessStory />
      <NeedHelp />
    </div>
  );

  return (
    <HomeShell active="/app/documents" rail={rail} loadFailed="your shop">
      <div className="flex flex-col">
        <EarnHero />

        <div className="mb-5 grid gap-3.5"
             style={{ gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))" }}>
          <Figure label="Earned this month" value={figures.month} note={figures.change}
                  noteTone={figures.up ? "up" : "plain"} icon="Wallet"
                  tint="--ux-tint-green" ink="--ux-green-ink" href="/app/wallet" />
          <Figure label="Waiting to be paid" value={figures.owed} note={figures.owedNote}
                  icon="Hourglass" tint="--ux-tint-amber" ink="--ux-amber-ink" href="/app/documents#orders" />
          <Figure label="Total orders" value={figures.orders} note={figures.needs}
                  icon="ShoppingBag" tint="--ux-tint-violet" ink="--ux-violet-ink" href="/app/documents#orders" />
          <Figure label="Live listings" value={figures.live} note={figures.mix}
                  icon="Package" tint="--ux-tint-blue" ink="--ux-blue-ink" href="/app/documents/listings" />
        </div>

        <Journey steps={steps} />
        <WaysToEarn />

        {activity.length > 0 && <Activity rows={activity} />}

        {error && (
          <p className="mb-4 rounded-[12px] px-4 py-3 text-xsm font-semibold"
             style={{ background: "var(--ux-danger-tint)", color: "var(--ux-danger-solid)" }}>
            {error}
          </p>
        )}

        <div id="orders" style={{ scrollMarginTop: "calc(var(--ux-topbar-h) + 16px)" }}>
          <main className="min-w-0">
            <Head icon="ClipboardList"
                  title={needs.length > 0 ? "Orders waiting on you" : "Orders"}
                  sub={orders.length > 0
                    ? `${orders.length} ${plural("order", orders.length)} in all`
                    : undefined} />

            {confirmDelete && (
              <div className="mb-4 rounded-[16px] p-5"
                   style={{ background: "var(--ux-surface)", border: `1px solid var(--ux-danger-solid)` }}>
                <p className="text-smd font-bold" style={{ color: "var(--ux-ink)" }}>
                  Remove &ldquo;{confirmDelete.title}&rdquo; from your shop?
                </p>
                <p className="mt-1.5 text-xsm leading-relaxed" style={{ color: "var(--ux-muted)" }}>
                  This cannot be undone, and the photographs go with it. If you have only stopped
                  making it for now, pause it instead — it comes back exactly as it was.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Btn size="sm" onClick={() => onDelete(confirmDelete)}>{tr("documents.yesRemoveIt")}</Btn>
                  <Btn size="sm" variant="outline"
                       onClick={() => { onPause(confirmDelete); setConfirmDelete(null); }}>{tr("documents.pauseItInstead")}</Btn>
                  <Btn size="sm" variant="ghost" onClick={() => setConfirmDelete(null)}>{tr("documents.keepIt")}</Btn>
                </div>
              </div>
            )}

            {orders.length === 0 ? (
              <div className="rounded-[16px] p-6"
                   style={{ background: "var(--ux-surface)", border: "1px solid var(--ux-line)" }}>
                <EmptyState
                  icon="Package"
                  title={tr("documents.noOrdersYet")}
                  body="They land here the moment somebody buys. Most first orders come from someone who already knows you — send them your shop link."
                  action={<Btn size="sm" href="/app/collect" icon="QrCode">{tr("documents.getYourShopLink")}</Btn>}
                />
              </div>
            ) : (
              <>
                {needs.map((o) => (
                  <OrderCard key={o.id} o={o} busy={busy === o.id} onAdvance={onAdvance} />
                ))}
                {rest.slice(0, 3).map((o) => (
                  <OrderCard key={o.id} o={o} busy={busy === o.id} onAdvance={onAdvance} />
                ))}
              </>
            )}

            <Head icon="Package" title={tr("documents.whatYouSell")}
                  sub="Stock, pause, photo and share are on the card itself"
                  more={tr("documents.addSomething")} href="/app/documents/product/new" />

            <div className="grid gap-3.5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))" }}>
              {listings.map((l) => (
                <ListingCard key={l.id} l={l} busy={busy === l.id}
                             onPhoto={onPhoto} onStock={onStock}
                             onPause={onPause} onShare={onShare}
                             onDelete={() => setConfirmDelete(l)} />
              ))}
              <Link href="/app/documents/product/new"
                    className="ux-press grid min-h-[330px] place-content-center justify-items-center gap-2.5 rounded-[20px] text-center text-xsm font-bold leading-relaxed"
                    style={{ border: "1px dashed var(--ux-line-strong)", color: "var(--ux-brand)" }}>
                <Icons.Plus className="h-[30px] w-[30px]" />
                <span>{tr("documents.addAProduct")}<br />or a service</span>
              </Link>
            </div>
          </main>

        </div>

        <div className="mt-6">
          <GrowBanner />
        </div>

        {/* one line of confirmation, in her words */}
        <div className="ux-toast rounded-[12px] px-5 py-3.5 text-xsm font-bold"
             data-on={note ? "true" : "false"} role="status" aria-live="polite"
             style={{ background: "var(--ux-ink)", color: "var(--ux-canvas)",
                      boxShadow: "0 20px 44px -18px rgba(0,0,0,.6)",
                      pointerEvents: note ? undefined : "none" }}>
          {note}
        </div>
      </div>
    </HomeShell>
  );
}
