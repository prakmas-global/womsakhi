"use client";

import { useCallback, useEffect, useState } from "react";
import { HandHeart, Link2Off, Search, ShieldCheck, UserX } from "lucide-react";

import { Badge, Card, EmptyState, Modal, Spinner, StatCard, Tabs, Textarea, useToast } from "@/design-system";
import AdminPage from "@/components/admin/AdminPage";
import { apiAssistLinks, apiRevokeAssistLink, type AssistLinkRow } from "@/lib/safety-admin-api";
import { shortDate } from "@/lib/members-admin-api";
import { memberError } from "@/lib/member-api";

/**
 * Assist links.
 *
 * "Together" lets one member help another use the app — read her screen, do a
 * task for her — on the helped woman's recorded consent. That consent is the
 * whole safeguard, and it is the kind of arrangement that can turn into
 * control. So safety staff can see every link: who recorded it, whether
 * consent was ever recorded, how much has been done under it, and can end one.
 * Ending it removes the link from the helper's screen at once and tells her.
 *
 * The helped woman is a name the helper typed, not an account. There is no
 * row of hers to open, and this screen does not pretend otherwise.
 */

const TABS = [
  { value: "", label: "All" },
  { value: "unconsented", label: "No consent recorded" },
  { value: "consented", label: "Consented" },
  { value: "revoked", label: "Ended by us" },
];

export default function AssistLinksPage() {
  const toast = useToast();
  const [tab, setTab] = useState("");
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<AssistLinkRow[] | null>(null);
  const [counts, setCounts] = useState({ total: 0, consented: 0, unconsented: 0, revoked: 0 });
  const [error, setError] = useState("");
  const [ending, setEnding] = useState<AssistLinkRow | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const [reloadKey, setReloadKey] = useState(0);
  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const data = await apiAssistLinks({ state: tab, q });
        if (!alive) return;
        setRows(data.items);
        setCounts({ total: data.total, consented: data.consented, unconsented: data.unconsented, revoked: data.revoked });
        setError("");
      } catch (e) {
        if (!alive) return;
        setError(memberError(e));
        setRows([]);
      }
    })();
    return () => { alive = false; };
  }, [tab, q, reloadKey]);

  const revoke = async () => {
    if (!ending || reason.trim().length < 3) return;
    setBusy(true);
    try {
      await apiRevokeAssistLink(ending.id, reason.trim());
      toast.success("Link ended", { description: `${ending.helper_name} no longer acts for ${ending.helped_name}. She has been told.` });
      setEnding(null);
      setReason("");
      reload();
    } catch (e) {
      toast.error("Couldn't end that link", { description: memberError(e) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <AdminPage
      title="Assist links"
      subtitle="Every consent one member holds to act for another. A link with no consent recorded is worth a look; ending one takes it off the helper's screen at once."
      error={error}
    >
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Links" value={String(counts.total)} icon={HandHeart} tone="brand" />
        <StatCard label="Consent recorded" value={String(counts.consented)} icon={ShieldCheck} tone="emerald" />
        <StatCard label="No consent yet" value={String(counts.unconsented)} icon={UserX} tone={counts.unconsented ? "amber" : "slate"} />
        <StatCard label="Ended by us" value={String(counts.revoked)} icon={Link2Off} tone="violet" />
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Tabs tabs={TABS} value={tab} onChange={setTab} />
        <label className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
          <input
            className="wc-input h-9 w-64 pl-9 text-sm"
            placeholder="Search the helped woman's name"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </label>
      </div>

      {!rows ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : rows.length === 0 ? (
        <Card>
          <EmptyState
            icon={HandHeart}
            title={q ? "Nothing matches that" : "No links here"}
            description={q ? "Try a shorter name." : "When a member starts helping another woman from Together, the link appears here."}
          />
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <table className="w-full text-sm">
            <thead className="bg-surface-2 text-left text-xs uppercase tracking-wide text-ink-subtle">
              <tr>
                <th className="px-4 py-3 font-semibold">Helper</th>
                <th className="px-4 py-3 font-semibold">Helps</th>
                <th className="px-4 py-3 font-semibold">Consent</th>
                <th className="px-4 py-3 font-semibold">Done under it</th>
                <th className="px-4 py-3 font-semibold text-right">Decide</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r) => (
                <tr key={r.id} className="align-top">
                  <td className="px-4 py-3">
                    <p className="font-medium text-ink">{r.helper_name}</p>
                    <p className="text-xs text-ink-subtle">{r.helper_code || "—"} · since {r.created_at ? shortDate(r.created_at) : "—"}</p>
                  </td>
                  <td className="max-w-xs px-4 py-3">
                    <p className="font-medium text-ink">{r.helped_name}</p>
                    <p className="text-xs text-ink-subtle">{r.because || "No reason recorded"}{r.owns_phone ? " · has her own phone" : " · uses the helper's phone"}</p>
                  </td>
                  <td className="px-4 py-3">
                    {r.revoked_at ? (
                      <>
                        <Badge tone="slate">Ended {shortDate(r.revoked_at)}</Badge>
                        <p className="mt-1 max-w-[16rem] text-xs text-ink-subtle">{r.revoked_reason}{r.revoked_by ? ` — ${r.revoked_by}` : ""}</p>
                      </>
                    ) : r.consented ? (
                      <Badge tone="emerald">Recorded {shortDate(r.consent_on)}</Badge>
                    ) : (
                      <Badge tone="amber">Not recorded</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 text-ink-muted">
                    {r.done_count} {r.done_count === 1 ? "thing" : "things"}{r.open_tasks ? ` · ${r.open_tasks} waiting` : ""}
                    {r.last_did && <p className="text-xs text-ink-subtle">Last: {r.last_did}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end">
                      {!r.revoked_at && (
                        <button type="button" className="btn btn-outline btn-sm" onClick={() => { setReason(""); setEnding(r); }}>
                          <Link2Off className="h-3.5 w-3.5" /> End link
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
        open={!!ending}
        onClose={() => (busy ? undefined : setEnding(null))}
        title={ending ? `End ${ending.helper_name}'s link with ${ending.helped_name}?` : ""}
        footer={
          <div className="flex justify-end gap-2">
            <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => setEnding(null)}>Back</button>
            <button type="button" className="btn btn-primary" disabled={busy || reason.trim().length < 3} onClick={revoke}>
              {busy ? <Spinner className="h-4 w-4" /> : "End the link"}
            </button>
          </div>
        }
      >
        <div className="space-y-3 text-sm text-ink-muted">
          <p>The link and its waiting tasks leave the helper&apos;s screen at once, and she gets a message saying the safety team ended it. This is written to the audit trail with your reason.</p>
          <Textarea label="Why (she will not see this; the audit log will)" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Report #… names this arrangement; no consent was ever recorded" />
        </div>
      </Modal>
    </AdminPage>
  );
}
