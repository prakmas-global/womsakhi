"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import * as Icons from "@/components/ux/icons";

import { HomeShell } from "@/components/ux/home/HomeShell";
import { Btn, EmptyState } from "@/components/ux/kit";
import { useResource } from "@/lib/use-resource";
import {
  apiAdvanceOrder, apiDeleteListing, apiListings, apiPauseListing, apiShopOrders, apiShopSummary, apiUpdateListing,
  type Listing, type ShopOrder, type ShopSummary,
} from "@/lib/shop-api";
import { apiUploadImage } from "@/lib/uploads-api";
import { Hero, ListingCard, OrderCard, Sec, Stats, Storefront } from "./shop-parts";
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
  }, [reListings, reSummary, say]);

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

  const onShare = useCallback(async (l: Listing) => {
    const url = `${window.location.origin}/shop/${l.id}`;
    try { await navigator.clipboard.writeText(url); say("Link copied — send it on WhatsApp"); }
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

  return (
    <HomeShell active="/app/documents">
      <div className="flex flex-col">
        <Hero summary={summary} needs={needs.length} />
        <Stats summary={summary} needs={needs.length} live={live} />

        {error && (
          <p className="mb-4 rounded-[12px] px-4 py-3 text-xsm font-semibold"
             style={{ background: "var(--ux-danger-tint)", color: "var(--ux-danger-solid)" }}>
            {error}
          </p>
        )}

        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_336px]">
          <main className="min-w-0">
            <Sec action={
              <Link href="/app/documents" className="ux-press flex min-h-[34px] items-center rounded-[12px] px-3 text-xs font-bold"
                    style={{ color: "var(--ux-brand)" }}>All {orders.length}</Link>
            }>
              {needs.length > 0 ? "Orders waiting on you" : "Orders"}
            </Sec>

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

            <Sec action={
              <Link href="/app/documents/product/new"
                    className="ux-press flex min-h-[34px] items-center gap-1.5 rounded-[12px] px-3 text-xs font-bold"
                    style={{ color: "var(--ux-brand)" }}>
                <Icons.Plus className="h-[13px] w-[13px]" />{tr("documents.addSomething")}</Link>
            }>{tr("documents.whatYouSell")}</Sec>

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

          <aside>
            <Sec>{tr("documents.whatBuyersSee")}</Sec>
            <Storefront summary={summary} listings={listings} />
          </aside>
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
