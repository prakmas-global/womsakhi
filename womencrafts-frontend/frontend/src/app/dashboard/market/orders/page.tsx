"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Ban, CheckCircle2, Clock, Download, Eye, MoreHorizontal, Search, ShoppingBag,
  SlidersHorizontal, UserRound, XCircle,
} from "lucide-react";

import {
  Badge, Card, Input, Menu, MenuItem, Modal, Pagination, Spinner, StatCard, useToast,
} from "@/design-system";
import { useAuth } from "@/context/AuthContext";
import ReasonModal from "@/components/admin/community/ReasonModal";
import PersonCell from "@/components/admin/market/PersonCell";
import {
  EMPTY_PAGE,
  apiAdminOrder,
  apiAdminOrders,
  apiForceCancelOrder,
  apiMarketPermissions,
  apiMarketSummary,
  apiOrdersCsv,
  saveBlob,
  shortDate,
  shortDateTime,
  showing,
  type AdminOrder,
  type AdminOrderDetail,
  type MarketAction,
  type MarketSummary,
  type OrderFilters,
  type Paged,
} from "@/lib/market-admin-api";
import { memberError } from "@/lib/member-api";

/**
 * Orders.
 *
 * ── No money passes through here ────────────────────────────────────────────
 * An order is a row in the seller's order book and nothing else: the buyer
 * pays her directly. So the one thing staff can do to an order is cancel it
 * on the seller's behalf — when she has gone quiet, or a dispute needs
 * settling — and both sides are told the reason.
 *
 * ── The timeline is only what the row can prove ─────────────────────────────
 * Orders keep a created time, a last-changed time and a state. There is no
 * per-step log, so the timeline shows placement, the latest change, and every
 * staff action recorded against the order — never invented steps in between.
 */

type Status = "" | "open" | "New" | "Making" | "Ready" | "Sent" | "Done" | "Cancelled";

const STATUS_LABEL: Record<Status, string> = {
  "": "All states", open: "Waiting on the seller", New: "New", Making: "Making", Ready: "Ready",
  Sent: "Sent", Done: "Done", Cancelled: "Cancelled",
};

const STATE_TONE: Record<string, "emerald" | "amber" | "rose" | "sky" | "slate" | "brand"> = {
  New: "brand", Making: "amber", Ready: "sky", Sent: "sky", Done: "emerald", Cancelled: "rose",
};

function OrdersInner() {
  const params = useSearchParams();
  const { isSuperAdmin } = useAuth();
  const toast = useToast();

  const [q, setQ] = useState("");
  const [term, setTerm] = useState("");
  const [status, setStatus] = useState<Status>((params.get("status") as Status) ?? "");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [seller] = useState(params.get("seller") ?? "");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Paged<AdminOrder>>(EMPTY_PAGE);
  const [summary, setSummary] = useState<MarketSummary["orders"] | null>(null);
  const [perms, setPerms] = useState<Set<MarketAction>>(new Set());
  const [error, setError] = useState("");
  const [loadedKey, setLoadedKey] = useState("");
  const latest = useRef("");
  const [busy, setBusy] = useState(false);
  const [cancelling, setCancelling] = useState<AdminOrder | null>(null);
  const [open, setOpen] = useState<AdminOrderDetail | null>(null);
  const [opening, setOpening] = useState("");

  const can = useCallback((a: MarketAction) => perms.has(a), [perms]);

  const filters = useCallback(
    (): OrderFilters => ({ q: term, status, seller, from, to, page, page_size: 20 }),
    [from, page, seller, status, term, to],
  );

  const filterKey = JSON.stringify(filters());
  const loading = loadedKey !== filterKey;

  const load = useCallback(async () => {
    const key = JSON.stringify(filters());
    latest.current = key;
    try {
      const [list, sum] = await Promise.all([apiAdminOrders(filters()), apiMarketSummary()]);
      if (latest.current !== key) return;
      setData(list);
      setSummary(sum.orders);
      setError("");
      setLoadedKey(key);
    } catch (e) {
      if (latest.current === key) setError(memberError(e));
    }
  }, [filters]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    let alive = true;
    apiMarketPermissions(isSuperAdmin)
      .then((p) => { if (alive) setPerms(p); })
      .catch(() => { if (alive) setPerms(new Set()); });
    return () => { alive = false; };
  }, [isSuperAdmin]);

  useEffect(() => {
    const t = setTimeout(() => { setTerm(q.trim()); setPage(1); }, 350);
    return () => clearTimeout(t);
  }, [q]);

  const openDetail = useCallback(async (o: AdminOrder) => {
    setOpening(o.id);
    try {
      setOpen(await apiAdminOrder(o.id));
    } catch (e) {
      toast.error("Could not open that order", { description: memberError(e) });
    } finally {
      setOpening("");
    }
  }, [toast]);

  const confirmCancel = useCallback(async (reason: string) => {
    if (!cancelling) return;
    setBusy(true);
    try {
      await apiForceCancelOrder(cancelling.id, reason);
      toast.success(`Order for “${cancelling.title}” cancelled`, { description: "The seller and the buyer have been told, with your reason." });
      setCancelling(null);
      if (open?.id === cancelling.id) setOpen(null);
      await load();
    } catch (e) {
      toast.error("Could not cancel that order", { description: memberError(e) });
    } finally {
      setBusy(false);
    }
  }, [cancelling, load, open, toast]);

  const exportCsv = useCallback(async () => {
    try {
      const blob = await apiOrdersCsv({ q: term, status, seller, from, to });
      saveBlob(blob, `womsakhi-orders-${new Date().toISOString().slice(0, 10)}.csv`);
      toast.success("Orders downloaded", { description: "The same filters as the list." });
    } catch (e) {
      toast.error("Could not export", { description: memberError(e) });
    }
  }, [from, seller, status, term, to, toast]);

  const filtered = !!term || !!status || !!seller || !!from || !!to;
  const cancellable = (o: AdminOrder) => o.state !== "Cancelled" && o.state !== "Done";

  return (
    <div className="wc-page-enter">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-11 w-11 items-center justify-center rounded-xl bg-brand-tint text-brand-ink">
            <ShoppingBag className="h-6 w-6" />
          </span>
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-ink">Orders</h1>
            <p className="mt-1 max-w-2xl text-sm text-ink-subtle">
              Every order placed on the market. Buyers pay sellers directly — WomSakhi holds no money, so the one thing staff can do here is cancel an order for both sides.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {seller && (
            <Link href="/dashboard/market/sellers" className="btn btn-outline">
              <UserRound className="h-4 w-4" /> One seller — show all
            </Link>
          )}
          {can("export") && (
            <button className="btn btn-outline" onClick={() => void exportCsv()}>
              <Download className="h-4 w-4" /> Export CSV
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Waiting on a seller" value={summary ? String(summary.open) : "—"} icon={Clock}
                  tone={summary && summary.open > 0 ? "amber" : "slate"} deltaNote="New, making or ready" />
        <StatCard label="Sent or done" value={summary ? String(summary.done) : "—"} icon={CheckCircle2} tone="emerald"
                  deltaNote="With the buyer" />
        <StatCard label="Cancelled" value={summary ? String(summary.cancelled) : "—"} icon={XCircle}
                  tone={summary && summary.cancelled > 0 ? "rose" : "slate"} deltaNote="By a seller or by staff" />
        <StatCard label="All orders" value={summary ? String(summary.total) : "—"} icon={ShoppingBag} tone="brand"
                  deltaNote="Since the market opened" />
      </div>

      <Card className="mt-6">
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <div className="relative max-w-xs flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
            <input
              placeholder="Search item, buyer name or note…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="w-full rounded-lg border border-line-strong bg-surface py-2 pl-9 pr-3 text-sm text-ink-muted placeholder-ink-subtle outline-none focus:border-brand-300 focus:ring-4 focus:ring-brand-tint"
            />
          </div>
          <Menu trigger={<span className="btn btn-sm btn-outline"><SlidersHorizontal className="h-3.5 w-3.5" /> {STATUS_LABEL[status]}</span>}>
            {(Object.keys(STATUS_LABEL) as Status[]).map((s) => (
              <MenuItem key={s || "all"} onClick={() => { setStatus(s); setPage(1); }}>{STATUS_LABEL[s]}</MenuItem>
            ))}
          </Menu>
          <Input type="date" label="From" value={from} className="w-40" onChange={(e) => { setFrom(e.target.value); setPage(1); }} />
          <Input type="date" label="To" value={to} className="w-40" onChange={(e) => { setTo(e.target.value); setPage(1); }} />
          {(from || to) && (
            <button className="btn btn-sm btn-ghost" onClick={() => { setFrom(""); setTo(""); setPage(1); }}>Clear dates</button>
          )}
        </div>

        {error ? (
          <div className="px-6 py-14 text-center">
            <p className="text-sm font-semibold text-ink">Could not load the orders</p>
            <p className="mx-auto mt-1 max-w-sm text-xs text-ink-subtle">{error}</p>
            <button className="btn btn-outline mt-4" onClick={() => void load()}>Try again</button>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center py-16"><Spinner /></div>
        ) : data.items.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-tint text-brand-ink">
              <ShoppingBag className="h-6 w-6" />
            </span>
            <p className="mt-3 text-sm font-semibold text-ink">{filtered ? "Nothing matches that" : "No orders yet"}</p>
            <p className="mx-auto mt-1 max-w-sm text-xs text-ink-subtle">
              {filtered ? "Try a different search, state or date range." : "Orders appear here as buyers place them against listings."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-line text-2xs font-semibold uppercase tracking-wide text-ink-subtle">
                  <th className="px-3 py-2.5">Order</th>
                  <th className="px-3 py-2.5">Buyer</th>
                  <th className="px-3 py-2.5">Seller</th>
                  <th className="px-3 py-2.5 text-right">Total</th>
                  <th className="px-3 py-2.5">State</th>
                  <th className="px-3 py-2.5">Placed</th>
                  <th className="px-3 py-2.5 text-right">&nbsp;</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((o) => (
                  <tr key={o.id} className="border-b border-line last:border-0 hover:bg-surface-2">
                    <td className="px-3 py-3">
                      <button className="text-left" onClick={() => void openDetail(o)} disabled={opening === o.id}>
                        <p className="text-sm font-semibold text-ink">{o.title}</p>
                        <p className="text-xs text-ink-subtle">{o.quantity} × {o.note ? `· “${o.note.length > 48 ? `${o.note.slice(0, 48)}…` : o.note}”` : ""}</p>
                      </button>
                    </td>
                    <td className="px-3 py-3"><PersonCell person={o.buyer} note={o.buyer.id ? undefined : "no account — seeded"} /></td>
                    <td className="px-3 py-3"><PersonCell person={o.seller} /></td>
                    <td className="px-3 py-3 text-right text-sm font-semibold text-ink">{o.total_label}</td>
                    <td className="px-3 py-3">
                      <Badge tone={STATE_TONE[o.state] ?? "slate"}>{o.state}</Badge>
                      {o.staff_cancel && (
                        <p className="mt-1 max-w-[14rem] truncate text-2xs text-ink-subtle" title={o.staff_cancel.reason}>by {o.staff_cancel.by}: {o.staff_cancel.reason}</p>
                      )}
                    </td>
                    <td className="px-3 py-3 text-sm text-ink-subtle">{shortDate(o.placed_at) || "—"}</td>
                    <td className="px-3 py-3 text-right">
                      <Menu trigger={<span className="btn btn-sm btn-ghost"><MoreHorizontal className="h-4 w-4" /></span>}>
                        <MenuItem icon={Eye} onClick={() => void openDetail(o)}>Open the timeline</MenuItem>
                        {cancellable(o) && can("edit") && (
                          <MenuItem icon={Ban} danger onClick={() => setCancelling(o)}>Cancel for both sides</MenuItem>
                        )}
                      </Menu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && !error && data.total > 0 && (
          <Pagination page={data.page} pageCount={data.pages} onPageChange={setPage} showing={showing(data, "orders")} />
        )}
      </Card>

      {/* ── detail ─────────────────────────────────────────────────────── */}
      <Modal open={!!open} onClose={() => setOpen(null)} title={open ? `${open.quantity} × ${open.title}` : ""} size="lg" icon={ShoppingBag}
             description={open ? `${open.total_label} · ${open.state}` : undefined}
             footer={open && cancellable(open) && can("edit") ? (
               <button className="btn btn-danger" onClick={() => setCancelling(open)}>
                 <Ban className="h-4 w-4" /> Cancel for both sides
               </button>
             ) : undefined}>
        {open && (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl bg-surface-2 p-3">
                <p className="mb-1.5 text-2xs font-semibold uppercase tracking-wide text-ink-subtle">Buyer</p>
                <PersonCell person={open.buyer} note={open.buyer.id ? undefined : "no account — seeded"} />
              </div>
              <div className="rounded-xl bg-surface-2 p-3">
                <p className="mb-1.5 text-2xs font-semibold uppercase tracking-wide text-ink-subtle">Seller</p>
                <PersonCell person={open.seller} />
              </div>
            </div>

            {open.note && <p className="text-sm text-ink-muted">Buyer&apos;s note: “{open.note}”</p>}

            <p className="text-xs text-ink-subtle">
              Listing:{" "}
              {open.listing.exists
                ? <span className="text-ink">{open.listing.title}{open.listing.hidden ? " (hidden by staff)" : open.listing.status === "paused" ? " (paused by her)" : ""}</span>
                : <span>{open.listing.title || "—"} — no longer exists</span>}
            </p>

            <div>
              <h3 className="font-display text-sm font-semibold text-ink">Timeline</h3>
              <ol className="mt-2 space-y-2 border-l border-line pl-4">
                {open.timeline.map((t, i) => (
                  <li key={i} className="relative text-sm">
                    <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full bg-brand-500" />
                    <p className="text-ink"><b>{t.label}</b>{t.who && <span className="text-ink-subtle"> · {t.who}</span>}</p>
                    <p className="text-xs text-ink-subtle">{shortDateTime(t.at) || "—"}{t.detail && ` — ${t.detail}`}</p>
                  </li>
                ))}
              </ol>
              <p className="mt-2 text-2xs text-ink-subtle">Only what the order records: when it was placed, its latest change, and staff actions. Steps in between are not logged.</p>
            </div>
          </div>
        )}
      </Modal>

      <ReasonModal
        open={!!cancelling}
        title={cancelling ? `Cancel the order for “${cancelling.title}”` : ""}
        description="It is marked cancelled in the seller's order book and in the buyer's list, and both are told this reason. Stock taken by a market order goes back on the shelf."
        label="Why it is being cancelled"
        confirmLabel="Cancel the order"
        danger
        busy={busy}
        icon={Ban}
        onClose={() => setCancelling(null)}
        onConfirm={confirmCancel}
      />
    </div>
  );
}

export default function OrdersPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-16"><Spinner /></div>}>
      <OrdersInner />
    </Suspense>
  );
}
