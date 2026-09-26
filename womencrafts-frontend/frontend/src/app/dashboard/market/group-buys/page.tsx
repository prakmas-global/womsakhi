"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Ban, CheckCircle2, Download, Loader2, MoreHorizontal, Package, PackageCheck, Pencil, Plus,
  Search, ShoppingCart, Truck, Users, XCircle,
} from "lucide-react";

import {
  Badge, Card, Input, Menu, MenuItem, Modal, Pagination, ProgressBar, Spinner, StatCard, Tabs, Textarea, useToast,
} from "@/design-system";
import { useAuth } from "@/context/AuthContext";
import ReasonModal from "@/components/admin/community/ReasonModal";
import PersonCell from "@/components/admin/market/PersonCell";
import {
  EMPTY_PAGE,
  apiAdminGroupBuys,
  apiCancelGroupBuy,
  apiCloseGroupBuy,
  apiCreateGroupBuy,
  apiDeliverGroupBuy,
  apiGroupBuyJoiners,
  apiGroupBuyJoinersCsv,
  apiGroupBuysCsv,
  apiMarketPermissions,
  apiMarketSummary,
  apiPlaceGroupOrder,
  apiUpdateGroupBuy,
  rupees,
  saveBlob,
  shortDate,
  showing,
  type AdminGroupBuy,
  type GroupBuyInput,
  type GroupBuyJoiner,
  type GroupBuyStatus,
  type MarketAction,
  type MarketSummary,
  type Paged,
} from "@/lib/market-admin-api";
import { memberError } from "@/lib/member-api";

/**
 * Group buys.
 *
 * ── The staff half that did not exist ───────────────────────────────────────
 * The member side promises "the order is placed by staff when enough of you
 * join". Nothing could do that, so every buy that reached its number sat on
 * "met" forever and nobody who joined was ever told anything. This screen is
 * that half: open a buy, place the order once it is met, mark it delivered,
 * or close it without one — and every one of those tells every joiner.
 *
 * ── Two numbers, on purpose ─────────────────────────────────────────────────
 * `joined` is the counter the member app races on; the joiner list is the
 * rows that exist. They should agree. Both are shown so a drift is visible
 * rather than hidden behind whichever one looked tidier.
 */

type Status = "" | GroupBuyStatus;
type Dialog =
  | { kind: "close" | "cancel" | "deliver"; item: AdminGroupBuy }
  | null;

const STAGE: Record<string, { label: string; tone: "emerald" | "amber" | "rose" | "sky" | "slate" | "brand" }> = {
  open: { label: "Open", tone: "brand" },
  met: { label: "Met — place the order", tone: "amber" },
  ordered: { label: "Ordered", tone: "sky" },
  delivered: { label: "Delivered", tone: "emerald" },
  closed: { label: "Closed, no order", tone: "slate" },
  cancelled: { label: "Cancelled", tone: "rose" },
};

const EMPTY_FORM: GroupBuyInput = {
  item: "", unit: "", alone_minor: 0, together_minor: 0, needed: 10, closes_at: "", supplier: "", note: "",
};

/** `<input type="datetime-local">` wants local time without the zone. */
function toLocalInput(iso: string) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function GroupBuysPage() {
  const { isSuperAdmin } = useAuth();
  const toast = useToast();

  const [q, setQ] = useState("");
  const [term, setTerm] = useState("");
  const [status, setStatus] = useState<Status>("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Paged<AdminGroupBuy>>(EMPTY_PAGE);
  const [summary, setSummary] = useState<MarketSummary["group_buys"] | null>(null);
  const [perms, setPerms] = useState<Set<MarketAction>>(new Set());
  const [error, setError] = useState("");
  const [loadedKey, setLoadedKey] = useState("");
  const latest = useRef("");
  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState<Dialog>(null);

  const [editing, setEditing] = useState<AdminGroupBuy | "new" | null>(null);
  const [form, setForm] = useState<GroupBuyInput>(EMPTY_FORM);
  const [rupeeAlone, setRupeeAlone] = useState("");
  const [rupeeTogether, setRupeeTogether] = useState("");

  const [ordering, setOrdering] = useState<AdminGroupBuy | null>(null);
  const [orderForm, setOrderForm] = useState({ reference: "", note: "" });

  const [joinersOf, setJoinersOf] = useState<AdminGroupBuy | null>(null);
  const [joiners, setJoiners] = useState<GroupBuyJoiner[] | null>(null);

  const can = useCallback((a: MarketAction) => perms.has(a), [perms]);

  const filterKey = JSON.stringify({ q: term, status, page });
  const loading = loadedKey !== filterKey;

  const load = useCallback(async () => {
    const key = JSON.stringify({ q: term, status, page });
    latest.current = key;
    try {
      const [list, sum] = await Promise.all([
        apiAdminGroupBuys({ q: term, status, page, page_size: 15 }),
        apiMarketSummary(),
      ]);
      if (latest.current !== key) return;
      setData(list);
      setSummary(sum.group_buys);
      setError("");
      setLoadedKey(key);
    } catch (e) {
      if (latest.current === key) setError(memberError(e));
    }
  }, [page, status, term]);

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

  /* ── create / edit ────────────────────────────────────────────────────── */

  const openEditor = useCallback((b: AdminGroupBuy | "new") => {
    if (b === "new") {
      const inAWeek = new Date(Date.now() + 7 * 24 * 3600 * 1000);
      setForm({ ...EMPTY_FORM, closes_at: toLocalInput(inAWeek.toISOString()) });
      setRupeeAlone("");
      setRupeeTogether("");
    } else {
      setForm({
        item: b.item, unit: b.unit, alone_minor: b.alone_minor, together_minor: b.together_minor,
        needed: b.needed, closes_at: toLocalInput(b.closes_at), supplier: b.supplier, note: b.note,
      });
      setRupeeAlone(String(b.alone_minor / 100));
      setRupeeTogether(String(b.together_minor / 100));
    }
    setEditing(b);
  }, []);

  const save = useCallback(async () => {
    const alone = Math.round(Number(rupeeAlone) * 100);
    const together = Math.round(Number(rupeeTogether) * 100);
    if (!form.item.trim() || !form.closes_at || !Number.isFinite(alone) || !Number.isFinite(together) || form.needed < 1) {
      toast.error("Item, both prices, the number needed and a closing date are all needed");
      return;
    }
    if (together > alone) {
      toast.error("The together price should not be higher than buying alone", { description: "Otherwise there is nothing to save." });
      return;
    }
    const closes = new Date(form.closes_at);
    if (Number.isNaN(closes.getTime())) {
      toast.error("That closing date is not readable");
      return;
    }
    const body: GroupBuyInput = { ...form, alone_minor: alone, together_minor: together, closes_at: closes.toISOString() };
    setBusy(true);
    try {
      if (editing === "new") {
        await apiCreateGroupBuy(body);
        toast.success(`“${body.item}” is open`, { description: "Members can join it from the app now." });
      } else if (editing) {
        await apiUpdateGroupBuy(editing.id, body);
        toast.success(`“${body.item}” updated`);
      }
      setEditing(null);
      await load();
    } catch (e) {
      toast.error("Could not save that buy", { description: memberError(e) });
    } finally {
      setBusy(false);
    }
  }, [editing, form, load, rupeeAlone, rupeeTogether, toast]);

  /* ── place the order ──────────────────────────────────────────────────── */

  const placeOrder = useCallback(async () => {
    if (!ordering) return;
    setBusy(true);
    try {
      const res = await apiPlaceGroupOrder(ordering.id, orderForm);
      toast.success(`Order placed for “${ordering.item}”`, { description: `${res.told ?? 0} joiner${res.told === 1 ? "" : "s"} told.` });
      setOrdering(null);
      await load();
    } catch (e) {
      toast.error("Could not place that order", { description: memberError(e) });
    } finally {
      setBusy(false);
    }
  }, [load, orderForm, ordering, toast]);

  /* ── close / cancel / deliver ─────────────────────────────────────────── */

  const confirmDialog = useCallback(async (reason: string) => {
    if (!dialog) return;
    setBusy(true);
    try {
      const { kind, item } = dialog;
      const res = kind === "close" ? await apiCloseGroupBuy(item.id, reason)
        : kind === "cancel" ? await apiCancelGroupBuy(item.id, reason)
        : await apiDeliverGroupBuy(item.id, reason);
      const told = `${res.told ?? 0} joiner${res.told === 1 ? "" : "s"} told.`;
      toast.success(
        kind === "close" ? `“${item.item}” closed without an order`
          : kind === "cancel" ? `“${item.item}” cancelled` : `“${item.item}” marked delivered`,
        { description: told },
      );
      setDialog(null);
      await load();
    } catch (e) {
      toast.error("That didn't go through", { description: memberError(e) });
    } finally {
      setBusy(false);
    }
  }, [dialog, load, toast]);

  /* ── joiners ──────────────────────────────────────────────────────────── */

  const openJoiners = useCallback(async (b: AdminGroupBuy) => {
    setJoinersOf(b);
    setJoiners(null);
    try {
      setJoiners(await apiGroupBuyJoiners(b.id));
    } catch (e) {
      toast.error("Could not load the joiners", { description: memberError(e) });
      setJoinersOf(null);
    }
  }, [toast]);

  const exportJoiners = useCallback(async (b: AdminGroupBuy) => {
    try {
      saveBlob(await apiGroupBuyJoinersCsv(b.id), `womsakhi-${b.item.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-joiners.csv`);
      toast.success("Joiner list downloaded");
    } catch (e) {
      toast.error("Could not export", { description: memberError(e) });
    }
  }, [toast]);

  const exportAll = useCallback(async () => {
    try {
      saveBlob(await apiGroupBuysCsv(), `womsakhi-group-buys-${new Date().toISOString().slice(0, 10)}.csv`);
      toast.success("Group buys downloaded");
    } catch (e) {
      toast.error("Could not export", { description: memberError(e) });
    }
  }, [toast]);

  const filtered = !!term || !!status;

  return (
    <div className="wc-page-enter">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-11 w-11 items-center justify-center rounded-xl bg-brand-tint text-brand-ink">
            <Package className="h-6 w-6" />
          </span>
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-ink">Group buys</h1>
            <p className="mt-1 max-w-2xl text-sm text-ink-subtle">
              Wholesale prices for women who cannot each order a sack. Nobody pays until you place the order; every step here tells every joiner.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {can("export") && (
            <button className="btn btn-outline" onClick={() => void exportAll()}>
              <Download className="h-4 w-4" /> Export CSV
            </button>
          )}
          {can("create") && (
            <button className="btn btn-primary" onClick={() => openEditor("new")}>
              <Plus className="h-4 w-4" /> Open a group buy
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Open" value={summary ? String(summary.open) : "—"} icon={Users} tone="brand" deltaNote="Taking joiners" />
        <StatCard label="Met — order due" value={summary ? String(summary.met) : "—"} icon={ShoppingCart}
                  tone={summary && summary.met > 0 ? "amber" : "slate"}
                  deltaNote={summary && summary.met > 0 ? "Enough joined; staff place the order" : "Nothing waiting on you"} />
        <StatCard label="Ordered" value={summary ? String(summary.ordered) : "—"} icon={Truck} tone="sky" deltaNote="Placed with the supplier" />
        <StatCard label="Closed" value={summary ? String(summary.closed) : "—"} icon={XCircle} tone="slate" deltaNote="Without an order, or cancelled" />
      </div>

      <Card className="mt-6">
        <Tabs
          className="mb-4"
          value={status}
          onChange={(v) => { setStatus(v as Status); setPage(1); }}
          tabs={[
            { value: "", label: "All" },
            { value: "open", label: "Open", count: summary?.open },
            { value: "met", label: "Met", count: summary?.met },
            { value: "ordered", label: "Ordered", count: summary?.ordered },
            { value: "closed", label: "Closed", count: summary?.closed },
          ]}
        />

        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="relative max-w-xs flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
            <input
              placeholder="Search the item or the supplier…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="w-full rounded-lg border border-line-strong bg-surface py-2 pl-9 pr-3 text-sm text-ink-muted placeholder-ink-subtle outline-none focus:border-brand-300 focus:ring-4 focus:ring-brand-tint"
            />
          </div>
        </div>

        {error ? (
          <div className="px-6 py-14 text-center">
            <p className="text-sm font-semibold text-ink">Could not load the group buys</p>
            <p className="mx-auto mt-1 max-w-sm text-xs text-ink-subtle">{error}</p>
            <button className="btn btn-outline mt-4" onClick={() => void load()}>Try again</button>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center py-16"><Spinner /></div>
        ) : data.items.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-tint text-brand-ink">
              <Package className="h-6 w-6" />
            </span>
            <p className="mt-3 text-sm font-semibold text-ink">{filtered ? "Nothing matches that" : "No group buys yet"}</p>
            <p className="mx-auto mt-1 max-w-sm text-xs text-ink-subtle">
              {filtered ? "Try a different search or tab." : "Open one: name the item, both prices, how many need to join and when it closes."}
            </p>
            {!filtered && can("create") && (
              <button className="btn btn-primary mt-4" onClick={() => openEditor("new")}><Plus className="h-4 w-4" /> Open a group buy</button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-line text-2xs font-semibold uppercase tracking-wide text-ink-subtle">
                  <th className="px-3 py-2.5">Item</th>
                  <th className="px-3 py-2.5">Price</th>
                  <th className="px-3 py-2.5">Joined</th>
                  <th className="px-3 py-2.5">Closes</th>
                  <th className="px-3 py-2.5">Stage</th>
                  <th className="px-3 py-2.5 text-right">&nbsp;</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((b) => {
                  const stage = STAGE[b.stage] ?? { label: b.stage, tone: "slate" as const };
                  const pct = b.needed > 0 ? Math.min(100, Math.round((b.joined / b.needed) * 100)) : 0;
                  const editable = b.status === "open" || b.status === "met";
                  const cancellable = b.status !== "closed" && !b.delivered_at;
                  return (
                    <tr key={b.id} className="border-b border-line last:border-0 hover:bg-surface-2">
                      <td className="px-3 py-3">
                        <p className="text-sm font-semibold text-ink">{b.item}</p>
                        <p className="text-xs text-ink-subtle">{b.unit}{b.supplier && ` · ${b.supplier}`}</p>
                      </td>
                      <td className="px-3 py-3 text-sm">
                        <p className="text-ink"><b>{rupees(b.together_minor)}</b> <span className="text-ink-subtle line-through">{rupees(b.alone_minor)}</span></p>
                        {b.saving_label && <p className="text-xs text-status-ok-ink">{b.saving_label}</p>}
                      </td>
                      <td className="px-3 py-3">
                        <button className="block w-36 text-left" onClick={() => void openJoiners(b)} title="See who joined">
                          <p className="text-sm text-ink">{b.joined} of {b.needed}
                            {b.joiner_count !== b.joined && (
                              <span className="ml-1 text-2xs text-status-warn-ink" title="The counter and the joiner rows disagree">({b.joiner_count} rows)</span>
                            )}
                          </p>
                          <ProgressBar value={pct} className="mt-1" />
                        </button>
                      </td>
                      <td className="px-3 py-3 text-sm text-ink-subtle">
                        {shortDate(b.closes_at) || "—"}
                        {b.closed && (b.status === "open" || b.status === "met") && <p className="text-2xs text-status-warn-ink">Date passed</p>}
                      </td>
                      <td className="px-3 py-3">
                        <Badge tone={stage.tone}>{stage.label}</Badge>
                        {b.stage === "ordered" && b.ordered_at && <p className="mt-1 text-2xs text-ink-subtle">by {b.ordered_by} · {shortDate(b.ordered_at)}{b.order_reference && ` · ${b.order_reference}`}</p>}
                        {b.stage === "delivered" && b.delivered_at && <p className="mt-1 text-2xs text-ink-subtle">{shortDate(b.delivered_at)}</p>}
                        {b.cancelled && <p className="mt-1 max-w-[14rem] truncate text-2xs text-ink-subtle" title={b.cancelled.reason}>{b.cancelled.by}: {b.cancelled.reason}</p>}
                      </td>
                      <td className="px-3 py-3 text-right">
                        <Menu trigger={<span className="btn btn-sm btn-ghost"><MoreHorizontal className="h-4 w-4" /></span>}>
                          <MenuItem icon={Users} onClick={() => void openJoiners(b)}>Who joined</MenuItem>
                          {b.status === "met" && can("approve") && (
                            <MenuItem icon={ShoppingCart} onClick={() => { setOrderForm({ reference: "", note: "" }); setOrdering(b); }}>Place the order</MenuItem>
                          )}
                          {b.status === "ordered" && !b.delivered_at && can("edit") && (
                            <MenuItem icon={PackageCheck} onClick={() => setDialog({ kind: "deliver", item: b })}>Mark delivered</MenuItem>
                          )}
                          {editable && can("edit") && (
                            <MenuItem icon={Pencil} onClick={() => openEditor(b)}>Edit</MenuItem>
                          )}
                          {editable && can("edit") && (
                            <MenuItem icon={XCircle} onClick={() => setDialog({ kind: "close", item: b })}>Close without an order</MenuItem>
                          )}
                          {cancellable && can("delete") && (
                            <MenuItem icon={Ban} danger onClick={() => setDialog({ kind: "cancel", item: b })}>Cancel it</MenuItem>
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
          <Pagination page={data.page} pageCount={data.pages} onPageChange={setPage} showing={showing(data, "group buys")} />
        )}
      </Card>

      {/* ── create / edit ──────────────────────────────────────────────── */}
      <Modal open={!!editing} onClose={() => setEditing(null)} icon={Package} size="md"
             title={editing === "new" ? "Open a group buy" : "Edit this group buy"}
             description={editing === "new" ? "Members see it in the app straight away and join without paying." : "Changing the number needed can tip it to met, or back to open."}
             footer={
               <>
                 <button className="btn btn-outline" onClick={() => setEditing(null)} disabled={busy}>Cancel</button>
                 <button className="btn btn-primary" onClick={() => void save()} disabled={busy}>
                   {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                   {editing === "new" ? "Open it" : "Save"}
                 </button>
               </>
             }>
        <div className="space-y-3">
          <Input label="Item" required value={form.item} onChange={(e) => setForm({ ...form, item: e.target.value })} placeholder="Plain cotton fabric" />
          <div className="grid gap-3 sm:grid-cols-2">
            <Input label="Unit" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="per 20-metre roll" hint="Shown after the price." />
            <Input label="Supplier" value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} placeholder="Bagru Mills" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input label="Price alone (₹)" required type="number" min={0} step="0.01" value={rupeeAlone} onChange={(e) => setRupeeAlone(e.target.value)} />
            <Input label="Price together (₹)" required type="number" min={0} step="0.01" value={rupeeTogether} onChange={(e) => setRupeeTogether(e.target.value)} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input label="How many need to join" required type="number" min={1} value={form.needed} onChange={(e) => setForm({ ...form, needed: Math.max(1, Number(e.target.value) || 1) })} />
            <Input label="Closes" required type="datetime-local" value={form.closes_at} onChange={(e) => setForm({ ...form, closes_at: e.target.value })} />
          </div>
          <Textarea label="A note for members" rows={2} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Enough for about two months of steady stitching." />
        </div>
      </Modal>

      {/* ── place the order ────────────────────────────────────────────── */}
      <Modal open={!!ordering} onClose={() => setOrdering(null)} icon={ShoppingCart} size="md"
             title={ordering ? `Place the order for “${ordering.item}”` : ""}
             description={ordering ? `${ordering.joined} joined of ${ordering.needed} needed. Every joiner is told the order is placed and what she pays (${rupees(ordering.together_minor)} ${ordering.unit}).` : undefined}
             footer={
               <>
                 <button className="btn btn-outline" onClick={() => setOrdering(null)} disabled={busy}>Not yet</button>
                 <button className="btn btn-primary" onClick={() => void placeOrder()} disabled={busy}>
                   {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                   <CheckCircle2 className="h-4 w-4" /> Order placed — tell them
                 </button>
               </>
             }>
        <div className="space-y-3">
          <Input label="Supplier reference (optional)" value={orderForm.reference} onChange={(e) => setOrderForm({ ...orderForm, reference: e.target.value })} placeholder="Invoice or order number" />
          <Textarea label="Anything to tell the joiners (optional)" rows={3} value={orderForm.note} onChange={(e) => setOrderForm({ ...orderForm, note: e.target.value })} placeholder="Expected in about ten days. Collect from the Sector 12 centre." hint="Added to the message every joiner receives." />
        </div>
      </Modal>

      {/* ── joiners ────────────────────────────────────────────────────── */}
      <Modal open={!!joinersOf} onClose={() => { setJoinersOf(null); setJoiners(null); }} icon={Users} size="md"
             title={joinersOf ? `Who joined “${joinersOf.item}”` : ""}
             description={joinersOf ? `${joinersOf.joined} of ${joinersOf.needed} needed` : undefined}
             footer={joinersOf && can("export") && joiners && joiners.length > 0 ? (
               <button className="btn btn-outline" onClick={() => void exportJoiners(joinersOf)}><Download className="h-4 w-4" /> Export CSV</button>
             ) : undefined}>
        {joiners === null ? (
          <div className="flex items-center justify-center py-8"><Spinner /></div>
        ) : joiners.length === 0 ? (
          <p className="py-6 text-center text-sm text-ink-subtle">Nobody has joined yet.</p>
        ) : (
          <ul className="divide-y divide-line">
            {joiners.map((j) => (
              <li key={j.id} className="flex items-center justify-between gap-3 py-2.5">
                <PersonCell person={j} note={`joined ${shortDate(j.joined_at)}`} />
                <span className="text-sm text-ink-muted">× {j.quantity}</span>
              </li>
            ))}
          </ul>
        )}
      </Modal>

      {/* ── reasons ────────────────────────────────────────────────────── */}
      <ReasonModal
        open={dialog?.kind === "close"}
        title={dialog ? `Close “${dialog.item.item}” without an order` : ""}
        description={dialog ? `${dialog.item.joined} of ${dialog.item.needed} joined. Every joiner is told it did not go ahead and that she owes nothing.` : undefined}
        label="A word for them (optional)"
        placeholder="We will open it again next month."
        confirmLabel="Close it"
        required={false}
        busy={busy}
        icon={XCircle}
        onClose={() => setDialog(null)}
        onConfirm={confirmDialog}
      />
      <ReasonModal
        open={dialog?.kind === "cancel"}
        title={dialog ? `Cancel “${dialog.item.item}”` : ""}
        description="Calls it off whatever stage it is at. Every joiner is told this reason and that she owes nothing."
        label="Why it is being cancelled"
        confirmLabel="Cancel the buy"
        danger
        busy={busy}
        icon={Ban}
        onClose={() => setDialog(null)}
        onConfirm={confirmDialog}
      />
      <ReasonModal
        open={dialog?.kind === "deliver"}
        title={dialog ? `“${dialog.item.item}” has arrived` : ""}
        description="Every joiner is told to collect it."
        label="Where and when to collect (optional)"
        placeholder="At the Sector 12 centre, weekdays 10 to 4."
        confirmLabel="Mark delivered — tell them"
        required={false}
        busy={busy}
        icon={PackageCheck}
        onClose={() => setDialog(null)}
        onConfirm={confirmDialog}
      />
    </div>
  );
}
