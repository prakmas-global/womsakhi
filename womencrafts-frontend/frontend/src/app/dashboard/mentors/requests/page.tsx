"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeftRight, Check, CheckCheck, Eye, HeartHandshake, Inbox, Loader2, Mail, MoreHorizontal, X, XCircle,
} from "lucide-react";
import {
  Badge, Card, EmptyState, Menu, MenuItem, Modal, Select, Spinner, StatCard, Tabs, Textarea, useToast,
} from "@/design-system";
import {
  apiGrowthDecideRequest, apiGrowthMentors, apiGrowthRequests, apiGrowthSummary,
  type GrowthSummary, type MentorRequestRow, type MentorRow,
} from "@/lib/growth-admin-api";
import { memberError } from "@/lib/member-api";

/**
 * Mentorship requests.
 *
 * Deciding one always messages the member. A decline needs a reason because
 * she is sent it; a request can also be handed to a different mentor when the
 * one she asked for is full, retired, or not the right fit.
 */

type Mode = "accepted" | "declined" | "reassign" | "closed";

const TONE: Record<string, "amber" | "emerald" | "slate" | "rose"> = {
  pending: "amber", accepted: "emerald", declined: "rose", closed: "slate",
};

function RequestsInner() {
  const params = useSearchParams();
  const mentorId = params.get("mentor") ?? "";
  const toast = useToast();

  const [requests, setRequests] = useState<MentorRequestRow[]>([]);
  const [summary, setSummary] = useState<GrowthSummary["requests"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("pending");

  const [viewing, setViewing] = useState<MentorRequestRow | null>(null);
  const [deciding, setDeciding] = useState<MentorRequestRow | null>(null);
  const [mode, setMode] = useState<Mode>("accepted");
  const [note, setNote] = useState("");
  const [activeMentors, setActiveMentors] = useState<MentorRow[] | null>(null);
  const [newMentorId, setNewMentorId] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [list, sum] = await Promise.all([
        apiGrowthRequests({ status: tab === "all" ? "" : tab, mentor_id: mentorId }),
        apiGrowthSummary(),
      ]);
      setRequests(list);
      setSummary(sum.requests);
    } catch (e) {
      toast.error("Could not load requests", { description: memberError(e) });
    } finally {
      setLoading(false);
    }
  }, [mentorId, tab, toast]);

  useEffect(() => {
    const timer = setTimeout(() => void refresh(), 0);
    return () => clearTimeout(timer);
  }, [refresh]);

  const mentorName = mentorId ? (requests[0]?.mentor_name ?? "") : "";

  const open = useCallback(async (r: MentorRequestRow, as: Mode) => {
    setDeciding(r);
    setMode(as);
    setNote("");
    setNewMentorId("");
    if (as === "reassign" && activeMentors === null) {
      try {
        setActiveMentors((await apiGrowthMentors({ status: "active" })).filter((m) => m.id !== r.mentor_id));
      } catch (e) {
        toast.error("Could not load mentors", { description: memberError(e) });
        setActiveMentors([]);
      }
    }
  }, [activeMentors, toast]);

  const decide = useCallback(async () => {
    if (!deciding) return;
    if (mode === "declined" && !note.trim()) { toast.error("Say why — she is told this"); return; }
    if (mode === "reassign" && !newMentorId) { toast.error("Pick who to hand it to"); return; }
    setBusy(true);
    try {
      const row = await apiGrowthDecideRequest(deciding.id, {
        status: mode === "reassign" ? "accepted" : mode,
        staff_note: note.trim(),
        mentor_id: mode === "reassign" ? newMentorId : undefined,
      });
      toast.success(
        mode === "accepted" ? `${row.mentor_name} said yes — ${row.member_name} has been told`
          : mode === "declined" ? `Declined — ${row.member_name} has been told why`
          : mode === "reassign" ? `Handed to ${row.mentor_name} — ${row.member_name} has been told`
          : `Closed — ${row.member_name} has been told`,
      );
      setDeciding(null);
      await refresh();
    } catch (e) {
      toast.error("Could not save that decision", { description: memberError(e) });
    } finally {
      setBusy(false);
    }
  }, [deciding, mode, newMentorId, note, refresh, toast]);

  const tabs = [
    { value: "pending", label: "Waiting", count: !mentorId && summary ? summary.pending : undefined },
    { value: "accepted", label: "Accepted", count: !mentorId && summary ? summary.accepted : undefined },
    { value: "declined", label: "Declined", count: !mentorId && summary ? summary.declined : undefined },
    { value: "closed", label: "Closed" },
    { value: "all", label: "All" },
  ];

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-11 w-11 items-center justify-center rounded-xl bg-brand-tint text-brand-ink">
            <Inbox className="h-6 w-6" />
          </span>
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-ink">Mentor requests</h1>
            <p className="mt-1 text-sm text-ink-subtle">
              Every decision here messages the member. Nobody is left wondering.
            </p>
          </div>
        </div>
        <Link href="/dashboard/mentors" className="btn btn-outline"><HeartHandshake className="h-4 w-4" /> Mentors</Link>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Waiting" value={summary ? String(summary.pending) : "—"} icon={Inbox}
                  tone={summary && summary.pending > 0 ? "amber" : "slate"} deltaNote="Need a decision" />
        <StatCard label="Accepted" value={summary ? String(summary.accepted) : "—"} icon={CheckCheck} tone="emerald" deltaNote="Introduced" />
        <StatCard label="Declined" value={summary ? String(summary.declined) : "—"} icon={XCircle} tone="rose" deltaNote="Told why" />
        <StatCard label="All time" value={summary ? String(summary.total) : "—"} icon={HeartHandshake} tone="violet" deltaNote="Every request ever made" />
      </div>

      {mentorId && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-surface-2 px-4 py-3 text-sm">
          <span className="text-ink-muted">
            Showing requests for <b className="text-ink">{mentorName || "one mentor"}</b> only.
          </span>
          <Link href="/dashboard/mentors/requests" className="font-semibold text-brand-ink hover:underline">Show everyone</Link>
        </div>
      )}

      <Card className="mt-6">
        <Tabs className="mb-4" value={tab} onChange={setTab} tabs={tabs} />

        {loading ? (
          <div className="flex items-center justify-center py-16"><Spinner /></div>
        ) : requests.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title={tab === "pending" ? "Nothing waiting" : "Nothing here"}
            description={tab === "pending"
              ? "Requests from members appear here the moment they're made."
              : "No requests with that status" + (mentorId ? " for this mentor." : ".")}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-line text-2xs font-semibold uppercase tracking-wide text-ink-subtle">
                  <th className="px-3 py-2.5">Member</th>
                  <th className="px-3 py-2.5">Wants time with</th>
                  <th className="px-3 py-2.5">Her goal</th>
                  <th className="px-3 py-2.5">Asked</th>
                  <th className="px-3 py-2.5">Status</th>
                  <th className="px-3 py-2.5 text-right">&nbsp;</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((r) => (
                  <tr key={r.id} className="border-b border-line last:border-0 hover:bg-surface-2">
                    <td className="px-3 py-3">
                      <p className="text-sm font-semibold text-ink">{r.member_name}</p>
                      <p className="flex items-center gap-1 text-xs text-ink-subtle"><Mail className="h-3 w-3" />{r.member_email}</p>
                    </td>
                    <td className="px-3 py-3 text-sm text-ink-muted">{r.mentor_name}</td>
                    <td className="max-w-xs px-3 py-3">
                      <p className="line-clamp-2 text-sm text-ink-muted">{r.goal || "—"}</p>
                      {r.preferred_time && <p className="text-2xs text-ink-subtle">Free: {r.preferred_time}</p>}
                    </td>
                    <td className="px-3 py-3 text-sm text-ink-subtle">{r.when}</td>
                    <td className="px-3 py-3">
                      <span title={r.staff_note || undefined}><Badge tone={TONE[r.status] ?? "slate"}>{r.status}</Badge></span>
                      {r.decided_by && <p className="mt-0.5 text-2xs text-ink-subtle">by {r.decided_by}</p>}
                    </td>
                    <td className="px-3 py-3 text-right">
                      <Menu trigger={<span className="btn btn-sm btn-ghost"><MoreHorizontal className="h-4 w-4" /></span>}>
                        <MenuItem icon={Eye} onClick={() => setViewing(r)}>View in full</MenuItem>
                        {r.status === "pending" && (
                          <>
                            <MenuItem icon={Check} onClick={() => void open(r, "accepted")}>Accept</MenuItem>
                            <MenuItem icon={ArrowLeftRight} onClick={() => void open(r, "reassign")}>Hand to another mentor</MenuItem>
                            <MenuItem icon={X} danger onClick={() => void open(r, "declined")}>Decline with a reason</MenuItem>
                          </>
                        )}
                        {r.status === "accepted" && (
                          <>
                            <MenuItem icon={ArrowLeftRight} onClick={() => void open(r, "reassign")}>Move to another mentor</MenuItem>
                            <MenuItem icon={CheckCheck} onClick={() => void open(r, "closed")}>Mark complete</MenuItem>
                          </>
                        )}
                      </Menu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* ── view ──────────────────────────────────────────────────────── */}
      <Modal
        open={!!viewing}
        onClose={() => setViewing(null)}
        title={viewing?.member_name ?? ""}
        description={viewing ? `wants time with ${viewing.mentor_name} · asked ${viewing.when}` : undefined}
        icon={HeartHandshake}
        footer={<button className="btn btn-outline" onClick={() => setViewing(null)}>Close</button>}
      >
        {viewing && (
          <div className="space-y-3 text-sm">
            <p className="text-xs text-ink-subtle">{viewing.member_email}{viewing.member_code ? ` · ${viewing.member_code}` : ""}</p>
            <div>
              <p className="text-2xs font-semibold uppercase tracking-wide text-ink-subtle">Her goal</p>
              <p className="mt-1 whitespace-pre-line rounded-xl bg-surface-2 px-3.5 py-3 text-ink-muted">{viewing.goal || "—"}</p>
            </div>
            {viewing.preferred_time && <p className="text-ink-muted"><b className="text-ink">Free:</b> {viewing.preferred_time}</p>}
            <div>
              <p className="text-2xs font-semibold uppercase tracking-wide text-ink-subtle">Status</p>
              <p className="mt-1 text-ink-muted">
                <Badge tone={TONE[viewing.status] ?? "slate"}>{viewing.status}</Badge>
                {viewing.decided_by && <span className="ml-2 text-xs text-ink-subtle">by {viewing.decided_by}{viewing.decided_on ? ` on ${viewing.decided_on}` : ""}</span>}
              </p>
            </div>
            {viewing.staff_note && (
              <div>
                <p className="text-2xs font-semibold uppercase tracking-wide text-ink-subtle">What we told her</p>
                <p className="mt-1 rounded-xl bg-status-info-bg px-3.5 py-2.5 text-status-info-ink">{viewing.staff_note}</p>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* ── decide ────────────────────────────────────────────────────── */}
      <Modal
        open={!!deciding}
        onClose={() => setDeciding(null)}
        title={mode === "accepted" ? "Accept this request" : mode === "declined" ? "Decline this request" : mode === "reassign" ? "Hand it to another mentor" : "Mark this mentorship complete"}
        description={deciding ? `${deciding.member_name} → ${deciding.mentor_name}` : undefined}
        icon={mode === "declined" ? X : mode === "reassign" ? ArrowLeftRight : Check}
        iconTone={mode === "declined" ? "rose" : mode === "reassign" ? "violet" : "emerald"}
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setDeciding(null)}>Cancel</button>
            <button
              className={mode === "declined" ? "btn btn-danger" : "btn btn-primary"}
              onClick={() => void decide()}
              disabled={busy || (mode === "declined" && !note.trim()) || (mode === "reassign" && !newMentorId)}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              {mode === "accepted" ? "Accept and tell her" : mode === "declined" ? "Decline and tell her" : mode === "reassign" ? "Hand over and tell her" : "Close and tell her"}
            </button>
          </>
        }
      >
        <div className="space-y-3">
          {mode === "reassign" && (
            activeMentors === null ? (
              <div className="flex items-center justify-center py-4"><Spinner /></div>
            ) : activeMentors.length === 0 ? (
              <p className="rounded-lg bg-status-warn-bg px-3 py-2.5 text-xs text-status-warn-ink">
                There is no other active mentor to hand this to. Add one first.
              </p>
            ) : (
              <Select
                label="Hand it to"
                value={newMentorId}
                onChange={(e) => setNewMentorId(e.target.value)}
                placeholder="Pick a mentor…"
                options={activeMentors.map((m) => ({ value: m.id, label: `${m.name}${m.headline ? ` — ${m.headline}` : ""}` }))}
              />
            )
          )}
          <Textarea
            label={mode === "declined" ? "Why? She is sent this." : "What should we say to her? (optional)"}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={
              mode === "accepted" ? "She's free on Sunday afternoons — we'll set up a call."
                : mode === "declined" ? "She can't take anyone new this month. We can suggest someone with similar experience."
                : mode === "reassign" ? "Lakshmi is full this quarter, so we've introduced you to Fatima, who exports handloom too."
                : "Thank you both — this one is complete."
            }
          />
          <p className="text-xs text-ink-subtle">She gets this as a notification straight away.</p>
        </div>
      </Modal>
    </div>
  );
}

export default function MentorRequestsPage() {
  // useSearchParams needs a Suspense boundary during prerender.
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-16"><Spinner /></div>}>
      <RequestsInner />
    </Suspense>
  );
}
