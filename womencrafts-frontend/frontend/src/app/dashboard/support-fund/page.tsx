"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle, Check, HeartHandshake, LifeBuoy, Loader2, MoreHorizontal, Search, Users, Wallet,
  XCircle,
} from "lucide-react";

import {
  Badge, Card, EmptyState, Input, Menu, MenuItem, Modal, Select, Spinner, StatCard, Tabs,
  Textarea, useToast,
} from "@/design-system";
import {
  apiDecideSupportRequest, apiSupportRequests, apiSupportSummary, rupees, when,
  type SupportRequestRow, type SupportStatus, type SupportSummary,
} from "@/lib/safety-admin-api";
import { memberError } from "@/lib/member-api";

/**
 * The support fund queue.
 *
 * Approving writes the credit into her wallet in the same action. There is no
 * separate "now go and top her up" step, because that step is the one that
 * gets forgotten — and a grant nobody actions is worse than a refusal.
 *
 * The tiles are two different facts kept apart on purpose. "Granted by this
 * queue" is the sum of approved requests. "Wallet credits written" is what
 * the ledger actually holds as scholarship credits — and the two do not have
 * to agree, because credits can be written elsewhere and older approvals
 * pre-date the ledger. There is no fund balance, because there is no fund
 * account in this system; the screen says so instead of inventing one.
 */

const STATUS_LABEL: Record<SupportStatus, string> = {
  pending: "Waiting",
  approved: "Approved",
  partial: "Part-funded",
  declined: "Declined",
};

const STATUS_TONE: Record<SupportStatus, "amber" | "emerald" | "violet" | "slate"> = {
  pending: "amber",
  approved: "emerald",
  partial: "violet",
  declined: "slate",
};

export default function AdminSupportFundPage() {
  const toast = useToast();

  const [summary, setSummary] = useState<SupportSummary | null>(null);
  const [rows, setRows] = useState<SupportRequestRow[]>([]);
  const [tab, setTab] = useState("pending");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  const [viewing, setViewing] = useState<SupportRequestRow | null>(null);

  const [deciding, setDeciding] = useState<SupportRequestRow | null>(null);
  const [status, setStatus] = useState<SupportStatus>("approved");
  const [granted, setGranted] = useState("");
  const [note, setNote] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [list, sum] = await Promise.all([
        apiSupportRequests({ status: tab === "all" ? "" : tab }),
        apiSupportSummary(),
      ]);
      setRows(list);
      setSummary(sum);
    } catch (e) {
      toast.error("Could not load the support fund", { description: memberError(e) });
    } finally {
      setLoading(false);
    }
  }, [tab, toast]);

  useEffect(() => { void load(); }, [load]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      `${r.member_name} ${r.member_email} ${r.member_code} ${r.what_for} ${r.reason}`.toLowerCase().includes(q),
    );
  }, [rows, query]);

  const cur = summary?.currency || "₹";
  const approvedCount = summary ? summary.approved + summary.partial : 0;
  const unlinked = summary ? approvedCount - summary.ledger_linked_count : 0;

  function openDecide(r: SupportRequestRow, preset: SupportStatus = "approved") {
    setDeciding(r);
    setStatus(preset);
    // Default to the full amount she asked for — the common case is one click.
    setGranted(String(Math.round((r.amount_needed_minor || 0) / 100)));
    setNote("");
    setReason("");
  }

  const decide = useCallback(async () => {
    if (!deciding) return;
    const amount = status === "declined" ? 0 : Number(granted) || 0;
    if (status !== "declined" && amount <= 0) {
      toast.error("Enter the amount you're granting");
      return;
    }
    if (status === "declined" && reason.trim().length < 3) {
      toast.error("Say why it's being declined", { description: "The reason goes on the record." });
      return;
    }
    setBusy(true);
    try {
      await apiDecideSupportRequest(deciding.id, {
        status,
        granted: amount,
        staff_note: note.trim(),
        reason: reason.trim(),
      });
      toast.success(
        status === "declined" ? "Declined, and she has been told" : `${cur}${amount.toLocaleString("en-IN")} credited to her wallet`,
        { description: status === "declined" ? undefined : "The credit and the message went together." },
      );
      setDeciding(null);
      setViewing(null);
      await load();
    } catch (e) {
      toast.error("Could not record the decision", { description: memberError(e) });
    } finally {
      setBusy(false);
    }
  }, [deciding, status, granted, note, reason, cur, load, toast]);

  const rowMenu = (r: SupportRequestRow) => (
    <Menu trigger={<span className="btn btn-sm btn-ghost"><MoreHorizontal className="h-4 w-4" /></span>}>
      <MenuItem onClick={() => setViewing(r)}>Open</MenuItem>
      {r.status === "pending" && (
        <>
          <MenuItem onClick={() => openDecide(r, "approved")}>Approve in full…</MenuItem>
          <MenuItem onClick={() => openDecide(r, "partial")}>Fund part of it…</MenuItem>
          <MenuItem danger onClick={() => openDecide(r, "declined")}>Decline…</MenuItem>
        </>
      )}
    </Menu>
  );

  return (
    <div className="wc-page-enter">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-11 w-11 items-center justify-center rounded-xl bg-violet-tint text-violet-ink">
            <LifeBuoy className="h-6 w-6" />
          </span>
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-ink">Support fund</h1>
            <p className="mt-1 max-w-2xl text-sm text-ink-subtle">
              Approving credits her wallet immediately — the decision and the money are one action.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Waiting" value={summary ? String(summary.pending) : "—"} icon={HeartHandshake} tone="amber"
                  deltaNote={summary ? `${rupees(summary.pending_asked_minor, cur)} asked for` : "—"} />
        <StatCard label="Approved" value={summary ? String(approvedCount) : "—"} icon={Check} tone="emerald"
                  deltaNote={summary ? `${summary.partial} part-funded · ${summary.declined} declined` : "—"} />
        <StatCard label="Granted by this queue" value={summary ? rupees(summary.approved_granted_minor, cur) : "—"} icon={LifeBuoy} tone="brand"
                  deltaNote="Sum of approved requests. There is no fund balance." />
        <StatCard label="Wallet credits written" value={summary ? rupees(summary.ledger_credit_minor, cur) : "—"} icon={Wallet} tone="violet"
                  deltaNote={summary ? `${summary.ledger_credit_count} scholarship credits in the ledger · ${summary.ledger_linked_count} from here` : "—"} />
      </div>

      {/* The two tiles above can disagree, and when they do the reason is
          worth saying out loud rather than leaving someone to add it up. */}
      {summary && unlinked > 0 && (
        <div className="mt-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div className="text-sm">
            <p className="font-semibold text-amber-900">
              {unlinked} approved request{unlinked === 1 ? " has" : "s have"} no matching wallet credit
            </p>
            <p className="mt-0.5 text-amber-800">
              They were decided before approvals wrote the credit, or were entered by hand. This screen did not
              move that money. Decisions made here from now on write the credit and the decision together.
            </p>
          </div>
        </div>
      )}

      <Card className="mt-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-base font-semibold text-ink">Requests, newest first</h2>
            <p className="text-xs text-ink-subtle">Aim to answer within a week. Asking was the hard part.</p>
          </div>
          <div className="relative w-full max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
            <input
              placeholder="Search name, member id, what for…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full rounded-lg border border-line-strong bg-surface py-2 pl-9 pr-3 text-sm text-ink-muted placeholder-ink-subtle outline-none focus:border-violet-300 focus:ring-4 focus:ring-violet-50"
            />
          </div>
        </div>

        <Tabs
          className="mb-4"
          value={tab}
          onChange={setTab}
          tabs={[
            { value: "pending", label: "Waiting", count: summary?.pending },
            { value: "approved", label: "Approved", count: summary?.approved },
            { value: "partial", label: "Part-funded", count: summary?.partial },
            { value: "declined", label: "Declined", count: summary?.declined },
            { value: "all", label: "All", count: summary?.total },
          ]}
        />

        {loading ? (
          <div className="flex items-center justify-center py-16"><Spinner /></div>
        ) : shown.length === 0 ? (
          <EmptyState
            icon={LifeBuoy}
            title={query ? "Nothing matches that" : tab === "pending" ? "Nothing waiting" : "No requests here"}
            description={query ? "Try a different search." : tab === "pending"
              ? "Requests from members appear here as they are made."
              : "No requests in this state."}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-line text-2xs font-semibold uppercase tracking-wide text-ink-subtle">
                  <th className="px-3 py-2.5">Asked</th>
                  <th className="px-3 py-2.5">Member</th>
                  <th className="px-3 py-2.5">For</th>
                  <th className="px-3 py-2.5">Amount</th>
                  <th className="px-3 py-2.5">Status</th>
                  <th className="px-3 py-2.5">Decided by</th>
                  <th className="px-3 py-2.5 text-right">&nbsp;</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => (
                  <tr key={r.id} className="border-b border-line last:border-0 hover:bg-surface-2">
                    <td className="whitespace-nowrap px-3 py-3 text-sm text-ink-subtle">{r.asked_on}</td>
                    <td className="px-3 py-3">
                      <p className="text-sm font-semibold text-ink">{r.member_name}</p>
                      <p className="text-xs text-ink-subtle">{r.member_email}{r.member_code ? ` · ${r.member_code}` : ""}</p>
                    </td>
                    <td className="max-w-xs px-3 py-3">
                      <button onClick={() => setViewing(r)} className="text-left">
                        <span className="block text-sm text-ink">{r.what_for}</span>
                        <span className="block truncate text-xs text-ink-subtle">{r.reason}</span>
                      </button>
                    </td>
                    <td className="whitespace-nowrap px-3 py-3">
                      <p className="font-display text-sm font-bold text-ink">{r.amount_needed_label}</p>
                      {r.granted_label && <p className="text-xs text-status-ok-ink">{r.granted_label} granted</p>}
                    </td>
                    <td className="px-3 py-3">
                      <Badge tone={STATUS_TONE[r.status] ?? "slate"}>{STATUS_LABEL[r.status] ?? r.status}</Badge>
                    </td>
                    <td className="px-3 py-3 text-sm text-ink-muted">
                      {r.decided_by || <span className="text-ink-subtle">—</span>}
                      {r.decided_at && <p className="text-2xs text-ink-subtle">{when(r.decided_at)}</p>}
                    </td>
                    <td className="px-3 py-3 text-right">{rowMenu(r)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* ── one request ────────────────────────────────────────────────── */}
      <Modal
        open={!!viewing}
        onClose={() => setViewing(null)}
        title={viewing ? `${viewing.amount_needed_label} for ${viewing.what_for}` : "Request"}
        description={viewing ? `${viewing.member_name} · asked ${viewing.asked_on}` : undefined}
        icon={LifeBuoy}
        size="lg"
        footer={
          viewing ? (
            <>
              <button className="btn btn-outline" onClick={() => setViewing(null)}>Close</button>
              {viewing.status === "pending" && (
                <>
                  <button className="btn btn-outline" onClick={() => openDecide(viewing, "declined")}>
                    <XCircle className="h-4 w-4" /> Decline
                  </button>
                  <button className="btn btn-primary" onClick={() => openDecide(viewing, "approved")}>
                    <HeartHandshake className="h-4 w-4" /> Decide
                  </button>
                </>
              )}
            </>
          ) : undefined
        }
      >
        {viewing && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={STATUS_TONE[viewing.status] ?? "slate"}>{STATUS_LABEL[viewing.status] ?? viewing.status}</Badge>
              {viewing.granted_label && <Badge tone="emerald">{viewing.granted_label} granted</Badge>}
              {viewing.decided_by && (
                <span className="text-xs text-ink-subtle">Decided by {viewing.decided_by} {when(viewing.decided_at)}</span>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <p className="text-2xs font-bold uppercase tracking-wide text-ink-subtle">Member</p>
                <p className="mt-0.5 text-sm text-ink">{viewing.member_name}</p>
                <p className="text-xs text-ink-subtle">{viewing.member_email}{viewing.member_code ? ` · ${viewing.member_code}` : ""}</p>
              </div>
              <div>
                <p className="text-2xs font-bold uppercase tracking-wide text-ink-subtle">Household income</p>
                <p className="mt-0.5 text-sm text-ink-muted">{viewing.household_income || "Not said"}</p>
              </div>
              <div>
                <p className="text-2xs font-bold uppercase tracking-wide text-ink-subtle">Supports</p>
                <p className="mt-0.5 flex items-center gap-1 text-sm text-ink-muted">
                  <Users className="h-3.5 w-3.5" />
                  {viewing.dependants > 0 ? `${viewing.dependants} ${viewing.dependants === 1 ? "person" : "people"}` : "Not said"}
                </p>
              </div>
            </div>

            <div>
              <p className="text-2xs font-bold uppercase tracking-wide text-ink-subtle">Why she is asking</p>
              <p className="mt-1 whitespace-pre-line rounded-xl bg-surface-inset px-3.5 py-3 text-sm text-ink-muted dark:bg-white/5">
                {viewing.reason}
              </p>
            </div>

            {viewing.staff_note && (
              <div>
                <p className="text-2xs font-bold uppercase tracking-wide text-ink-subtle">What she was told</p>
                <p className="mt-1 rounded-xl bg-status-info-bg px-3.5 py-2.5 text-sm text-status-info-ink">{viewing.staff_note}</p>
              </div>
            )}
            {viewing.decision_reason && (
              <div>
                <p className="text-2xs font-bold uppercase tracking-wide text-ink-subtle">Why (internal)</p>
                <p className="mt-1 text-sm text-ink-muted">{viewing.decision_reason}</p>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* ── decide ─────────────────────────────────────────────────────── */}
      <Modal
        open={!!deciding}
        onClose={() => setDeciding(null)}
        title="Decide this request"
        description={deciding ? `${deciding.member_name} · ${deciding.amount_needed_label} for ${deciding.what_for}` : undefined}
        icon={LifeBuoy}
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setDeciding(null)}>Cancel</button>
            <button className="btn btn-primary" onClick={() => void decide()} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              {status === "declined" ? "Decline and tell her" : "Approve and credit her wallet"}
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <Select
            label="Decision"
            value={status}
            onChange={(e) => setStatus(e.target.value as SupportStatus)}
            options={[
              { value: "approved", label: "Approve in full" },
              { value: "partial", label: "Fund part of it" },
              { value: "declined", label: "Decline" },
            ]}
          />
          {status !== "declined" && (
            <Input
              label={`Amount to grant (${cur})`}
              type="number"
              min={1}
              value={granted}
              onChange={(e) => setGranted(e.target.value)}
            />
          )}
          <Textarea
            label={status === "declined" ? "Why (internal, required)" : "Why (internal)"}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={status === "declined"
              ? "Same programme was funded for her in March; fund rules allow one grant a year."
              : "Income under the threshold; two dependants; first request."}
            hint="Kept on the request and written to the audit trail. She does not see it."
          />
          <Textarea
            label="What should we tell her?"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={status === "declined"
              ? "We can't fund this one, but the next intake has free places — we'll hold one for you."
              : "This covers the full fee. Nothing else to do — it comes off automatically."}
          />
          {status !== "declined" ? (
            <p className="rounded-xl bg-status-ok-bg px-3.5 py-2.5 text-xs text-status-ok-ink">
              This writes {cur}{(Number(granted) || 0).toLocaleString("en-IN")} into her wallet immediately and
              sends her a message. It cannot be undone from here.
            </p>
          ) : (
            <p className="rounded-xl bg-surface-inset px-3.5 py-2.5 text-xs text-ink-muted dark:bg-white/5">
              Nothing is credited. She gets the message above, or a plain &quot;we can&apos;t fund this one right now&quot; if it is blank.
            </p>
          )}
        </div>
      </Modal>
    </div>
  );
}
