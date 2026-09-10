"use client";

import { useCallback, useEffect, useState } from "react";
import {
  BadgeCheck,
  CircleAlert,
  Clock,
  Eye,
  FileText,
  Loader2,
  Mail,
  Phone,
  ShieldCheck,
  X,
} from "lucide-react";

import PageHeader from "@/components/layout/PageHeader";
import { Alert, Avatar, Badge, Card, EmptyState, Modal, SkeletonTable, Textarea } from "@/design-system";
import {
  apiApproveApplicant,
  apiDocumentObjectUrl,
  apiRejectApplicant,
  apiVerificationQueue,
  verificationErrorMessage,
  type ApiDocument,
  type QueueItem,
  type VerificationState,
} from "@/lib/verification-api";

/**
 * The admission desk.
 *
 * Every applicant to a women-only community is admitted by a person, not a
 * rule — so this screen is built for careful judgement: her details, her
 * document opened securely in place, and two decisions. Rejection demands a
 * reason, because she is told what it says.
 */

const TABS: { key: VerificationState; label: string; icon: React.ElementType }[] = [
  { key: "in_review", label: "Awaiting review", icon: Clock },
  { key: "pending_documents", label: "No ID yet", icon: FileText },
  { key: "pending_email", label: "Unconfirmed email", icon: Mail },
  { key: "active", label: "Approved", icon: BadgeCheck },
  { key: "rejected", label: "Rejected", icon: CircleAlert },
];

export default function VerificationQueuePage() {
  const [tab, setTab] = useState<VerificationState>("in_review");
  const [items, setItems] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [viewing, setViewing] = useState<{ doc: ApiDocument; url: string } | null>(null);
  const [rejecting, setRejecting] = useState<QueueItem | null>(null);
  const [reason, setReason] = useState("");
  const [working, setWorking] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiVerificationQueue(tab);
      setItems(data.items);
      setError("");
    } catch (err) {
      setError(verificationErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    void load();
  }, [load]);

  async function openDocument(doc: ApiDocument) {
    try {
      // Fetched with the auth header, held as a temporary object URL — there is
      // no public link to this file.
      const url = await apiDocumentObjectUrl(doc.id);
      setViewing({ doc, url });
    } catch (err) {
      setError(verificationErrorMessage(err));
    }
  }

  function closeViewer() {
    if (viewing) URL.revokeObjectURL(viewing.url);
    setViewing(null);
  }

  async function approve(item: QueueItem) {
    setWorking(item.user_id);
    try {
      const res = await apiApproveApplicant(item.user_id);
      setNotice(res.message);
      await load();
    } catch (err) {
      setError(verificationErrorMessage(err));
    } finally {
      setWorking("");
    }
  }

  async function confirmReject() {
    if (!rejecting || !reason.trim()) return;
    setWorking(rejecting.user_id);
    try {
      const res = await apiRejectApplicant(rejecting.user_id, reason.trim());
      setNotice(res.message);
      setRejecting(null);
      setReason("");
      await load();
    } catch (err) {
      setError(verificationErrorMessage(err));
    } finally {
      setWorking("");
    }
  }

  return (
    <div>
      <PageHeader
        title="Member verification"
        subtitle="Review identity documents and admit new members to WomSakhi."
        icon={ShieldCheck}
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold transition ${
              tab === key
                ? "bg-linear-to-r from-brand-600 to-brand-500 text-white shadow-sm shadow-brand-500/30"
                : "border border-line-strong text-ink-muted hover:bg-surface-hover"
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {error && (
        <Alert variant="danger" className="mb-4">
          {error}
        </Alert>
      )}
      {notice && (
        <Alert variant="success" className="mb-4">
          {notice}
        </Alert>
      )}

      {loading ? (
        <SkeletonTable />
      ) : items.length === 0 ? (
        <Card>
          <EmptyState
            icon={ShieldCheck}
            title="Nothing here right now"
            description={
              tab === "in_review"
                ? "No applications are waiting for review. New ones will appear here as soon as an ID is submitted."
                : "No accounts in this state."
            }
          />
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {items.map((item) => (
            <Card key={item.user_id}>
              <div className="flex items-start gap-3">
                <Avatar name={item.full_name} size="lg" />
                <div className="min-w-0 flex-1">
                  <p className="font-display font-bold text-ink">{item.full_name}</p>
                  <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-ink-subtle">
                    <Mail className="h-3.5 w-3.5 shrink-0" /> {item.email}
                  </p>
                  {item.phone && (
                    <p className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-subtle">
                      <Phone className="h-3.5 w-3.5 shrink-0" /> {item.phone}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-ink-subtle">Applied {item.applied}</p>
                </div>
                <Badge tone={item.status === "active" ? "emerald" : item.status === "rejected" ? "rose" : "amber"}>
                  {item.status.replace("_", " ")}
                </Badge>
              </div>

              {item.documents.length > 0 && (
                <ul className="mt-4 space-y-2">
                  {item.documents.map((doc) => (
                    <li
                      key={doc.id}
                      className="flex items-center gap-3 rounded-xl border border-line px-3 py-2.5"
                    >
                      <FileText className="h-4 w-4 shrink-0 text-ink-subtle" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-ink">{doc.doc_type_label}</p>
                        <p className="text-xs text-ink-subtle">
                          {(doc.size / 1024).toFixed(0)} KB · {doc.submitted}
                        </p>
                      </div>
                      <button onClick={() => openDocument(doc)} className="btn btn-outline btn-sm">
                        <Eye className="h-3.5 w-3.5" /> View
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {(item.status === "in_review" || item.status === "pending_documents") && (
                <div className="mt-4 flex gap-2">
                  <button
                    onClick={() => approve(item)}
                    disabled={working === item.user_id}
                    className="btn btn-primary btn-sm flex-1"
                  >
                    {working === item.user_id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <BadgeCheck className="h-3.5 w-3.5" />
                    )}
                    Approve
                  </button>
                  <button
                    onClick={() => {
                      setRejecting(item);
                      setReason("");
                    }}
                    className="btn btn-danger btn-sm flex-1"
                  >
                    <X className="h-3.5 w-3.5" /> Reject
                  </button>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* document viewer — the file is streamed, never linked publicly */}
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
          <img loading="lazy" decoding="async"
            src={viewing?.url}
            alt={viewing?.doc.doc_type_label ?? "Identity document"}
            className="max-h-[60vh] w-full rounded-xl object-contain"
          />
        )}
      </Modal>

      {/* rejection — a reason is mandatory, because she is told it */}
      <Modal
        open={rejecting !== null}
        onClose={() => setRejecting(null)}
        title={`Reject ${rejecting?.full_name ?? ""}?`}
        description="She'll be emailed this reason, so write something she can act on."
        icon={CircleAlert}
        iconTone="rose"
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setRejecting(null)}>
              Cancel
            </button>
            <button
              className="btn btn-danger"
              onClick={confirmReject}
              disabled={!reason.trim() || working === rejecting?.user_id}
            >
              {working === rejecting?.user_id ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <X className="h-4 w-4" />
              )}
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
          placeholder="e.g. The photo of your ID was too blurry to read — please send a clearer one."
        />
      </Modal>
    </div>
  );
}
