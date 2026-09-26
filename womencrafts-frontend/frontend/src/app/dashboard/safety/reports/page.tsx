"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Check, ClipboardList, EyeOff, Flag, Loader2, MoreHorizontal, Search, ShieldCheck, UserCheck,
  UserPlus,
} from "lucide-react";

import {
  Badge, Card, EmptyState, Menu, MenuItem, Modal, Select, Spinner, StatCard, Tabs, Textarea,
  useToast,
} from "@/design-system";
import {
  REPORT_STATUS_LABEL, REPORT_STATUS_TONE, apiAddReportNote, apiAssignReport, apiAssignees,
  apiChangeReportStatus, apiReportSummary, apiSafetyReport, apiSafetyReports, isResolved, when,
  type Assignee, type ReportStatus, type ReportSummary, type SafetyReportDetail,
  type SafetyReportRow,
} from "@/lib/safety-admin-api";
import { useAuth } from "@/context/AuthContext";
import { memberError } from "@/lib/member-api";

/**
 * Reports.
 *
 * An "anonymous" report still shows staff who filed it — we cannot act on
 * something we cannot follow up, and abuse of the report system is itself a
 * safety problem. Anonymous means hidden from the person reported, never
 * hidden from the people responsible for acting. The badge on the row makes
 * that distinction visible rather than leaving it to be assumed.
 *
 * Nothing on this screen reaches past the report row: no phone number, no
 * address, no trusted contacts, nothing from her vault. What she wrote, who
 * she is, and what staff have done about it.
 *
 * Every action here — assign, note, status change — is written to the audit
 * trail with the report id as the target.
 */

const STATUS_OPTIONS = (Object.keys(REPORT_STATUS_LABEL) as ReportStatus[]).map((s) => ({
  value: s,
  label: REPORT_STATUS_LABEL[s],
}));

export default function AdminReportsPage() {
  const toast = useToast();
  const { user } = useAuth();

  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [rows, setRows] = useState<SafetyReportRow[]>([]);
  const [tab, setTab] = useState("open");
  const [mine, setMine] = useState(false);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [assignees, setAssignees] = useState<Assignee[]>([]);

  const [detail, setDetail] = useState<SafetyReportDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [noteText, setNoteText] = useState("");

  const [assigning, setAssigning] = useState<SafetyReportRow | null>(null);
  const [assignee, setAssignee] = useState("");

  const [changing, setChanging] = useState<SafetyReportRow | null>(null);
  const [newStatus, setNewStatus] = useState<ReportStatus>("reviewing");
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");

  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [list, sum] = await Promise.all([
        apiSafetyReports({ status: tab === "all" ? "" : tab, assigned: mine ? "me" : "" }),
        apiReportSummary(),
      ]);
      setRows(list);
      setSummary(sum);
    } catch (e) {
      toast.error("Could not load reports", { description: memberError(e) });
    } finally {
      setLoading(false);
    }
  }, [tab, mine, toast]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    let alive = true;
    apiAssignees().then((a) => { if (alive) setAssignees(a); }).catch(() => { /* the assign menu stays "me only" */ });
    return () => { alive = false; };
  }, []);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      `${r.category} ${r.about} ${r.details} ${r.member_name} ${r.member_email} ${r.assigned_to_name}`
        .toLowerCase()
        .includes(q),
    );
  }, [rows, query]);

  /** After a write, the list, the tiles and any open detail all move together. */
  const applyUpdate = useCallback(async (updated: SafetyReportDetail) => {
    setDetail((d) => (d && d.id === updated.id ? updated : d));
    await load();
  }, [load]);

  const openDetail = useCallback(async (r: SafetyReportRow) => {
    setDetailLoading(true);
    setNoteText("");
    try {
      setDetail(await apiSafetyReport(r.id));
    } catch (e) {
      toast.error("Could not open that report", { description: memberError(e) });
    } finally {
      setDetailLoading(false);
    }
  }, [toast]);

  const assignToMe = useCallback(async (r: SafetyReportRow) => {
    setBusy(true);
    try {
      const updated = await apiAssignReport(r.id, "me");
      toast.success("It's yours", { description: `${r.category} is assigned to you.` });
      await applyUpdate(updated);
    } catch (e) {
      toast.error("Could not assign it", { description: memberError(e) });
    } finally {
      setBusy(false);
    }
  }, [applyUpdate, toast]);

  function openAssign(r: SafetyReportRow) {
    setAssignee(r.assigned_to || "");
    setAssigning(r);
  }

  const saveAssign = useCallback(async () => {
    if (!assigning) return;
    setBusy(true);
    try {
      const updated = await apiAssignReport(assigning.id, assignee);
      toast.success(assignee ? `Assigned to ${updated.assigned_to_name}` : "Unassigned");
      setAssigning(null);
      await applyUpdate(updated);
    } catch (e) {
      toast.error("Could not change the assignment", { description: memberError(e) });
    } finally {
      setBusy(false);
    }
  }, [assigning, assignee, applyUpdate, toast]);

  const addNote = useCallback(async () => {
    if (!detail || !noteText.trim()) return;
    setBusy(true);
    try {
      const updated = await apiAddReportNote(detail.id, noteText.trim());
      setNoteText("");
      toast.success("Note added", { description: "Internal — she does not see it." });
      await applyUpdate(updated);
    } catch (e) {
      toast.error("Could not add the note", { description: memberError(e) });
    } finally {
      setBusy(false);
    }
  }, [detail, noteText, applyUpdate, toast]);

  function openStatus(r: SafetyReportRow, preset?: ReportStatus) {
    setNewStatus(preset ?? (r.status === "open" ? "reviewing" : "actioned"));
    setReason("");
    setMessage("");
    setChanging(r);
  }

  const saveStatus = useCallback(async () => {
    if (!changing) return;
    if (newStatus !== changing.status && reason.trim().length < 3) {
      toast.error("Say why the status is changing", { description: "The reason goes on the record." });
      return;
    }
    setBusy(true);
    try {
      const updated = await apiChangeReportStatus(changing.id, {
        status: newStatus,
        reason: reason.trim(),
        staff_note: message.trim(),
      });
      toast.success(`Now ${REPORT_STATUS_LABEL[newStatus].toLowerCase()}`, {
        description: isResolved(newStatus) ? "She has been messaged." : undefined,
      });
      setChanging(null);
      await applyUpdate(updated);
    } catch (e) {
      toast.error("Could not change the status", { description: memberError(e) });
    } finally {
      setBusy(false);
    }
  }, [changing, newStatus, reason, message, applyUpdate, toast]);

  const assigneeOptions = useMemo(() => {
    const opts = assignees.map((a) => ({
      value: a.id,
      label: a.is_me ? `${a.full_name} (you)` : `${a.full_name} · ${a.role}`,
    }));
    return [{ value: "", label: "Nobody — unassign" }, ...opts];
  }, [assignees]);

  const myId = useMemo(() => assignees.find((a) => a.is_me)?.id ?? "", [assignees]);

  const rowMenu = (r: SafetyReportRow) => (
    <Menu trigger={<span className="btn btn-sm btn-ghost"><MoreHorizontal className="h-4 w-4" /></span>}>
      <MenuItem onClick={() => void openDetail(r)}>Open</MenuItem>
      {(!myId || r.assigned_to !== myId) && (
        <MenuItem onClick={() => void assignToMe(r)}>Assign to me</MenuItem>
      )}
      <MenuItem onClick={() => openAssign(r)}>Assign to someone…</MenuItem>
      <MenuItem onClick={() => openStatus(r)}>Change status…</MenuItem>
      {!isResolved(r.status) && (
        <MenuItem onClick={() => openStatus(r, "actioned")}>Mark resolved…</MenuItem>
      )}
    </Menu>
  );

  return (
    <div className="wc-page-enter">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-11 w-11 items-center justify-center rounded-xl bg-status-warn-bg text-status-warn-ink">
            <Flag className="h-6 w-6" />
          </span>
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-ink">Reports</h1>
            <p className="mt-1 max-w-2xl text-sm text-ink-subtle">
              Someone told us about behaviour that isn&apos;t acceptable. Aim to answer every one within 24 hours.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="New" value={summary ? String(summary.open) : "—"} icon={Flag} tone="rose"
                  deltaNote="Nobody has looked yet" />
        <StatCard label="In review" value={summary ? String(summary.reviewing) : "—"} icon={ClipboardList} tone="amber"
                  deltaNote="Being looked into" />
        <StatCard label="Resolved" value={summary ? String(summary.resolved) : "—"} icon={ShieldCheck} tone="emerald"
                  deltaNote={summary ? `${summary.actioned} action taken · ${summary.closed} closed` : "—"} />
        <StatCard label="Assigned to me" value={summary ? String(summary.assigned_to_me) : "—"} icon={UserCheck} tone="violet"
                  deltaNote={summary ? `${summary.unassigned_open} open with nobody on them` : "—"} />
      </div>

      <Card className="mt-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-base font-semibold text-ink">Every report, newest first</h2>
            <p className="text-xs text-ink-subtle">
              Her name is shown to you so we can follow up — an anonymous report is anonymous to the person involved, never to the team.
            </p>
          </div>
          <div className="relative w-full max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
            <input
              aria-label="Search safety reports"
              placeholder="Search category, who, what…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full rounded-lg border border-line-strong bg-surface py-2 pl-9 pr-3 text-sm text-ink-muted placeholder-ink-subtle outline-none focus:border-violet-300 focus:ring-4 focus:ring-violet-50"
            />
          </div>
        </div>

        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <Tabs
            value={tab}
            onChange={setTab}
            tabs={[
              { value: "open", label: "New", count: summary?.open },
              { value: "reviewing", label: "In review", count: summary?.reviewing },
              { value: "resolved", label: "Resolved", count: summary?.resolved },
              { value: "all", label: "All", count: summary?.total },
            ]}
          />
          <label className="flex cursor-pointer items-center gap-2 text-sm text-ink-muted">
            <input aria-label="Show only reports assigned to me" type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} className="h-4 w-4 rounded border-line-strong" />
            Only mine
          </label>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16"><Spinner /></div>
        ) : shown.length === 0 ? (
          <EmptyState
            icon={ShieldCheck}
            title={query ? "Nothing matches that" : tab === "open" ? "Nothing new" : "No reports here"}
            description={query
              ? "Try a different search."
              : mine
                ? "Nothing in this state is assigned to you."
                : tab === "open"
                  ? "No new reports are waiting for a first look."
                  : "No reports in this state."}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-line text-2xs font-semibold uppercase tracking-wide text-ink-subtle">
                  <th className="px-3 py-2.5">Filed</th>
                  <th className="px-3 py-2.5">What</th>
                  <th className="px-3 py-2.5">Reported by</th>
                  <th className="px-3 py-2.5">Assigned</th>
                  <th className="px-3 py-2.5">Status</th>
                  <th className="px-3 py-2.5 text-right">&nbsp;</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => (
                  <tr key={r.id} className="border-b border-line last:border-0 hover:bg-surface-2">
                    <td className="whitespace-nowrap px-3 py-3 text-sm text-ink-subtle">{r.filed_on}</td>
                    <td className="max-w-md px-3 py-3">
                      <button onClick={() => void openDetail(r)} className="text-left">
                        <span className="flex flex-wrap items-center gap-1.5">
                          <span className="text-sm font-semibold text-ink">{r.category}</span>
                          {r.anonymous && (
                            <Badge tone="slate"><EyeOff className="mr-1 inline h-3 w-3" />Anonymous</Badge>
                          )}
                          {r.notes_count > 0 && <Badge tone="sky">{r.notes_count} note{r.notes_count === 1 ? "" : "s"}</Badge>}
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-ink-subtle">
                          {r.about ? `About ${r.about} — ` : ""}{r.details}
                        </span>
                      </button>
                    </td>
                    <td className="px-3 py-3">
                      <p className="text-sm text-ink">{r.member_name}</p>
                      <p className="text-xs text-ink-subtle">{r.member_email}</p>
                    </td>
                    <td className="px-3 py-3 text-sm text-ink-muted">
                      {r.assigned_to_name || <span className="text-ink-subtle">—</span>}
                    </td>
                    <td className="px-3 py-3">
                      <Badge tone={REPORT_STATUS_TONE[r.status] ?? "slate"}>{REPORT_STATUS_LABEL[r.status] ?? r.status}</Badge>
                    </td>
                    <td className="px-3 py-3 text-right">{rowMenu(r)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* ── one report ─────────────────────────────────────────────────── */}
      <Modal
        open={!!detail || detailLoading}
        onClose={() => setDetail(null)}
        title={detail?.category ?? "Report"}
        description={detail ? `Filed ${detail.filed_on} by ${detail.member_name}` : undefined}
        icon={Flag}
        iconTone="amber"
        size="lg"
        footer={
          detail ? (
            <>
              <button className="btn btn-outline" onClick={() => setDetail(null)}>Close</button>
              {(!myId || detail.assigned_to !== myId) && (
                <button className="btn btn-outline" disabled={busy} onClick={() => void assignToMe(detail)}>
                  <UserPlus className="h-4 w-4" /> Assign to me
                </button>
              )}
              <button className="btn btn-primary" onClick={() => openStatus(detail)}>
                <Check className="h-4 w-4" /> Change status
              </button>
            </>
          ) : undefined
        }
      >
        {!detail ? (
          <div className="flex items-center justify-center py-10"><Spinner /></div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={REPORT_STATUS_TONE[detail.status] ?? "slate"}>{REPORT_STATUS_LABEL[detail.status] ?? detail.status}</Badge>
              {detail.anonymous && <Badge tone="slate"><EyeOff className="mr-1 inline h-3 w-3" />Anonymous</Badge>}
              <span className="text-xs text-ink-subtle">
                {detail.assigned_to_name ? `Assigned to ${detail.assigned_to_name}` : "Nobody assigned"}
                {detail.resolved_by ? ` · resolved by ${detail.resolved_by} ${when(detail.resolved_at)}` : ""}
              </span>
            </div>

            {detail.anonymous && (
              <p className="rounded-lg bg-surface-inset px-3 py-2 text-xs text-ink-subtle dark:bg-white/5">
                She asked to stay anonymous to the person involved. Her name is shown to you so we can follow up — never repeat it outside the team.
              </p>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <p className="text-2xs font-bold uppercase tracking-wide text-ink-subtle">Reported by</p>
                <p className="mt-0.5 text-sm text-ink">{detail.member_name}</p>
                <p className="text-xs text-ink-subtle">{detail.member_email}</p>
              </div>
              <div>
                <p className="text-2xs font-bold uppercase tracking-wide text-ink-subtle">About</p>
                <p className="mt-0.5 text-sm text-ink-muted">{detail.about || "Not said"}</p>
              </div>
            </div>

            <div>
              <p className="text-2xs font-bold uppercase tracking-wide text-ink-subtle">What she wrote</p>
              <p className="mt-1 whitespace-pre-line rounded-xl bg-surface-inset px-3.5 py-3 text-sm text-ink-muted dark:bg-white/5">
                {detail.details}
              </p>
              {detail.evidence && (
                <p className="mt-1 text-xs text-ink-subtle">
                  Evidence attached: <span className="break-all font-mono">{detail.evidence}</span>
                </p>
              )}
            </div>

            {detail.staff_note && (
              <div>
                <p className="text-2xs font-bold uppercase tracking-wide text-ink-subtle">What she was told</p>
                <p className="mt-1 rounded-xl bg-status-info-bg px-3.5 py-2.5 text-sm text-status-info-ink">{detail.staff_note}</p>
              </div>
            )}

            <div>
              <p className="text-2xs font-bold uppercase tracking-wide text-ink-subtle">Internal notes</p>
              {detail.notes.length === 0 ? (
                <p className="mt-1 text-xs text-ink-subtle">No notes yet.</p>
              ) : (
                <ul className="mt-1 space-y-2">
                  {detail.notes.map((n) => (
                    <li key={n.id} className="rounded-xl border border-line px-3.5 py-2.5 text-sm dark:border-white/10">
                      <p className="whitespace-pre-line text-ink-muted">{n.text}</p>
                      <p className="mt-1 text-2xs text-ink-subtle">{n.by_name} · {when(n.at)}</p>
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-2 flex items-end gap-2">
                <div className="flex-1">
                  <Textarea rows={2} value={noteText} onChange={(e) => setNoteText(e.target.value)}
                            placeholder="Spoke to her on the phone; she wants the account removed but no message sent." />
                </div>
                <button className="btn btn-outline btn-sm" disabled={busy || !noteText.trim()} onClick={() => void addNote()}>
                  Add note
                </button>
              </div>
            </div>

            {detail.history.length > 0 && (
              <div>
                <p className="text-2xs font-bold uppercase tracking-wide text-ink-subtle">History</p>
                <ul className="mt-1 space-y-1">
                  {[...detail.history].reverse().map((h, i) => (
                    <li key={`${h.at}-${i}`} className="text-xs text-ink-muted">
                      <span className="text-ink-subtle">{when(h.at)}</span> · {h.by_name}{" "}
                      {h.kind === "assign"
                        ? h.to ? `assigned it to ${h.to}` : "unassigned it"
                        : `moved it ${REPORT_STATUS_LABEL[h.from as ReportStatus] ?? h.from} → ${REPORT_STATUS_LABEL[h.to as ReportStatus] ?? h.to}`}
                      {h.reason ? ` — ${h.reason}` : ""}
                      {h.told_member ? " (she was messaged)" : ""}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* ── assign ─────────────────────────────────────────────────────── */}
      <Modal
        open={!!assigning}
        onClose={() => setAssigning(null)}
        title="Who should handle this?"
        description={assigning?.category}
        icon={UserPlus}
        iconTone="violet"
        size="sm"
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setAssigning(null)}>Cancel</button>
            <button className="btn btn-primary" disabled={busy} onClick={() => void saveAssign()}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Assign
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <Select label="Staff account" value={assignee} onChange={(e) => setAssignee(e.target.value)}
                  options={assigneeOptions} />
          <p className="text-xs text-ink-subtle">
            {assignees.length <= 1
              ? "You are the only active staff account. Invite colleagues from the Staff screen to hand reports to them."
              : "Only active staff accounts are listed. The change is written to the audit trail."}
          </p>
        </div>
      </Modal>

      {/* ── status ─────────────────────────────────────────────────────── */}
      <Modal
        open={!!changing}
        onClose={() => setChanging(null)}
        title="Change the status"
        description={changing ? `${changing.category} · currently ${REPORT_STATUS_LABEL[changing.status] ?? changing.status}` : undefined}
        icon={Flag}
        iconTone="amber"
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setChanging(null)}>Cancel</button>
            <button className="btn btn-primary" disabled={busy} onClick={() => void saveStatus()}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              {isResolved(newStatus) ? "Resolve and tell her" : "Save"}
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <Select label="New status" value={newStatus} onChange={(e) => setNewStatus(e.target.value as ReportStatus)}
                  options={STATUS_OPTIONS} />
          <Textarea
            label="Why (internal, required)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Account confirmed as impersonation; removed and the posts taken down."
            hint="Goes on the report's history and into the audit trail. She does not see it."
          />
          {isResolved(newStatus) && (
            <Textarea
              label="What should we tell her?"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="We've removed the account and the posts. Thank you for telling us — please tell us again if anything else happens."
              hint="Sent to her as a notification when you save. Left blank, she gets a plain 'we've looked into it and taken action'."
            />
          )}
          {user?.full_name && (
            <p className="text-xs text-ink-subtle">Recorded as {user.full_name}.</p>
          )}
        </div>
      </Modal>
    </div>
  );
}
