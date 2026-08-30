"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Building2, Check, Loader2, Mail, Phone, Send, Users } from "lucide-react";

import AdminPage, { AdminLoading } from "@/components/admin/AdminPage";
import { Badge, Card, EmptyState, Modal, Select, Tabs, Textarea } from "@/design-system";
import {
  apiAdminApplications,
  apiDecideApplication,
  type AdminApplication,
} from "@/lib/admin-modules-api";
import { memberError } from "@/lib/member-api";

/**
 * The applications pipeline.
 *
 * Moving a card here sends the member a message immediately — including for
 * "closed". Rejection told plainly beats silence, and silence is what everyone
 * complains about with every other job board they've used.
 */

const LADDER = ["applied", "shortlisted", "interview", "offered", "closed"];

const TONE: Record<string, "brand" | "violet" | "amber" | "emerald" | "slate"> = {
  applied: "brand",
  shortlisted: "violet",
  interview: "amber",
  offered: "emerald",
  closed: "slate",
  withdrawn: "slate",
};

function ApplicationsInner() {
  const params = useSearchParams();
  const opportunityId = params.get("opportunity") ?? "";

  const [apps, setApps] = useState<AdminApplication[]>([]);
  const [tab, setTab] = useState("applied");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);

  const [moving, setMoving] = useState<AdminApplication | null>(null);
  const [nextStatus, setNextStatus] = useState("shortlisted");
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    try {
      setApps(
        await apiAdminApplications({
          opportunity_id: opportunityId,
          status: tab === "all" ? "" : tab,
        }),
      );
      setError("");
    } catch (err) {
      setError(memberError(err));
    } finally {
      setLoading(false);
    }
  }, [tab, opportunityId]);

  useEffect(() => {
    void load();
  }, [load]);

  const stats = useMemo(
    () => [
      { label: "Showing", value: apps.length },
      {
        label: "New",
        value: apps.filter((a) => a.status === "applied").length,
        tone: "text-brand-ink",
      },
      {
        label: "In progress",
        value: apps.filter((a) => ["shortlisted", "interview"].includes(a.status)).length,
        tone: "text-status-warn-ink",
      },
      {
        label: "Offered",
        value: apps.filter((a) => a.status === "offered").length,
        tone: "text-status-ok-ink",
      },
    ],
    [apps],
  );

  function open(a: AdminApplication) {
    setMoving(a);
    // Default to the next rung, so the common case is one click.
    const i = LADDER.indexOf(a.status);
    setNextStatus(LADDER[Math.min(i + 1, LADDER.length - 1)] ?? "shortlisted");
    setNote("");
  }

  async function move() {
    if (!moving) return;
    setWorking(true);
    try {
      await apiDecideApplication(moving.id, { status: nextStatus, staff_note: note.trim() });
      setMoving(null);
      await load();
    } catch (err) {
      setError(memberError(err));
    } finally {
      setWorking(false);
    }
  }

  return (
    <AdminPage
      title="Applications"
      subtitle={
        opportunityId
          ? "Applications for one listing. Every move you make here messages the member."
          : "Every move you make here messages the member — including a decline."
      }
      error={error}
      stats={stats}
    >
      <Tabs
        className="mb-4"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: "applied", label: "New" },
          { value: "shortlisted", label: "Shortlisted" },
          { value: "interview", label: "Interview" },
          { value: "offered", label: "Offered" },
          { value: "all", label: "All" },
        ]}
      />

      {loading ? (
        <AdminLoading />
      ) : apps.length === 0 ? (
        <EmptyState
          icon={Send}
          title="Nothing here"
          description="Applications land in this queue the moment a member applies."
        />
      ) : (
        <div className="grid gap-3 xl:grid-cols-2">
          {apps.map((a) => (
            <Card key={a.id}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-display font-bold text-ink">{a.member_name}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-ink-subtle">
                    <span className="flex items-center gap-1">
                      <Mail className="h-3.5 w-3.5" />
                      {a.member_email}
                    </span>
                    {a.member_phone && (
                      <span className="flex items-center gap-1">
                        <Phone className="h-3.5 w-3.5" />
                        {a.member_phone}
                      </span>
                    )}
                  </p>
                </div>
                <Badge tone={TONE[a.status] ?? "slate"} className="shrink-0 capitalize">
                  {a.status}
                </Badge>
              </div>

              <p className="mt-3 flex items-center gap-1.5 text-sm font-medium text-ink">
                <Building2 className="h-3.5 w-3.5 shrink-0 text-ink-subtle" />
                {a.opportunity_title}
                <span className="font-normal text-ink-subtle">· {a.org}</span>
              </p>

              {a.note && (
                <p className="mt-2 whitespace-pre-line rounded-xl bg-surface-inset px-3.5 py-3 text-sm text-ink-muted dark:bg-white/5">
                  {a.note}
                </p>
              )}
              {a.staff_note && (
                <p className="mt-2 rounded-xl bg-status-info-bg px-3.5 py-2.5 text-sm text-status-info-ink">
                  {a.staff_note}
                </p>
              )}

              <div className="mt-3 flex items-center justify-between border-t border-line pt-2.5 dark:border-white/10">
                <span className="text-xs text-ink-subtle">Applied {a.applied_on}</span>
                {!["withdrawn", "closed"].includes(a.status) && (
                  <button onClick={() => open(a)} className="btn btn-primary btn-sm">
                    <Check className="h-3.5 w-3.5" /> Move on
                  </button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={!!moving}
        onClose={() => setMoving(null)}
        title="Move this application"
        description={`${moving?.member_name} · ${moving?.opportunity_title}`}
        icon={Users}
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setMoving(null)}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={move} disabled={working}>
              {working ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Move and tell her
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <Select
            label="New status"
            value={nextStatus}
            onChange={(e) => setNextStatus(e.target.value)}
            options={LADDER}
          />
          <Textarea
            label="What should we tell her?"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={
              nextStatus === "closed"
                ? "They've filled the position this time. Your application was strong — we'll tell you when something similar comes up."
                : "They'd like to speak to you on Thursday afternoon. Are you free?"
            }
          />
          <p className="text-xs text-ink-subtle">
            She gets this as a notification straight away, and it shows on her application card.
          </p>
        </div>
      </Modal>
    </AdminPage>
  );
}

export default function AdminApplicationsPage() {
  // useSearchParams needs a Suspense boundary during prerender.
  return (
    <Suspense fallback={<AdminLoading />}>
      <ApplicationsInner />
    </Suspense>
  );
}
