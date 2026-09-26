"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CheckCircle2, CreditCard, Download, MoreHorizontal, Receipt, RotateCcw, Search,
  SlidersHorizontal, XCircle,
} from "lucide-react";
import {
  Badge, Card, ErrorState, Input, Menu, MenuItem, Modal, Pagination, Spinner, StatCard,
  Textarea, useToast,
} from "@/design-system";
import { useAuth } from "@/context/AuthContext";
import { apiErrorMessage } from "@/lib/api";
import {
  apiMoneyOrder, apiMoneyOrders, apiMoneyOrdersCsv, apiMoneyOrdersSummary, apiMoneyPermissions,
  apiMoneyRefund, downloadBlob, whenLabel,
  type AdminOrder, type AdminOrderDetail, type MoneyAction, type OrdersPage, type OrdersSummary,
} from "@/lib/money-admin-api";
import {
  DateRange, HonestyNote, ORDER_LABEL, ORDER_TONE, PageHeader, PersonCell, StatusBadge, TableEmpty,
  money, rupeesToMinor, searchClass, showingLabel, thClass, trHead, trRow,
} from "@/components/admin/money/shared";

/**
 * Every payment a member started, and the one thing staff can do to it: ask
 * the provider for a refund.
 *
 * The two endpoints behind this used to sit in payments.py behind
 * `require_staff` only — any staff account could refund anything, unaudited.
 * They now need `money.approve`, and each refund is written to the audit
 * trail with its reason.
 */

const PAGE_SIZE = 20;
const STATUS_OPTIONS = ["all", "paid", "created", "failed", "refunded", "cancelled"];

export default function MoneyOrdersPage() {
  const { user } = useAuth();
  const toast = useToast();
  const isSuper = user?.role === "Super Admin";

  const [perms, setPerms] = useState<Set<MoneyAction>>(new Set());
  const [data, setData] = useState<OrdersPage | null>(null);
  const [summary, setSummary] = useState<OrdersSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [status, setStatus] = useState("all");
  const [range, setRange] = useState({ from: "", to: "" });
  const [page, setPage] = useState(1);

  const [detail, setDetail] = useState<AdminOrderDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [refunding, setRefunding] = useState<AdminOrder | null>(null);
  const [refundForm, setRefundForm] = useState({ full: true, amount: "", reason: "" });
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);
  useEffect(() => { setPage(1); }, [debouncedQ, status, range.from, range.to]);

  useEffect(() => {
    let alive = true;
    apiMoneyPermissions(isSuper).then((p) => { if (alive) setPerms(p); }).catch(() => {});
    return () => { alive = false; };
  }, [isSuper]);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError("");
    try {
      const [list, sum] = await Promise.all([
        apiMoneyOrders({ status, q: debouncedQ, from: range.from, to: range.to, page, page_size: PAGE_SIZE }, signal),
        apiMoneyOrdersSummary(signal),
      ]);
      setData(list);
      setSummary(sum);
    } catch (e) {
      if (signal?.aborted) return;
      setError(apiErrorMessage(e, "Could not load payments."));
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [status, debouncedQ, range.from, range.to, page]);

  useEffect(() => {
    const c = new AbortController();
    void load(c.signal);
    return () => c.abort();
  }, [load]);

  const openDetail = useCallback(async (o: AdminOrder) => {
    setDetailLoading(true);
    try {
      setDetail(await apiMoneyOrder(o.id));
    } catch (e) {
      toast.error("Could not open that payment", { description: apiErrorMessage(e) });
    } finally {
      setDetailLoading(false);
    }
  }, [toast]);

  const openRefund = useCallback((o: AdminOrder) => {
    setRefundForm({ full: true, amount: "", reason: "" });
    setRefunding(o);
  }, []);

  const submitRefund = useCallback(async () => {
    if (!refunding) return;
    const reason = refundForm.reason.trim();
    if (reason.length < 3) {
      toast.error("Say why", { description: "The reason goes on the audit trail and to the member." });
      return;
    }
    let amount: number | null = null;
    if (!refundForm.full) {
      amount = rupeesToMinor(refundForm.amount);
      if (!amount) {
        toast.error("Enter an amount in rupees, like 250 or 250.50");
        return;
      }
      if (amount > refunding.refundable_minor) {
        toast.error(`Only ${money(refunding.refundable_minor)} can still be refunded`);
        return;
      }
    }
    setBusy(true);
    try {
      const res = await apiMoneyRefund(refunding.id, { amount_minor: amount, reason });
      toast.success(`Refund of ${res.refund.amount_label} requested`, {
        description: `Sent to ${res.order.provider}${res.order.sandbox ? " (sandbox — no real money moves)" : ""}. Status: ${res.refund.status}.`,
      });
      setRefunding(null);
      if (detail?.id === res.order.id) setDetail(res.order);
      await load();
    } catch (e) {
      toast.error("The refund was not made", { description: apiErrorMessage(e) });
    } finally {
      setBusy(false);
    }
  }, [refunding, refundForm, detail, load, toast]);

  const exportCsv = useCallback(async () => {
    setExporting(true);
    try {
      downloadBlob(await apiMoneyOrdersCsv({ status, q: debouncedQ, from: range.from, to: range.to }), "payments.csv");
      toast.success("Exported", { description: "Filtered exactly as the table is." });
    } catch (e) {
      toast.error("Could not export", { description: apiErrorMessage(e) });
    } finally {
      setExporting(false);
    }
  }, [status, debouncedQ, range, toast]);

  const filtered = !!debouncedQ || status !== "all" || !!range.from || !!range.to;
  const orders = data?.orders ?? [];
  const pagination = data?.pagination;
  const by = summary?.by_status ?? {};
  const bucket = (s: string) => by[s] ?? { count: 0, amount_minor: 0, refunded_minor: 0 };

  return (
    <div>
      <PageHeader
        icon={CreditCard}
        title="Payments"
        subtitle="Every payment a member started, what the provider said about it, and any refund."
        action={perms.has("export") ? (
          <button className="btn btn-outline" disabled={exporting} onClick={() => void exportCsv()}>
            <Download className="h-4 w-4" /> {exporting ? "Exporting…" : "Export CSV"}
          </button>
        ) : undefined}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="All payments" value={String(summary?.total ?? 0)} icon={Receipt} tone="brand"
                  deltaNote="Every order ever started" />
        <StatCard label="Paid" value={String(bucket("paid").count + bucket("refunded").count)} icon={CheckCircle2} tone="emerald"
                  deltaNote={summary ? `${money(summary.gross_minor)} received in all` : "—"} />
        <StatCard label="Refunded" value={String(summary?.refund_count ?? 0)} icon={RotateCcw} tone="sky"
                  deltaNote={summary ? `${money(summary.refunded_minor)} sent back` : "—"} />
        <StatCard label="Unpaid or failed" value={String(bucket("created").count + bucket("failed").count)} icon={XCircle}
                  tone={bucket("failed").count > 0 ? "amber" : "slate"}
                  deltaNote={`${bucket("created").count} awaiting · ${bucket("failed").count} failed`} />
      </div>

      <HonestyNote title="WomSakhi holds no money">
        A refund here is a request to the payment provider
        {summary ? ` (${summary.provider}${summary.sandbox ? " — sandbox, so no real money moves yet" : ""})` : ""}.
        The provider moves the money; this screen records that it was asked to. Nothing on this page can move a rupee itself.
      </HonestyNote>

      <Card className="mt-6">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="relative max-w-xs flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
            <input placeholder="Search by member, title or provider id…" value={q}
                   onChange={(e) => setQ(e.target.value)} className={searchClass} />
          </div>
          <Menu trigger={
            <span className="btn btn-sm btn-outline">
              <SlidersHorizontal className="h-3.5 w-3.5" />
              {status === "all" ? "All statuses" : ORDER_LABEL[status] ?? status}
            </span>
          }>
            {STATUS_OPTIONS.map((s) => (
              <MenuItem key={s} onClick={() => setStatus(s)}>{s === "all" ? "All statuses" : ORDER_LABEL[s]}</MenuItem>
            ))}
          </Menu>
          <DateRange from={range.from} to={range.to} onChange={setRange} />
          {filtered && (
            <button className="btn btn-sm btn-ghost" onClick={() => { setQ(""); setStatus("all"); setRange({ from: "", to: "" }); }}>
              Clear
            </button>
          )}
        </div>

        {error ? (
          <ErrorState title="Could not load payments" description={error} onRetry={() => void load()} />
        ) : loading && !data ? (
          <div className="flex items-center justify-center py-16"><Spinner /></div>
        ) : orders.length === 0 ? (
          <TableEmpty
            icon={Receipt}
            title={filtered ? "Nothing matches that" : "No payments yet"}
            description={filtered
              ? "Try a different search, status or date range."
              : "A payment appears here the moment a member starts a checkout."}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className={trHead}>
                  <th className={thClass}>Member</th>
                  <th className={thClass}>For</th>
                  <th className={`${thClass} text-right`}>Amount</th>
                  <th className={thClass}>Status</th>
                  <th className={thClass}>Method</th>
                  <th className={thClass}>When</th>
                  <th className={`${thClass} text-right`}>&nbsp;</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id} className={trRow}>
                    <td className="px-3 py-3"><PersonCell person={o.member} /></td>
                    <td className="px-3 py-3">
                      <p className="text-sm text-ink">{o.title || "—"}</p>
                      <p className="text-2xs uppercase tracking-wide text-ink-subtle">{o.purpose}</p>
                    </td>
                    <td className="px-3 py-3 text-right">
                      <p className="text-sm font-semibold text-ink">{money(o.amount_minor)}</p>
                      {o.refunded_minor > 0 && (
                        <p className="text-2xs text-ink-subtle">{money(o.refunded_minor)} refunded</p>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <StatusBadge value={o.status} tones={ORDER_TONE} labels={ORDER_LABEL} />
                      {o.failure_reason && <p className="mt-0.5 max-w-[14rem] truncate text-2xs text-ink-subtle" title={o.failure_reason}>{o.failure_reason}</p>}
                    </td>
                    <td className="px-3 py-3 text-sm text-ink-muted">
                      {o.method ? o.method.toUpperCase() : "—"}
                      <p className="text-2xs text-ink-subtle">{o.provider}</p>
                    </td>
                    <td className="px-3 py-3 text-sm text-ink-subtle">{whenLabel(o.paid_at || o.created_at, false) || o.created}</td>
                    <td className="px-3 py-3 text-right">
                      <Menu trigger={<span className="btn btn-sm btn-ghost"><MoreHorizontal className="h-4 w-4" /></span>}>
                        <MenuItem onClick={() => void openDetail(o)}>Open details</MenuItem>
                        {perms.has("approve") && o.status === "paid" && o.refundable_minor > 0 && (
                          <MenuItem onClick={() => openRefund(o)}>Refund…</MenuItem>
                        )}
                      </Menu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {pagination && pagination.total > 0 && (
          <Pagination page={pagination.page} pageCount={pagination.pages} onPageChange={setPage}
                      showing={showingLabel(pagination.total, pagination.page, pagination.page_size, "payments")} />
        )}
      </Card>

      {/* ── detail ─────────────────────────────────────────────────────── */}
      <Modal open={!!detail || detailLoading} onClose={() => setDetail(null)} title="Payment" size="lg"
             description={detail ? `${detail.title} · ${money(detail.amount_minor)}` : undefined}>
        {detailLoading && !detail ? (
          <div className="flex items-center justify-center py-10"><Spinner /></div>
        ) : detail && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <PersonCell person={detail.member} sub={detail.purpose} />
              <StatusBadge value={detail.status} tones={ORDER_TONE} labels={ORDER_LABEL} />
            </div>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
              <Field label="Amount" value={money(detail.amount_minor)} />
              <Field label="Refunded" value={money(detail.refunded_minor)} />
              <Field label="Still refundable" value={money(detail.refundable_minor)} />
              <Field label="Method" value={detail.method ? detail.method.toUpperCase() : "—"} />
              <Field label="Provider" value={`${detail.provider}${detail.sandbox ? " (sandbox)" : ""}`} />
              <Field label="Currency" value={detail.currency} />
              <Field label="Started" value={whenLabel(detail.created_at) || detail.created} />
              <Field label="Paid" value={whenLabel(detail.paid_at) || "—"} />
              <Field label="Last change" value={whenLabel(detail.updated_at) || "—"} />
              <Field label="Provider order" value={detail.provider_order_id || "—"} mono />
              <Field label="Provider payment" value={detail.provider_payment_id || "—"} mono />
              <Field label="Reference" value={detail.reference_id || "—"} mono />
            </dl>
            {detail.failure_reason && (
              <p className="rounded-lg bg-status-danger-bg px-3 py-2 text-xs text-status-danger-ink">{detail.failure_reason}</p>
            )}
            <div>
              <h3 className="font-display text-sm font-semibold text-ink">Refunds</h3>
              {detail.refunds.length === 0 ? (
                <p className="mt-1 text-xs text-ink-subtle">None for this payment.</p>
              ) : (
                <ul className="mt-2 divide-y divide-line rounded-lg border border-line">
                  {detail.refunds.map((r) => (
                    <li key={r.id} className="flex flex-wrap items-start justify-between gap-2 px-3 py-2 text-sm">
                      <div>
                        <p className="font-semibold text-ink">{money(r.amount_minor)} <Badge tone={r.status === "processed" ? "emerald" : r.status === "failed" ? "rose" : "amber"}>{r.status}</Badge></p>
                        <p className="text-xs text-ink-muted">{r.reason || "No reason recorded"}</p>
                      </div>
                      <p className="text-xs text-ink-subtle">{whenLabel(r.created_at) || r.created}{r.by_name ? ` · ${r.by_name}` : ""}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <button className="btn btn-outline" onClick={() => setDetail(null)}>Close</button>
              {perms.has("approve") && detail.status === "paid" && detail.refundable_minor > 0 && (
                <button className="btn btn-primary" onClick={() => openRefund(detail)}>Refund…</button>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* ── refund ─────────────────────────────────────────────────────── */}
      <Modal open={!!refunding} onClose={() => setRefunding(null)} title="Ask the provider for a refund"
             description={refunding ? `${refunding.member.name} · ${refunding.title}` : undefined}>
        {refunding && (
          <div className="space-y-4">
            <p className="rounded-lg bg-surface-2 px-3 py-2.5 text-xs leading-relaxed text-ink-muted">
              Paid {money(refunding.amount_minor)}; {money(refunding.refunded_minor)} already refunded;
              {" "}<b className="text-ink">{money(refunding.refundable_minor)}</b> can still go back.
              The provider{summary?.sandbox ? " (sandbox — no real money moves)" : ""} makes the transfer; this records the request.
            </p>
            <div className="flex gap-2">
              <button className={`btn btn-sm ${refundForm.full ? "btn-primary" : "btn-outline"}`}
                      onClick={() => setRefundForm({ ...refundForm, full: true })}>
                Everything left ({money(refunding.refundable_minor)})
              </button>
              <button className={`btn btn-sm ${!refundForm.full ? "btn-primary" : "btn-outline"}`}
                      onClick={() => setRefundForm({ ...refundForm, full: false })}>
                Part of it
              </button>
            </div>
            {!refundForm.full && (
              <Input label="Amount (₹)" inputMode="decimal" placeholder="250.00" value={refundForm.amount}
                     onChange={(e) => setRefundForm({ ...refundForm, amount: e.target.value })}
                     hint={`Up to ${money(refunding.refundable_minor)}`} />
            )}
            <Textarea label="Reason" required rows={3} value={refundForm.reason}
                      onChange={(e) => setRefundForm({ ...refundForm, reason: e.target.value })}
                      hint="Goes on the audit trail and in her notification." />
            <div className="flex justify-end gap-2 pt-2">
              <button className="btn btn-outline" onClick={() => setRefunding(null)}>Cancel</button>
              <button className="btn btn-primary" disabled={busy} onClick={() => void submitRefund()}>
                {busy ? "Requesting…" : "Request refund"}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function Field({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-2xs font-semibold uppercase tracking-wide text-ink-subtle">{label}</dt>
      <dd className={`mt-0.5 truncate text-ink ${mono ? "font-mono text-xs" : ""}`} title={value}>{value}</dd>
    </div>
  );
}
