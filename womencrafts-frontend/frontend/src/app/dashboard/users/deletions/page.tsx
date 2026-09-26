"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Clock, ShieldCheck, Trash2, UserCheck } from "lucide-react";

import { Badge, Card, EmptyState, Modal, Spinner, StatCard, Textarea, useToast } from "@/design-system";
import AdminPage from "@/components/admin/AdminPage";
import {
  apiCancelDeletion, apiCompleteDeletion, apiDeletionRequests, shortDate,
  type DeletionRequestRow,
} from "@/lib/members-admin-api";
import { memberError } from "@/lib/member-api";
import { useAuth } from "@/context/AuthContext";

/**
 * Deletion requests.
 *
 * A member asks from Settings → "Delete my account". That suspends her at once
 * and promises her the erasure will be complete within 30 days. Nothing is
 * automatic after that on purpose: a person looks at the account first — an
 * unpaid booking, a wallet balance, a report she is named in — and then
 * either completes the erasure or, if she has said she wants to stay, cancels
 * it and lets her sign in again.
 *
 * Completing is final. Her login, her directory row and everything that only
 * existed because of her are deleted; her financial records survive with the
 * pointer cleared, because a ledger is not tidied by deleting money that moved.
 */

type Pending =
  | { kind: "complete"; row: DeletionRequestRow }
  | { kind: "cancel"; row: DeletionRequestRow }
  | null;

export default function DeletionRequestsPage() {
  const toast = useToast();
  const { user } = useAuth();
  const canDelete = !!user && (user.role === "Super Admin" || user.role === "Admin");

  const [rows, setRows] = useState<DeletionRequestRow[] | null>(null);
  const [overdue, setOverdue] = useState(0);
  const [error, setError] = useState("");
  const [pending, setPending] = useState<Pending>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const [reloadKey, setReloadKey] = useState(0);
  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const data = await apiDeletionRequests();
        if (!alive) return;
        setRows(data.items);
        setOverdue(data.overdue);
        setError("");
      } catch (e) {
        if (!alive) return;
        setError(memberError(e));
        setRows([]);
      }
    })();
    return () => { alive = false; };
  }, [reloadKey]);

  const act = async () => {
    if (!pending) return;
    setBusy(true);
    try {
      if (pending.kind === "complete") {
        const res = await apiCompleteDeletion(pending.row.user_id, note);
        toast.success("Account erased", { description: res.message });
      } else {
        const res = await apiCancelDeletion(pending.row.user_id, note);
        toast.success("She can sign in again", { description: res.message });
      }
      setPending(null);
      setNote("");
      reload();
    } catch (e) {
      toast.error("That didn't go through", { description: memberError(e) });
    } finally {
      setBusy(false);
    }
  };

  const total = rows?.length ?? 0;
  const waitingLongest = rows && rows.length ? Math.max(...rows.map((r) => r.days_waiting)) : 0;

  return (
    <AdminPage
      title="Deletion requests"
      subtitle="Members who asked for their account to be deleted. Each one is suspended already; a person finishes the job within 30 days, or lets her back in if she has changed her mind."
      error={error}
    >
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <StatCard label="Waiting" value={rows ? String(total) : "—"} icon={Clock} tone="brand" />
        <StatCard label="Past 30 days" value={rows ? String(overdue) : "—"} icon={AlertTriangle} tone={overdue ? "amber" : "slate"} />
        <StatCard label="Longest wait" value={rows ? `${waitingLongest} d` : "—"} icon={ShieldCheck} tone="violet" />
      </div>

      {!rows ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : rows.length === 0 ? (
        <Card>
          <EmptyState
            icon={ShieldCheck}
            title="Nobody is waiting"
            description="When a member asks to delete her account from Settings, she appears here."
          />
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <table className="w-full text-sm">
            <thead className="bg-surface-2 text-left text-xs uppercase tracking-wide text-ink-subtle">
              <tr>
                <th className="px-4 py-3 font-semibold">Member</th>
                <th className="px-4 py-3 font-semibold">Her reason</th>
                <th className="px-4 py-3 font-semibold">Asked on</th>
                <th className="px-4 py-3 font-semibold">Waiting</th>
                <th className="px-4 py-3 font-semibold text-right">Decide</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r) => (
                <tr key={r.user_id} className="align-top">
                  <td className="px-4 py-3">
                    <p className="font-medium text-ink">{r.name}</p>
                    <p className="text-xs text-ink-subtle">{r.code ? `${r.code} · ` : ""}{r.email}</p>
                    {r.member_id && (
                      <Link href={`/dashboard/users?q=${encodeURIComponent(r.email || r.name)}`} className="text-xs font-semibold text-brand-ink">
                        Look at her account first
                      </Link>
                    )}
                  </td>
                  <td className="max-w-xs px-4 py-3 text-ink-muted">{r.reason || <span className="text-ink-subtle">No reason given</span>}</td>
                  <td className="px-4 py-3 text-ink-muted">{r.requested_at ? shortDate(r.requested_at) : "—"}</td>
                  <td className="px-4 py-3">
                    <Badge tone={r.overdue ? "rose" : r.days_waiting > 20 ? "amber" : "slate"}>
                      {r.days_waiting} {r.days_waiting === 1 ? "day" : "days"}{r.overdue ? " · past promise" : ""}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        onClick={() => { setNote(""); setPending({ kind: "cancel", row: r }); }}
                      >
                        <UserCheck className="h-3.5 w-3.5" /> Keep account
                      </button>
                      {canDelete && (
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={() => { setNote(""); setPending({ kind: "complete", row: r }); }}
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Erase
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <Modal
        open={!!pending}
        onClose={() => (busy ? undefined : setPending(null))}
        title={pending?.kind === "complete" ? `Erase ${pending.row.name}'s account?` : `Keep ${pending?.row.name ?? ""}'s account?`}
        footer={
          <div className="flex justify-end gap-2">
            <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => setPending(null)}>Back</button>
            <button type="button" className="btn btn-primary" disabled={busy} onClick={act}>
              {busy ? <Spinner className="h-4 w-4" /> : pending?.kind === "complete" ? "Erase everything" : "Let her back in"}
            </button>
          </div>
        }
      >
        {pending?.kind === "complete" ? (
          <div className="space-y-3 text-sm text-ink-muted">
            <p className="rounded-lg bg-status-danger-bg px-3 py-2.5 text-status-danger-ink">
              This cannot be undone. Her login, her profile, her documents, messages and saved items are deleted.
              Records of money that moved are kept with her name removed.
            </p>
            <Textarea label="What you checked first (goes in the audit log)" rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="No open bookings, wallet at zero, not named in any report" />
          </div>
        ) : (
          <div className="space-y-3 text-sm text-ink-muted">
            <p>Her request is withdrawn and she can sign in straight away. Only do this when she has told us she wants to stay.</p>
            <Textarea label="How we know (goes in the audit log)" rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="She replied to our email on 24 September asking to keep it" />
          </div>
        )}
      </Modal>
    </AdminPage>
  );
}
