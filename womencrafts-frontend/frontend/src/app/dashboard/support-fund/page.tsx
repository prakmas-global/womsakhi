"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, HeartHandshake, LifeBuoy, Loader2, Mail, Users } from "lucide-react";

import AdminPage, { AdminLoading } from "@/components/admin/AdminPage";
import { Badge, Card, EmptyState, Input, Modal, Select, Tabs, Textarea } from "@/design-system";
import { apiAdminSupport, apiDecideSupport, type AdminSupportRequest } from "@/lib/admin-modules-api";
import { memberError } from "@/lib/member-api";

/**
 * The support fund queue.
 *
 * Approving writes the credit into her wallet in the same action. There is no
 * separate "now go and top her up" step, because that step is the one that gets
 * forgotten — and a grant nobody actions is worse than a refusal.
 */
export default function AdminSupportFundPage() {
  const [requests, setRequests] = useState<AdminSupportRequest[]>([]);
  const [tab, setTab] = useState("pending");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);

  const [deciding, setDeciding] = useState<AdminSupportRequest | null>(null);
  const [status, setStatus] = useState("approved");
  const [granted, setGranted] = useState("");
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    try {
      setRequests(await apiAdminSupport({ status: tab === "all" ? "" : tab }));
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

  const stats = useMemo(() => {
    const grantedTotal = requests.reduce((n, r) => n + r.granted_minor, 0);
    return [
      {
        label: "Waiting",
        value: requests.filter((r) => r.status === "pending").length,
        tone: "text-status-warn-ink",
      },
      {
        label: "Approved",
        value: requests.filter((r) => ["approved", "partial"].includes(r.status)).length,
        tone: "text-status-ok-ink",
      },
      {
        label: "Granted",
        value: `₹${(grantedTotal / 100).toLocaleString("en-IN")}`,
        tone: "text-brand-ink",
      },
      {
        label: "Asked for",
        value: `₹${(
          requests.reduce((n, r) => n + r.amount_needed_minor, 0) / 100
        ).toLocaleString("en-IN")}`,
      },
    ];
  }, [requests]);

  function open(r: AdminSupportRequest) {
    setDeciding(r);
    setStatus("approved");
    // Default to the full amount she asked for — the common case is one click.
    setGranted(String(Math.round(r.amount_needed_minor / 100)));
    setNote("");
  }

  async function decide() {
    if (!deciding) return;
    setWorking(true);
    try {
      await apiDecideSupport(deciding.id, {
        status,
        granted: status === "declined" ? 0 : Number(granted) || 0,
        staff_note: note.trim(),
      });
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
      title="Support fund"
      subtitle="Approving credits her wallet immediately — the decision and the money are one action."
      error={error}
      stats={stats}
    >
      <Tabs
        className="mb-4"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: "pending", label: "Waiting" },
          { value: "approved", label: "Approved" },
          { value: "partial", label: "Part-funded" },
          { value: "declined", label: "Declined" },
          { value: "all", label: "All" },
        ]}
      />

      {loading ? (
        <AdminLoading />
      ) : requests.length === 0 ? (
        <EmptyState
          icon={LifeBuoy}
          title="Nothing waiting"
          description="Requests from members appear here. Aim to answer within a week."
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
                    {r.member_code ? ` · ${r.member_code}` : ""}
                  </p>
                </div>
                <Badge
                  tone={
                    r.status === "pending"
                      ? "amber"
                      : r.status === "approved"
                        ? "emerald"
                        : r.status === "partial"
                          ? "violet"
                          : "slate"
                  }
                  className="shrink-0"
                >
                  {r.status}
                </Badge>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-3">
                <p className="font-display text-xl font-bold text-ink">
                  {r.amount_needed_label}
                  <span className="ms-1.5 text-sm font-medium text-ink-subtle">
                    for {r.what_for}
                  </span>
                </p>
                {r.granted_label && (
                  <Badge tone="emerald">{r.granted_label} granted</Badge>
                )}
              </div>

              <p className="mt-2 whitespace-pre-line rounded-xl bg-surface-inset px-3.5 py-3 text-sm text-ink-muted dark:bg-white/5">
                {r.reason}
              </p>

              <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-subtle">
                {r.household_income && <span>Income: {r.household_income}</span>}
                {r.dependants > 0 && (
                  <span className="flex items-center gap-1">
                    <Users className="h-3.5 w-3.5" />
                    Supports {r.dependants}
                  </span>
                )}
              </p>

              {r.staff_note && (
                <p className="mt-2 rounded-xl bg-status-info-bg px-3.5 py-2.5 text-sm text-status-info-ink">
                  {r.staff_note}
                </p>
              )}

              <div className="mt-3 flex items-center justify-between border-t border-line pt-2.5 dark:border-white/10">
                <span className="text-xs text-ink-subtle">Asked {r.asked_on}</span>
                {r.status === "pending" && (
                  <button onClick={() => open(r)} className="btn btn-primary btn-sm">
                    <HeartHandshake className="h-3.5 w-3.5" /> Decide
                  </button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={!!deciding}
        onClose={() => setDeciding(null)}
        title="Decide this request"
        description={`${deciding?.member_name} · ${deciding?.amount_needed_label} for ${deciding?.what_for}`}
        icon={LifeBuoy}
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setDeciding(null)}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={decide} disabled={working}>
              {working ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              {status === "declined" ? "Decline and tell her" : "Approve and credit her wallet"}
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <Select
            label="Decision"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            options={[
              { value: "approved", label: "Approve in full" },
              { value: "partial", label: "Fund part of it" },
              { value: "declined", label: "Decline" },
            ]}
          />
          {status !== "declined" && (
            <Input
              label="Amount to grant (₹)"
              type="number"
              value={granted}
              onChange={(e) => setGranted(e.target.value)}
            />
          )}
          <Textarea
            label="What should we tell her?"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={
              status === "declined"
                ? "We can't fund this one, but the next intake has free places — we'll hold one for you."
                : "This covers the full fee. Nothing else to do — it comes off automatically."
            }
          />
          {status !== "declined" && (
            <p className="rounded-xl bg-status-ok-bg px-3.5 py-2.5 text-xs text-status-ok-ink">
              This writes ₹{granted || 0} into her wallet immediately and sends her a message. It
              cannot be undone from here.
            </p>
          )}
        </div>
      </Modal>
    </AdminPage>
  );
}
