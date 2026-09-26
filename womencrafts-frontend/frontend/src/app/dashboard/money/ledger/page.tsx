"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ArrowDownLeft, ArrowUpRight, BookOpen, Download, MoreHorizontal, Scale, Search,
  SlidersHorizontal, Users, Wallet,
} from "lucide-react";
import {
  Badge, Card, ErrorState, Input, Menu, MenuItem, Modal, Pagination, Select, Spinner, StatCard,
  Textarea, useToast,
} from "@/design-system";
import { useAuth } from "@/context/AuthContext";
import { apiErrorMessage } from "@/lib/api";
import {
  apiMoneyAdjust, apiMoneyLedger, apiMoneyLedgerCsv, apiMoneyLedgerSummary, apiMoneyMemberBalance,
  apiMoneyPermissions, downloadBlob, whenLabel,
  type LedgerPage, type LedgerSummary, type LedgerTxn, type MemberBalance, type MoneyAction, type Person,
} from "@/lib/money-admin-api";
import {
  DateRange, HonestyNote, PageHeader, PersonCell, TableEmpty, money, rupeesToMinor, searchClass,
  showingLabel, sourceLabel, thClass, trHead, trRow,
} from "@/components/admin/money/shared";

/**
 * The wallet ledger: every credit and debit on every member's balance.
 *
 * A balance is never stored — it is the sum of these rows — so this is the
 * whole truth about what the platform owes a member. The one write here is a
 * manual adjustment: a correction with a mandatory reason, written as a new
 * row (the ledger is append-only) and put on the audit trail with the reason.
 */

const PAGE_SIZE = 25;
const HEX24 = /^[0-9a-f]{24}$/;

export default function MoneyLedgerPage() {
  const { user } = useAuth();
  const toast = useToast();
  const isSuper = user?.role === "Super Admin";

  const [perms, setPerms] = useState<Set<MoneyAction>>(new Set());
  const [data, setData] = useState<LedgerPage | null>(null);
  const [summary, setSummary] = useState<LedgerSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [kind, setKind] = useState("");
  const [source, setSource] = useState("all");
  const [member, setMember] = useState<Person | null>(null);
  const [range, setRange] = useState({ from: "", to: "" });
  const [page, setPage] = useState(1);

  const [balance, setBalance] = useState<MemberBalance | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [adjusting, setAdjusting] = useState(false);
  const [adjust, setAdjust] = useState({ user_id: "", person: null as Person | null, kind: "credit", amount: "", reason: "" });
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);
  useEffect(() => { setPage(1); }, [debouncedQ, kind, source, member, range.from, range.to]);

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
        apiMoneyLedger({
          user_id: member?.user_id ?? "", kind, source, q: debouncedQ,
          from: range.from, to: range.to, page, page_size: PAGE_SIZE,
        }, signal),
        apiMoneyLedgerSummary(signal),
      ]);
      setData(list);
      setSummary(sum);
    } catch (e) {
      if (signal?.aborted) return;
      setError(apiErrorMessage(e, "Could not load the ledger."));
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [member, kind, source, debouncedQ, range.from, range.to, page]);

  useEffect(() => {
    const c = new AbortController();
    void load(c.signal);
    return () => c.abort();
  }, [load]);

  const openBalance = useCallback(async (p: Person) => {
    setBalanceLoading(true);
    try {
      setBalance(await apiMoneyMemberBalance(p.user_id));
    } catch (e) {
      toast.error("Could not read her balance", { description: apiErrorMessage(e) });
    } finally {
      setBalanceLoading(false);
    }
  }, [toast]);

  const openAdjust = useCallback((p: Person | null) => {
    setAdjust({ user_id: p?.user_id ?? "", person: p, kind: "credit", amount: "", reason: "" });
    setAdjusting(true);
  }, []);

  const submitAdjust = useCallback(async () => {
    const userId = adjust.user_id.trim().toLowerCase();
    if (!HEX24.test(userId)) {
      toast.error("Pick a member", { description: "Open an adjustment from one of her rows, or paste her 24-character user id." });
      return;
    }
    const amount = rupeesToMinor(adjust.amount);
    if (!amount) {
      toast.error("Enter an amount in rupees, like 250 or 250.50");
      return;
    }
    const reason = adjust.reason.trim();
    if (reason.length < 5) {
      toast.error("The reason is required", { description: "It is written on the row and on the audit trail." });
      return;
    }
    setBusy(true);
    try {
      const res = await apiMoneyAdjust({ user_id: userId, kind: adjust.kind as "credit" | "debit", amount_minor: amount, reason });
      toast.success(`${res.transaction.amount_label} adjustment written`, {
        description: `${res.transaction.member.name} now has ${money(res.balance_minor)}. She has been told.`,
      });
      setAdjusting(false);
      if (balance?.member.user_id === userId) setBalance(await apiMoneyMemberBalance(userId));
      await load();
    } catch (e) {
      toast.error("The adjustment was not written", { description: apiErrorMessage(e) });
    } finally {
      setBusy(false);
    }
  }, [adjust, balance, load, toast]);

  const exportCsv = useCallback(async () => {
    setExporting(true);
    try {
      downloadBlob(await apiMoneyLedgerCsv({
        user_id: member?.user_id ?? "", kind, source, q: debouncedQ, from: range.from, to: range.to,
      }), "ledger.csv");
      toast.success("Exported", { description: "Filtered exactly as the table is." });
    } catch (e) {
      toast.error("Could not export", { description: apiErrorMessage(e) });
    } finally {
      setExporting(false);
    }
  }, [member, kind, source, debouncedQ, range, toast]);

  const rows = data?.transactions ?? [];
  const pagination = data?.pagination;
  const filtered = !!debouncedQ || !!kind || source !== "all" || !!member || !!range.from || !!range.to;
  const sourceOptions = [{ value: "all", label: "All sources" }, ...(summary?.sources ?? []).map((s) => ({ value: s, label: sourceLabel(s) }))];

  return (
    <div>
      <PageHeader
        icon={BookOpen}
        title="Ledger"
        subtitle="Every credit and debit on every member's balance. A balance is only ever the sum of these rows."
        action={
          <div className="flex gap-2">
            {perms.has("export") && (
              <button className="btn btn-outline" disabled={exporting} onClick={() => void exportCsv()}>
                <Download className="h-4 w-4" /> {exporting ? "Exporting…" : "Export CSV"}
              </button>
            )}
            {perms.has("edit") && (
              <button className="btn btn-primary" onClick={() => openAdjust(member)}>
                <Scale className="h-4 w-4" /> Adjustment
              </button>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Credited" value={summary ? money(summary.credits.amount_minor) : "—"} icon={ArrowDownLeft} tone="emerald"
                  valueClassName="text-xl" deltaNote={`${summary?.credits.count ?? 0} credit rows`} />
        <StatCard label="Debited" value={summary ? money(summary.debits.amount_minor) : "—"} icon={ArrowUpRight} tone="rose"
                  valueClassName="text-xl" deltaNote={`${summary?.debits.count ?? 0} debit rows`} />
        <StatCard label="Owed to members" value={summary ? money(summary.held_minor) : "—"} icon={Wallet} tone="brand"
                  valueClassName="text-xl" deltaNote="Sum of every positive balance" />
        <StatCard label="Members with a balance" value={String(summary?.members_with_balance ?? 0)} icon={Users} tone="violet"
                  deltaNote="Anyone above zero" />
      </div>

      <HonestyNote title="An adjustment is a correction, not a transfer">
        WomSakhi holds no money. Balances here are what the organisation owes members in credit; a manual adjustment changes
        what the ledger says, with a reason that is written on the row and on the audit trail. It moves no money anywhere.
      </HonestyNote>

      {summary && summary.by_source.length > 0 && (
        <Card className="mt-6">
          <h2 className="font-display text-base font-semibold text-ink">By source</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {summary.by_source.map((s) => (
              <button key={`${s.source}-${s.kind}`} type="button"
                      onClick={() => { setSource(s.source); setKind(s.kind); }}
                      className="flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5 text-xs text-ink-muted hover:bg-surface-2">
                <Badge tone={s.kind === "credit" ? "emerald" : "rose"}>{s.kind}</Badge>
                <span className="font-semibold text-ink">{sourceLabel(s.source)}</span>
                <span>{money(s.amount_minor)} · {s.count}</span>
              </button>
            ))}
          </div>
        </Card>
      )}

      <Card className="mt-6">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="relative max-w-xs flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
            <input placeholder="Search by member or label…" value={q} onChange={(e) => setQ(e.target.value)} className={searchClass} />
          </div>
          <Menu trigger={
            <span className="btn btn-sm btn-outline">
              <SlidersHorizontal className="h-3.5 w-3.5" />
              {kind === "credit" ? "Credits" : kind === "debit" ? "Debits" : "Credits and debits"}
            </span>
          }>
            <MenuItem onClick={() => setKind("")}>Credits and debits</MenuItem>
            <MenuItem onClick={() => setKind("credit")}>Credits only</MenuItem>
            <MenuItem onClick={() => setKind("debit")}>Debits only</MenuItem>
          </Menu>
          <Select className="w-48" options={sourceOptions} value={source} onChange={(e) => setSource(e.target.value)} />
          <DateRange from={range.from} to={range.to} onChange={setRange} />
          {member && (
            <Badge tone="brand">Only {member.name}</Badge>
          )}
          {filtered && (
            <button className="btn btn-sm btn-ghost"
                    onClick={() => { setQ(""); setKind(""); setSource("all"); setMember(null); setRange({ from: "", to: "" }); }}>
              Clear
            </button>
          )}
        </div>

        {error ? (
          <ErrorState title="Could not load the ledger" description={error} onRetry={() => void load()} />
        ) : loading && !data ? (
          <div className="flex items-center justify-center py-16"><Spinner /></div>
        ) : rows.length === 0 ? (
          <TableEmpty
            icon={BookOpen}
            title={filtered ? "Nothing matches that" : "The ledger is empty"}
            description={filtered
              ? "Try a different search, kind, source or date range."
              : "A row appears here the first time a refund, referral thank-you, scholarship or withdrawal touches a member's balance."}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className={trHead}>
                  <th className={thClass}>Member</th>
                  <th className={thClass}>Entry</th>
                  <th className={thClass}>Source</th>
                  <th className={`${thClass} text-right`}>Amount</th>
                  <th className={thClass}>By</th>
                  <th className={thClass}>When</th>
                  <th className={`${thClass} text-right`}>&nbsp;</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((t: LedgerTxn) => (
                  <tr key={t.id} className={trRow}>
                    <td className="px-3 py-3"><PersonCell person={t.member} /></td>
                    <td className="px-3 py-3">
                      <p className="max-w-[20rem] truncate text-sm text-ink" title={t.label}>{t.label || "—"}</p>
                      {t.reference_id && <p className="font-mono text-2xs text-ink-subtle">{t.reference_id}</p>}
                    </td>
                    <td className="px-3 py-3">
                      <Badge tone={t.kind === "credit" ? "emerald" : "rose"}>{sourceLabel(t.source)}</Badge>
                      {t.payout_status && <p className="mt-0.5 text-2xs text-ink-subtle">{t.payout_status}</p>}
                    </td>
                    <td className={`px-3 py-3 text-right text-sm font-semibold ${t.kind === "credit" ? "text-status-ok-ink" : "text-status-danger-ink"}`}>
                      {t.kind === "credit" ? "+" : "−"}{money(t.amount_minor)}
                    </td>
                    <td className="px-3 py-3 text-xs text-ink-muted">{t.by || "—"}</td>
                    <td className="px-3 py-3 text-sm text-ink-subtle">{whenLabel(t.created_at) || t.when}</td>
                    <td className="px-3 py-3 text-right">
                      <Menu trigger={<span className="btn btn-sm btn-ghost"><MoreHorizontal className="h-4 w-4" /></span>}>
                        <MenuItem onClick={() => void openBalance(t.member)}>Her balance</MenuItem>
                        <MenuItem onClick={() => setMember(t.member)}>Only her rows</MenuItem>
                        {perms.has("edit") && <MenuItem onClick={() => openAdjust(t.member)}>Adjust her balance…</MenuItem>}
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
                      showing={showingLabel(pagination.total, pagination.page, pagination.page_size, "rows")} />
        )}
      </Card>

      {/* ── her balance ────────────────────────────────────────────────── */}
      <Modal open={!!balance || balanceLoading} onClose={() => setBalance(null)} title="Balance"
             description={balance ? balance.member.name : undefined}>
        {balanceLoading && !balance ? (
          <div className="flex items-center justify-center py-10"><Spinner /></div>
        ) : balance && (
          <div className="space-y-4">
            <PersonCell person={balance.member} />
            <div className="grid grid-cols-2 gap-3">
              <Stat label="Balance" value={money(balance.balance_minor)} strong />
              <Stat label="Rows" value={String(balance.transactions)} />
              <Stat label="Credited in all" value={money(balance.credits_minor)} />
              <Stat label="Debited in all" value={money(balance.debits_minor)} />
            </div>
            {balance.raw_minor < 0 && (
              <p className="rounded-lg bg-status-danger-bg px-3 py-2 text-xs text-status-danger-ink">
                Her rows sum to {money(balance.raw_minor)} — below zero. The member app shows ₹0; this needs a correcting credit.
              </p>
            )}
            <p className="text-xs text-ink-subtle">Last activity {whenLabel(balance.last_activity_at) || "never"}.</p>
            <div className="flex justify-end gap-2">
              <button className="btn btn-outline" onClick={() => setBalance(null)}>Close</button>
              <button className="btn btn-outline" onClick={() => { setMember(balance.member); setBalance(null); }}>Only her rows</button>
              {perms.has("edit") && (
                <button className="btn btn-primary" onClick={() => openAdjust(balance.member)}>Adjust…</button>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* ── adjustment ─────────────────────────────────────────────────── */}
      <Modal open={adjusting} onClose={() => setAdjusting(false)} title="Ledger adjustment" icon={Scale}
             description="A correction with a reason on record. It moves no money.">
        <div className="space-y-4">
          {adjust.person ? (
            <PersonCell person={adjust.person} sub="Her ledger gets one new row" />
          ) : (
            <Input label="Member user id" required value={adjust.user_id} placeholder="24-character id from the Users screen"
                   onChange={(e) => setAdjust({ ...adjust, user_id: e.target.value })}
                   hint="Easier: open an adjustment from one of her rows in the ledger." />
          )}
          <Select label="Kind" value={adjust.kind}
                  options={[{ value: "credit", label: "Credit — add to her balance" }, { value: "debit", label: "Debit — take from her balance" }]}
                  onChange={(e) => setAdjust({ ...adjust, kind: e.target.value })} />
          <Input label="Amount (₹)" required inputMode="decimal" placeholder="250.00" value={adjust.amount}
                 onChange={(e) => setAdjust({ ...adjust, amount: e.target.value })}
                 hint={adjust.kind === "debit" ? "A debit cannot take her below zero." : undefined} />
          <Textarea label="Reason" required rows={3} value={adjust.reason}
                    onChange={(e) => setAdjust({ ...adjust, reason: e.target.value })}
                    hint="Written on the row, on the audit trail and in her notification." />
          <div className="flex justify-end gap-2 pt-2">
            <button className="btn btn-outline" onClick={() => setAdjusting(false)}>Cancel</button>
            <button className="btn btn-primary" disabled={busy} onClick={() => void submitAdjust()}>
              {busy ? "Writing…" : "Write the adjustment"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function Stat({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="rounded-lg bg-surface-2 px-3 py-2">
      <p className="text-2xs font-semibold uppercase tracking-wide text-ink-subtle">{label}</p>
      <p className={`mt-0.5 font-display ${strong ? "text-xl font-bold" : "text-base font-semibold"} text-ink`}>{value}</p>
    </div>
  );
}
