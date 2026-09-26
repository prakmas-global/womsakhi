"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Download, Eye, EyeOff, MoreHorizontal, PackageOpen, PauseCircle, Search,
  SlidersHorizontal, Store, Trash2, UserRound,
} from "lucide-react";

import {
  Badge, Card, Menu, MenuItem, Modal, Pagination, Spinner, StatCard, Tabs, Thumb, useToast,
} from "@/design-system";
import { useAuth } from "@/context/AuthContext";
import ReasonModal from "@/components/admin/community/ReasonModal";
import PersonCell from "@/components/admin/market/PersonCell";
import {
  EMPTY_PAGE,
  apiAdminListing,
  apiAdminListings,
  apiHideListing,
  apiListingsCsv,
  apiMarketPermissions,
  apiMarketSummary,
  apiRemoveListing,
  apiRestoreListing,
  saveBlob,
  shortDate,
  shortDateTime,
  showing,
  type AdminListing,
  type AdminOrder,
  type HistoryEntry,
  type ListingFilters,
  type MarketAction,
  type MarketSummary,
  type Paged,
} from "@/lib/market-admin-api";
import { memberError } from "@/lib/member-api";

/**
 * Listings.
 *
 * ── Hiding, never deleting ──────────────────────────────────────────────────
 * A listing that caused a complaint has to outlive the complaint, or there is
 * nothing to review the decision against. So a moderator has three moves, all
 * reversible from here: hide (out of the market, expected back), restore, and
 * remove (out of the market with a stronger word on the record). The seller
 * is told each time, with the reason written in the dialog.
 *
 * The list is server-paged: 273 listings today, and the number only grows.
 */

type Status = "" | "live" | "paused" | "hidden";
type Kind = "" | "product" | "service";
type Dialog = { kind: "hide" | "remove" | "restore"; item: AdminListing } | null;

const STATE_TONE: Record<string, "emerald" | "amber" | "rose" | "slate"> = {
  live: "emerald", paused: "amber", hidden: "rose", removed: "rose",
};

function listingState(l: AdminListing): { label: string; tone: "emerald" | "amber" | "rose" | "slate" } {
  if (l.hidden) return { label: l.moderation.state === "removed" ? "Removed" : "Hidden", tone: "rose" };
  if (l.status === "paused") return { label: "Paused by her", tone: "amber" };
  return { label: "Live", tone: "emerald" };
}

function ListingsInner() {
  const params = useSearchParams();
  const { isSuperAdmin } = useAuth();
  const toast = useToast();

  const [q, setQ] = useState("");
  const [term, setTerm] = useState("");
  const [status, setStatus] = useState<Status>((params.get("status") as Status) ?? "");
  const [kind, setKind] = useState<Kind>("");
  const [seller] = useState(params.get("seller") ?? "");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Paged<AdminListing>>(EMPTY_PAGE);
  const [summary, setSummary] = useState<MarketSummary["listings"] | null>(null);
  const [perms, setPerms] = useState<Set<MarketAction>>(new Set());
  const [error, setError] = useState("");
  // Loading is derived, not set: the page is loading whenever the filters
  // in force are not the ones the data on screen was fetched for.
  const [loadedKey, setLoadedKey] = useState("");
  const latest = useRef("");
  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [open, setOpen] = useState<(AdminListing & { recent_orders: AdminOrder[]; history: HistoryEntry[] }) | null>(null);
  const [opening, setOpening] = useState("");

  const can = useCallback((a: MarketAction) => perms.has(a), [perms]);

  const filters = useCallback(
    (): ListingFilters => ({ q: term, status, kind, seller, page, page_size: 20 }),
    [kind, page, seller, status, term],
  );

  const filterKey = JSON.stringify(filters());
  const loading = loadedKey !== filterKey;

  const load = useCallback(async () => {
    const key = JSON.stringify(filters());
    latest.current = key;
    try {
      const [list, sum] = await Promise.all([apiAdminListings(filters()), apiMarketSummary()]);
      if (latest.current !== key) return; // a newer filter took over
      setData(list);
      setSummary(sum.listings);
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

  // Typing searches after a pause, not on every keystroke — each search is a
  // round trip to the cluster.
  useEffect(() => {
    const t = setTimeout(() => { setTerm(q.trim()); setPage(1); }, 350);
    return () => clearTimeout(t);
  }, [q]);

  const confirmDialog = useCallback(async (reason: string) => {
    if (!dialog) return;
    setBusy(true);
    try {
      const { kind: action, item } = dialog;
      if (action === "hide") await apiHideListing(item.id, reason);
      else if (action === "remove") await apiRemoveListing(item.id, reason);
      else await apiRestoreListing(item.id, reason);
      toast.success(
        action === "restore" ? `“${item.title}” is back on the market` : `“${item.title}” is off the market`,
        { description: "The seller has been told, with your reason." },
      );
      setDialog(null);
      await load();
    } catch (e) {
      toast.error("That didn't go through", { description: memberError(e) });
    } finally {
      setBusy(false);
    }
  }, [dialog, load, toast]);

  const exportCsv = useCallback(async () => {
    try {
      const blob = await apiListingsCsv({ q: term, status, kind, seller });
      saveBlob(blob, `womsakhi-listings-${new Date().toISOString().slice(0, 10)}.csv`);
      toast.success("Listings downloaded", { description: "The same filters as the list." });
    } catch (e) {
      toast.error("Could not export", { description: memberError(e) });
    }
  }, [kind, seller, status, term, toast]);

  const openDetail = useCallback(async (l: AdminListing) => {
    setOpening(l.id);
    try {
      setOpen(await apiAdminListing(l.id));
    } catch (e) {
      toast.error("Could not open that listing", { description: memberError(e) });
    } finally {
      setOpening("");
    }
  }, [toast]);

  const kindLabel = kind === "" ? "Products and services" : kind === "product" ? "Products only" : "Services only";
  const filtered = !!term || !!kind || !!seller || !!status;

  return (
    <div className="wc-page-enter">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-11 w-11 items-center justify-center rounded-xl bg-brand-tint text-brand-ink">
            <Store className="h-6 w-6" />
          </span>
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-ink">Listings</h1>
            <p className="mt-1 max-w-2xl text-sm text-ink-subtle">
              Everything members are selling. Hiding takes a listing off the market and tells the seller why; nothing is ever deleted.
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
        <StatCard label="Live" value={summary ? String(summary.live) : "—"} icon={Store} tone="brand"
                  deltaNote="On the market right now" />
        <StatCard label="Paused by sellers" value={summary ? String(summary.paused) : "—"} icon={PauseCircle}
                  tone={summary && summary.paused > 0 ? "amber" : "slate"} deltaNote="Her choice, not ours" />
        <StatCard label="Hidden by staff" value={summary ? String(summary.hidden) : "—"} icon={EyeOff}
                  tone={summary && summary.hidden > 0 ? "rose" : "slate"}
                  deltaNote={summary && summary.hidden > 0 ? "Kept on record, off the market" : "Nothing hidden"} />
        <StatCard label="All listings" value={summary ? String(summary.total) : "—"} icon={PackageOpen} tone="violet"
                  deltaNote="Products and services" />
      </div>

      <Card className="mt-6">
        <Tabs
          className="mb-4"
          value={status}
          onChange={(v) => { setStatus(v as Status); setPage(1); }}
          tabs={[
            { value: "", label: "All" },
            { value: "live", label: "Live", count: summary?.live },
            { value: "paused", label: "Paused", count: summary?.paused },
            { value: "hidden", label: "Hidden", count: summary?.hidden },
          ]}
        />

        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="relative max-w-xs flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
            <input
              placeholder="Search title, category or place…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="w-full rounded-lg border border-line-strong bg-surface py-2 pl-9 pr-3 text-sm text-ink-muted placeholder-ink-subtle outline-none focus:border-brand-300 focus:ring-4 focus:ring-brand-tint"
            />
          </div>
          <Menu trigger={<span className="btn btn-sm btn-outline"><SlidersHorizontal className="h-3.5 w-3.5" /> {kindLabel}</span>}>
            <MenuItem onClick={() => { setKind(""); setPage(1); }}>Products and services</MenuItem>
            <MenuItem onClick={() => { setKind("product"); setPage(1); }}>Products only</MenuItem>
            <MenuItem onClick={() => { setKind("service"); setPage(1); }}>Services only</MenuItem>
          </Menu>
        </div>

        {error ? (
          <div className="px-6 py-14 text-center">
            <p className="text-sm font-semibold text-ink">Could not load the listings</p>
            <p className="mx-auto mt-1 max-w-sm text-xs text-ink-subtle">{error}</p>
            <button className="btn btn-outline mt-4" onClick={() => void load()}>Try again</button>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center py-16"><Spinner /></div>
        ) : data.items.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-tint text-brand-ink">
              <Store className="h-6 w-6" />
            </span>
            <p className="mt-3 text-sm font-semibold text-ink">
              {status === "hidden" ? "Nothing is hidden" : filtered ? "Nothing matches that" : "No listings yet"}
            </p>
            <p className="mx-auto mt-1 max-w-sm text-xs text-ink-subtle">
              {status === "hidden"
                ? "Anything you hide or remove lands here with its reason, and can be restored."
                : filtered ? "Try a different search, or clear the filter." : "Listings appear here as members add them to their shops."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-line text-2xs font-semibold uppercase tracking-wide text-ink-subtle">
                  <th className="px-3 py-2.5">Listing</th>
                  <th className="px-3 py-2.5">Seller</th>
                  <th className="px-3 py-2.5">Price</th>
                  <th className="px-3 py-2.5">Stock</th>
                  <th className="px-3 py-2.5">State</th>
                  <th className="px-3 py-2.5 text-right">Orders</th>
                  <th className="px-3 py-2.5">Listed</th>
                  <th className="px-3 py-2.5 text-right">&nbsp;</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((l) => {
                  const st = listingState(l);
                  return (
                    <tr key={l.id} className={`border-b border-line last:border-0 hover:bg-surface-2 ${l.hidden ? "opacity-80" : ""}`}>
                      <td className="px-3 py-3">
                        <button className="flex items-center gap-3 text-left" onClick={() => void openDetail(l)} disabled={opening === l.id}>
                          <Thumb seed={l.id} src={l.photo || undefined} alt="" className="h-10 w-10 shrink-0 rounded-lg" />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-ink">{l.title}</p>
                            <p className="truncate text-xs text-ink-subtle">
                              <Badge tone={l.kind === "service" ? "sky" : "slate"}>{l.kind === "service" ? "Service" : "Product"}</Badge>
                              {l.category && <span className="ml-1.5">{l.category}</span>}
                              {l.place && <span> · {l.place}</span>}
                            </p>
                          </div>
                        </button>
                      </td>
                      <td className="px-3 py-3"><PersonCell person={l.seller} /></td>
                      <td className="px-3 py-3 text-sm text-ink-muted">{l.price_label}</td>
                      <td className="px-3 py-3 text-sm text-ink-muted">
                        {l.stock === null ? <span className="text-ink-subtle">—</span>
                          : l.out_of_stock ? <Badge tone="rose">None left</Badge>
                          : l.low_stock ? <Badge tone="amber">{l.stock} left</Badge>
                          : l.stock}
                      </td>
                      <td className="px-3 py-3">
                        <Badge tone={st.tone}>{st.label}</Badge>
                        {l.hidden && l.moderation.reason && (
                          <p className="mt-1 max-w-[16rem] truncate text-2xs text-ink-subtle" title={l.moderation.reason}>
                            {l.moderation.by && `${l.moderation.by}: `}{l.moderation.reason}
                          </p>
                        )}
                      </td>
                      <td className="px-3 py-3 text-right text-sm text-ink-muted">{l.orders}</td>
                      <td className="px-3 py-3 text-sm text-ink-subtle">{shortDate(l.created_at) || "—"}</td>
                      <td className="px-3 py-3 text-right">
                        <Menu trigger={<span className="btn btn-sm btn-ghost"><MoreHorizontal className="h-4 w-4" /></span>}>
                          <MenuItem icon={Eye} onClick={() => void openDetail(l)}>Open</MenuItem>
                          <MenuItem icon={UserRound} href={`/dashboard/market/sellers?q=${encodeURIComponent(l.seller.member_id || l.seller.name)}`}>Her shop</MenuItem>
                          {!l.hidden && can("edit") && (
                            <MenuItem icon={EyeOff} onClick={() => setDialog({ kind: "hide", item: l })}>Hide from the market</MenuItem>
                          )}
                          {l.hidden && can("edit") && (
                            <MenuItem icon={Eye} onClick={() => setDialog({ kind: "restore", item: l })}>Restore</MenuItem>
                          )}
                          {l.moderation.state !== "removed" && can("delete") && (
                            <MenuItem icon={Trash2} danger onClick={() => setDialog({ kind: "remove", item: l })}>Remove from the market</MenuItem>
                          )}
                        </Menu>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {!loading && !error && data.total > 0 && (
          <Pagination page={data.page} pageCount={data.pages} onPageChange={setPage} showing={showing(data, "listings")} />
        )}
      </Card>

      {/* ── detail ─────────────────────────────────────────────────────── */}
      <Modal open={!!open} onClose={() => setOpen(null)} title={open?.title ?? ""} size="lg" icon={Store}
             description={open ? `${open.kind === "service" ? "Service" : "Product"}${open.category ? ` · ${open.category}` : ""}${open.place ? ` · ${open.place}` : ""}` : undefined}>
        {open && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-start gap-4">
              <Thumb seed={open.id} src={open.photo || undefined} alt="" className="h-24 w-24 rounded-xl" />
              <div className="min-w-0 flex-1 space-y-1 text-sm">
                <p className="text-ink-muted">{open.desc || <span className="text-ink-subtle">No description.</span>}</p>
                <p className="text-ink"><b>{open.price_label}</b>{open.stock !== null && <span className="text-ink-subtle"> · {open.stock} in stock</span>}</p>
                <p className="text-xs text-ink-subtle">
                  {open.views} views · {open.orders} orders · listed {shortDate(open.created_at) || "—"}
                </p>
                <div className="pt-1"><PersonCell person={open.seller} /></div>
              </div>
              <Badge tone={listingState(open).tone}>{listingState(open).label}</Badge>
            </div>

            {open.hidden && (
              <p className="rounded-lg bg-surface-2 px-3 py-2 text-xs text-ink-muted">
                <b className="text-ink">{open.moderation.state === "removed" ? "Removed" : "Hidden"}</b>
                {open.moderation.by && ` by ${open.moderation.by}`}
                {open.moderation.at && ` on ${shortDate(open.moderation.at)}`}
                {open.moderation.reason && ` — ${open.moderation.reason}`}
              </p>
            )}

            <div>
              <h3 className="font-display text-sm font-semibold text-ink">Recent orders</h3>
              {open.recent_orders.length === 0 ? (
                <p className="mt-1 text-xs text-ink-subtle">Nobody has ordered this yet.</p>
              ) : (
                <ul className="mt-2 divide-y divide-line">
                  {open.recent_orders.slice(0, 8).map((o) => (
                    <li key={o.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                      <span className="min-w-0 truncate text-ink">{o.buyer.name} <span className="text-ink-subtle">· {o.quantity} ×</span></span>
                      <span className="flex items-center gap-2">
                        <Badge tone={STATE_TONE[o.state.toLowerCase()] ?? (o.state === "Cancelled" ? "rose" : o.state === "Done" ? "emerald" : "sky")}>{o.state}</Badge>
                        <span className="text-ink-subtle">{o.total_label}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {open.history.length > 0 && (
              <div>
                <h3 className="font-display text-sm font-semibold text-ink">Staff actions</h3>
                <ul className="mt-2 space-y-1.5">
                  {open.history.map((h, i) => (
                    <li key={i} className="text-xs text-ink-muted">
                      <span className="text-ink-subtle">{shortDateTime(h.at)}</span> · <b className="text-ink">{h.who}</b> — {h.detail}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* ── reasons ────────────────────────────────────────────────────── */}
      <ReasonModal
        open={dialog?.kind === "hide"}
        title={dialog ? `Hide “${dialog.item.title}”` : ""}
        description="It leaves the market and her own shop list but stays on record. She is told, with this reason. You can restore it from the Hidden tab."
        label="Why it is being hidden"
        confirmLabel="Hide it"
        busy={busy}
        icon={EyeOff}
        onClose={() => setDialog(null)}
        onConfirm={confirmDialog}
      />
      <ReasonModal
        open={dialog?.kind === "remove"}
        title={dialog ? `Remove “${dialog.item.title}” from the market` : ""}
        description="The same as hiding, with a stronger word on the record. It is not deleted — it stays with this reason, and can be restored."
        label="Why it is being removed"
        confirmLabel="Remove it"
        danger
        busy={busy}
        icon={Trash2}
        onClose={() => setDialog(null)}
        onConfirm={confirmDialog}
      />
      <ReasonModal
        open={dialog?.kind === "restore"}
        title={dialog ? `Restore “${dialog.item.title}”` : ""}
        description="It goes back on the market and into her shop. She is told it is back."
        label="A note for the record"
        confirmLabel="Restore it"
        required={false}
        busy={busy}
        icon={Eye}
        onClose={() => setDialog(null)}
        onConfirm={confirmDialog}
      />
    </div>
  );
}

export default function ListingsPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-16"><Spinner /></div>}>
      <ListingsInner />
    </Suspense>
  );
}
