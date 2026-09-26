"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Banknote, CheckCircle2, Clock, Download, Landmark, MoreHorizontal, Search, XCircle,
} from "lucide-react";
import {
  Card, ErrorState, Input, Menu, MenuItem, Modal, Pagination, Spinner, StatCard, Tabs,
  Textarea, useToast,
} from "@/design-system";
import { useAuth } from "@/context/AuthContext";
import { apiErrorMessage } from "@/lib/api";
import {
  apiMoneyMarkFailed, apiMoneyMarkPaid, apiMoneyPermissions, apiMoneyWithdrawals,
  apiMoneyWithdrawalsCsv, apiMoneyWithdrawalsSummary, downloadBlob, whenLabel,
  type AdminWithdrawal, type MoneyAction, type WithdrawalsPage, type WithdrawalsSummary,
} from "@/lib/money-admin-api";
import {
  DateRange, HonestyNote, PAYOUT_LABEL, PAYOUT_TONE, PageHeader, PersonCell, StatusBadge, TableEmpty,
  money, searchClass, showingLabel, thClass, trHead, trRow,
} from "@/components/admin/money/shared";

/**
 * Withdrawal requests: a member asked for her balance to be sent to her bank.
 *
 * The member side writes a debit row and nothing processed it — the one real
 * request has sat as a debit with nowhere to go. This is where staff record
 * what happened to it:
 *
 *   Mark paid   — the organisation made the transfer from its own bank; the
 *                 UTR / reference is recorded here. It moves no money.
 *   Mark failed — the transfer did not go through; a reversing CREDIT row
 *                 restores her balance, and the reason stays on record.
 */

const PAGE_SIZE = 20;

export default function MoneyWithdrawalsPage() {
  const { user } = useAuth();
  const toast = useToast();
  const isSuper = user?.role === "Super Admin";

  const [perms, setPerms] = useState<Set<MoneyAction>>(new Set());
  const [data, setData] = useState<WithdrawalsPage | null>(null);
  const [summary, setSummary] = useState<WithdrawalsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [status, setStatus] = useState("pending");
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [range, setRange] = useState({ from: "", to: "" });
  const [page, setPage] = useState(1);

  const [paying, setPaying] = useState<AdminWithdrawal | null>(null);
  const [payForm, setPayForm] = useState({ utr: "", paid_at: "", note: "" });
  const [failing, setFailing] = useState<AdminWithdrawal | null>(null);
  const [failReason, setFailReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);
  useEffect(() => { setPage(1); }, [status, debouncedQ, range.from, range.to]);

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
        apiMoneyWithdrawals({ status, q: debouncedQ, from: range.from, to: range.to, page, page_size: PAGE_SIZE }, signal),
        apiMoneyWithdrawalsSummary(signal),
      ]);
      setData(list);
      setSummary(sum);
    } catch (e) {
      if (signal?.aborted) return;
      setError(apiErrorMessage(e, "Could not load withdrawals."));
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [status, debouncedQ, range.from, range.to, page]);

  useEffect(() => {
    const c = new AbortController();
    void load(c.signal);
    return () => c.abort();
  }, [load]);

  const submitPaid = useCallback(async () => {
    if (!paying) return;
    const utr = payForm.utr.trim();
    if (utr.length < 4) {
      toast.error("Enter the bank's reference (UTR)", { description: "It is the evidence the transfer was made." });
      return;
    }
    setBusy(true);
    try {
      const row = await apiMoneyMarkPaid(paying.id, { utr, paid_at: payForm.paid_at, note: payForm.note.trim() });
      toast.success(`Recorded ${row.amount_label} as paid out`, { description: `UTR ${row.utr}. She has been told.` });
      setPaying(null);
      await load();
    } catch (e) {
      toast.error("Could not record that", { description: apiErrorMessage(e) });
    } finally {
      setBusy(false);
    }
  }, [paying, payForm, load, toast]);

  const submitFailed = useCallback(async () => {
    if (!failing) return;
    const reason = failReason.trim();
    if (reason.length < 5) {
      toast.error("Say what went wrong", { description: "The reason is shown to her and kept on the audit trail." });
      return;
    }
    setBusy(true);
    try {
      const row = await apiMoneyMarkFailed(failing.id, reason);
      toast.success(`${row.amount_label} is back in her balance`, { description: "A reversing credit was written; the failed request stays on record." });
      setFailing(null);
      await load();
    } catch (e) {
      toast.error("Could not record that", { description: apiErrorMessage(e) });
    } finally {
      setBusy(false);
    }
  }, [failing, failReason, load, toast]);

  const exportCsv = useCallback(async () => {
    setExporting(true);
    try {
      downloadBlob(await apiMoneyWithdrawalsCsv({ status, q: debouncedQ, from: range.from, to: range.to }), "withdrawals.csv");
      toast.success("Exported", { description: "Filtered exactly as the table is." });
    } catch (e) {
      toast.error("Could not export", { description: apiErrorMessage(e) });
    } finally {
      setExporting(false);
    }
  }, [status, debouncedQ, range, toast]);

  const rows = data?.withdrawals ?? [];
  const pagination = data?.pagination;
  const by = summary?.by_status;
  const filtered = !!debouncedQ || !!range.from || !!range.to;

  return (
    <div>
      <PageHeader
        icon={Banknote}
        title="Withdrawals"
        subtitle="Members asking for their balance to be sent to their bank, and what happened to each request."
        action={perms.has("export") ? (
          <button className="btn btn-outline" disabled={exporting} onClick={() => void exportCsv()}>
            <Download className="h-4 w-4" /> {exporting ? "Exporting…" : "Export CSV"}
          </button>
        ) : undefined}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Pending" value={String(by?.pending.count ?? 0)} icon={Clock}
                  tone={(by?.pending.count ?? 0) > 0 ? "amber" : "slate"}
                  deltaNote={by ? `${money(by.pending.amount_minor)} waiting to be sent` : "—"} />
        <StatCard label="Paid out" value={String(by?.paid.count ?? 0)} icon={CheckCircle2} tone="emerald"
                  deltaNote={by ? `${money(by.paid.amount_minor)} transferred` : "—"} />
        <StatCard label="Failed" value={String(by?.failed.count ?? 0)} icon={XCircle} tone={(by?.failed.count ?? 0) > 0 ? "rose" : "slate"}
                  deltaNote={by ? `${money(by.failed.amount_minor)} returned to balances` : "—"} />
        <StatCard label="Oldest pending" value={summary?.oldest_pending_at ? whenLabel(summary.oldest_pending_at, false) : "None"}
                  icon={Landmark} tone="brand" valueClassName="text-lg"
                  deltaNote="Members are told: within three working days" />
      </div>

      <HonestyNote title="Nothing here moves money">
        WomSakhi holds no money and is not licensed to. <b>Mark paid</b> records a transfer the organisation
        already made from its own bank account — enter the bank&apos;s UTR / reference as the evidence.
        <b> Mark failed</b> restores her balance with a reversing credit row; the failed request stays on record with its reason.
      </HonestyNote>

      <Card className="mt-6">
        <Tabs
          className="mb-4"
          value={status}
          onChange={setStatus}
          tabs={[
            { value: "pending", label: "Pending", count: by?.pending.count },
            { value: "paid", label: "Paid out", count: by?.paid.count },
            { value: "failed", label: "Failed", count: by?.failed.count },
            { value: "all", label: "All" },
          ]}
        />
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="relative max-w-xs flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
            <input placeholder="Search by member or UTR…" value={q} onChange={(e) => setQ(e.target.value)} className={searchClass} />
          </div>
          <DateRange from={range.from} to={range.to} onChange={setRange} />
          {filtered && (
            <button className="btn btn-sm btn-ghost" onClick={() => { setQ(""); setRange({ from: "", to: "" }); }}>Clear</button>
          )}
        </div>

        {error ? (
          <ErrorState title="Could not load withdrawals" description={error} onRetry={() => void load()} />
        ) : loading && !data ? (
          <div className="flex items-center justify-center py-16"><Spinner /></div>
        ) : rows.length === 0 ? (
          <TableEmpty
            icon={Banknote}
            title={filtered ? "Nothing matches that" : status === "pending" ? "Nothing waiting" : `No ${PAYOUT_LABEL[status]?.toLowerCase() ?? ""} withdrawals`}
            description={filtered
              ? "Try a different search or date range."
              : status === "pending"
                ? "Every request has been dealt with. A new one appears here the moment a member asks to withdraw."
                : "Requests move here once they are marked from the pending list."}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className={trHead}>
                  <th className={thClass}>Member</th>
                  <th className={`${thClass} text-right`}>Amount</th>
                  <th className={thClass}>To</th>
                  <th className={thClass}>Requested</th>
                  <th className={thClass}>Status</th>
                  <th className={thClass}>Record</th>
                  <th className={`${thClass} text-right`}>&nbsp;</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((w) => (
                  <tr key={w.id} className={trRow}>
                    <td className="px-3 py-3"><PersonCell person={w.member} /></td>
                    <td className="px-3 py-3 text-right text-sm font-semibold text-ink">{money(w.amount_minor)}</td>
                    <td className="px-3 py-3">
                      {w.account ? (
                        <>
                          <p className="text-sm text-ink">{w.account.kind} {w.account.detail}</p>
                          <p className="text-2xs text-ink-subtle">
                            {w.account.holder || w.account.label}{w.account.ifsc ? ` · ${w.account.ifsc}` : ""}
                            {w.account.verified ? " · verified" : " · not verified"}
                          </p>
                        </>
                      ) : (
                        <p className="text-xs text-ink-subtle">Account removed since</p>
                      )}
                    </td>
                    <td className="px-3 py-3 text-sm text-ink-subtle">{whenLabel(w.requested_at)}</td>
                    <td className="px-3 py-3"><StatusBadge value={w.payout_status} tones={PAYOUT_TONE} labels={PAYOUT_LABEL} /></td>
                    <td className="px-3 py-3 text-xs text-ink-muted">
                      {w.payout_status === "paid" && (
                        <>
                          <p className="font-mono text-ink">{w.utr}</p>
                          <p className="text-2xs text-ink-subtle">{whenLabel(w.paid_at, false)}{w.paid_by ? ` · ${w.paid_by}` : ""}</p>
                        </>
                      )}
                      {w.payout_status === "failed" && (
                        <>
                          <p className="max-w-[16rem] truncate" title={w.failed_reason}>{w.failed_reason}</p>
                          <p className="text-2xs text-ink-subtle">{whenLabel(w.failed_at, false)}{w.failed_by ? ` · ${w.failed_by}` : ""}</p>
                        </>
                      )}
                      {w.payout_status === "pending" && <span className="text-ink-subtle">—</span>}
                    </td>
                    <td className="px-3 py-3 text-right">
                      {perms.has("approve") && w.payout_status === "pending" && (
                        <Menu trigger={<span className="btn btn-sm btn-ghost"><MoreHorizontal className="h-4 w-4" /></span>}>
                          <MenuItem onClick={() => { setPayForm({ utr: "", paid_at: "", note: "" }); setPaying(w); }}>Mark paid…</MenuItem>
                          <MenuItem danger onClick={() => { setFailReason(""); setFailing(w); }}>Mark failed…</MenuItem>
                        </Menu>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {pagination && pagination.total > 0 && (
          <Pagination page={pagination.page} pageCount={pagination.pages} onPageChange={setPage}
                      showing={showingLabel(pagination.total, pagination.page, pagination.page_size, "requests")} />
        )}
      </Card>

      {/* ── mark paid ──────────────────────────────────────────────────── */}
      <Modal open={!!paying} onClose={() => setPaying(null)} title="Record the transfer"
             description={paying ? `${paying.member.name} · ${money(paying.amount_minor)}` : undefined}>
        {paying && (
          <div className="space-y-4">
            <p className="rounded-lg bg-surface-2 px-3 py-2.5 text-xs leading-relaxed text-ink-muted">
              This records a transfer the organisation has <b>already made</b> from its own bank
              {paying.account ? <> to <b className="text-ink">{paying.account.kind} {paying.account.detail}</b> ({paying.account.holder || paying.account.label})</> : null}.
              It does not send anything. She is notified with the reference you enter.
            </p>
            <Input label="Bank reference (UTR)" required value={payForm.utr} placeholder="e.g. HDFCN52026092612345"
                   onChange={(e) => setPayForm({ ...payForm, utr: e.target.value })} />
            <Input label="Date transferred" type="date" value={payForm.paid_at}
                   onChange={(e) => setPayForm({ ...payForm, paid_at: e.target.value })} hint="Leave blank for today." />
            <Input label="Note (optional)" value={payForm.note}
                   onChange={(e) => setPayForm({ ...payForm, note: e.target.value })} />
            <div className="flex justify-end gap-2 pt-2">
              <button className="btn btn-outline" onClick={() => setPaying(null)}>Cancel</button>
              <button className="btn btn-primary" disabled={busy} onClick={() => void submitPaid()}>
                {busy ? "Recording…" : "Record as paid"}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── mark failed ────────────────────────────────────────────────── */}
      <Modal open={!!failing} onClose={() => setFailing(null)} title="Record a failed transfer" iconTone="rose"
             description={failing ? `${failing.member.name} · ${money(failing.amount_minor)}` : undefined}>
        {failing && (
          <div className="space-y-4">
            <p className="rounded-lg bg-surface-2 px-3 py-2.5 text-xs leading-relaxed text-ink-muted">
              A reversing credit of <b className="text-ink">{money(failing.amount_minor)}</b> is written to her ledger so her
              balance is restored. The request stays on record as failed, with this reason, and she is told.
            </p>
            <Textarea label="What went wrong" required rows={3} value={failReason}
                      onChange={(e) => setFailReason(e.target.value)}
                      hint="Shown to her. e.g. “The bank rejected the account number.”" />
            <div className="flex justify-end gap-2 pt-2">
              <button className="btn btn-outline" onClick={() => setFailing(null)}>Cancel</button>
              <button className="btn btn-primary" disabled={busy} onClick={() => void submitFailed()}>
                {busy ? "Recording…" : "Mark failed and restore balance"}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
