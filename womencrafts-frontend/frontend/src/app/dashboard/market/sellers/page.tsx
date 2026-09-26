"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  BadgeCheck, Ban, Download, Eye, FileBadge, MoreHorizontal, Search, ShieldOff, ShoppingBag,
  SlidersHorizontal, Star, Store, UserRoundCheck, Users,
} from "lucide-react";

import {
  Badge, Card, Menu, MenuItem, Modal, Pagination, Spinner, StatCard, useToast,
} from "@/design-system";
import { useAuth } from "@/context/AuthContext";
import ReasonModal from "@/components/admin/community/ReasonModal";
import PersonCell from "@/components/admin/market/PersonCell";
import {
  EMPTY_PAGE,
  apiAdminSeller,
  apiAdminSellers,
  apiMarketPermissions,
  apiMarketSummary,
  apiSellersCsv,
  apiSuspendSeller,
  apiUnsuspendSeller,
  apiUnverifyLicence,
  apiVerifyLicence,
  rupees,
  saveBlob,
  shortDate,
  shortDateTime,
  showing,
  type AdminSeller,
  type AdminSellerDetail,
  type MarketAction,
  type MarketSummary,
  type Paged,
  type SellerFilters,
} from "@/lib/market-admin-api";
import { memberError } from "@/lib/member-api";

/**
 * Sellers.
 *
 * A seller is any member with a listing — there is no separate register.
 * What staff can do to one: stop her selling (her listings leave the market
 * and she cannot list until it is lifted), and mark her FSSAI food licence
 * number as checked. Both are reversible, both tell her, both are audited.
 *
 * She is shown by name, avatar and member code. Her email and phone are in
 * People, behind that module's permission, where reading them is recorded.
 */

type State = "" | "active" | "suspended" | "licensed";
type Sort = "listings" | "orders" | "name" | "newest";
type Dialog = { kind: "suspend" | "unsuspend" | "verify" | "unverify"; item: AdminSeller } | null;

const STATE_LABEL: Record<State, string> = { "": "Everyone", active: "Selling", suspended: "Suspended", licensed: "Licence recorded" };
const SORT_LABEL: Record<Sort, string> = { listings: "Most listings", orders: "Most orders", name: "By name", newest: "Newest first" };

function SellersInner() {
  const params = useSearchParams();
  const { isSuperAdmin } = useAuth();
  const toast = useToast();

  const [q, setQ] = useState(params.get("q") ?? "");
  const [term, setTerm] = useState(params.get("q") ?? "");
  const [state, setState] = useState<State>("");
  const [sort, setSort] = useState<Sort>("listings");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Paged<AdminSeller> & { suspended_total: number; licensed_total: number }>({ ...EMPTY_PAGE, suspended_total: 0, licensed_total: 0 });
  const [summary, setSummary] = useState<MarketSummary | null>(null);
  const [perms, setPerms] = useState<Set<MarketAction>>(new Set());
  const [error, setError] = useState("");
  const [loadedKey, setLoadedKey] = useState("");
  const latest = useRef("");
  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [open, setOpen] = useState<AdminSellerDetail | null>(null);
  const [opening, setOpening] = useState("");

  const can = useCallback((a: MarketAction) => perms.has(a), [perms]);

  const filters = useCallback(
    (): SellerFilters => ({ q: term, state, sort, page, page_size: 20 }),
    [page, sort, state, term],
  );

  const filterKey = JSON.stringify(filters());
  const loading = loadedKey !== filterKey;

  const load = useCallback(async () => {
    const key = JSON.stringify(filters());
    latest.current = key;
    try {
      const [list, sum] = await Promise.all([apiAdminSellers(filters()), apiMarketSummary()]);
      if (latest.current !== key) return;
      setData(list);
      setSummary(sum);
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

  const openDetail = useCallback(async (s: AdminSeller) => {
    setOpening(s.id);
    try {
      setOpen(await apiAdminSeller(s.id));
    } catch (e) {
      toast.error("Could not open that seller", { description: memberError(e) });
    } finally {
      setOpening("");
    }
  }, [toast]);

  const confirmDialog = useCallback(async (reason: string) => {
    if (!dialog) return;
    setBusy(true);
    try {
      const { kind, item } = dialog;
      if (kind === "suspend") await apiSuspendSeller(item.id, reason);
      else if (kind === "unsuspend") await apiUnsuspendSeller(item.id, reason);
      else if (kind === "verify") await apiVerifyLicence(item.id, reason);
      else await apiUnverifyLicence(item.id, reason);
      toast.success(
        kind === "suspend" ? `${item.name} can no longer sell`
          : kind === "unsuspend" ? `${item.name} can sell again`
          : kind === "verify" ? `${item.name}'s licence is marked verified`
          : `The verified mark on ${item.name}'s licence is withdrawn`,
        { description: "She has been told." },
      );
      setDialog(null);
      if (open?.id === item.id) setOpen(await apiAdminSeller(item.id).catch(() => null));
      await load();
    } catch (e) {
      toast.error("That didn't go through", { description: memberError(e) });
    } finally {
      setBusy(false);
    }
  }, [dialog, load, open, toast]);

  const exportCsv = useCallback(async () => {
    try {
      saveBlob(await apiSellersCsv(), `womsakhi-sellers-${new Date().toISOString().slice(0, 10)}.csv`);
      toast.success("Sellers downloaded");
    } catch (e) {
      toast.error("Could not export", { description: memberError(e) });
    }
  }, [toast]);

  const filtered = !!term || !!state;

  const rowMenu = (s: AdminSeller) => (
    <Menu trigger={<span className="btn btn-sm btn-ghost"><MoreHorizontal className="h-4 w-4" /></span>}>
      <MenuItem icon={Eye} onClick={() => void openDetail(s)}>Open</MenuItem>
      <MenuItem icon={Store} href={`/dashboard/market/listings?seller=${s.id}`}>Her listings</MenuItem>
      <MenuItem icon={ShoppingBag} href={`/dashboard/market/orders?seller=${s.id}`}>Her orders</MenuItem>
      {can("approve") && s.kitchen.licence_no && !s.kitchen.verified && (
        <MenuItem icon={BadgeCheck} onClick={() => setDialog({ kind: "verify", item: s })}>Mark licence verified</MenuItem>
      )}
      {can("approve") && s.kitchen.verified && (
        <MenuItem icon={ShieldOff} onClick={() => setDialog({ kind: "unverify", item: s })}>Withdraw the verified mark</MenuItem>
      )}
      {can("edit") && (s.suspended
        ? <MenuItem icon={UserRoundCheck} onClick={() => setDialog({ kind: "unsuspend", item: s })}>Let her sell again</MenuItem>
        : <MenuItem icon={Ban} danger onClick={() => setDialog({ kind: "suspend", item: s })}>Stop her selling</MenuItem>)}
    </Menu>
  );

  return (
    <div className="wc-page-enter">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-11 w-11 items-center justify-center rounded-xl bg-brand-tint text-brand-ink">
            <Users className="h-6 w-6" />
          </span>
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-ink">Sellers</h1>
            <p className="mt-1 max-w-2xl text-sm text-ink-subtle">
              Every member with something for sale. Suspending takes her listings off the market until it is lifted; a food licence can be marked as checked.
            </p>
          </div>
        </div>
        {can("export") && (
          <button className="btn btn-outline" onClick={() => void exportCsv()}>
            <Download className="h-4 w-4" /> Export CSV
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Sellers" value={summary ? String(summary.sellers.total) : "—"} icon={Users} tone="brand" deltaNote="Members with a listing" />
        <StatCard label="Suspended" value={summary ? String(summary.sellers.suspended) : "—"} icon={Ban}
                  tone={summary && summary.sellers.suspended > 0 ? "rose" : "slate"}
                  deltaNote={summary && summary.sellers.suspended > 0 ? "Off the market until lifted" : "Nobody is suspended"} />
        <StatCard label="Licence recorded" value={loadedKey ? String(data.licensed_total) : "—"} icon={FileBadge} tone="amber"
                  deltaNote="Food sellers with an FSSAI number" />
        <StatCard label="Live listings" value={summary ? String(summary.listings.live) : "—"} icon={Store} tone="emerald" deltaNote="Across every shop" />
      </div>

      <Card className="mt-6">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="relative max-w-xs flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
            <input
              placeholder="Search by name or member code…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="w-full rounded-lg border border-line-strong bg-surface py-2 pl-9 pr-3 text-sm text-ink-muted placeholder-ink-subtle outline-none focus:border-brand-300 focus:ring-4 focus:ring-brand-tint"
            />
          </div>
          <Menu trigger={<span className="btn btn-sm btn-outline"><SlidersHorizontal className="h-3.5 w-3.5" /> {STATE_LABEL[state]}</span>}>
            {(Object.keys(STATE_LABEL) as State[]).map((s) => (
              <MenuItem key={s || "all"} onClick={() => { setState(s); setPage(1); }}>{STATE_LABEL[s]}</MenuItem>
            ))}
          </Menu>
          <Menu trigger={<span className="btn btn-sm btn-outline">{SORT_LABEL[sort]}</span>}>
            {(Object.keys(SORT_LABEL) as Sort[]).map((s) => (
              <MenuItem key={s} onClick={() => { setSort(s); setPage(1); }}>{SORT_LABEL[s]}</MenuItem>
            ))}
          </Menu>
        </div>

        {error ? (
          <div className="px-6 py-14 text-center">
            <p className="text-sm font-semibold text-ink">Could not load the sellers</p>
            <p className="mx-auto mt-1 max-w-sm text-xs text-ink-subtle">{error}</p>
            <button className="btn btn-outline mt-4" onClick={() => void load()}>Try again</button>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center py-16"><Spinner /></div>
        ) : data.items.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-tint text-brand-ink">
              <Users className="h-6 w-6" />
            </span>
            <p className="mt-3 text-sm font-semibold text-ink">{filtered ? "Nobody matches that" : "No sellers yet"}</p>
            <p className="mx-auto mt-1 max-w-sm text-xs text-ink-subtle">
              {filtered ? "Try a different search, or clear the filter." : "A member becomes a seller the moment she lists something."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-line text-2xs font-semibold uppercase tracking-wide text-ink-subtle">
                  <th className="px-3 py-2.5">Seller</th>
                  <th className="px-3 py-2.5">Listings</th>
                  <th className="px-3 py-2.5">Orders</th>
                  <th className="px-3 py-2.5">Reviews</th>
                  <th className="px-3 py-2.5">Food licence</th>
                  <th className="px-3 py-2.5">State</th>
                  <th className="px-3 py-2.5 text-right">&nbsp;</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((s) => (
                  <tr key={s.id} className={`border-b border-line last:border-0 hover:bg-surface-2 ${s.suspended ? "opacity-80" : ""}`}>
                    <td className="px-3 py-3">
                      <button className="text-left" onClick={() => void openDetail(s)} disabled={opening === s.id}>
                        <PersonCell person={{ ...s, suspended: false }} note={s.account_exists ? (s.since ? `since ${shortDate(s.since)}` : undefined) : "account gone"} />
                      </button>
                    </td>
                    <td className="px-3 py-3 text-sm text-ink-muted">
                      {s.listings.total}
                      <span className="text-xs text-ink-subtle"> · {s.listings.live} live{s.listings.hidden > 0 && <span className="text-status-danger-ink">, {s.listings.hidden} hidden</span>}</span>
                    </td>
                    <td className="px-3 py-3 text-sm text-ink-muted">
                      {s.orders.total}
                      <span className="text-xs text-ink-subtle"> · {s.orders.open} open · {rupees(s.orders.earned_minor)} sent or done</span>
                    </td>
                    <td className="px-3 py-3 text-sm text-ink-muted">
                      {s.reviews.count === 0 ? <span className="text-ink-subtle">None</span> : (
                        <span className="inline-flex items-center gap-1"><Star className="h-3.5 w-3.5 fill-status-warn-ink text-status-warn-ink" /> {s.reviews.rating} <span className="text-xs text-ink-subtle">({s.reviews.count})</span></span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-sm">
                      {s.kitchen.licence_no ? (
                        <>
                          <p className="font-mono text-xs text-ink">{s.kitchen.licence_no}</p>
                          {s.kitchen.verified
                            ? <Badge tone="emerald">Verified{s.kitchen.verified_by ? ` · ${s.kitchen.verified_by}` : ""}</Badge>
                            : <Badge tone="amber">Not checked</Badge>}
                        </>
                      ) : s.kitchen.steps_done > 0
                        ? <span className="text-xs text-ink-subtle">{s.kitchen.steps_done} of 4 steps, no number yet</span>
                        : <span className="text-ink-subtle">—</span>}
                    </td>
                    <td className="px-3 py-3">
                      {s.suspended
                        ? <>
                            <Badge tone="rose">Suspended</Badge>
                            {s.suspension && <p className="mt-1 max-w-[14rem] truncate text-2xs text-ink-subtle" title={s.suspension.reason}>{s.suspension.by}: {s.suspension.reason}</p>}
                          </>
                        : <Badge tone="emerald">Selling</Badge>}
                    </td>
                    <td className="px-3 py-3 text-right">{rowMenu(s)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && !error && data.total > 0 && (
          <Pagination page={data.page} pageCount={data.pages} onPageChange={setPage} showing={showing(data, "sellers")} />
        )}
      </Card>

      {/* ── detail ─────────────────────────────────────────────────────── */}
      <Modal open={!!open} onClose={() => setOpen(null)} title={open?.name ?? ""} size="lg" icon={Users}
             description={open ? `${open.member_id ? `${open.member_id} · ` : ""}${open.listings.total} listing${open.listings.total === 1 ? "" : "s"} · ${open.orders.total} order${open.orders.total === 1 ? "" : "s"}` : undefined}
             footer={open ? <div className="flex justify-end">{rowMenu(open)}</div> : undefined}>
        {open && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              {open.suspended ? <Badge tone="rose">Suspended from selling</Badge> : <Badge tone="emerald">Selling</Badge>}
              {open.kitchen.licence_no && (open.kitchen.verified ? <Badge tone="emerald">Licence verified</Badge> : <Badge tone="amber">Licence not checked</Badge>)}
              {open.reviews.count > 0 && <Badge tone="slate">{open.reviews.rating} ★ from {open.reviews.count}</Badge>}
            </div>
            {open.suspension && (
              <p className="rounded-lg bg-surface-2 px-3 py-2 text-xs text-ink-muted">
                <b className="text-ink">Suspended</b> by {open.suspension.by} on {shortDate(open.suspension.at)} — {open.suspension.reason}
              </p>
            )}
            {open.kitchen.licence_no && (
              <p className="text-xs text-ink-muted">
                FSSAI licence <span className="font-mono text-ink">{open.kitchen.licence_no}</span>
                {open.kitchen.verified && open.kitchen.verified_at && ` · verified by ${open.kitchen.verified_by} on ${shortDate(open.kitchen.verified_at)}`}
              </p>
            )}

            <div>
              <h3 className="font-display text-sm font-semibold text-ink">Listings</h3>
              {open.listing_rows.length === 0 ? <p className="mt-1 text-xs text-ink-subtle">No listings.</p> : (
                <ul className="mt-2 divide-y divide-line">
                  {open.listing_rows.slice(0, 10).map((l) => (
                    <li key={l.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                      <span className="min-w-0 truncate text-ink">{l.title} <span className="text-ink-subtle">· {l.price_label}</span></span>
                      <Badge tone={l.hidden ? "rose" : l.status === "paused" ? "amber" : "emerald"}>{l.hidden ? "Hidden" : l.status === "paused" ? "Paused" : "Live"}</Badge>
                    </li>
                  ))}
                  {open.listing_rows.length > 10 && <li className="py-2 text-xs text-ink-subtle">and {open.listing_rows.length - 10} more — open her listings for all of them.</li>}
                </ul>
              )}
            </div>

            <div>
              <h3 className="font-display text-sm font-semibold text-ink">Recent orders</h3>
              {open.recent_orders.length === 0 ? <p className="mt-1 text-xs text-ink-subtle">No orders yet.</p> : (
                <ul className="mt-2 divide-y divide-line">
                  {open.recent_orders.slice(0, 6).map((o) => (
                    <li key={o.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                      <span className="min-w-0 truncate text-ink">{o.title} <span className="text-ink-subtle">· {o.buyer.name}</span></span>
                      <span className="flex items-center gap-2"><Badge tone={o.state === "Cancelled" ? "rose" : o.state === "Done" ? "emerald" : "sky"}>{o.state}</Badge><span className="text-ink-subtle">{o.total_label}</span></span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <h3 className="font-display text-sm font-semibold text-ink">Recent reviews</h3>
              {open.recent_reviews.length === 0 ? <p className="mt-1 text-xs text-ink-subtle">No reviews yet.</p> : (
                <ul className="mt-2 divide-y divide-line">
                  {open.recent_reviews.slice(0, 4).map((r) => (
                    <li key={r.id} className="py-2 text-sm">
                      <p className="text-ink">{r.who} <span className="text-ink-subtle">· {r.stars} ★ · {r.when}</span>{r.hidden && <Badge tone="rose" className="ml-1.5">Hidden</Badge>}</p>
                      {r.text && <p className="text-xs text-ink-muted">{r.text}</p>}
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
        open={dialog?.kind === "suspend"}
        title={dialog ? `Stop ${dialog.item.name} selling` : ""}
        description="Her listings leave the market at once and she cannot list or re-publish anything until this is lifted. Her shop, orders and reviews are kept. She is told, with this reason."
        label="Why"
        confirmLabel="Suspend her shop"
        danger
        busy={busy}
        icon={Ban}
        onClose={() => setDialog(null)}
        onConfirm={confirmDialog}
      />
      <ReasonModal
        open={dialog?.kind === "unsuspend"}
        title={dialog ? `Let ${dialog.item.name} sell again` : ""}
        description="Her live listings go back on the market and she can list again. She is told."
        label="A note for the record"
        confirmLabel="Lift the suspension"
        required={false}
        busy={busy}
        icon={UserRoundCheck}
        onClose={() => setDialog(null)}
        onConfirm={confirmDialog}
      />
      <ReasonModal
        open={dialog?.kind === "verify"}
        title={dialog ? `Mark ${dialog.item.name}'s licence as verified` : ""}
        description={dialog ? `Licence ${dialog.item.kitchen.licence_no}. Only do this after checking it on the FSSAI register — the mark says WomSakhi looked.` : undefined}
        label="What you checked (optional)"
        placeholder="Matched on foscos.fssai.gov.in, valid to March 2028."
        confirmLabel="Mark verified"
        required={false}
        busy={busy}
        icon={BadgeCheck}
        onClose={() => setDialog(null)}
        onConfirm={confirmDialog}
      />
      <ReasonModal
        open={dialog?.kind === "unverify"}
        title={dialog ? `Withdraw the verified mark on ${dialog.item.name}'s licence` : ""}
        description="She is told, with this reason, and can record a corrected number."
        label="Why"
        confirmLabel="Withdraw it"
        danger
        busy={busy}
        icon={ShieldOff}
        onClose={() => setDialog(null)}
        onConfirm={confirmDialog}
      />
    </div>
  );
}

export default function SellersPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-16"><Spinner /></div>}>
      <SellersInner />
    </Suspense>
  );
}
