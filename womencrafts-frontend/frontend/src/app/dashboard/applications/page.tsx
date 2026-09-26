"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Award, Briefcase, Check, History, Loader2, Mail, MessagesSquare, MoreHorizontal, Phone, Send,
  Sparkles, Star, X, XCircle,
} from "lucide-react";
import {
  Badge, Card, EmptyState, Menu, MenuItem, Modal, Spinner, StatCard, Tabs, Textarea, useToast,
} from "@/design-system";
import {
  apiGrowthApplications, apiGrowthDecideApplication, apiGrowthSummary, whenLabel,
  type ApplicationRow, type GrowthSummary,
} from "@/lib/growth-admin-api";
import { memberError } from "@/lib/member-api";

/**
 * The applications pipeline.
 *
 * Moving a card here sends the member a message immediately — including for a
 * decline, which needs a reason. Rejection told plainly beats silence, and
 * silence is what everyone complains about with every other job board.
 */

const TONE: Record<string, "brand" | "violet" | "amber" | "emerald" | "slate" | "rose"> = {
  applied: "brand", shortlisted: "violet", interview: "amber", offered: "emerald", closed: "rose", withdrawn: "slate",
};

const LABEL: Record<string, string> = {
  applied: "New", shortlisted: "Shortlisted", interview: "Interview", offered: "Offered", closed: "Declined", withdrawn: "Withdrawn",
};

const MOVE: Record<string, { title: string; verb: string; placeholder: string }> = {
  shortlisted: { title: "Shortlist her", verb: "Shortlist and tell her", placeholder: "Your application stood out. The employer is reviewing a short list this week." },
  interview: { title: "Invite her to interview", verb: "Invite and tell her", placeholder: "They'd like to speak to you on Thursday afternoon. Are you free?" },
  offered: { title: "Make her an offer", verb: "Offer and tell her", placeholder: "They'd like to offer you the position. We'll call to go through the details." },
  closed: { title: "Decline her application", verb: "Decline and tell her why", placeholder: "They've filled the position this time. Your application was strong — we'll tell you when something similar comes up." },
  applied: { title: "Put her back to New", verb: "Move back and tell her", placeholder: "We're reconsidering your application from the start." },
};

/** Where an application can go from where it is. */
function nextSteps(status: string): string[] {
  switch (status) {
    case "applied": return ["shortlisted", "interview", "closed"];
    case "shortlisted": return ["interview", "offered", "closed", "applied"];
    case "interview": return ["offered", "closed", "shortlisted"];
    case "offered": return ["closed"];
    default: return [];
  }
}

function ApplicationsInner() {
  const params = useSearchParams();
  const opportunityId = params.get("opportunity") ?? "";
  const toast = useToast();

  const [apps, setApps] = useState<ApplicationRow[]>([]);
  const [summary, setSummary] = useState<GrowthSummary["applications"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("applied");

  const [moving, setMoving] = useState<ApplicationRow | null>(null);
  const [target, setTarget] = useState("shortlisted");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [historyFor, setHistoryFor] = useState<ApplicationRow | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [list, sum] = await Promise.all([
        apiGrowthApplications({ opportunity_id: opportunityId, status: tab === "all" ? "" : tab }),
        apiGrowthSummary(),
      ]);
      setApps(list);
      setSummary(sum.applications);
    } catch (e) {
      toast.error("Could not load applications", { description: memberError(e) });
    } finally {
      setLoading(false);
    }
  }, [opportunityId, tab, toast]);

  useEffect(() => {
    const timer = setTimeout(() => void refresh(), 0);
    return () => clearTimeout(timer);
  }, [refresh]);

  const listingTitle = opportunityId ? (apps[0]?.opportunity_title ?? "") : "";

  const open = (a: ApplicationRow, to: string) => { setMoving(a); setTarget(to); setNote(""); };

  const move = useCallback(async () => {
    if (!moving) return;
    if (target === "closed" && !note.trim()) { toast.error("Say why — she is told this"); return; }
    setBusy(true);
    try {
      const row = await apiGrowthDecideApplication(moving.id, { status: target, staff_note: note.trim() });
      toast.success(`${row.member_name} — ${LABEL[row.status] ?? row.status}`, { description: "She has been told." });
      setMoving(null);
      await refresh();
    } catch (e) {
      toast.error("Could not move that application", { description: memberError(e) });
    } finally {
      setBusy(false);
    }
  }, [moving, note, refresh, target, toast]);

  const counts = !opportunityId && summary ? summary : null;
  const tabs = [
    { value: "applied", label: "New", count: counts?.applied },
    { value: "shortlisted", label: "Shortlisted", count: counts?.shortlisted },
    { value: "interview", label: "Interview", count: counts?.interview },
    { value: "offered", label: "Offered", count: counts?.offered },
    { value: "closed", label: "Declined", count: counts?.closed },
    { value: "withdrawn", label: "Withdrawn", count: counts?.withdrawn },
    { value: "all", label: "All" },
  ];

  const inProgress = summary ? summary.shortlisted + summary.interview : 0;
  const m = MOVE[target] ?? MOVE.shortlisted;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-11 w-11 items-center justify-center rounded-xl bg-brand-tint text-brand-ink">
            <Send className="h-6 w-6" />
          </span>
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-ink">Applications</h1>
            <p className="mt-1 text-sm text-ink-subtle">
              Every move you make here messages the member — including a decline, which needs a reason.
            </p>
          </div>
        </div>
        <Link href="/dashboard/opportunities" className="btn btn-outline"><Briefcase className="h-4 w-4" /> Opportunities</Link>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="New" value={summary ? String(summary.applied) : "—"} icon={Sparkles}
                  tone={summary && summary.applied > 0 ? "brand" : "slate"} deltaNote="Waiting for a first look" />
        <StatCard label="In progress" value={summary ? String(inProgress) : "—"} icon={MessagesSquare} tone="amber" deltaNote="Shortlisted or at interview" />
        <StatCard label="Offered" value={summary ? String(summary.offered) : "—"} icon={Award} tone="emerald" deltaNote="Women with an offer" />
        <StatCard label="Declined" value={summary ? String(summary.closed) : "—"} icon={XCircle} tone="rose" deltaNote="Each told why" />
      </div>

      {opportunityId && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-surface-2 px-4 py-3 text-sm">
          <span className="text-ink-muted">
            Showing applications for <b className="text-ink">{listingTitle || "one listing"}</b> only.
          </span>
          <Link href="/dashboard/applications" className="font-semibold text-brand-ink hover:underline">Show every listing</Link>
        </div>
      )}

      <Card className="mt-6">
        <Tabs className="mb-4" value={tab} onChange={setTab} tabs={tabs} />

        {loading ? (
          <div className="flex items-center justify-center py-16"><Spinner /></div>
        ) : apps.length === 0 ? (
          <EmptyState
            icon={Send}
            title={tab === "applied" ? "No new applications" : "Nothing here"}
            description={tab === "applied"
              ? "Applications land in this queue the moment a member applies."
              : `No ${(LABEL[tab] ?? tab).toLowerCase()} applications` + (opportunityId ? " for this listing." : ".")}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-line text-2xs font-semibold uppercase tracking-wide text-ink-subtle">
                  <th className="px-3 py-2.5">Applicant</th>
                  <th className="px-3 py-2.5">For</th>
                  <th className="px-3 py-2.5">Applied</th>
                  <th className="px-3 py-2.5">Status</th>
                  <th className="px-3 py-2.5">Last told</th>
                  <th className="px-3 py-2.5 text-right">&nbsp;</th>
                </tr>
              </thead>
              <tbody>
                {apps.map((a) => {
                  const steps = nextSteps(a.status);
                  return (
                    <tr key={a.id} className="border-b border-line last:border-0 hover:bg-surface-2">
                      <td className="px-3 py-3">
                        <p className="text-sm font-semibold text-ink">{a.member_name}</p>
                        <p className="flex flex-wrap items-center gap-x-3 text-xs text-ink-subtle">
                          <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{a.member_email}</span>
                          {a.member_phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{a.member_phone}</span>}
                        </p>
                      </td>
                      <td className="max-w-xs px-3 py-3">
                        <p className="truncate text-sm text-ink">{a.opportunity_title}</p>
                        <p className="truncate text-xs text-ink-subtle">{a.org}</p>
                      </td>
                      <td className="px-3 py-3 text-sm text-ink-subtle">{a.applied_on}</td>
                      <td className="px-3 py-3"><Badge tone={TONE[a.status] ?? "slate"}>{LABEL[a.status] ?? a.status}</Badge></td>
                      <td className="max-w-xs px-3 py-3">
                        <p className="line-clamp-2 text-xs text-ink-muted">{a.staff_note || <span className="text-ink-subtle">Nothing yet</span>}</p>
                      </td>
                      <td className="px-3 py-3 text-right">
                        <Menu trigger={<span className="btn btn-sm btn-ghost"><MoreHorizontal className="h-4 w-4" /></span>}>
                          <MenuItem icon={History} onClick={() => setHistoryFor(a)}>Her note and history</MenuItem>
                          {steps.includes("shortlisted") && <MenuItem icon={Star} onClick={() => open(a, "shortlisted")}>Shortlist</MenuItem>}
                          {steps.includes("interview") && <MenuItem icon={MessagesSquare} onClick={() => open(a, "interview")}>Invite to interview</MenuItem>}
                          {steps.includes("offered") && <MenuItem icon={Award} onClick={() => open(a, "offered")}>Make an offer</MenuItem>}
                          {steps.includes("applied") && <MenuItem onClick={() => open(a, "applied")}>Back to New</MenuItem>}
                          {steps.includes("closed") && <MenuItem icon={X} danger onClick={() => open(a, "closed")}>Decline with a reason</MenuItem>}
                        </Menu>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* ── move ──────────────────────────────────────────────────────── */}
      <Modal
        open={!!moving}
        onClose={() => setMoving(null)}
        title={m.title}
        description={moving ? `${moving.member_name} · ${moving.opportunity_title}` : undefined}
        icon={target === "closed" ? X : Check}
        iconTone={target === "closed" ? "rose" : "emerald"}
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setMoving(null)}>Cancel</button>
            <button className={target === "closed" ? "btn btn-danger" : "btn btn-primary"} onClick={() => void move()}
                    disabled={busy || (target === "closed" && !note.trim())}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              {m.verb}
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <Textarea
            label={target === "closed" ? "Why? She is sent this." : "What should we tell her? (optional)"}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={m.placeholder}
          />
          <p className="text-xs text-ink-subtle">She gets this as a notification straight away, and it shows on her application card.</p>
        </div>
      </Modal>

      {/* ── history ───────────────────────────────────────────────────── */}
      <Modal
        open={!!historyFor}
        onClose={() => setHistoryFor(null)}
        title={historyFor?.member_name ?? ""}
        description={historyFor ? `${historyFor.opportunity_title} · ${historyFor.org}` : undefined}
        icon={History}
        footer={<button className="btn btn-outline" onClick={() => setHistoryFor(null)}>Close</button>}
      >
        {historyFor && (
          <div className="space-y-4 text-sm">
            <p className="text-xs text-ink-subtle">
              {historyFor.member_email}{historyFor.member_phone ? ` · ${historyFor.member_phone}` : ""}{historyFor.member_code ? ` · ${historyFor.member_code}` : ""}
            </p>
            <div>
              <p className="text-2xs font-semibold uppercase tracking-wide text-ink-subtle">What she wrote</p>
              <p className="mt-1 whitespace-pre-line rounded-xl bg-surface-2 px-3.5 py-3 text-ink-muted">{historyFor.note || "She didn't add a note."}</p>
            </div>
            <div>
              <p className="text-2xs font-semibold uppercase tracking-wide text-ink-subtle">History</p>
              {historyFor.history.length === 0 ? (
                <p className="mt-1 text-ink-subtle">Applied {historyFor.applied_on}. Nothing has happened since.</p>
              ) : (
                <ol className="mt-2 space-y-2 border-l-2 border-line pl-4">
                  {[...historyFor.history].reverse().map((h, i) => (
                    <li key={`${h.at}-${i}`}>
                      <p className="flex flex-wrap items-center gap-2">
                        <Badge tone={TONE[h.status] ?? "slate"}>{LABEL[h.status] ?? h.status}</Badge>
                        <span className="text-xs text-ink-subtle">{whenLabel(h.at)}{h.by ? ` · ${h.by}` : ""}</span>
                      </p>
                      {h.note && <p className="mt-1 text-xs text-ink-muted">{h.note}</p>}
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

export default function AdminApplicationsPage() {
  // useSearchParams needs a Suspense boundary during prerender.
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-16"><Spinner /></div>}>
      <ApplicationsInner />
    </Suspense>
  );
}
