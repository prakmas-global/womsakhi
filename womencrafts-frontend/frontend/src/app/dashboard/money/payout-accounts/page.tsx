"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Landmark, MoreHorizontal, Search, ShieldCheck, ShieldOff, SlidersHorizontal, Smartphone,
} from "lucide-react";
import {
  Badge, Card, ErrorState, Input, Menu, MenuItem, Modal, Pagination, Spinner, StatCard,
  Textarea, useToast,
} from "@/design-system";
import { useAuth } from "@/context/AuthContext";
import { apiErrorMessage } from "@/lib/api";
import {
  apiMoneyPayoutAccounts, apiMoneyPermissions, apiMoneyUnverifyAccount, apiMoneyVerifyAccount, whenLabel,
  type AdminPayoutAccount, type MoneyAction, type PayoutAccountsPage,
} from "@/lib/money-admin-api";
import {
  HonestyNote, PageHeader, PersonCell, TableEmpty, searchClass, showingLabel, thClass, trHead, trRow,
} from "@/components/admin/money/shared";

/**
 * Where members' money goes when they withdraw.
 *
 * Only the last four digits of a bank account are ever stored, so that is all
 * this screen can show — by design, not by omission. "Verified" records that
 * a ₹1 test transfer landed in the account; it is the staff member's word,
 * with her name and the time on the row and on the audit trail.
 */

const PAGE_SIZE = 20;

export default function MoneyPayoutAccountsPage() {
  const { user } = useAuth();
  const toast = useToast();
  const isSuper = user?.role === "Super Admin";

  const [perms, setPerms] = useState<Set<MoneyAction>>(new Set());
  const [data, setData] = useState<PayoutAccountsPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [kind, setKind] = useState("");
  const [verified, setVerified] = useState("all");
  const [page, setPage] = useState(1);

  const [verifying, setVerifying] = useState<AdminPayoutAccount | null>(null);
  const [verifyNote, setVerifyNote] = useState("");
  const [unverifying, setUnverifying] = useState<AdminPayoutAccount | null>(null);
  const [unverifyReason, setUnverifyReason] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);
  useEffect(() => { setPage(1); }, [debouncedQ, kind, verified]);

  useEffect(() => {
    let alive = true;
    apiMoneyPermissions(isSuper).then((p) => { if (alive) setPerms(p); }).catch(() => {});
    return () => { alive = false; };
  }, [isSuper]);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError("");
    try {
      setData(await apiMoneyPayoutAccounts({ q: debouncedQ, kind, verified, page, page_size: PAGE_SIZE }, signal));
    } catch (e) {
      if (signal?.aborted) return;
      setError(apiErrorMessage(e, "Could not load payout accounts."));
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [debouncedQ, kind, verified, page]);

  useEffect(() => {
    const c = new AbortController();
    void load(c.signal);
    return () => c.abort();
  }, [load]);

  const submitVerify = useCallback(async () => {
    if (!verifying) return;
    setBusy(true);
    try {
      const row = await apiMoneyVerifyAccount(verifying.id, verifyNote.trim());
      toast.success(`${row.kind} ${row.detail} marked verified`, { description: `${row.member.name} has been told.` });
      setVerifying(null);
      await load();
    } catch (e) {
      toast.error("Could not mark that verified", { description: apiErrorMessage(e) });
    } finally {
      setBusy(false);
    }
  }, [verifying, verifyNote, load, toast]);

  const submitUnverify = useCallback(async () => {
    if (!unverifying) return;
    const reason = unverifyReason.trim();
    if (reason.length < 3) {
      toast.error("Say why", { description: "The reason goes on the row and on the audit trail." });
      return;
    }
    setBusy(true);
    try {
      const row = await apiMoneyUnverifyAccount(unverifying.id, reason);
      toast.success(`Verification withdrawn for ${row.kind} ${row.detail}`);
      setUnverifying(null);
      await load();
    } catch (e) {
      toast.error("Could not withdraw verification", { description: apiErrorMessage(e) });
    } finally {
      setBusy(false);
    }
  }, [unverifying, unverifyReason, load, toast]);

  const rows = data?.accounts ?? [];
  const pagination = data?.pagination;
  const sum = data?.summary;
  const filtered = !!debouncedQ || !!kind || verified !== "all";

  return (
    <div>
      <PageHeader
        icon={Landmark}
        title="Payout accounts"
        subtitle="The bank accounts and UPI ids members withdraw to. Only the last four digits are ever stored."
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Accounts" value={String(sum?.total ?? 0)} icon={Landmark} tone="brand" deltaNote="Across every member" />
        <StatCard label="Verified" value={String(sum?.verified ?? 0)} icon={ShieldCheck} tone="emerald" deltaNote="A ₹1 test transfer landed" />
        <StatCard label="Not yet verified" value={String(sum?.unverified ?? 0)} icon={ShieldOff}
                  tone={(sum?.unverified ?? 0) > 0 ? "amber" : "slate"} deltaNote="Usable, but flagged to her" />
        <StatCard label="Kinds" value={sum ? `${rows.filter((a) => a.kind === "Bank").length} · ${rows.filter((a) => a.kind === "UPI").length}` : "—"}
                  icon={Smartphone} tone="violet" deltaNote="Bank · UPI on this page" />
      </div>

      <HonestyNote title="What verification means here">
        Marking an account verified records that a small test transfer from the organisation&apos;s own bank landed in it.
        Nothing here sends that transfer, and the full account number is not stored anywhere — the platform cannot read it back.
      </HonestyNote>

      <Card className="mt-6">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="relative max-w-xs flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
            <input placeholder="Search by member, holder, IFSC or UPI id…" value={q} onChange={(e) => setQ(e.target.value)} className={searchClass} />
          </div>
          <Menu trigger={<span className="btn btn-sm btn-outline"><SlidersHorizontal className="h-3.5 w-3.5" />{kind || "Bank and UPI"}</span>}>
            <MenuItem onClick={() => setKind("")}>Bank and UPI</MenuItem>
            <MenuItem onClick={() => setKind("Bank")}>Bank only</MenuItem>
            <MenuItem onClick={() => setKind("UPI")}>UPI only</MenuItem>
          </Menu>
          <Menu trigger={<span className="btn btn-sm btn-outline"><ShieldCheck className="h-3.5 w-3.5" />{verified === "yes" ? "Verified" : verified === "no" ? "Not verified" : "Any state"}</span>}>
            <MenuItem onClick={() => setVerified("all")}>Any state</MenuItem>
            <MenuItem onClick={() => setVerified("yes")}>Verified</MenuItem>
            <MenuItem onClick={() => setVerified("no")}>Not verified</MenuItem>
          </Menu>
          {filtered && (
            <button className="btn btn-sm btn-ghost" onClick={() => { setQ(""); setKind(""); setVerified("all"); }}>Clear</button>
          )}
        </div>

        {error ? (
          <ErrorState title="Could not load payout accounts" description={error} onRetry={() => void load()} />
        ) : loading && !data ? (
          <div className="flex items-center justify-center py-16"><Spinner /></div>
        ) : rows.length === 0 ? (
          <TableEmpty
            icon={Landmark}
            title={filtered ? "Nothing matches that" : "No payout accounts yet"}
            description={filtered ? "Try a different search or filter." : "An account appears here when a member adds a bank account or UPI id on her Earn screen."}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className={trHead}>
                  <th className={thClass}>Member</th>
                  <th className={thClass}>Account</th>
                  <th className={thClass}>Holder</th>
                  <th className={thClass}>State</th>
                  <th className={thClass}>Added</th>
                  <th className={`${thClass} text-right`}>&nbsp;</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((a) => (
                  <tr key={a.id} className={trRow}>
                    <td className="px-3 py-3"><PersonCell person={a.member} /></td>
                    <td className="px-3 py-3">
                      <p className="text-sm text-ink">
                        <Badge tone={a.kind === "UPI" ? "violet" : "sky"}>{a.kind}</Badge>
                        <span className="ml-2 font-mono">{a.detail}</span>
                        {a.primary && <span className="ml-2 text-2xs text-ink-subtle">primary</span>}
                      </p>
                      <p className="text-2xs text-ink-subtle">{a.label}{a.ifsc ? ` · ${a.ifsc}` : ""}</p>
                    </td>
                    <td className="px-3 py-3 text-sm text-ink-muted">{a.holder || "—"}</td>
                    <td className="px-3 py-3">
                      {a.verified ? (
                        <>
                          <Badge tone="emerald">Verified</Badge>
                          <p className="mt-0.5 text-2xs text-ink-subtle">{whenLabel(a.verified_at, false)}{a.verified_by ? ` · ${a.verified_by}` : ""}</p>
                        </>
                      ) : (
                        <>
                          <Badge tone="amber">Not verified</Badge>
                          {a.unverified_reason && <p className="mt-0.5 max-w-[14rem] truncate text-2xs text-ink-subtle" title={a.unverified_reason}>{a.unverified_reason}</p>}
                        </>
                      )}
                    </td>
                    <td className="px-3 py-3 text-sm text-ink-subtle">{whenLabel(a.created_at, false) || a.added_on}</td>
                    <td className="px-3 py-3 text-right">
                      {perms.has("approve") && (
                        <Menu trigger={<span className="btn btn-sm btn-ghost"><MoreHorizontal className="h-4 w-4" /></span>}>
                          {a.verified
                            ? <MenuItem danger onClick={() => { setUnverifyReason(""); setUnverifying(a); }}>Withdraw verification…</MenuItem>
                            : <MenuItem onClick={() => { setVerifyNote(""); setVerifying(a); }}>Mark verified…</MenuItem>}
                        </Menu>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {pagination && pagination.total > 0 && (
          <Pagination page={pagination.page} pageCount={pagination.pages} onPageChange={setPage}
                      showing={showingLabel(pagination.total, pagination.page, pagination.page_size, "accounts")} />
        )}
      </Card>

      <Modal open={!!verifying} onClose={() => setVerifying(null)} title="Mark verified" icon={ShieldCheck} iconTone="emerald"
             description={verifying ? `${verifying.member.name} · ${verifying.kind} ${verifying.detail}` : undefined}>
        {verifying && (
          <div className="space-y-4">
            <p className="rounded-lg bg-surface-2 px-3 py-2.5 text-xs leading-relaxed text-ink-muted">
              Only do this once a test transfer has landed in <b className="text-ink">{verifying.kind} {verifying.detail}</b>
              {verifying.holder ? ` (${verifying.holder})` : ""}. Your name and the time go on the row and on the audit trail; she is told.
            </p>
            <Input label="Note (optional)" value={verifyNote} placeholder="e.g. ₹1 test on 26 Sep, UTR …"
                   onChange={(e) => setVerifyNote(e.target.value)} />
            <div className="flex justify-end gap-2 pt-2">
              <button className="btn btn-outline" onClick={() => setVerifying(null)}>Cancel</button>
              <button className="btn btn-primary" disabled={busy} onClick={() => void submitVerify()}>{busy ? "Saving…" : "Mark verified"}</button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={!!unverifying} onClose={() => setUnverifying(null)} title="Withdraw verification" icon={ShieldOff} iconTone="rose"
             description={unverifying ? `${unverifying.member.name} · ${unverifying.kind} ${unverifying.detail}` : undefined}>
        {unverifying && (
          <div className="space-y-4">
            <Textarea label="Reason" required rows={3} value={unverifyReason}
                      onChange={(e) => setUnverifyReason(e.target.value)}
                      hint="Kept on the row and on the audit trail. e.g. “Holder name does not match her ID.”" />
            <div className="flex justify-end gap-2 pt-2">
              <button className="btn btn-outline" onClick={() => setUnverifying(null)}>Cancel</button>
              <button className="btn btn-primary" disabled={busy} onClick={() => void submitUnverify()}>{busy ? "Saving…" : "Withdraw verification"}</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
