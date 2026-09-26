"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Award, BadgeCheck, Ban, CalendarDays, Download, MoreHorizontal, Plus, Search,
  ShieldCheck, ShieldOff, SlidersHorizontal,
} from "lucide-react";
import {
  Avatar, Badge, Card, ErrorState, Input, Menu, MenuItem, Modal, Pagination, Select,
  Spinner, StatCard, Textarea, useConfirm, useToast,
} from "@/design-system";
import { useAuth } from "@/context/AuthContext";
import { memberError } from "@/lib/member-api";
import {
  apiCertificateMembers, apiCertificateProgrammes, apiCertificates, apiCertificatesCsv,
  apiDeleteCertificate, apiIssueCertificate, apiLearningPermissions, apiReinstateCertificate,
  apiReissueCertificate, apiRevokeCertificate, apiVerifyCertificate, fmtDate, fmtDateTime, saveCsv,
  type CertificatePage, type CertificateRow, type LearningAction, type MemberOption,
  type ProgrammeOption, type VerifyOut,
} from "@/lib/learning-admin-api";

/**
 * The certificate register.
 *
 * For many members the certificate is the most valuable thing they take away,
 * so every action here is deliberate: revoking needs a written reason, the
 * number never changes (an employer already holds it), a name correction
 * rewrites the holder on the same number, and a certificate a woman earned
 * is withdrawn, never erased. Only a hand-issued one can be deleted, and only
 * after it is revoked.
 */

const PAGE_SIZE = 15;

type StateFilter = "" | "valid" | "revoked";

const BLANK_ISSUE = { user_id: "", program_id: "", holder_name: "", hours: "", grade: "" };

export default function CertificatesPage() {
  const { user } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const isSuper = user?.role === "Super Admin";

  const [data, setData] = useState<CertificatePage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [perms, setPerms] = useState<Set<LearningAction>>(new Set());
  const [query, setQuery] = useState("");
  const [term, setTerm] = useState("");
  const [state, setState] = useState<StateFilter>("");
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(false);

  // verify
  const [code, setCode] = useState("");
  const [checking, setChecking] = useState(false);
  const [verified, setVerified] = useState<VerifyOut | null>(null);

  // revoke / reissue
  const [revoking, setRevoking] = useState<CertificateRow | null>(null);
  const [reason, setReason] = useState("");
  const [renaming, setRenaming] = useState<CertificateRow | null>(null);
  const [newName, setNewName] = useState("");

  // manual issue
  const [issuing, setIssuing] = useState(false);
  const [issue, setIssue] = useState(BLANK_ISSUE);
  const [programmes, setProgrammes] = useState<ProgrammeOption[]>([]);
  const [memberQuery, setMemberQuery] = useState("");
  const [memberHits, setMemberHits] = useState<MemberOption[]>([]);
  const [picked, setPicked] = useState<MemberOption | null>(null);

  const can = useCallback((a: LearningAction) => perms.has(a), [perms]);

  useEffect(() => {
    let alive = true;
    apiLearningPermissions(isSuper).then((p) => { if (alive) setPerms(p); }).catch(() => {});
    return () => { alive = false; };
  }, [isSuper]);

  useEffect(() => {
    const t = setTimeout(() => { setTerm(query.trim()); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [query]);

  const load = useCallback(async () => {
    setError("");
    try {
      setData(await apiCertificates({ q: term, state, page, page_size: PAGE_SIZE }));
    } catch (e) {
      setError(memberError(e));
    } finally {
      setLoading(false);
    }
  }, [term, state, page]);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);

  // Member search for the issue dialog: one request per pause. Below two
  // characters nothing is asked and the list is cleared (the panel is only
  // drawn from two characters, so this is bookkeeping, not a flash).
  useEffect(() => {
    if (!issuing) return;
    const q = memberQuery.trim();
    let alive = true;
    const t = setTimeout(() => {
      if (q.length < 2) { setMemberHits([]); return; }
      apiCertificateMembers(q).then((hits) => { if (alive) setMemberHits(hits); }).catch(() => { if (alive) setMemberHits([]); });
    }, 300);
    return () => { alive = false; clearTimeout(t); };
  }, [issuing, memberQuery]);

  /* ── verify ─────────────────────────────────────────────────────────── */

  const verify = useCallback(async () => {
    const c = code.trim();
    if (!c) return;
    setChecking(true);
    try {
      setVerified(await apiVerifyCertificate(c));
    } catch (e) {
      toast.error("Could not check that number", { description: memberError(e) });
    } finally {
      setChecking(false);
    }
  }, [code, toast]);

  /* ── actions ────────────────────────────────────────────────────────── */

  const revoke = useCallback(async () => {
    if (!revoking) return;
    if (!reason.trim()) { toast.error("Say why the certificate is being withdrawn"); return; }
    setBusy(true);
    try {
      await apiRevokeCertificate(revoking.id, reason.trim());
      setRevoking(null);
      setReason("");
      toast.success(`${revoking.code} revoked`, { description: "It no longer verifies, and it has left her app." });
      await load();
    } catch (e) {
      toast.error("Could not revoke it", { description: memberError(e) });
    } finally {
      setBusy(false);
    }
  }, [load, reason, revoking, toast]);

  const reinstate = useCallback(async (c: CertificateRow) => {
    const ok = await confirm({
      title: `Reinstate ${c.code}?`,
      description: `It verifies again and returns to ${c.holder_name}'s app. The revocation stays in the audit log.`,
      confirmLabel: "Reinstate",
    });
    if (!ok) return;
    try {
      await apiReinstateCertificate(c.id);
      toast.success(`${c.code} is valid again`);
      await load();
    } catch (e) {
      toast.error("Could not reinstate it", { description: memberError(e) });
    }
  }, [confirm, load, toast]);

  const reissue = useCallback(async () => {
    if (!renaming) return;
    if (!newName.trim()) { toast.error("Give the corrected name"); return; }
    setBusy(true);
    try {
      await apiReissueCertificate(renaming.id, newName.trim());
      setRenaming(null);
      toast.success("Reissued with the corrected name", { description: `The number ${renaming.code} is unchanged.` });
      await load();
    } catch (e) {
      toast.error("Could not reissue it", { description: memberError(e) });
    } finally {
      setBusy(false);
    }
  }, [load, newName, renaming, toast]);

  const remove = useCallback(async (c: CertificateRow) => {
    const ok = await confirm({
      title: `Delete ${c.code}?`,
      description: "Only because it was issued by hand in error and is already revoked. The number will stop answering at all.",
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    try {
      await apiDeleteCertificate(c.id);
      toast.success("Deleted");
      await load();
    } catch (e) {
      toast.error("Not deleted", { description: memberError(e) });
    }
  }, [confirm, load, toast]);

  const openIssue = useCallback(async () => {
    setIssue(BLANK_ISSUE);
    setPicked(null);
    setMemberQuery("");
    setMemberHits([]);
    setIssuing(true);
    if (programmes.length === 0) {
      try {
        setProgrammes(await apiCertificateProgrammes());
      } catch (e) {
        toast.error("Could not load the programmes", { description: memberError(e) });
      }
    }
  }, [programmes.length, toast]);

  const submitIssue = useCallback(async () => {
    if (!picked) { toast.error("Pick the member"); return; }
    if (!issue.program_id) { toast.error("Pick the programme"); return; }
    setBusy(true);
    try {
      const made = await apiIssueCertificate({ ...issue, user_id: picked.id });
      setIssuing(false);
      toast.success(`Issued ${made.code}`, { description: `${made.program_name} — ${made.holder_name}` });
      await load();
    } catch (e) {
      toast.error("Not issued", { description: memberError(e) });
    } finally {
      setBusy(false);
    }
  }, [issue, load, picked, toast]);

  const exportCsv = useCallback(async () => {
    try {
      saveCsv(await apiCertificatesCsv(), "womsakhi-certificates.csv");
      toast.success("CSV downloaded");
    } catch (e) {
      toast.error("Could not export", { description: memberError(e) });
    }
  }, [toast]);

  const summary = data?.summary;
  const rows = data?.items ?? [];
  const filtered = term !== "" || state !== "";

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-11 w-11 items-center justify-center rounded-xl bg-brand-tint text-brand-ink">
            <Award className="h-6 w-6" />
          </span>
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-ink">Certificates</h1>
            <p className="mt-1 text-sm text-ink-subtle">
              Every certificate issued, by number. An employer can check any number without an account.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {can("export") && (
            <button className="btn btn-outline" onClick={() => void exportCsv()}>
              <Download className="h-4 w-4" /> Export CSV
            </button>
          )}
          {can("create") && (
            <button className="btn btn-primary" onClick={() => void openIssue()}>
              <Plus className="h-4 w-4" /> Issue by hand
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Issued" value={summary ? String(summary.total) : "—"} icon={Award} tone="brand"
                  deltaNote="All time" />
        <StatCard label="Valid" value={summary ? String(summary.valid) : "—"} icon={ShieldCheck} tone="emerald"
                  deltaNote="Verify today" />
        <StatCard label="Revoked" value={summary ? String(summary.revoked) : "—"} icon={ShieldOff}
                  tone={summary && summary.revoked > 0 ? "rose" : "slate"} deltaNote="Withdrawn with a reason" />
        <StatCard label="This month" value={summary ? String(summary.this_month) : "—"} icon={CalendarDays} tone="violet"
                  deltaNote="Issued since the 1st" />
      </div>

      {/* ── verify ──────────────────────────────────────────────────────── */}
      <Card className="mt-6">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-base font-semibold text-ink">Check a number</h2>
            <p className="text-xs text-ink-subtle">What an employer sees, plus the member number.</p>
          </div>
          <div className="flex w-full max-w-md items-end gap-2">
            <Input className="flex-1" value={code} placeholder="WS-2026-4F9C2A"
                   onChange={(e) => setCode(e.target.value.toUpperCase())}
                   onKeyDown={(e) => { if (e.key === "Enter") void verify(); }} />
            <button className="btn btn-outline" disabled={checking || !code.trim()} onClick={() => void verify()}>
              <BadgeCheck className="h-4 w-4" /> {checking ? "Checking…" : "Check"}
            </button>
          </div>
        </div>
        {verified && (
          <div className={`mt-4 rounded-xl border p-4 text-sm ${
            !verified.found ? "border-line bg-surface-2"
              : verified.valid ? "border-status-success-ink/30 bg-status-success-bg"
                : "border-status-danger-ink/30 bg-status-danger-bg"
          }`}>
            {!verified.found ? (
              <p className="text-ink-muted"><b className="font-mono text-ink">{verified.code}</b> — no certificate carries that number.</p>
            ) : (
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-ink">
                    <span className="font-mono">{verified.code}</span> · {verified.holder_name}
                  </p>
                  <p className="mt-0.5 text-ink-muted">
                    {verified.program_name} · issued {fmtDate(verified.issued_at)}
                    {verified.member_id && <span className="ml-2 font-mono text-2xs text-ink-subtle">{verified.member_id}</span>}
                  </p>
                  {!verified.valid && (
                    <p className="mt-1 text-xs text-status-danger-ink">
                      Revoked {fmtDateTime(verified.revoked_at)}: {verified.revoked_reason}
                    </p>
                  )}
                </div>
                <Badge tone={verified.valid ? "emerald" : "rose"}>{verified.valid ? "Valid" : "Revoked"}</Badge>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* ── register ────────────────────────────────────────────────────── */}
      <Card className="mt-6">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="relative max-w-xs flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
            <input
              placeholder="Search by name, programme or number…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full rounded-lg border border-line-strong bg-surface py-2 pl-9 pr-3 text-sm text-ink-muted placeholder-ink-subtle outline-none focus:border-violet-300 focus:ring-4 focus:ring-violet-50"
            />
          </div>
          <Menu
            trigger={
              <span className="btn btn-sm btn-outline">
                <SlidersHorizontal className="h-3.5 w-3.5" />
                {state === "" ? "Valid and revoked" : state === "valid" ? "Valid only" : "Revoked only"}
              </span>
            }
          >
            <MenuItem onClick={() => { setState(""); setPage(1); }}>Valid and revoked</MenuItem>
            <MenuItem onClick={() => { setState("valid"); setPage(1); }}>Valid only</MenuItem>
            <MenuItem onClick={() => { setState("revoked"); setPage(1); }}>Revoked only</MenuItem>
          </Menu>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16"><Spinner /></div>
        ) : error ? (
          <ErrorState title="Could not load the register" description={error} onRetry={() => { setLoading(true); void load(); }} />
        ) : rows.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-tint text-brand-ink">
              <Award className="h-6 w-6" />
            </span>
            <p className="mt-3 text-sm font-semibold text-ink">{filtered ? "Nothing matches that" : "No certificates yet"}</p>
            <p className="mx-auto mt-1 max-w-sm text-xs text-ink-subtle">
              {filtered ? "Try a different search, or clear the filter."
                : "A certificate appears here the moment a member claims one for a programme she has finished."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-line text-2xs font-semibold uppercase tracking-wide text-ink-subtle">
                  <th className="px-3 py-2.5">Holder</th>
                  <th className="px-3 py-2.5">Number</th>
                  <th className="px-3 py-2.5">Programme</th>
                  <th className="px-3 py-2.5">Issued</th>
                  <th className="px-3 py-2.5">Status</th>
                  <th className="px-3 py-2.5 text-right">&nbsp;</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id} className="border-b border-line last:border-0 hover:bg-surface-2">
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar name={c.holder_name || "?"} src={c.avatar || null} size="sm" />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-ink">{c.holder_name}</p>
                          {c.member_id && <p className="truncate font-mono text-2xs text-ink-subtle">{c.member_id}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 font-mono text-sm text-ink-muted">{c.code}</td>
                    <td className="px-3 py-3">
                      <p className="max-w-xs truncate text-sm text-ink-muted">{c.program_name}</p>
                      {(c.hours || c.grade) && (
                        <p className="text-2xs text-ink-subtle">{[c.hours, c.grade].filter(Boolean).join(" · ")}</p>
                      )}
                    </td>
                    <td className="px-3 py-3 text-sm text-ink-subtle">
                      {fmtDate(c.issued_at)}
                      {c.issued_by !== "member" && <p className="text-2xs">by {c.issued_by}</p>}
                      {c.reissued_at && <p className="text-2xs">name corrected {fmtDate(c.reissued_at)}</p>}
                    </td>
                    <td className="px-3 py-3">
                      {c.revoked ? (
                        <span title={`${c.revoked_reason} — ${c.revoked_by}, ${fmtDateTime(c.revoked_at)}`}>
                          <Badge tone="rose">Revoked</Badge>
                        </span>
                      ) : (
                        <Badge tone="emerald">Valid</Badge>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right">
                      {(can("approve") || can("edit") || can("delete")) && (
                        <Menu trigger={<span className="btn btn-sm btn-ghost"><MoreHorizontal className="h-4 w-4" /></span>}>
                          <MenuItem onClick={() => { setCode(c.code); setVerified(null); void apiVerifyCertificate(c.code).then(setVerified).catch(() => {}); }}>
                            Check this number
                          </MenuItem>
                          {can("edit") && !c.revoked && (
                            <MenuItem onClick={() => { setNewName(c.holder_name); setRenaming(c); }}>Correct the name</MenuItem>
                          )}
                          {can("approve") && !c.revoked && (
                            <MenuItem icon={Ban} danger onClick={() => { setReason(""); setRevoking(c); }}>Revoke</MenuItem>
                          )}
                          {can("approve") && c.revoked && (
                            <MenuItem onClick={() => void reinstate(c)}>Reinstate</MenuItem>
                          )}
                          {can("delete") && c.revoked && c.issued_by !== "member" && (
                            <MenuItem danger onClick={() => void remove(c)}>Delete (issued by hand)</MenuItem>
                          )}
                        </Menu>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {data && data.pages > 1 && (
          <Pagination
            page={data.page}
            pageCount={data.pages}
            onPageChange={setPage}
            showing={`Showing ${(data.page - 1) * data.page_size + 1} to ${Math.min(data.page * data.page_size, data.total)} of ${data.total} certificates`}
          />
        )}
      </Card>

      {/* ── revoke ──────────────────────────────────────────────────────── */}
      <Modal open={!!revoking} onClose={() => setRevoking(null)} title="Revoke this certificate" size="sm">
        {revoking && (
          <div className="space-y-4">
            <p className="text-sm text-ink-muted">
              <b className="font-mono text-ink">{revoking.code}</b> — {revoking.program_name}, held by{" "}
              <b className="text-ink">{revoking.holder_name}</b>. It stops verifying and leaves her app. You can reinstate it later.
            </p>
            <Textarea label="Why" required rows={3} value={reason} onChange={(e) => setReason(e.target.value)}
                      placeholder="Issued against the wrong programme" />
            <div className="flex justify-end gap-2 pt-2">
              <button className="btn btn-outline" onClick={() => setRevoking(null)}>Cancel</button>
              <button className="btn btn-primary" disabled={busy} onClick={() => void revoke()}>
                {busy ? "Revoking…" : "Revoke"}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── correct the name ────────────────────────────────────────────── */}
      <Modal open={!!renaming} onClose={() => setRenaming(null)} title="Correct the holder's name" size="sm">
        {renaming && (
          <div className="space-y-4">
            <p className="text-sm text-ink-muted">
              The number <b className="font-mono text-ink">{renaming.code}</b> stays the same, so anyone already holding it
              still finds it valid — with the corrected name.
            </p>
            <Input label="Name as it should read" required value={newName} onChange={(e) => setNewName(e.target.value)} />
            <div className="flex justify-end gap-2 pt-2">
              <button className="btn btn-outline" onClick={() => setRenaming(null)}>Cancel</button>
              <button className="btn btn-primary" disabled={busy} onClick={() => void reissue()}>
                {busy ? "Saving…" : "Reissue"}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── issue by hand ───────────────────────────────────────────────── */}
      <Modal open={issuing} onClose={() => setIssuing(false)} title="Issue a certificate by hand"
             description="For a programme finished off the platform. It is recorded as issued by you.">
        <div className="space-y-4">
          <div>
            <p className="mb-1.5 text-xs font-semibold text-ink">Member</p>
            {picked ? (
              <div className="flex items-center justify-between gap-3 rounded-lg border border-line bg-surface-2 px-3 py-2">
                <div className="flex min-w-0 items-center gap-2">
                  <Avatar name={picked.full_name} src={picked.avatar || null} size="sm" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink">{picked.full_name}</p>
                    {picked.member_id && <p className="truncate font-mono text-2xs text-ink-subtle">{picked.member_id}</p>}
                  </div>
                </div>
                <button className="btn btn-sm btn-ghost" onClick={() => setPicked(null)}>Change</button>
              </div>
            ) : (
              <>
                <Input value={memberQuery} placeholder="Type her name or email…" onChange={(e) => setMemberQuery(e.target.value)} />
                {memberQuery.trim().length >= 2 && (
                  <div className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-line">
                    {memberHits.length === 0 ? (
                      <p className="px-3 py-3 text-xs text-ink-subtle">No member matches that.</p>
                    ) : memberHits.map((m) => (
                      <button key={m.id} className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-surface-2"
                              onClick={() => { setPicked(m); setIssue({ ...issue, holder_name: m.full_name }); }}>
                        <Avatar name={m.full_name} src={m.avatar || null} size="sm" />
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold text-ink">{m.full_name}</span>
                          {m.member_id && <span className="block truncate font-mono text-2xs text-ink-subtle">{m.member_id}</span>}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
          <Select label="Programme" required value={issue.program_id}
                  options={programmes.map((p) => ({ value: p.id, label: p.status ? `${p.name} (${p.status})` : p.name }))}
                  onChange={(e) => setIssue({ ...issue, program_id: e.target.value })}
                  placeholder={programmes.length === 0 ? "Loading programmes…" : "Pick the programme"} />
          <Input label="Name on the certificate" value={issue.holder_name}
                 onChange={(e) => setIssue({ ...issue, holder_name: e.target.value })}
                 hint="Leave as her account name unless it should read differently." />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Hours (optional)" value={issue.hours} placeholder="40 hours"
                   onChange={(e) => setIssue({ ...issue, hours: e.target.value })} />
            <Input label="Grade (optional)" value={issue.grade} placeholder="Distinction"
                   onChange={(e) => setIssue({ ...issue, grade: e.target.value })} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button className="btn btn-outline" onClick={() => setIssuing(false)}>Cancel</button>
            <button className="btn btn-primary" disabled={busy} onClick={() => void submitIssue()}>
              {busy ? "Issuing…" : "Issue"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
