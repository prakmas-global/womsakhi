"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle, Check, Copy, KeyRound, Mail, MoreHorizontal,
  Search, ShieldAlert, ShieldCheck, SlidersHorizontal, UserCog, UserPlus, Users,
} from "lucide-react";
import {
  Badge, Card, Input, Menu, MenuItem, Modal, Select, StatCard, Spinner, useConfirm, useToast,
} from "@/design-system";
import {
  STATE_LABEL, STATE_NOTE, STATE_TONE,
  apiAssignableRoles, apiChangeStaffRole, apiInviteStaff, apiResendInvite,
  apiRestoreStaff, apiStaffList, apiSuspendStaff,
  type AssignableRole, type StaffAccount, type StaffList, type StaffState,
} from "@/lib/staff-accounts-api";
import { useAuth } from "@/context/AuthContext";
import { memberError } from "@/lib/member-api";
import StaffAccessPanel from "@/components/admin/StaffAccessPanel";

/**
 * Who can get into this dashboard.
 *
 * ── The screen that did not exist ───────────────────────────────────────────
 * There was no way to create a staff login anywhere in the product. The one
 * Super Admin was seeded by hand; there was no second one, and no way to give
 * a colleague narrower access. This is that screen.
 *
 * ── The invitation is shown once ────────────────────────────────────────────
 * Creating an account does not set a password — it issues a single-use link
 * the invitee uses to choose her own. An admin who types a colleague's first
 * password knows that password, and on a platform holding women's ID
 * documents that is not a footnote.
 *
 * The server stores only a digest, so the raw link is readable exactly once,
 * in the response to the create call. The dialog below therefore refuses to
 * close quietly: it shows the link, says it will not be shown again, and
 * makes copying it the primary action.
 */

const EMPTY: StaffList = {
  staff: [], total: 0,
  by_state: { invited: 0, active: 0, suspended: 0 },
  super_admins: 0,
};

export default function StaffPage() {
  const { user } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();

  const [data, setData] = useState<StaffList>(EMPTY);
  const [roles, setRoles] = useState<AssignableRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [stateFilter, setStateFilter] = useState<StaffState | "All">("All");

  const [inviting, setInviting] = useState(false);
  const [form, setForm] = useState({ full_name: "", email: "", role: "", phone: "" });
  const [busy, setBusy] = useState(false);
  /** The one-time link, held only long enough to show it. */
  const [issued, setIssued] = useState<{ name: string; email: string; link: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState<StaffAccount | null>(null);

  const isSuper = user?.role === "Super Admin";

  const refresh = useCallback(async () => {
    try {
      setData(await apiStaffList());
    } catch (e) {
      toast.error("Could not load the staff list", { description: memberError(e) });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  // One effect, one wave. `refresh` and the role list are independent, so they
  // go together rather than as two mounts racing each other into state.
  useEffect(() => {
    let alive = true;
    void (async () => {
      const [list, roleList] = await Promise.all([
        apiStaffList().catch(() => null),
        apiAssignableRoles().catch(() => [] as AssignableRole[]),
      ]);
      if (!alive) return;
      if (list) setData(list);
      else toast.error("Could not load the staff list");
      setRoles(roleList);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [toast]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return data.staff.filter((s) => {
      if (stateFilter !== "All" && s.state !== stateFilter) return false;
      if (!q) return true;
      return `${s.full_name} ${s.email} ${s.role}`.toLowerCase().includes(q);
    });
  }, [data.staff, query, stateFilter]);

  const openInvite = useCallback(() => {
    setForm({ full_name: "", email: "", role: roles[0]?.name ?? "", phone: "" });
    setInviting(true);
  }, [roles]);

  const invite = useCallback(async () => {
    if (!form.full_name.trim() || !form.email.trim() || !form.role) {
      toast.error("Name, email and role are all needed");
      return;
    }
    setBusy(true);
    try {
      const res = await apiInviteStaff({
        full_name: form.full_name.trim(),
        email: form.email.trim(),
        role: form.role,
        phone: form.phone.trim(),
      });
      setInviting(false);
      setCopied(false);
      setIssued({
        name: res.staff.full_name,
        email: res.staff.email,
        link: `${window.location.origin}/accept-invite?token=${res.invite_token}`,
      });
      await refresh();
    } catch (e) {
      toast.error("Could not create that account", { description: memberError(e) });
    } finally {
      setBusy(false);
    }
  }, [form, refresh, toast]);

  const resend = useCallback(async (s: StaffAccount) => {
    try {
      const res = await apiResendInvite(s.id);
      setCopied(false);
      setIssued({
        name: s.full_name,
        email: s.email,
        link: `${window.location.origin}/accept-invite?token=${res.invite_token}`,
      });
      toast.success("A fresh link was issued", { description: "The previous one stopped working." });
    } catch (e) {
      toast.error("Could not issue a new link", { description: memberError(e) });
    }
  }, [toast]);

  const changeRole = useCallback(async (s: StaffAccount, role: string) => {
    if (role === s.role) return;
    const ok = await confirm({
      title: `Make ${s.full_name} a ${role}?`,
      description: role === "Super Admin"
        ? "A Super Admin can do everything, including creating and removing other admins. There is no higher level."
        : `She will immediately gain what a ${role} can do, and lose anything her current role allowed that this one does not.`,
      confirmLabel: "Change role",
    });
    if (!ok) return;
    try {
      await apiChangeStaffRole(s.id, role);
      toast.success(`${s.full_name} is now a ${role}`);
      await refresh();
    } catch (e) {
      toast.error("Could not change the role", { description: memberError(e) });
    }
  }, [confirm, refresh, toast]);

  const suspend = useCallback(async (s: StaffAccount) => {
    const ok = await confirm({
      title: `Suspend ${s.full_name}?`,
      description: "She is signed out everywhere immediately and refused at sign-in. Her account and everything she has done are kept, and you can bring her back at any time.",
      confirmLabel: "Suspend",
      danger: true,
    });
    if (!ok) return;
    try {
      await apiSuspendStaff(s.id);
      toast.success(`${s.full_name} is suspended`);
      await refresh();
    } catch (e) {
      toast.error("Could not suspend that account", { description: memberError(e) });
    }
  }, [confirm, refresh, toast]);

  const restore = useCallback(async (s: StaffAccount) => {
    try {
      await apiRestoreStaff(s.id);
      toast.success(`${s.full_name} can sign in again`);
      await refresh();
    } catch (e) {
      toast.error("Could not restore that account", { description: memberError(e) });
    }
  }, [refresh, toast]);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-11 w-11 items-center justify-center rounded-xl bg-brand-tint text-brand-ink">
            <UserCog className="h-6 w-6" />
          </span>
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-ink">Staff</h1>
            <p className="mt-1 text-sm text-ink-subtle">
              Who can open this dashboard, and what each of them is allowed to do.
            </p>
          </div>
        </div>
        {isSuper && (
          <button className="btn btn-primary" onClick={openInvite}>
            <UserPlus className="h-4 w-4" /> Invite someone
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Staff accounts" value={String(data.total)} icon={Users} tone="brand"
                  deltaNote="Everyone with dashboard access" />
        <StatCard label="Active" value={String(data.by_state.active)} icon={ShieldCheck} tone="violet"
                  deltaNote="Can sign in now" />
        <StatCard label="Waiting to accept" value={String(data.by_state.invited)} icon={Mail} tone="amber"
                  deltaNote="Invited, no password yet" />
        <StatCard label="Super Admins" value={String(data.super_admins)} icon={ShieldAlert}
                  tone={data.super_admins < 2 ? "amber" : "brand"}
                  deltaNote={data.super_admins < 2 ? "Only one — add a second" : "Full control"} />
      </div>

      {/* A single Super Admin is one forgotten password away from nobody being
          able to manage roles at all. Said here rather than in a runbook. */}
      {data.super_admins < 2 && !loading && (
        <div className="mt-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div className="text-sm">
            <p className="font-semibold text-amber-900">There is only one Super Admin</p>
            <p className="mt-0.5 text-amber-800">
              If that account is lost, nobody can manage roles or create staff — and there is no way
              back without editing the database by hand. Invite a second one you trust.
            </p>
          </div>
        </div>
      )}

      <Card className="mt-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-base font-semibold text-ink">Everyone with access</h2>
            <p className="text-xs text-ink-subtle">
              Role decides the starting point. Anything granted or withheld for one person is shown on her row.
            </p>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="relative max-w-xs flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
            <input
              placeholder="Search by name, email or role…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full rounded-lg border border-line-strong bg-surface py-2 pl-9 pr-3 text-sm text-ink-muted placeholder-ink-subtle outline-none focus:border-violet-300 focus:ring-4 focus:ring-violet-50"
            />
          </div>
          <Menu
            trigger={
              <span className="btn btn-sm btn-outline">
                <SlidersHorizontal className="h-3.5 w-3.5" />
                {stateFilter === "All" ? "All states" : STATE_LABEL[stateFilter]}
              </span>
            }
          >
            <MenuItem onClick={() => setStateFilter("All")}>All states</MenuItem>
            <MenuItem onClick={() => setStateFilter("active")}>Active</MenuItem>
            <MenuItem onClick={() => setStateFilter("invited")}>Waiting to accept</MenuItem>
            <MenuItem onClick={() => setStateFilter("suspended")}>Suspended</MenuItem>
          </Menu>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16"><Spinner /></div>
        ) : shown.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-tint text-brand-ink">
              <Users className="h-6 w-6" />
            </span>
            <p className="mt-3 text-sm font-semibold text-ink">
              {query || stateFilter !== "All" ? "Nobody matches that" : "No staff yet"}
            </p>
            <p className="mx-auto mt-1 max-w-sm text-xs text-ink-subtle">
              {query || stateFilter !== "All"
                ? "Try a different search, or clear the filter."
                : "Invite a colleague and choose what she can reach. She sets her own password from the link you send her."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-line text-2xs font-semibold uppercase tracking-wide text-ink-subtle">
                  <th className="px-3 py-2.5">Person</th>
                  <th className="px-3 py-2.5">Role</th>
                  <th className="px-3 py-2.5">State</th>
                  <th className="px-3 py-2.5">Can open</th>
                  <th className="px-3 py-2.5">Last signed in</th>
                  <th className="px-3 py-2.5 text-right">&nbsp;</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((s) => {
                  const isMe = s.email === user?.email;
                  const adjusted = s.extra_permissions.length + s.denied_permissions.length;
                  return (
                    <tr key={s.id} className="border-b border-line last:border-0 hover:bg-surface-2">
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-3">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-tint text-sm font-bold text-brand-ink">
                            {s.full_name.charAt(0).toUpperCase()}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-ink">
                              {s.full_name}{isMe && <span className="ml-1.5 text-xs font-normal text-ink-subtle">(you)</span>}
                            </p>
                            <p className="truncate text-xs text-ink-subtle">{s.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <Badge tone={s.role === "Super Admin" ? "violet" : "slate"}>{s.role}</Badge>
                      </td>
                      <td className="px-3 py-3">
                        <span title={STATE_NOTE[s.state]}>
                          <Badge tone={STATE_TONE[s.state]}>{STATE_LABEL[s.state]}</Badge>
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <p className="text-sm text-ink-muted">
                          {s.role === "Super Admin" ? "Everything" : `${s.modules.length} sections`}
                        </p>
                        {adjusted > 0 && (
                          <p className="mt-0.5 text-2xs text-ink-subtle">
                            {s.extra_permissions.length > 0 && `+${s.extra_permissions.length} granted`}
                            {s.extra_permissions.length > 0 && s.denied_permissions.length > 0 && " · "}
                            {s.denied_permissions.length > 0 && `−${s.denied_permissions.length} withheld`}
                          </p>
                        )}
                      </td>
                      <td className="px-3 py-3 text-sm text-ink-subtle">
                        {s.last_login_at
                          ? new Date(s.last_login_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
                          : "Never"}
                      </td>
                      <td className="px-3 py-3 text-right">
                        {isSuper && (
                          <Menu trigger={<span className="btn btn-sm btn-ghost"><MoreHorizontal className="h-4 w-4" /></span>}>
                            <MenuItem onClick={() => setEditing(s)}>Adjust what she can do</MenuItem>
                            {roles
                              .filter((r) => r.name !== s.role)
                              .map((r) => (
                                <MenuItem key={r.id} onClick={() => void changeRole(s, r.name)}>
                                  Make her a {r.name}
                                </MenuItem>
                              ))}
                            {s.state === "invited" && (
                              <MenuItem onClick={() => void resend(s)}>Issue a fresh invite link</MenuItem>
                            )}
                            {s.state === "suspended"
                              ? <MenuItem onClick={() => void restore(s)}>Let her back in</MenuItem>
                              : !isMe && <MenuItem onClick={() => void suspend(s)}>Suspend</MenuItem>}
                          </Menu>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* ── invite ───────────────────────────────────────────────────────── */}
      <Modal open={inviting} onClose={() => setInviting(false)} title="Invite someone to the dashboard">
        <div className="space-y-4">
          <p className="rounded-lg bg-surface-2 px-3 py-2.5 text-xs leading-relaxed text-ink-muted">
            She sets her own password from a link — you never type it, and you never see it.
          </p>
          <Input label="Her name" value={form.full_name}
                 onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                 placeholder="Asha Verma" />
          <Input label="Work email" type="email" value={form.email}
                 onChange={(e) => setForm({ ...form, email: e.target.value })}
                 placeholder="asha@womsakhi.com" />
          <Input label="Phone (optional)" value={form.phone}
                 onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <Select
            label="Role"
            value={form.role}
            options={roles.map((r) => ({ value: r.name, label: r.name }))}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
          />
          {form.role && (
            <p className="text-xs text-ink-subtle">
              {form.role === "Super Admin"
                ? "A Super Admin can do everything, including creating and removing other admins."
                : `Opens ${roles.find((r) => r.name === form.role)?.modules.length ?? 0} sections. You can narrow or widen this for her afterwards.`}
            </p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button className="btn btn-outline" onClick={() => setInviting(false)}>Cancel</button>
            <button className="btn btn-primary" disabled={busy} onClick={() => void invite()}>
              {busy ? "Creating…" : "Create and get the link"}
            </button>
          </div>
        </div>
      </Modal>

      {/* ── the one-time link ────────────────────────────────────────────── */}
      <Modal open={!!issued} onClose={() => setIssued(null)} title="Send her this link">
        {issued && (
          <div className="space-y-4">
            <p className="text-sm text-ink-muted">
              <b className="text-ink">{issued.name}</b> can set her password with this link. It works once and
              expires in three days.
            </p>
            <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
              <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <p className="text-xs leading-relaxed text-amber-900">
                This is the only time it can be shown. We store it scrambled, so it cannot be looked up
                again — if you lose it, issue a fresh one from her row.
              </p>
            </div>
            <div className="rounded-lg border border-line-strong bg-surface-2 p-3">
              <code className="block break-all text-xs text-ink-muted">{issued.link}</code>
            </div>
            <div className="flex justify-end gap-2">
              <button className="btn btn-outline" onClick={() => setIssued(null)}>Done</button>
              <button
                className="btn btn-primary"
                onClick={() => {
                  navigator.clipboard?.writeText(issued.link).then(
                    () => { setCopied(true); toast.success("Link copied"); },
                    () => toast.error("Could not copy — select it by hand"),
                  );
                }}
              >
                {copied ? <><Check className="h-4 w-4" /> Copied</> : <><Copy className="h-4 w-4" /> Copy the link</>}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── per-person access ────────────────────────────────────────────── */}
      {editing && (
        <StaffAccessPanel
          staff={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); void refresh(); }}
        />
      )}
    </div>
  );
}
