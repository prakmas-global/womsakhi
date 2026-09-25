"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BadgeCheck,
  CircleAlert,
  Clock,
  Eye,
  FileText,
  History,
  Loader2,
  Mail,
  MoreHorizontal,
  Phone,
  RefreshCw,
  ShieldCheck,
  UserCheck,
  X,
} from "lucide-react";

import PageHeader from "@/components/layout/PageHeader";
import {
  Avatar,
  Badge,
  Card,
  EmptyState,
  ErrorState,
  Menu,
  MenuItem,
  Modal,
  SearchInput,
  SkeletonTable,
  Spinner,
  StatCard,
  Tabs,
  Textarea,
  useConfirm,
  useToast,
} from "@/design-system";
import {
  REVIEW_STATES,
  REVIEW_STATE_LABEL,
  REVIEW_STATE_TONE,
  apiApplicantDetail,
  apiApproveApplicant,
  apiDocumentObjectUrl,
  apiRejectApplicant,
  apiRequestResubmission,
  apiReviewQueue,
  verificationErrorMessage,
  type ApiDocument,
  type ApplicantDetail,
  type QueueCounts,
  type QueueRow,
  type ReviewedDocument,
  type VerificationState,
} from "@/lib/verification-api";

/**
 * The admission desk.
 *
 * Every applicant to a women-only community is admitted by a person, not a
 * rule — so this screen is built for careful judgement: her details, her
 * document opened securely in place, and three answers rather than two.
 * Approve, reject with a reason she is emailed, or send her back to the
 * upload step with a note saying what to change.
 *
 * Every count on this page is the server's. Opening a document is recorded on
 * the document; every decision is recorded in the activity log, and both are
 * read back into the submission panel so a reviewer can see who has already
 * looked and what was decided before.
 */

const EMPTY_COUNTS: QueueCounts = {
  in_review: 0,
  pending_documents: 0,
  pending_email: 0,
  active: 0,
  rejected: 0,
  suspended: 0,
};

/** Who can be acted on, and how. The server enforces the same rules. */
function canApprove(state: VerificationState) {
  return state === "in_review" || state === "pending_documents" || state === "rejected";
}
function canReject(state: VerificationState) {
  return state === "in_review" || state === "pending_documents";
}
function canAskAgain(state: VerificationState) {
  return state === "in_review" || state === "pending_documents" || state === "rejected";
}

function formatSize(bytes: number) {
  if (!bytes || bytes < 1024) return `${bytes || 0} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatWhen(iso: string) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
}

type Target = { user_id: string; full_name: string; documents: number };

export default function VerificationQueuePage() {
  const toast = useToast();
  const confirm = useConfirm();

  const [tab, setTab] = useState<VerificationState>("in_review");
  const [query, setQuery] = useState("");
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<QueueRow[]>([]);
  const [counts, setCounts] = useState<QueueCounts>(EMPTY_COUNTS);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  /** The submission panel: which applicant is open, and what came back. */
  const [openFor, setOpenFor] = useState("");
  const [detail, setDetail] = useState<ApplicantDetail | null>(null);

  const [viewing, setViewing] = useState<{ doc: ApiDocument; url: string } | null>(null);
  const [opening, setOpening] = useState("");
  const [rejecting, setRejecting] = useState<Target | null>(null);
  const [askingAgain, setAskingAgain] = useState<Target | null>(null);
  const [reason, setReason] = useState("");
  const [working, setWorking] = useState("");

  // The search box waits for her to stop typing before it asks the server.
  const qRef = useRef("");
  useEffect(() => {
    const t = setTimeout(() => {
      const next = query.trim();
      if (next === qRef.current) return;
      qRef.current = next;
      setLoading(true);
      setQ(next);
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  // The list is a function of (tab, search, reloadKey). Every state update
  // lands after the request answers, never in the effect body: the skeleton
  // is switched on by whoever changed the question (a tab, the search box,
  // the retry button), and `alive` drops an answer that arrives after a newer
  // question was asked.
  const [reloadKey, setReloadKey] = useState(0);
  const reload = useCallback(() => setReloadKey((k) => k + 1), []);
  useEffect(() => {
    let alive = true;
    void (async () => {
      const result = await apiReviewQueue({ state: tab, q }).then(
        (data) => ({ data, error: "" }),
        (err: unknown) => ({ data: null, error: verificationErrorMessage(err) }),
      );
      if (!alive) return;
      if (result.data) {
        setRows(result.data.items);
        setCounts(result.data.counts);
        setLoadError("");
      } else {
        setLoadError(result.error);
      }
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [tab, q, reloadKey]);

  const openDetail = useCallback(async (userId: string) => {
    setOpenFor(userId);
    setDetail(null);
    try {
      setDetail(await apiApplicantDetail(userId));
    } catch (err) {
      setOpenFor("");
      toast.error("Could not open that submission", { description: verificationErrorMessage(err) });
    }
  }, [toast]);

  const closeDetail = useCallback(() => {
    setOpenFor("");
    setDetail(null);
  }, []);

  /** After any decision: the list, the counts, and the open panel if it is hers. */
  const afterDecision = useCallback(async (userId: string) => {
    reload();
    if (openFor === userId) {
      try {
        setDetail(await apiApplicantDetail(userId));
      } catch {
        // The list already moved on; the panel keeps what it had.
      }
    }
  }, [openFor, reload]);

  async function openDocument(doc: ApiDocument) {
    setOpening(doc.id);
    try {
      // Fetched with the auth header, held as a temporary object URL — there is
      // no public link to this file. The server writes who opened it.
      const url = await apiDocumentObjectUrl(doc.id);
      setViewing({ doc, url });
    } catch (err) {
      toast.error("Could not open that document", { description: verificationErrorMessage(err) });
    } finally {
      setOpening("");
    }
  }

  function closeViewer() {
    if (viewing) URL.revokeObjectURL(viewing.url);
    setViewing(null);
    // The access log on the open panel now has one more line.
    if (openFor) void apiApplicantDetail(openFor).then(setDetail).catch(() => undefined);
  }

  const approve = useCallback(async (t: Target) => {
    const ok = await confirm({
      title: `Approve ${t.full_name}?`,
      description:
        t.documents === 0
          ? "She has not sent a document. Approving admits her anyway — only do this if you have verified her another way. She is emailed that she is in, and the app opens for her immediately."
          : "She is admitted immediately, emailed that she is in, and the app opens for her.",
      confirmLabel: "Approve",
    });
    if (!ok) return;
    setWorking(t.user_id);
    try {
      const res = await apiApproveApplicant(t.user_id);
      toast.success(res.message);
      await afterDecision(t.user_id);
    } catch (err) {
      toast.error("Could not approve", { description: verificationErrorMessage(err) });
    } finally {
      setWorking("");
    }
  }, [afterDecision, confirm, toast]);

  const confirmReject = useCallback(async () => {
    if (!rejecting || !reason.trim()) return;
    setWorking(rejecting.user_id);
    try {
      const res = await apiRejectApplicant(rejecting.user_id, reason.trim());
      toast.success(res.message);
      const id = rejecting.user_id;
      setRejecting(null);
      setReason("");
      await afterDecision(id);
    } catch (err) {
      toast.error("Could not reject", { description: verificationErrorMessage(err) });
    } finally {
      setWorking("");
    }
  }, [afterDecision, reason, rejecting, toast]);

  const confirmAskAgain = useCallback(async () => {
    if (!askingAgain || !reason.trim()) return;
    setWorking(askingAgain.user_id);
    try {
      const res = await apiRequestResubmission(askingAgain.user_id, reason.trim());
      toast.success(res.message, { description: "She is emailed the note and sent back to the upload step." });
      const id = askingAgain.user_id;
      setAskingAgain(null);
      setReason("");
      await afterDecision(id);
    } catch (err) {
      toast.error("Could not send that request", { description: verificationErrorMessage(err) });
    } finally {
      setWorking("");
    }
  }, [afterDecision, askingAgain, reason, toast]);

  const asTarget = (r: { user_id: string; full_name: string; documents: unknown[] }): Target => ({
    user_id: r.user_id,
    full_name: r.full_name,
    documents: r.documents.length,
  });

  const tabs = useMemo(
    () => REVIEW_STATES.map((s) => ({ value: s, label: REVIEW_STATE_LABEL[s], count: counts[s] })),
    [counts],
  );
  const waitingOnHer = counts.pending_email + counts.pending_documents;

  const detailStatus = detail?.status;
  const detailBusy = !!detail && working === detail.user_id;

  return (
    <div>
      <PageHeader
        title="Member verification"
        subtitle="Review identity documents and admit new members to WomSakhi."
        icon={ShieldCheck}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Awaiting review" value={String(counts.in_review)} icon={Clock} tone="amber"
                  deltaNote="ID sent, no decision yet" />
        <StatCard label="Waiting on her" value={String(waitingOnHer)} icon={Mail} tone="sky"
                  deltaNote="Email unconfirmed or no ID yet" />
        <StatCard label="Approved" value={String(counts.active)} icon={BadgeCheck} tone="emerald"
                  deltaNote="Can use the app" />
        <StatCard label="Rejected" value={String(counts.rejected)} icon={CircleAlert} tone="rose"
                  deltaNote="Told why by email" />
      </div>

      <Card className="mt-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-base font-semibold text-ink">Applications</h2>
            <p className="text-xs text-ink-subtle">
              Open a submission to see her documents, who has already looked, and what was decided before.
            </p>
          </div>
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder="Name, email, phone or member id…"
            className="w-full max-w-xs"
          />
        </div>

        <Tabs
          tabs={tabs}
          value={tab}
          onChange={(v) => {
            if (v === tab) return;
            setLoading(true);
            setTab(v as VerificationState);
          }}
          className="mb-4"
        />

        {loading ? (
          <SkeletonTable />
        ) : loadError ? (
          <ErrorState description={loadError} onRetry={() => { setLoading(true); reload(); }} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={ShieldCheck}
            title={q ? "Nobody matches that" : tab === "in_review" ? "Nothing waiting for review" : `No accounts ${REVIEW_STATE_LABEL[tab].toLowerCase()}`}
            description={
              q
                ? "Try a different name, email, phone or member id, or clear the search."
                : tab === "in_review"
                  ? "New applications appear here the moment an ID is submitted."
                  : "Accounts move here as their status changes."
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-line text-2xs font-semibold uppercase tracking-wide text-ink-subtle">
                  <th className="px-3 py-2.5">Applicant</th>
                  <th className="px-3 py-2.5">Member id</th>
                  <th className="px-3 py-2.5">Documents</th>
                  <th className="px-3 py-2.5">Applied</th>
                  <th className="px-3 py-2.5">Status</th>
                  <th className="px-3 py-2.5 text-right">&nbsp;</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.user_id} className="border-b border-line last:border-0 hover:bg-surface-2">
                    <td className="px-3 py-3">
                      <button
                        type="button"
                        onClick={() => void openDetail(r.user_id)}
                        className="flex items-center gap-3 text-left"
                      >
                        <Avatar name={r.full_name} size="md" />
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold text-ink hover:text-brand-ink">{r.full_name || "—"}</span>
                          <span className="block truncate text-xs text-ink-subtle">{r.email}</span>
                          {r.phone && (
                            <span className="mt-0.5 flex items-center gap-1 text-xs text-ink-subtle">
                              <Phone className="h-3 w-3" /> {r.phone}
                            </span>
                          )}
                        </span>
                      </button>
                    </td>
                    <td className="px-3 py-3 text-sm text-ink-muted">{r.member_id || "—"}</td>
                    <td className="px-3 py-3">
                      {r.documents.length === 0 ? (
                        <span className="text-sm text-ink-subtle">None yet</span>
                      ) : (
                        <span className="flex flex-wrap gap-1">
                          {r.documents.map((d) => (
                            <Badge key={d.id} tone={d.status === "approved" ? "emerald" : d.status === "rejected" ? "rose" : "slate"}>
                              {d.doc_type_label}
                            </Badge>
                          ))}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-sm text-ink-subtle">{r.applied || "—"}</td>
                    <td className="px-3 py-3">
                      <Badge tone={REVIEW_STATE_TONE[r.status] ?? "slate"}>{REVIEW_STATE_LABEL[r.status] ?? r.status}</Badge>
                    </td>
                    <td className="px-3 py-3 text-right">
                      {working === r.user_id ? (
                        <Loader2 className="ml-auto h-4 w-4 animate-spin text-ink-subtle" />
                      ) : (
                        <Menu trigger={<span className="btn btn-sm btn-ghost"><MoreHorizontal className="h-4 w-4" /></span>}>
                          <MenuItem icon={Eye} onClick={() => void openDetail(r.user_id)}>Open submission</MenuItem>
                          {canApprove(r.status) && (
                            <MenuItem icon={UserCheck} onClick={() => void approve(asTarget(r))}>Approve</MenuItem>
                          )}
                          {canAskAgain(r.status) && (
                            <MenuItem icon={RefreshCw} onClick={() => { setReason(""); setAskingAgain(asTarget(r)); }}>
                              Ask for a new document…
                            </MenuItem>
                          )}
                          {canReject(r.status) && (
                            <MenuItem icon={X} danger onClick={() => { setReason(""); setRejecting(asTarget(r)); }}>
                              Reject…
                            </MenuItem>
                          )}
                        </Menu>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* ── the submission ─────────────────────────────────────────────── */}
      <Modal
        open={openFor !== ""}
        onClose={closeDetail}
        title={detail?.full_name || "Submission"}
        description={detail ? detail.email : "Loading her submission…"}
        icon={ShieldCheck}
        iconTone="brand"
        size="lg"
        footer={
          detail ? (
            <>
              <button className="btn btn-outline" onClick={closeDetail}>Close</button>
              {detailStatus && canAskAgain(detailStatus) && (
                <button
                  className="btn btn-outline"
                  disabled={detailBusy}
                  onClick={() => { setReason(""); setAskingAgain(asTarget(detail)); }}
                >
                  <RefreshCw className="h-4 w-4" /> Ask for a new document
                </button>
              )}
              {detailStatus && canReject(detailStatus) && (
                <button
                  className="btn btn-danger"
                  disabled={detailBusy}
                  onClick={() => { setReason(""); setRejecting(asTarget(detail)); }}
                >
                  <X className="h-4 w-4" /> Reject
                </button>
              )}
              {detailStatus && canApprove(detailStatus) && (
                <button className="btn btn-primary" disabled={detailBusy} onClick={() => void approve(asTarget(detail))}>
                  {detailBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <BadgeCheck className="h-4 w-4" />}
                  Approve
                </button>
              )}
            </>
          ) : undefined
        }
      >
        {!detail ? (
          <div className="flex items-center justify-center py-12"><Spinner /></div>
        ) : (
          <div className="space-y-5">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-2xs font-semibold uppercase tracking-wide text-ink-subtle">Status</dt>
                <dd className="mt-1"><Badge tone={REVIEW_STATE_TONE[detail.status] ?? "slate"}>{REVIEW_STATE_LABEL[detail.status] ?? detail.status_label}</Badge></dd>
              </div>
              <div>
                <dt className="text-2xs font-semibold uppercase tracking-wide text-ink-subtle">Member id</dt>
                <dd className="mt-1 text-ink-muted">{detail.member_id || "Not assigned"}</dd>
              </div>
              <div>
                <dt className="text-2xs font-semibold uppercase tracking-wide text-ink-subtle">Phone</dt>
                <dd className="mt-1 text-ink-muted">{detail.phone || "Not given"}</dd>
              </div>
              <div>
                <dt className="text-2xs font-semibold uppercase tracking-wide text-ink-subtle">Applied</dt>
                <dd className="mt-1 text-ink-muted">{detail.applied || "—"}</dd>
              </div>
              <div>
                <dt className="text-2xs font-semibold uppercase tracking-wide text-ink-subtle">Email confirmed</dt>
                <dd className="mt-1 text-ink-muted">{formatWhen(detail.email_verified_at) || "Not yet"}</dd>
              </div>
              <div>
                <dt className="text-2xs font-semibold uppercase tracking-wide text-ink-subtle">Verified</dt>
                <dd className="mt-1 text-ink-muted">{formatWhen(detail.verified_at) || "Not yet"}</dd>
              </div>
            </dl>

            {detail.rejection_reason && detail.status !== "active" && (
              <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
                <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                <div className="text-xs leading-relaxed text-amber-900">
                  <p className="font-semibold">The last note she was sent</p>
                  <p className="mt-0.5">{detail.rejection_reason}</p>
                </div>
              </div>
            )}

            <section>
              <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink">
                <FileText className="h-4 w-4 text-ink-subtle" /> Documents
              </h3>
              {detail.documents.length === 0 ? (
                <p className="rounded-xl border border-dashed border-line px-3 py-4 text-center text-xs text-ink-subtle">
                  She has not sent a document yet.
                </p>
              ) : (
                <ul className="space-y-2">
                  {detail.documents.map((doc: ReviewedDocument) => {
                    const last = doc.access_log.length > 0 ? doc.access_log[doc.access_log.length - 1] : null;
                    return (
                      <li key={doc.id} className="rounded-xl border border-line px-3 py-2.5">
                        <div className="flex items-center gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-ink">
                              {doc.doc_type_label}
                              <Badge tone={doc.status === "approved" ? "emerald" : doc.status === "rejected" ? "rose" : "amber"}>
                                {doc.status}
                              </Badge>
                            </p>
                            <p className="truncate text-xs text-ink-subtle">
                              {doc.original_name} · {formatSize(doc.size)} · sent {doc.submitted}
                            </p>
                          </div>
                          <button
                            onClick={() => void openDocument(doc)}
                            disabled={opening === doc.id}
                            className="btn btn-outline btn-sm"
                          >
                            {opening === doc.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5" />}
                            View
                          </button>
                        </div>
                        {(doc.review_note || doc.reviewed_by_name) && (
                          <p className="mt-2 text-xs text-ink-muted">
                            {doc.reviewed_by_name && <span className="font-semibold">{doc.reviewed_by_name}</span>}
                            {doc.reviewed_by_name && doc.reviewed_at && <span> · {formatWhen(doc.reviewed_at)}</span>}
                            {doc.review_note && <span>{doc.reviewed_by_name ? " — " : ""}{doc.review_note}</span>}
                          </p>
                        )}
                        <p className="mt-1.5 text-2xs text-ink-subtle">
                          {doc.access_count === 0
                            ? "Nobody has opened this yet."
                            : `Opened ${doc.access_count} ${doc.access_count === 1 ? "time" : "times"}${last ? `, last by ${last.name || "a staff member"} on ${formatWhen(last.at)}` : ""}.`}
                        </p>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <section>
              <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink">
                <History className="h-4 w-4 text-ink-subtle" /> Decisions so far
              </h3>
              {detail.history.length === 0 ? (
                <p className="rounded-xl border border-dashed border-line px-3 py-4 text-center text-xs text-ink-subtle">
                  No decision has been recorded about her yet.
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {detail.history.map((h) => (
                    <li key={h.id} className="rounded-xl bg-surface-2 px-3 py-2 text-xs">
                      <p className="text-ink">
                        <span className="font-semibold">{h.label}</span>
                        <span className="text-ink-subtle"> · {h.user_name || "Staff"} · {h.when}</span>
                      </p>
                      {h.detail && <p className="mt-0.5 text-ink-muted">{h.detail}</p>}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}
      </Modal>

      {/* ── document viewer — the file is streamed, never linked publicly ── */}
      <Modal
        open={viewing !== null}
        onClose={closeViewer}
        title={viewing?.doc.doc_type_label ?? "Document"}
        description="Opened securely. This view is recorded against your account."
        icon={FileText}
        iconTone="violet"
        size="lg"
      >
        {viewing?.doc.content_type === "application/pdf" ? (
          <object data={viewing.url} type="application/pdf" className="h-[60vh] w-full rounded-xl">
            <p className="text-sm text-ink-subtle">
              This PDF can&apos;t be shown inline.{" "}
              <a href={viewing.url} target="_blank" rel="noreferrer" className="font-semibold text-brand-ink">
                Open it in a new tab
              </a>
              .
            </p>
          </object>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            loading="lazy"
            decoding="async"
            src={viewing?.url}
            alt={viewing?.doc.doc_type_label ?? "Identity document"}
            className="max-h-[60vh] w-full rounded-xl object-contain"
          />
        )}
      </Modal>

      {/* ── rejection — a reason is mandatory, because she is told it ──── */}
      <Modal
        open={rejecting !== null}
        onClose={() => setRejecting(null)}
        title={`Reject ${rejecting?.full_name ?? ""}?`}
        description="She'll be emailed this reason, so write something she can act on."
        icon={CircleAlert}
        iconTone="rose"
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setRejecting(null)}>Cancel</button>
            <button
              className="btn btn-danger"
              onClick={() => void confirmReject()}
              disabled={!reason.trim() || working === rejecting?.user_id}
            >
              {working === rejecting?.user_id ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
              Reject and notify
            </button>
          </>
        }
      >
        <Textarea
          label="Reason"
          required
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. The name on the card does not match the name on the account."
        />
      </Modal>

      {/* ── a new document — the third answer, between yes and no ──────── */}
      <Modal
        open={askingAgain !== null}
        onClose={() => setAskingAgain(null)}
        title={`Ask ${askingAgain?.full_name ?? ""} for a new document?`}
        description="She goes back to the upload step and is emailed this note. Her account is not refused; the app stays closed until someone looks again."
        icon={RefreshCw}
        iconTone="amber"
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setAskingAgain(null)}>Cancel</button>
            <button
              className="btn btn-primary"
              onClick={() => void confirmAskAgain()}
              disabled={!reason.trim() || working === askingAgain?.user_id}
            >
              {working === askingAgain?.user_id ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Send the request
            </button>
          </>
        }
      >
        <Textarea
          label="What should she change?"
          required
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. The photo is too blurred to read — take it in daylight, flat on a table, with all four corners in the frame."
        />
      </Modal>
    </div>
  );
}
