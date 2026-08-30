"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Inbox, Loader2, Mail, X } from "lucide-react";

import AdminPage, { AdminLoading } from "@/components/admin/AdminPage";
import { Badge, Card, EmptyState, Modal, Tabs, Textarea } from "@/design-system";
import {
  apiDecideMentorRequest,
  apiMentorRequests,
  type AdminMentorRequest,
} from "@/lib/admin-modules-api";
import { memberError } from "@/lib/member-api";

/**
 * Mentorship requests.
 *
 * Deciding one always messages the member — accepted or declined. A request
 * that sits in "pending" forever with no word is the failure mode this whole
 * queue exists to prevent.
 */
export default function MentorRequestsPage() {
  const [requests, setRequests] = useState<AdminMentorRequest[]>([]);
  const [tab, setTab] = useState("pending");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);

  const [deciding, setDeciding] = useState<AdminMentorRequest | null>(null);
  const [decision, setDecision] = useState<"accepted" | "declined">("accepted");
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    try {
      setRequests(await apiMentorRequests({ status: tab === "all" ? "" : tab }));
      setError("");
    } catch (err) {
      setError(memberError(err));
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    void load();
  }, [load]);

  const stats = useMemo(
    () => [
      { label: "Showing", value: requests.length },
      {
        label: "Waiting",
        value: requests.filter((r) => r.status === "pending").length,
        tone: "text-status-warn-ink",
      },
      {
        label: "Accepted",
        value: requests.filter((r) => r.status === "accepted").length,
        tone: "text-status-ok-ink",
      },
      {
        label: "Declined",
        value: requests.filter((r) => r.status === "declined").length,
        tone: "text-ink-subtle",
      },
    ],
    [requests],
  );

  function open(r: AdminMentorRequest, as: "accepted" | "declined") {
    setDeciding(r);
    setDecision(as);
    setNote("");
  }

  async function decide() {
    if (!deciding) return;
    setWorking(true);
    try {
      await apiDecideMentorRequest(deciding.id, { status: decision, staff_note: note.trim() });
      setDeciding(null);
      await load();
    } catch (err) {
      setError(memberError(err));
    } finally {
      setWorking(false);
    }
  }

  return (
    <AdminPage
      title="Mentor requests"
      subtitle="Every decision here messages the member. Nobody is left wondering."
      error={error}
      stats={stats}
    >
      <Tabs
        className="mb-4"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: "pending", label: "Waiting" },
          { value: "accepted", label: "Accepted" },
          { value: "declined", label: "Declined" },
          { value: "all", label: "All" },
        ]}
      />

      {loading ? (
        <AdminLoading />
      ) : requests.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="Nothing waiting"
          description="Requests from members appear here the moment they're made."
        />
      ) : (
        <div className="grid gap-3 xl:grid-cols-2">
          {requests.map((r) => (
            <Card key={r.id}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-display font-bold text-ink">{r.member_name}</p>
                  <p className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-subtle">
                    <Mail className="h-3.5 w-3.5" />
                    {r.member_email}
                  </p>
                </div>
                <Badge
                  tone={
                    r.status === "pending"
                      ? "amber"
                      : r.status === "accepted"
                        ? "emerald"
                        : "slate"
                  }
                >
                  {r.status}
                </Badge>
              </div>

              <p className="mt-3 text-sm text-ink-subtle">
                wants time with <span className="font-semibold text-ink">{r.mentor_name}</span>
              </p>
              <p className="mt-2 whitespace-pre-line rounded-xl bg-surface-inset px-3.5 py-3 text-sm text-ink-muted dark:bg-white/5">
                {r.goal}
              </p>
              {r.preferred_time && (
                <p className="mt-2 text-xs text-ink-subtle">Free: {r.preferred_time}</p>
              )}
              {r.staff_note && (
                <p className="mt-2 rounded-xl bg-status-info-bg px-3.5 py-2.5 text-sm text-status-info-ink">
                  {r.staff_note}
                </p>
              )}

              <div className="mt-3 flex items-center justify-between border-t border-line pt-2.5 dark:border-white/10">
                <span className="text-xs text-ink-subtle">Asked {r.when}</span>
                {r.status === "pending" && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => open(r, "declined")}
                      className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-status-danger-ink transition hover:bg-status-danger-bg"
                    >
                      <X className="h-3.5 w-3.5" /> Decline
                    </button>
                    <button onClick={() => open(r, "accepted")} className="btn btn-primary btn-sm">
                      <Check className="h-3.5 w-3.5" /> Accept
                    </button>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={!!deciding}
        onClose={() => setDeciding(null)}
        title={decision === "accepted" ? "Accept this request" : "Decline this request"}
        description={`${deciding?.member_name} → ${deciding?.mentor_name}`}
        icon={decision === "accepted" ? Check : X}
        iconTone={decision === "accepted" ? "emerald" : "rose"}
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setDeciding(null)}>
              Cancel
            </button>
            <button
              className={decision === "accepted" ? "btn btn-primary" : "btn btn-danger"}
              onClick={decide}
              disabled={working}
            >
              {working ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              {decision === "accepted" ? "Accept and tell her" : "Decline and tell her"}
            </button>
          </>
        }
      >
        <Textarea
          label="What should we say to her?"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={
            decision === "accepted"
              ? "She's free on Sunday afternoons — we'll set up a call."
              : "She can't take anyone new this month. We can suggest someone with similar experience."
          }
        />
      </Modal>
    </AdminPage>
  );
}
