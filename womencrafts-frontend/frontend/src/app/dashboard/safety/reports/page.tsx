"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, EyeOff, Flag, Loader2, Mail, ShieldCheck } from "lucide-react";

import AdminPage, { AdminLoading } from "@/components/admin/AdminPage";
import { Badge, Card, EmptyState, Modal, Select, Tabs, Textarea } from "@/design-system";
import { apiAdminReports, apiDecideReport, type AdminReport } from "@/lib/admin-modules-api";
import { memberError } from "@/lib/member-api";

/**
 * Reports.
 *
 * An "anonymous" report still shows staff who filed it — we cannot act on
 * something we cannot follow up, and abuse of the report system is itself a
 * safety problem. Anonymous means hidden from the person reported, never hidden
 * from the people responsible for acting. The badge on the card makes that
 * distinction visible rather than leaving it to be assumed.
 */
export default function AdminReportsPage() {
  const [reports, setReports] = useState<AdminReport[]>([]);
  const [tab, setTab] = useState("open");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);

  const [handling, setHandling] = useState<AdminReport | null>(null);
  const [status, setStatus] = useState("reviewing");
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    try {
      setReports(await apiAdminReports({ status: tab === "all" ? "" : tab }));
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
      {
        label: "Open",
        value: reports.filter((r) => r.status === "open").length,
        tone: "text-status-danger-ink",
      },
      {
        label: "Reviewing",
        value: reports.filter((r) => r.status === "reviewing").length,
        tone: "text-status-warn-ink",
      },
      {
        label: "Actioned",
        value: reports.filter((r) => r.status === "actioned").length,
        tone: "text-status-ok-ink",
      },
      { label: "Showing", value: reports.length },
    ],
    [reports],
  );

  function open(r: AdminReport) {
    setHandling(r);
    setStatus(r.status === "open" ? "reviewing" : "actioned");
    setNote(r.staff_note || "");
  }

  async function decide() {
    if (!handling) return;
    setWorking(true);
    try {
      await apiDecideReport(handling.id, { status, staff_note: note.trim() });
      setHandling(null);
      await load();
    } catch (err) {
      setError(memberError(err));
    } finally {
      setWorking(false);
    }
  }

  return (
    <AdminPage
      title="Reports"
      subtitle="Someone told us about behaviour that isn't acceptable. Aim to answer every one within 24 hours."
      error={error}
      stats={stats}
    >
      <Tabs
        className="mb-4"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: "open", label: "New" },
          { value: "reviewing", label: "Reviewing" },
          { value: "actioned", label: "Actioned" },
          { value: "all", label: "All" },
        ]}
      />

      {loading ? (
        <AdminLoading />
      ) : reports.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title="Nothing to review"
          description="No open reports."
        />
      ) : (
        <div className="grid gap-3 xl:grid-cols-2">
          {reports.map((r) => (
            <Card key={r.id} className={r.status === "open" ? "border-status-danger-border" : ""}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="rose">{r.category}</Badge>
                    {r.anonymous && (
                      <Badge tone="slate">
                        <EyeOff className="mr-1 inline h-3 w-3" /> Anonymous
                      </Badge>
                    )}
                  </div>
                  <p className="mt-2 font-display font-bold text-ink">{r.member_name}</p>
                  <p className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-subtle">
                    <Mail className="h-3.5 w-3.5" />
                    {r.member_email}
                  </p>
                </div>
                <Badge
                  tone={
                    r.status === "open"
                      ? "rose"
                      : r.status === "reviewing"
                        ? "amber"
                        : r.status === "actioned"
                          ? "emerald"
                          : "slate"
                  }
                  className="shrink-0"
                >
                  {r.status}
                </Badge>
              </div>

              {r.anonymous && (
                <p className="mt-2 rounded-lg bg-surface-inset px-3 py-2 text-xs text-ink-subtle dark:bg-white/5">
                  She asked to stay anonymous to the person involved. Her name is shown to you so we
                  can follow up — never repeat it outside the team.
                </p>
              )}

              {r.about && (
                <p className="mt-2 text-sm">
                  <span className="font-semibold text-ink">About: </span>
                  <span className="text-ink-muted">{r.about}</span>
                </p>
              )}

              <p className="mt-2 whitespace-pre-line rounded-xl bg-surface-inset px-3.5 py-3 text-sm text-ink-muted dark:bg-white/5">
                {r.details}
              </p>

              {r.staff_note && (
                <p className="mt-2 rounded-xl bg-status-info-bg px-3.5 py-2.5 text-sm text-status-info-ink">
                  {r.staff_note}
                </p>
              )}

              <div className="mt-3 flex items-center justify-between border-t border-line pt-2.5 dark:border-white/10">
                <span className="text-xs text-ink-subtle">Filed {r.filed_on}</span>
                {!["actioned", "closed"].includes(r.status) && (
                  <button onClick={() => open(r)} className="btn btn-primary btn-sm">
                    <Check className="h-3.5 w-3.5" /> Handle
                  </button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={!!handling}
        onClose={() => setHandling(null)}
        title="Handle this report"
        description={handling?.category}
        icon={Flag}
        iconTone="amber"
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setHandling(null)}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={decide} disabled={working}>
              {working ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Save
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <Select
            label="Status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            options={["reviewing", "actioned", "closed", "open"]}
          />
          <Textarea
            label="What should we tell her?"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="We've removed the account and the posts. Thank you for telling us — please tell us again if anything else happens."
          />
          <p className="text-xs text-ink-subtle">
            Marking this <strong>actioned</strong> or <strong>closed</strong> sends her this message.
          </p>
        </div>
      </Modal>
    </AdminPage>
  );
}
