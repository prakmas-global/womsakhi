"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import * as Icons from "@/components/ux/icons";

import { HomeShell } from "@/components/ux/home/HomeShell";
import { useResource } from "@/lib/use-resource";
import { apiApplications, apiApply, apiOpportunities, apiToggleSaveOpportunity,
         type Application, type Opportunity } from "@/lib/growth-api";
import { apiGroupBuys, apiJoinBuy, apiLeaveBuy, type GroupBuy } from "@/lib/entitlements-api";
import { apiAdvanceOrder, apiListings, apiShopOrders,
         type Listing, type ShopOrder } from "@/lib/shop-api";
import { apiWallet } from "@/lib/wallet-api";
import { Board, Feed, isOpen, Ledger, Magazine, rupees,
         type Acts, type EarnData } from "./earn-views";

/**
 * Earn — one screen, four ways of seeing the same work.
 *
 * ── Why four ───────────────────────────────────────────────────────────────
 * The women using this do not think about money the same way, and one layout
 * always suits somebody badly. A ledger reader wants columns she can add up; a
 * phone reader wants a stream; somebody juggling six things wants to see what
 * is stuck and what has cleared; somebody deciding wants to be shown the one
 * best thing and told why. All four are built from the same props, so none can
 * drift into telling a different truth than its neighbour.
 *
 * Her choice is remembered — a woman who reads money as a ledger does not stop
 * doing that on Tuesday.
 */

const VIEWS = [
  { id: "ledger",   label: "Ledger",   icon: "Table2" },
  { id: "feed",     label: "Feed",     icon: "Rows3" },
  { id: "board",    label: "Board",    icon: "Columns3" },
  { id: "magazine", label: "Magazine", icon: "Image" },
] as const;
type ViewId = (typeof VIEWS)[number]["id"];
const KEY = "womsakhi.earn.view";

export default function EarnPage() {
  const [view, setView] = useState<ViewId>("ledger");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY) as ViewId | null;
      if (saved && VIEWS.some((v) => v.id === saved)) setView(saved);
    } catch { /* private mode — the default view is fine */ }
  }, []);

  const choose = (v: ViewId) => {
    setView(v);
    try { localStorage.setItem(KEY, v); } catch { /* nothing to recover from */ }
  };

  const { data: opps, refetch: reOpps } =
    useResource(useCallback((s?: AbortSignal) => apiOpportunities(s), []), [] as Opportunity[]);
  const { data: apps } =
    useResource(useCallback((s?: AbortSignal) => apiApplications(s), []), [] as Application[]);
  const { data: orders, refetch: reOrders } =
    useResource(useCallback((s?: AbortSignal) => apiShopOrders(s), []), [] as ShopOrder[]);
  const { data: listings } =
    useResource(useCallback((s?: AbortSignal) => apiListings(s), []), [] as Listing[]);
  const { data: pools, refetch: rePools } =
    useResource(useCallback((s?: AbortSignal) => apiGroupBuys(s), []), [] as GroupBuy[]);
  const { data: wallet } =
    useResource(useCallback((s?: AbortSignal) => apiWallet(s), []),
                { balance_minor: 0, balance_label: "₹0", currency: "INR", transactions: [] });

  const d: EarnData = useMemo(() => {
    const now = new Date();
    const txns = wallet.transactions;
    // "This month" means this month — a running total that quietly includes
    // August would make her think she is doing better than she is.
    const thisMonth = txns.filter((t) => {
      const when = new Date(t.when);
      return !Number.isNaN(when.getTime())
        && when.getFullYear() === now.getFullYear() && when.getMonth() === now.getMonth();
    });
    const credits = (thisMonth.length ? thisMonth : txns).filter((t) => t.kind === "credit");
    return {
      balanceMinor: wallet.balance_minor,
      earnedMinor: credits.reduce((s, t) => s + t.amount_minor, 0),
      owedMinor: orders.filter((o) => o.needs_her).reduce((s, o) => s + o.total_minor, 0),
      // Only what she can still apply for — totalling closed listings would
      // promise her money that is no longer on the table.
      openMinor: opps.filter(isOpen).reduce(
        (s, o) => s + ((o as unknown as { pay_high_minor?: number }).pay_high_minor ?? 0), 0),
      orders, opps, apps, pools, listings,
      txns: thisMonth.length ? thisMonth : txns,
    };
  }, [wallet, orders, opps, apps, pools, listings]);

  /**
   * Every action is real, and says so when it fails rather than pretending.
   *
   * Held stable, because it is half of what the four views are given. Every
   * action sets `busy` and clears it, so each one costs two renders of this
   * page — and rebuilding `act` inline made those two renders re-render the
   * whole ledger, feed, board or magazine underneath. All four refetchers are
   * themselves stable, so this object only ever changes shape when they do.
   */
  const act: Acts = useMemo(() => ({
    apply: async (id) => {
      setBusy(id); setError(null);
      try { await apiApply(id); reOpps(); }
      catch { setError("That did not send. Try again in a moment."); }
      finally { setBusy(null); }
    },
    save: async (id) => {
      setBusy(id);
      try { await apiToggleSaveOpportunity(id); reOpps(); }
      catch { setError("Could not save that."); }
      finally { setBusy(null); }
    },
    pool: async (id, join) => {
      setBusy(id); setError(null);
      try { join ? await apiJoinBuy(id) : await apiLeaveBuy(id); rePools(); }
      catch { setError("Could not change that group buy."); }
      finally { setBusy(null); }
    },
    advance: async (id) => {
      setBusy(id); setError(null);
      try { await apiAdvanceOrder(id); reOrders(); }
      catch { setError("Could not move that order on."); }
      finally { setBusy(null); }
    },
  }), [reOpps, rePools, reOrders]);

  const waiting = useMemo(
    () => orders.filter((o) => o.needs_her).length, [orders]);

  // `isOpen` parses a date per listing, so this is a `new Date()` for every
  // opening on the board — in a sentence that only changes when the openings
  // do, not when a button goes busy.
  const live = useMemo(() => opps.filter(isOpen).length, [opps]);

  return (
    <HomeShell active="/app/opportunities">
      <div className="flex flex-col gap-5">
        <header className="flex flex-wrap items-end gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-[0.6875rem] font-extrabold uppercase tracking-[0.2em]" style={{ color: "var(--ux-brand)" }}>
              Earn
            </p>
            <h1 className="mt-2 text-[clamp(1.5rem,3.2vw,2.125rem)] font-extrabold leading-[1.1] tracking-[-0.035em]"
                style={{ color: "var(--ux-ink)" }}>
              {rupees(d.earnedMinor)} this month
              {waiting > 0 && (
                <span style={{ color: "var(--ux-amber-ink)" }}>
                  {" · "}{rupees(d.owedMinor)} waiting
                </span>
              )}
            </h1>
            <p className="mt-1.5 text-[0.875rem]" style={{ color: "var(--ux-ink-2)" }}>
              {rupees(d.balanceMinor)} is yours to take out now.
              {live > 0 ? ` ${live} ${live === 1 ? "opening is" : "openings are"} still open to you.` : ""}
            </p>
          </div>

          {/* Four ways to read the same page. */}
          <div className="ux-tabs flex gap-1.5 rounded-full p-1"
               style={{ background: "var(--ux-surface)", border: "1px solid var(--ux-line)" }}>
            {VIEWS.map((v) => {
              const on = view === v.id;
              const I = (Icons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[v.icon]
                ?? Icons.Circle;
              return (
                <button key={v.id} type="button" onClick={() => choose(v.id)} aria-pressed={on}
                        className="ux-press flex min-h-[38px] shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-4 text-[0.8125rem] font-bold"
                        style={on
                          ? { background: "linear-gradient(96deg, var(--ux-rib-2), var(--ux-rib-3))",
                              color: "var(--ux-on-brand)" }
                          : { color: "var(--ux-muted)" }}>
                  <I className="h-[15px] w-[15px]" /> {v.label}
                </button>
              );
            })}
          </div>
        </header>

        {error && (
          <p className="rounded-[12px] px-4 py-3 text-[0.8125rem] font-semibold"
             style={{ background: "var(--ux-danger-tint)", color: "var(--ux-danger-solid)" }}>
            {error}
          </p>
        )}

        <div style={{ opacity: busy ? 0.6 : 1, transition: "opacity .15s" }}>
          {view === "ledger"   && <Ledger d={d} act={act} />}
          {view === "feed"     && <Feed d={d} act={act} />}
          {view === "board"    && <Board d={d} act={act} />}
          {view === "magazine" && <Magazine d={d} act={act} />}
        </div>
      </div>
    </HomeShell>
  );
}
