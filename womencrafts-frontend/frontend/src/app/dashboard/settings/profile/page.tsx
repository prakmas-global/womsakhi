"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Activity, Bell, ChevronRight, History, Mail, MonitorSmartphone, Palette, Pencil, Phone,
  ShieldCheck, Ticket, UserCircle,
} from "lucide-react";
import Link from "next/link";
import { Alert, Badge, Card, ImageUpload, Input, Modal, Spinner, useToast } from "@/design-system";
import { useAuth } from "@/context/AuthContext";
import {
  apiMyAccount, apiSaveStaffProfile, apiStaffActivity, formatWhen, MODULE_LABEL,
  type ActivityItem, type MyAccount,
} from "@/lib/staff-api";
import { memberError } from "@/lib/member-api";

/**
 * My profile — the signed-in staff member's own account.
 *
 * ── What was here before ────────────────────────────────────────────────────
 * "Admin User", "AD-0001", a bio about being the top administrator, "6+
 * years", "Mumbai", 28 logins this month, 1,248 users managed, five fixed
 * activity rows, two fixed sessions, a photo that took a pasted URL and an
 * Edit form whose Save only changed local state. The account's real name was
 * merged over the top of it, so the screen was one-third real and said which
 * third nowhere.
 *
 * ── What is here now ────────────────────────────────────────────────────────
 * Only fields the `users` row has: name, email, phone, photo, role, active,
 * joined, last sign-in, and the sections her access lets her open. The photo
 * is uploaded through /uploads and saved to the account. The activity is her
 * audited actions. The counts are counted.
 */

const QUICK_LINKS: { icon: React.ElementType; label: string; href: string }[] = [
  { icon: ShieldCheck, label: "Security", href: "/dashboard/settings/security" },
  { icon: MonitorSmartphone, label: "Sessions", href: "/dashboard/settings/sessions" },
  { icon: Bell, label: "Notifications", href: "/dashboard/settings/notifications" },
  { icon: Palette, label: "Appearance", href: "/dashboard/settings/appearance" },
  { icon: History, label: "My activity", href: "/dashboard/settings/activity" },
];

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-ink-subtle">{label}</p>
      <div className="mt-0.5 text-sm font-medium text-ink">{value}</div>
    </div>
  );
}

export default function ProfilePage() {
  const toast = useToast();
  const { user, updateUser } = useAuth();

  const [account, setAccount] = useState<MyAccount | null>(null);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [editOpen, setEditOpen] = useState(false);
  const [draft, setDraft] = useState({ full_name: "", phone: "" });
  const [saving, setSaving] = useState(false);
  const [draftError, setDraftError] = useState("");

  const fetchAll = useCallback(async () => {
    const [acc, acts] = await Promise.all([
      apiMyAccount(),
      apiStaffActivity({ mine: true, limit: 8 }).catch(() => [] as ActivityItem[]),
    ]);
    return { acc, acts };
  }, []);

  const load = useCallback(async () => {
    try {
      const { acc, acts } = await fetchAll();
      setAccount(acc);
      setActivity(acts);
      setLoadError("");
    } catch (e) {
      setLoadError(memberError(e));
    }
  }, [fetchAll]);

  // One wave on mount, the way the reference screen does it: state is set only
  // after the request answers, never synchronously in the effect body.
  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const { acc, acts } = await fetchAll();
        if (!alive) return;
        setAccount(acc);
        setActivity(acts);
        setLoadError("");
      } catch (e) {
        if (alive) setLoadError(memberError(e));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [fetchAll]);

  /** Keep the shell (sidebar name, avatar) in step with what was just saved. */
  const syncShell = useCallback((p: { full_name: string; phone: string; avatar: string }) => {
    if (user) updateUser({ ...user, full_name: p.full_name, phone: p.phone, avatar: p.avatar });
  }, [updateUser, user]);

  const openEdit = () => {
    if (!account) return;
    setDraft({ full_name: account.full_name, phone: account.phone });
    setDraftError("");
    setEditOpen(true);
  };

  const saveEdit = useCallback(async () => {
    if (!draft.full_name.trim()) { setDraftError("Your name cannot be empty."); return; }
    setSaving(true);
    try {
      const p = await apiSaveStaffProfile({ full_name: draft.full_name.trim(), phone: draft.phone.trim() });
      syncShell(p);
      setEditOpen(false);
      toast.success("Profile saved");
      await load();
    } catch (e) {
      setDraftError(memberError(e));
    } finally {
      setSaving(false);
    }
  }, [draft, load, syncShell, toast]);

  const savePhoto = useCallback(async (url: string | null) => {
    try {
      const p = await apiSaveStaffProfile({ avatar: url ?? "" });
      syncShell(p);
      toast.success(url ? "Photo saved" : "Photo removed");
      await load();
    } catch (e) {
      toast.error("Could not save the photo", { description: memberError(e) });
    }
  }, [load, syncShell, toast]);

  return (
    <div>
      {loadError && <Alert variant="danger" className="mb-4">{loadError}</Alert>}

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-11 w-11 items-center justify-center rounded-xl bg-brand-tint text-brand-ink">
            <UserCircle className="h-6 w-6" />
          </span>
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-ink">My profile</h1>
            <p className="mt-1 text-sm text-ink-subtle">Your name, photo and contact details, and what this account records about you.</p>
          </div>
        </div>
        <button className="btn btn-secondary" onClick={openEdit} disabled={!account}>
          <Pencil className="h-4 w-4" /> Edit profile
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16"><Spinner /></div>
      ) : account && (
        <>
          <Card>
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
              <div className="flex flex-col gap-6 sm:flex-row">
                <div className="flex shrink-0 flex-col items-center gap-3">
                  <ImageUpload
                    variant="avatar"
                    kind="avatar"
                    size="lg"
                    compact
                    name={account.full_name}
                    value={account.avatar || null}
                    onChange={(url) => void savePhoto(url)}
                  />
                  {account.avatar && (
                    <button className="text-xs font-semibold text-ink-subtle hover:text-status-danger-ink" onClick={() => void savePhoto(null)}>
                      Remove photo
                    </button>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <h2 className="font-display text-2xl font-bold text-ink">{account.full_name}</h2>
                    <Badge tone={account.role === "Super Admin" ? "violet" : "slate"}>{account.role}</Badge>
                    <Badge tone={account.is_active ? "emerald" : "rose"}>{account.is_active ? "Active" : "Suspended"}</Badge>
                  </div>
                  <div className="mt-3 space-y-1.5">
                    <p className="flex items-center gap-2 text-sm text-ink-muted">
                      <Mail className="h-4 w-4 text-ink-subtle" /> {account.email}
                    </p>
                    <p className="flex items-center gap-2 text-sm text-ink-muted">
                      <Phone className="h-4 w-4 text-ink-subtle" /> {account.phone || <span className="text-ink-subtle">No phone on file</span>}
                    </p>
                  </div>

                  <div className="mt-5 grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
                    <Fact label="Joined" value={formatWhen(account.created_at, false) || "Not recorded"} />
                    <Fact label="Last signed in" value={formatWhen(account.last_login_at) || "Not recorded"} />
                    <Fact label="Password last changed" value={formatWhen(account.password_changed_at) || "Not recorded"} />
                    <Fact label="Account id" value={<code className="text-xs">{account.id}</code>} />
                    <div className="sm:col-span-2">
                      <p className="text-xs text-ink-subtle">Can open ({account.modules.length} sections)</p>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {account.modules.length === 0
                          ? <span className="text-sm text-ink-subtle">Nothing yet — ask a Super Admin</span>
                          : account.modules.map((m) => (
                            <span key={m} className="rounded-full bg-surface-inset px-2.5 py-0.5 text-xs font-medium text-ink-muted">
                              {MODULE_LABEL[m] ?? m}
                            </span>
                          ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-line p-4">
                <h3 className="mb-3 font-display text-base font-semibold text-ink">Your settings</h3>
                <ul className="space-y-1">
                  {QUICK_LINKS.map((q) => (
                    <li key={q.label}>
                      <Link href={q.href} className="flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left hover:bg-surface-hover">
                        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-tint text-violet-ink">
                          <q.icon className="h-4 w-4" />
                        </span>
                        <span className="flex-1 text-sm font-medium text-ink-muted">{q.label}</span>
                        <ChevronRight className="h-4 w-4 text-ink-subtle" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </Card>

          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
            <Card>
              <h2 className="mb-4 font-display text-base font-semibold text-ink">Account summary</h2>
              <ul className="space-y-4">
                {[
                  { icon: Activity, tone: "bg-brand-tint text-brand-ink", label: "Audited actions", value: account.activity.total },
                  { icon: Activity, tone: "bg-violet-tint text-violet-ink", label: "Actions this month", value: account.activity.this_month },
                  { icon: Ticket, tone: "bg-status-warn-bg text-status-warn-ink", label: "Open support tickets", value: account.tickets_open },
                  { icon: ShieldCheck, tone: "bg-status-ok-bg text-status-ok-ink", label: "Sessions ended everywhere", value: account.token_version },
                ].map((s) => (
                  <li key={s.label} className="flex items-center gap-3">
                    <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${s.tone}`}>
                      <s.icon className="h-4.5 w-4.5" />
                    </span>
                    <span className="flex-1 text-sm text-ink-muted">{s.label}</span>
                    <span className="font-display text-base font-bold text-ink">{s.value.toLocaleString("en-IN")}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-xs text-ink-subtle">
                Actions are counted from the audit trail, which records every change staff make. Reads are not recorded.
              </p>
            </Card>

            <Card>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-display text-base font-semibold text-ink">Recent activity</h2>
                <Link href="/dashboard/settings/activity" className="text-xs font-semibold text-brand-ink hover:underline">
                  Full log
                </Link>
              </div>
              {activity.length === 0 ? (
                <p className="py-8 text-center text-sm text-ink-subtle">Nothing audited on this account yet.</p>
              ) : (
                <ul className="divide-y divide-line">
                  {activity.map((a) => (
                    <li key={a.id} className="flex items-start gap-3 py-3">
                      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-inset text-ink-subtle">
                        <Activity className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-ink-muted">{a.detail || a.action}</p>
                        <p className="text-xs text-ink-subtle">
                          {a.category}{a.target ? ` · ${a.target}` : ""}{a.ip ? ` · from ${a.ip}` : ""}
                        </p>
                      </div>
                      <span className="shrink-0 text-xs text-ink-subtle">{a.when}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </>
      )}

      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="Edit profile"
        description="Your name and phone. Your email is how you sign in, so it is not changed here."
        icon={Pencil}
        iconTone="brand"
        size="sm"
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setEditOpen(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={() => void saveEdit()} disabled={saving}>
              {saving ? "Saving…" : "Save changes"}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Full name"
            required
            icon={UserCircle}
            value={draft.full_name}
            onChange={(e) => setDraft({ ...draft, full_name: e.target.value })}
          />
          <Input
            label="Phone"
            icon={Phone}
            value={draft.phone}
            onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
          />
          <p className="text-xs text-ink-subtle">
            To change the email this account signs in with, ask a Super Admin — there is no self-service email change yet,
            because it needs a confirmation step that does not exist.
          </p>
          {draftError && <p className="text-sm font-medium text-status-danger-ink">{draftError}</p>}
        </div>
      </Modal>
    </div>
  );
}
