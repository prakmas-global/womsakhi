"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Gift, MoreHorizontal, Search, Settings2, UserCheck, UserPlus, Users,
} from "lucide-react";
import {
  Badge, Card, ErrorState, Input, Menu, MenuItem, Modal, Pagination, Select, Spinner, StatCard,
  Switch, Tabs, useToast,
} from "@/design-system";
import { useAuth } from "@/context/AuthContext";
import { apiErrorMessage } from "@/lib/api";
import {
  apiMoneyCreditReferral, apiMoneyPermissions, apiMoneyReferralConfig, apiMoneyReferrals,
  apiMoneyReferralsSummary, apiMoneySetReferralConfig, whenLabel,
  type MoneyAction, type ReferralCondition, type ReferralConfig, type ReferralRow, type ReferralsPage,
  type ReferralsSummary,
} from "@/lib/money-admin-api";
import {
  HonestyNote, PageHeader, PersonCell, TableEmpty, money, rupeesToMinor, searchClass, showingLabel,
  thClass, trHead, trRow,
} from "@/components/admin/money/shared";

/**
 * Who invited whom, and the thank-you for it.
 *
 * The reward is configured here (amount, when it is earned, on or off) and
 * lives on the organisation's settings document. Crediting is a wallet credit
 * to the inviter with the invited woman's id as the reference — one per
 * invited woman, so a second click is refused rather than paid twice.
 *
 * Honest limits: a row appears here only when a user carries `referred_by`,
 * and the sign-up form does not yet save the invite code it is opened with.
 * The empty state says so instead of showing a sample.
 */

const PAGE_SIZE = 20;

export default function MoneyReferralsPage() {
  const { user } = useAuth();
  const toast = useToast();
  const isSuper = user?.role === "Super Admin";

  const [perms, setPerms] = useState<Set<MoneyAction>>(new Set());
  const [data, setData] = useState<ReferralsPage | null>(null);
  const [summary, setSummary] = useState<ReferralsSummary | null>(null);
  const [config, setConfig] = useState<ReferralConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [state, setState] = useState("all");
  const [page, setPage] = useState(1);

  const [form, setForm] = useState({ reward: "", condition: "joined" as ReferralCondition, enabled: false });
  const [savingConfig, setSavingConfig] = useState(false);
  const [crediting, setCrediting] = useState<ReferralRow | null>(null);
  const [creditForm, setCreditForm] = useState({ amount: "", note: "" });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);
  useEffect(() => { setPage(1); }, [debouncedQ, state]);

  useEffect(() => {
    let alive = true;
    apiMoneyPermissions(isSuper).then((p) => { if (alive) setPerms(p); }).catch(() => {});
    return () => { alive = false; };
  }, [isSuper]);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError("");
    try {
      const [list, sum, cfg] = await Promise.all([
        apiMoneyReferrals({ q: debouncedQ, state, page, page_size: PAGE_SIZE }, signal),
        apiMoneyReferralsSummary(signal),
        apiMoneyReferralConfig(signal),
      ]);
      setData(list);
      setSummary(sum);
      setConfig(cfg);
    } catch (e) {
      if (signal?.aborted) return;
      setError(apiErrorMessage(e, "Could not load referrals."));
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [debouncedQ, state, page]);

  useEffect(() => {
    const c = new AbortController();
    void load(c.signal);
    return () => c.abort();
  }, [load]);

  // The form mirrors the saved config until the admin edits it.
  useEffect(() => {
    if (!config) return;
    setForm({
      reward: config.reward_minor > 0 ? (config.reward_minor / 100).toFixed(2) : "",
      condition: config.condition,
      enabled: config.enabled,
    });
  }, [config]);

  const saveConfig = useCallback(async () => {
    const reward = form.reward.trim() ? rupeesToMinor(form.reward) : 0;
    if (reward === null) {
      toast.error("Enter the reward in rupees, like 100 or 100.50");
      return;
    }
    if (form.enabled && reward <= 0) {
      toast.error("Set a reward before switching referrals on");
      return;
    }
    setSavingConfig(true);
    try {
      const cfg = await apiMoneySetReferralConfig({ reward_minor: reward, condition: form.condition, enabled: form.enabled });
      setConfig(cfg);
      toast.success(cfg.enabled ? `Referral reward is ${cfg.reward_label}` : "Referral reward is off");
      setSummary(await apiMoneyReferralsSummary());
    } catch (e) {
      toast.error("Could not save", { description: apiErrorMessage(e) });
    } finally {
      setSavingConfig(false);
    }
  }, [form, toast]);

  const openCredit = useCallback((r: ReferralRow) => {
    setCreditForm({ amount: config && config.reward_minor > 0 ? (config.reward_minor / 100).toFixed(2) : "", note: "" });
    setCrediting(r);
  }, [config]);

  const submitCredit = useCallback(async () => {
    if (!crediting) return;
    const amount = rupeesToMinor(creditForm.amount);
    if (!amount) {
      toast.error("Enter the amount in rupees");
      return;
    }
    setBusy(true);
    try {
      const row = await apiMoneyCreditReferral(crediting.referred_user_id, { amount_minor: amount, note: creditForm.note.trim() });
      toast.success(`${money(row.credited_minor)} credited to ${row.referrer?.name ?? "the inviter"}`, {
        description: `For inviting ${row.referred.name}. She has been told.`,
      });
      setCrediting(null);
      await load();
    } catch (e) {
      toast.error("Not credited", { description: apiErrorMessage(e) });
    } finally {
      setBusy(false);
    }
  }, [crediting, creditForm, load, toast]);

  const rows = data?.referrals ?? [];
  const pagination = data?.pagination;
  const filtered = !!debouncedQ || state !== "all";
  const canCredit = (r: ReferralRow) =>
    perms.has("approve") && !r.credited && !!r.referrer && (config?.condition === "signed_up" || r.admitted);

  return (
    <div>
      <PageHeader
        icon={Gift}
        title="Referrals"
        subtitle="Who invited whom, whether she was admitted, and the thank-you credited to the inviter."
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Invited" value={String(summary?.invited ?? 0)} icon={UserPlus} tone="brand" deltaNote="Signed up with a code" />
        <StatCard label="Admitted" value={String(summary?.joined ?? 0)} icon={UserCheck} tone="emerald" deltaNote="Of those, now active" />
        <StatCard label="Referral credits" value={String(summary?.credited ?? 0)} icon={Gift} tone="violet"
                  deltaNote={summary ? `${money(summary.credited_minor)} in the ledger, all time` : "—"} />
        <StatCard label="Reward" value={config ? (config.enabled ? config.reward_label : "Off") : "—"} icon={Settings2}
                  tone={config?.enabled ? "emerald" : "slate"} valueClassName="text-xl"
                  deltaNote={config?.enabled ? (config.condition === "joined" ? "Per admitted member" : "Per sign-up") : "Not offered yet"} />
      </div>

      <HonestyNote title="A credit, not a transfer">
        The thank-you is a wallet credit to the inviter — WomSakhi holds no money, so it is credit she can spend on the platform
        or ask to withdraw. One credit per invited woman: a second click on the same row is refused, not paid twice.
      </HonestyNote>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <h2 className="font-display text-base font-semibold text-ink">The reward</h2>
          <p className="text-xs text-ink-subtle">Saved on the organisation&apos;s settings; every change is on the audit trail.</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Input label="Amount (₹)" inputMode="decimal" placeholder="100.00" value={form.reward}
                   onChange={(e) => setForm({ ...form, reward: e.target.value })} disabled={!perms.has("edit")} />
            <Select label="Earned when" value={form.condition}
                    options={[{ value: "joined", label: "The invited woman is admitted" }, { value: "signed_up", label: "She signs up" }]}
                    onChange={(e) => setForm({ ...form, condition: e.target.value as ReferralCondition })} />
          </div>
          <div className="mt-4">
            <Switch label="Offer the reward" description="When off, staff can still credit by hand from a row."
                    checked={form.enabled} onChange={(v) => setForm({ ...form, enabled: v })} />
          </div>
          {perms.has("edit") && (
            <div className="mt-4 flex items-center justify-between gap-3">
              <p className="text-2xs text-ink-subtle">
                {config?.updated_at ? `Last changed ${whenLabel(config.updated_at)}${config.updated_by ? ` by ${config.updated_by}` : ""}` : "Never set"}
              </p>
              <button className="btn btn-primary" disabled={savingConfig} onClick={() => void saveConfig()}>
                {savingConfig ? "Saving…" : "Save"}
              </button>
            </div>
          )}
        </Card>

        <Card>
          <h2 className="font-display text-base font-semibold text-ink">Top inviters</h2>
          {!summary || summary.top.length === 0 ? (
            <p className="mt-2 text-xs text-ink-subtle">Nobody has been recorded as inviting anyone yet.</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {summary.top.map((t) => (
                <li key={t.code} className="flex items-center justify-between gap-3">
                  <PersonCell person={t.referrer} sub={`Code ${t.code}`} />
                  <p className="text-xs text-ink-muted"><b className="text-ink">{t.joined}</b> admitted · {t.invited} invited</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card className="mt-6">
        <Tabs className="mb-4" value={state} onChange={setState}
              tabs={[{ value: "all", label: "All" }, { value: "admitted", label: "Admitted" },
                     { value: "uncredited", label: "Not yet credited" }, { value: "credited", label: "Credited" }]} />
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="relative max-w-xs flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
            <input placeholder="Search by name or invite code…" value={q} onChange={(e) => setQ(e.target.value)} className={searchClass} />
          </div>
          {filtered && <button className="btn btn-sm btn-ghost" onClick={() => { setQ(""); setState("all"); }}>Clear</button>}
        </div>

        {error ? (
          <ErrorState title="Could not load referrals" description={error} onRetry={() => void load()} />
        ) : loading && !data ? (
          <div className="flex items-center justify-center py-16"><Spinner /></div>
        ) : rows.length === 0 ? (
          <TableEmpty
            icon={Users}
            title={filtered ? "Nothing matches that" : "No one has been recorded as invited yet"}
            description={filtered
              ? "Try a different search or tab."
              : "A row appears here when a new account carries the invite code it signed up with. The sign-up form does not yet save that code, so this list fills only once it does."}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className={trHead}>
                  <th className={thClass}>Invited</th>
                  <th className={thClass}>Invited by</th>
                  <th className={thClass}>Signed up</th>
                  <th className={thClass}>State</th>
                  <th className={thClass}>Thank-you</th>
                  <th className={`${thClass} text-right`}>&nbsp;</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.referred_user_id} className={trRow}>
                    <td className="px-3 py-3"><PersonCell person={r.referred} /></td>
                    <td className="px-3 py-3">
                      {r.referrer
                        ? <PersonCell person={r.referrer} sub={`Code ${r.code}`} />
                        : <p className="text-xs text-ink-subtle">Code {r.code} — no member holds it</p>}
                    </td>
                    <td className="px-3 py-3 text-sm text-ink-subtle">{whenLabel(r.joined_at, false) || "—"}</td>
                    <td className="px-3 py-3">
                      <Badge tone={r.admitted ? "emerald" : "amber"}>{r.admitted ? "Admitted" : r.status || "Pending"}</Badge>
                    </td>
                    <td className="px-3 py-3 text-xs text-ink-muted">
                      {r.credited ? (
                        <>
                          <p className="font-semibold text-ink">{money(r.credited_minor)}</p>
                          <p className="text-2xs text-ink-subtle">{whenLabel(r.credited_at, false)}{r.credited_by ? ` · ${r.credited_by}` : ""}</p>
                        </>
                      ) : <span className="text-ink-subtle">Not yet</span>}
                    </td>
                    <td className="px-3 py-3 text-right">
                      {canCredit(r) && (
                        <Menu trigger={<span className="btn btn-sm btn-ghost"><MoreHorizontal className="h-4 w-4" /></span>}>
                          <MenuItem onClick={() => openCredit(r)}>Credit the thank-you…</MenuItem>
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
                      showing={showingLabel(pagination.total, pagination.page, pagination.page_size, "referrals")} />
        )}
      </Card>

      <Modal open={!!crediting} onClose={() => setCrediting(null)} title="Credit the thank-you" icon={Gift}
             description={crediting ? `${crediting.referrer?.name ?? "The inviter"} invited ${crediting.referred.name}` : undefined}>
        {crediting && (
          <div className="space-y-4">
            <p className="rounded-lg bg-surface-2 px-3 py-2.5 text-xs leading-relaxed text-ink-muted">
              A wallet credit to <b className="text-ink">{crediting.referrer?.name}</b>, with {crediting.referred.name}&apos;s account as the
              reference so it cannot be paid twice. Your name goes on the row and on the audit trail; she is told.
            </p>
            <Input label="Amount (₹)" required inputMode="decimal" placeholder="100.00" value={creditForm.amount}
                   onChange={(e) => setCreditForm({ ...creditForm, amount: e.target.value })}
                   hint={config && config.reward_minor > 0 ? `The configured reward is ${config.reward_label}.` : "No reward is configured; enter one."} />
            <Input label="Note (optional)" value={creditForm.note} onChange={(e) => setCreditForm({ ...creditForm, note: e.target.value })} />
            <div className="flex justify-end gap-2 pt-2">
              <button className="btn btn-outline" onClick={() => setCrediting(null)}>Cancel</button>
              <button className="btn btn-primary" disabled={busy} onClick={() => void submitCredit()}>{busy ? "Crediting…" : "Credit"}</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
