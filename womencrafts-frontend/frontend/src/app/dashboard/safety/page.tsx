"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Check,
  Flag,
  Loader2,
  Mail,
  MapPin,
  Phone,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";

import AdminPage, { AdminLoading } from "@/components/admin/AdminPage";
import { Badge, Card, EmptyState, Modal, Select, Tabs, Textarea } from "@/design-system";
import { apiAdminAlerts, apiDecideAlert, type AdminAlert } from "@/lib/admin-modules-api";
import { memberError } from "@/lib/member-api";

/**
 * The alert queue.
 *
 * This is the most time-critical screen in the whole admin app. Open alerts
 * lead, her phone number is on the card rather than behind a click, and her
 * trusted contacts are listed right there so nobody has to go looking for them
 * while somebody is waiting.
 */
export default function AdminSafetyPage() {
  const [alerts, setAlerts] = useState<AdminAlert[]>([]);
  const [tab, setTab] = useState("open");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);

  const [handling, setHandling] = useState<AdminAlert | null>(null);
  const [status, setStatus] = useState("acknowledged");
  const [resolution, setResolution] = useState("");

  const load = useCallback(async () => {
    try {
      setAlerts(await apiAdminAlerts({ status: tab === "all" ? "" : tab }));
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

  // An open alert must not go stale on a screen someone left up.
  useEffect(() => {
    const timer = setInterval(() => void load(), 60_000);
    return () => clearInterval(timer);
  }, [load]);

  const stats = useMemo(
    () => [
      {
        label: "Open",
        value: alerts.filter((a) => a.status === "open").length,
        tone: "text-status-danger-ink",
      },
      {
        label: "Acknowledged",
        value: alerts.filter((a) => a.status === "acknowledged").length,
        tone: "text-status-warn-ink",
      },
      {
        label: "Resolved",
        value: alerts.filter((a) => a.status === "resolved").length,
        tone: "text-status-ok-ink",
      },
      { label: "Showing", value: alerts.length },
    ],
    [alerts],
  );

  function open(a: AdminAlert) {
    setHandling(a);
    setStatus(a.status === "open" ? "acknowledged" : "resolved");
    setResolution(a.resolution || "");
  }

  async function decide() {
    if (!handling) return;
    setWorking(true);
    try {
      await apiDecideAlert(handling.id, { status, resolution: resolution.trim() });
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
      title="Safety alerts"
      subtitle="Raised by a member who needs help. This screen refreshes itself every minute."
      error={error}
      stats={stats}
      action={
        <Link href="/dashboard/safety/reports" className="btn btn-outline">
          <Flag className="h-4 w-4" /> Reports
        </Link>
      }
    >
      <Tabs
        className="mb-4"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: "open", label: "Open" },
          { value: "acknowledged", label: "In hand" },
          { value: "resolved", label: "Resolved" },
          { value: "all", label: "All" },
        ]}
      />

      {loading ? (
        <AdminLoading />
      ) : alerts.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title="Nothing open"
          description="No member has raised an alert. Long may it stay that way."
        />
      ) : (
        <div className="grid gap-3 xl:grid-cols-2">
          {alerts.map((a) => (
            <Card
              key={a.id}
              className={a.status === "open" ? "border-status-danger-border bg-status-danger-bg/50" : ""}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <span
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                      a.status === "open"
                        ? "bg-status-danger-bg text-status-danger-ink"
                        : "bg-surface-inset text-ink-subtle"
                    }`}
                  >
                    <ShieldAlert className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="font-display font-bold text-ink">{a.member_name}</p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-ink-subtle">
                      {a.member_phone && (
                        <a
                          href={`tel:${a.member_phone}`}
                          className="flex items-center gap-1 font-semibold text-status-ok-ink"
                        >
                          <Phone className="h-3.5 w-3.5" />
                          {a.member_phone}
                        </a>
                      )}
                      <span className="flex items-center gap-1">
                        <Mail className="h-3.5 w-3.5" />
                        {a.member_email}
                      </span>
                    </p>
                  </div>
                </div>
                <Badge
                  tone={
                    a.status === "open"
                      ? "rose"
                      : a.status === "acknowledged"
                        ? "amber"
                        : "emerald"
                  }
                >
                  {a.status}
                </Badge>
              </div>

              {a.note && (
                <p className="mt-3 whitespace-pre-line rounded-xl bg-surface px-3.5 py-3 text-sm text-ink-muted dark:bg-white/5">
                  {a.note}
                </p>
              )}
              {a.location && (
                <p className="mt-2 flex items-center gap-1.5 text-sm text-ink-muted">
                  <MapPin className="h-3.5 w-3.5 text-ink-subtle" />
                  {a.location}
                </p>
              )}

              {a.contacts.length > 0 && (
                <div className="mt-3">
                  <p className="text-2xs font-bold uppercase tracking-wide text-ink-subtle">
                    Her trusted contacts
                  </p>
                  <ul className="mt-1.5 space-y-1">
                    {a.contacts.map((c) => (
                      <li key={c.id} className="flex items-center gap-2 text-sm">
                        <a
                          href={`tel:${c.phone}`}
                          className="flex items-center gap-1.5 font-semibold text-status-ok-ink"
                        >
                          <Phone className="h-3.5 w-3.5" />
                          {c.phone}
                        </a>
                        <span className="truncate text-ink-muted">
                          {c.name}
                          {c.relation ? ` · ${c.relation}` : ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {a.resolution && (
                <p className="mt-3 rounded-xl bg-status-info-bg px-3.5 py-2.5 text-sm text-status-info-ink">
                  {a.resolution}
                </p>
              )}

              <div className="mt-3 flex items-center justify-between border-t border-line pt-2.5 dark:border-white/10">
                <span className="text-xs text-ink-subtle">
                  {a.raised_at}
                  {a.handled_by ? ` · ${a.handled_by}` : ""}
                </span>
                {a.status !== "resolved" && (
                  <button onClick={() => open(a)} className="btn btn-primary btn-sm">
                    <Check className="h-3.5 w-3.5" />
                    {a.status === "open" ? "Take this" : "Resolve"}
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
        title="Update this alert"
        description={handling?.member_name}
        icon={ShieldAlert}
        iconTone="rose"
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
            options={["acknowledged", "resolved", "open"]}
          />
          <Textarea
            label="What did you do?"
            value={resolution}
            onChange={(e) => setResolution(e.target.value)}
            placeholder="Called her at 4:10pm — she's safe at her sister's. Following up tomorrow."
          />
          <p className="text-xs text-ink-subtle">
            Marking this <strong>acknowledged</strong> messages her to say someone is on it. This
            note is kept on the record either way.
          </p>
        </div>
      </Modal>
    </AdminPage>
  );
}
