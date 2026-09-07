"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import * as Icons from "@/components/ux/icons";

import { HomeShell } from "@/components/ux/home/HomeShell";
import { Btn, EmptyState } from "@/components/ux/kit";
import { useResource } from "@/lib/use-resource";
import {
  apiAdvanceOrder, apiListings, apiPauseListing, apiShopOrders, apiShopSummary, apiUpdateListing,
  type Listing, type ShopOrder, type ShopSummary,
} from "@/lib/shop-api";
import { apiUploadImage } from "@/lib/uploads-api";
import { Hero, ListingCard, OrderCard, Sec, Stats, Storefront } from "./shop-parts";

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
  const [busy, setBusy] = useState<string | null>(null);
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
      say(paused ? "Paused — buyers cannot see it now" : "Back in your shop");
    } catch { setError("Could not change that listing."); }
    finally { setBusy(null); }
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
          <p className="mb-4 rounded-[12px] px-4 py-3 text-[0.8125rem] font-semibold"
             style={{ background: "var(--ux-danger-tint)", color: "var(--ux-danger-solid)" }}>
            {error}
          </p>
        )}

        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_336px]">
          <main className="min-w-0">
            <Sec action={
              <Link href="/app/documents" className="ux-press flex min-h-[34px] items-center rounded-[12px] px-3 text-[0.75rem] font-bold"
                    style={{ color: "var(--ux-brand)" }}>All {orders.length}</Link>
            }>
              {needs.length > 0 ? "Orders waiting on you" : "Orders"}
            </Sec>

            {orders.length === 0 ? (
              <div className="rounded-[16px] p-6"
                   style={{ background: "var(--ux-surface)", border: "1px solid var(--ux-line)" }}>
                <EmptyState
                  icon="Package"
                  title="No orders yet"
                  body="They land here the moment somebody buys. Most first orders come from someone who already knows you — send them your shop link."
                  action={<Btn size="sm" href="/app/collect" icon="QrCode">Get your shop link</Btn>}
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
                    className="ux-press flex min-h-[34px] items-center gap-1.5 rounded-[12px] px-3 text-[0.75rem] font-bold"
                    style={{ color: "var(--ux-brand)" }}>
                <Icons.Plus className="h-[13px] w-[13px]" /> Add something
              </Link>
            }>
              What you sell
            </Sec>

            <div className="grid gap-3.5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))" }}>
              {listings.map((l) => (
                <ListingCard key={l.id} l={l} busy={busy === l.id}
                             onPhoto={onPhoto} onStock={onStock}
                             onPause={onPause} onShare={onShare} />
              ))}
              <Link href="/app/documents/product/new"
                    className="ux-press grid min-h-[330px] place-content-center justify-items-center gap-2.5 rounded-[20px] text-center text-[0.8125rem] font-bold leading-relaxed"
                    style={{ border: "1px dashed var(--ux-line-strong)", color: "var(--ux-brand)" }}>
                <Icons.Plus className="h-[30px] w-[30px]" />
                <span>Add a product<br />or a service</span>
              </Link>
            </div>
          </main>

          <aside>
            <Sec>What buyers see</Sec>
            <Storefront summary={summary} listings={listings} />
          </aside>
        </div>

        {/* one line of confirmation, in her words */}
        <div className="ux-toast rounded-[12px] px-5 py-3.5 text-[0.8125rem] font-bold"
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
