"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity, Bell, Building2, ChevronRight, Clock, Database, FileClock, HelpCircle, KeyRound, LogOut,
  MonitorSmartphone, Palette, RefreshCw, Settings as SettingsIcon, ShieldCheck, UserCircle, UserCog, Users,
} from "lucide-react";
import Link from "next/link";
import { Alert, Badge, Card, Input, Select, Spinner, StatCard, Switch, Textarea, useToast } from "@/design-system";
import { useAuth } from "@/context/AuthContext";
import {
  apiMyAccount, apiPlatformSettings, apiSavePlatformSettings, apiSystemHealth, formatWhen,
  type MyAccount, type PlatformSettings, type SystemHealthItem,
} from "@/lib/staff-api";
import { apiMyPermissions } from "@/lib/permissions-api";
import { memberError } from "@/lib/member-api";
import { LOCALES } from "@/i18n/locales";
import { ResizableColumns } from "@/layout-engine";

/**
 * Settings — the hub.
 *
 * ── What was here before ────────────────────────────────────────────────────
 * "12,845 active users", "24.6 GB of 100 GB", "Local time 10:30 AM", six
 * services all "Operational" with no check behind any of them, a Clear
 * Cache and a Reset Platform that closed their own dialogs, a logo upload
 * that uploaded nothing, and Time Format / Language rows whose Save ticked
 * "Saved" without sending a request.
 *
 * ── What is here now ────────────────────────────────────────────────────────
 * Your own account, with the facts it records and the way to each of its
 * screens. The platform's configuration, saved as one form to the real
 * endpoint — with the behaviour flags labelled for what they are: stored,
 * read by nothing yet. And the system status from the real health checks,
 * which say "degraded" when something is not configured.
 */

const TIMEZONES = [
  "Asia/Kolkata (GMT+5:30)", "UTC (GMT+0:00)", "Asia/Dubai (GMT+4:00)", "Asia/Singapore (GMT+8:00)",
  "Europe/London (GMT+0:00)", "America/New_York (GMT-5:00)", "Australia/Sydney (GMT+11:00)",
];
const DATE_FORMATS = ["DD/MM/YYYY", "DD MMM YYYY", "MM/DD/YYYY", "YYYY-MM-DD"];

const HEALTH_TONE: Record<SystemHealthItem["status"], "emerald" | "amber" | "rose"> = {
  ok: "emerald", degraded: "amber", down: "rose",
};
const HEALTH_LABEL: Record<SystemHealthItem["status"], string> = {
  ok: "OK", degraded: "Degraded", down: "Down",
};

type Form = Omit<PlatformSettings, "updated_at">;

function toForm(s: PlatformSettings): Form {
  const rest: Partial<PlatformSettings> = { ...s };
  delete rest.updated_at;
  return rest as Form;
}

export default function SettingsPage() {
  const toast = useToast();
  const { isSuperAdmin } = useAuth();

  const [account, setAccount] = useState<MyAccount | null>(null);
  const [settings, setSettings] = useState<PlatformSettings | null>(null);
  const [settingsError, setSettingsError] = useState("");
  const [form, setForm] = useState<Form | null>(null);
  const [health, setHealth] = useState<SystemHealthItem[] | null>(null);
  const [healthAt, setHealthAt] = useState<Date | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState(false);

  const loadHealth = useCallback(async () => {
    setChecking(true);
    try {
      setHealth(await apiSystemHealth());
      setHealthAt(new Date());
    } catch {
      setHealth(null);
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const [acc, plat, perms, hl] = await Promise.allSettled([
        apiMyAccount(), apiPlatformSettings(), apiMyPermissions(), apiSystemHealth(),
      ]);
      if (!alive) return;
      if (acc.status === "fulfilled") setAccount(acc.value);
      else toast.error("Could not load your account", { description: memberError(acc.reason) });
      if (plat.status === "fulfilled") { setSettings(plat.value); setForm(toForm(plat.value)); }
      else setSettingsError(memberError(plat.reason));
      setCanEdit(isSuperAdmin || (perms.status === "fulfilled" && perms.value.permissions.includes("settings.edit")));
      if (hl.status === "fulfilled") { setHealth(hl.value); setHealthAt(new Date()); }
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [isSuperAdmin, toast]);

  const changes = useMemo(() => {
    if (!form || !settings) return {} as Partial<Form>;
    const out: Partial<Form> = {};
    (Object.keys(form) as (keyof Form)[]).forEach((k) => {
      if (form[k] !== settings[k]) (out as Record<string, unknown>)[k] = form[k];
    });
    return out;
  }, [form, settings]);
  const dirty = Object.keys(changes).length > 0;

  const set = <K extends keyof Form>(key: K, value: Form[K]) =>
    setForm((f) => (f ? { ...f, [key]: value } : f));

  const save = useCallback(async () => {
    if (!dirty) return;
    setSaving(true);
    try {
      const saved = await apiSavePlatformSettings(changes);
      setSettings(saved);
      setForm(toForm(saved));
      toast.success("Platform settings saved", { description: `Changed ${Object.keys(changes).join(", ")}` });
    } catch (e) {
      toast.error("Could not save", { description: memberError(e) });
    } finally {
      setSaving(false);
    }
  }, [changes, dirty, toast]);

  const dateFormats = form && !DATE_FORMATS.includes(form.date_format) && form.date_format
    ? [form.date_format, ...DATE_FORMATS] : DATE_FORMATS;
  const timezones = form && !TIMEZONES.includes(form.timezone) && form.timezone
    ? [form.timezone, ...TIMEZONES] : TIMEZONES;
  const localeOptions = LOCALES.map((l) => ({ value: l.code, label: `${l.name} (${l.nativeName})` }));

  const tiles: { icon: React.ElementType; label: string; href: string; fact: string }[] = account ? [
    { icon: UserCircle, label: "My profile", href: "/dashboard/settings/profile", fact: `${account.full_name} · ${account.role}` },
    { icon: ShieldCheck, label: "Security", href: "/dashboard/settings/security", fact: account.password_changed_at ? `Password changed ${formatWhen(account.password_changed_at, false)}` : "Password change date not recorded" },
    { icon: MonitorSmartphone, label: "Sessions", href: "/dashboard/settings/sessions", fact: account.this_session.started_at ? `This one started ${formatWhen(account.this_session.started_at)}` : "Sign out everywhere lives here" },
    { icon: Bell, label: "Notifications", href: "/dashboard/settings/notifications", fact: account.prefs_applied ? "Applied" : "Stored, not applied yet" },
    { icon: Palette, label: "Appearance", href: "/dashboard/settings/appearance", fact: "Colours and language, saved to your account" },
    { icon: UserCog, label: "Your role", href: "/dashboard/settings/switch-role", fact: `${account.role} · opens ${account.modules.length} sections` },
    { icon: HelpCircle, label: "Help", href: "/dashboard/settings/help", fact: account.tickets_open > 0 ? `${account.tickets_open} open ticket${account.tickets_open === 1 ? "" : "s"}` : "How things are done here" },
    { icon: LogOut, label: "Log out", href: "/dashboard/logout", fact: "This device, or everywhere" },
  ] : [];

  return (
    <div>
      <div className="mb-6 flex items-start gap-3">
        <span className="mt-0.5 flex h-11 w-11 items-center justify-center rounded-xl bg-brand-tint text-brand-ink">
          <SettingsIcon className="h-6 w-6" />
        </span>
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-ink">Settings</h1>
          <p className="mt-1 text-sm text-ink-subtle">Your account, and the platform you run.</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16"><Spinner /></div>
      ) : (
        <>
          {account && (
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <StatCard label="Signed in as" value={account.full_name} icon={Users} tone="brand" valueClassName="text-lg" deltaNote={account.role} />
              <StatCard label="Last signed in" value={formatWhen(account.last_login_at) || "Not recorded"} icon={Clock} tone="amber" valueClassName="text-lg" deltaNote="Most recent successful sign-in" />
              <StatCard label="Sessions ended everywhere" value={String(account.token_version)} icon={ShieldCheck} tone="emerald" deltaNote={account.sessions_ended_at ? `Last ${formatWhen(account.sessions_ended_at, false)}` : "Never, on this account"} />
              <StatCard label="Actions this month" value={account.activity.this_month.toLocaleString("en-IN")} icon={Activity} tone="violet" deltaNote={`${account.activity.total.toLocaleString("en-IN")} audited in all`} />
            </div>
          )}

          {tiles.length > 0 && (
            <Card className="mt-6">
              <h2 className="font-display text-base font-semibold text-ink">Your account</h2>
              <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
                {tiles.map((t) => (
                  <Link key={t.href} href={t.href} className="flex items-center gap-3 rounded-xl border border-line p-3 transition hover:bg-surface-hover">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-tint text-violet-ink">
                      <t.icon className="h-4.5 w-4.5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-ink">{t.label}</p>
                      <p className="truncate text-xs text-ink-subtle" title={t.fact}>{t.fact}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-ink-faint" />
                  </Link>
                ))}
              </div>
            </Card>
          )}

          <ResizableColumns id="settings" defaultSize={0.68} className="mt-6 gap-6">
            <Card>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-display text-base font-semibold text-ink">Platform</h2>
                  <p className="mt-1 text-sm text-ink-subtle">
                    The organisation&apos;s identity and regional defaults.{settings?.updated_at ? ` Last saved ${formatWhen(settings.updated_at)}.` : ""}
                  </p>
                </div>
                {settings && (
                  <button className="btn btn-primary" onClick={() => void save()} disabled={!canEdit || !dirty || saving}>
                    {saving ? "Saving…" : dirty ? "Save changes" : "Saved"}
                  </button>
                )}
              </div>

              {settingsError ? (
                <Alert variant="warning" className="mt-4">{settingsError}</Alert>
              ) : form && (
                <>
                  {!canEdit && (
                    <Alert variant="info" className="mt-4">
                      You can read these, but changing them needs the settings “edit” permission.
                    </Alert>
                  )}
                  <fieldset disabled={!canEdit} className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Input label="Organisation name" required icon={Building2} value={form.org_name} onChange={(e) => set("org_name", e.target.value)} />
                    <Input label="Tagline" value={form.tagline} onChange={(e) => set("tagline", e.target.value)} />
                    <Input label="Support email" type="email" value={form.support_email} onChange={(e) => set("support_email", e.target.value)}
                           hint="Shown to staff on the Help screen." />
                    <Input label="Support phone" value={form.support_phone} onChange={(e) => set("support_phone", e.target.value)} />
                    <Input label="Website" className="sm:col-span-2" value={form.website} onChange={(e) => set("website", e.target.value)} />
                    <Select label="Time zone" options={timezones} value={form.timezone} onChange={(e) => set("timezone", e.target.value)} />
                    <Select label="Date format" options={dateFormats} value={form.date_format} onChange={(e) => set("date_format", e.target.value)} />
                    <Select label="Default language for new accounts" className="sm:col-span-2" options={localeOptions} value={form.default_locale} onChange={(e) => set("default_locale", e.target.value)} />
                  </fieldset>

                  <div className="mt-6 border-t border-line pt-5">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-semibold text-ink">Behaviour</h3>
                      <Badge tone="amber">Stored, not enforced yet</Badge>
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-ink-subtle">
                      These are saved to the platform record, but no part of the server reads them yet — sign-up, admission and
                      session length behave the same whatever is set here. They are kept so the switches start from your
                      choices once something enforces them.
                    </p>
                    <fieldset disabled={!canEdit} className="mt-4 space-y-3">
                      <Switch label="Allow public sign-ups" description="Whether the member sign-up form accepts new accounts." checked={form.allow_signups} onChange={(v) => set("allow_signups", v)} />
                      <Switch label="Require an identity document" description="Whether a member must upload a document before admission." checked={form.require_document_verification} onChange={(v) => set("require_document_verification", v)} />
                      <Switch label="Admit members automatically" description="Skip the human approval step." checked={form.auto_approve_members} onChange={(v) => set("auto_approve_members", v)} />
                      <Switch label="Maintenance mode" description="Show members a notice instead of the app." checked={form.maintenance_mode} onChange={(v) => set("maintenance_mode", v)} />
                      {form.maintenance_mode && (
                        <Textarea label="Maintenance notice" rows={2} value={form.maintenance_message} onChange={(e) => set("maintenance_message", e.target.value)} />
                      )}
                      <Input label="Session timeout (minutes)" type="number" min={5} max={1440} value={String(form.session_timeout_minutes)}
                             onChange={(e) => set("session_timeout_minutes", Number(e.target.value) || 0)}
                             hint="Sessions actually last 30 minutes of inactivity, set by the server's configuration, not by this." />
                    </fieldset>
                  </div>
                </>
              )}
            </Card>

            <div className="space-y-6">
              <Card>
                <div className="mb-4 flex items-center justify-between gap-2">
                  <div>
                    <h2 className="font-display text-base font-semibold text-ink">System status</h2>
                    <p className="text-xs text-ink-subtle">{healthAt ? `Checked ${formatWhen(healthAt.toISOString())}` : "Checking…"}</p>
                  </div>
                  <button className="btn btn-sm btn-outline" onClick={() => void loadHealth()} disabled={checking} aria-label="Check again">
                    <RefreshCw className={`h-3.5 w-3.5 ${checking ? "animate-spin" : ""}`} />
                  </button>
                </div>
                {health === null ? (
                  <p className="text-sm text-ink-subtle">{checking ? "Running the checks…" : "The health checks could not be read."}</p>
                ) : (
                  <ul className="space-y-3">
                    {health.map((h) => (
                      <li key={h.name} className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-ink-muted">{h.name}</p>
                          <p className="truncate text-xs text-ink-subtle" title={h.detail}>{h.detail}</p>
                        </div>
                        <Badge tone={HEALTH_TONE[h.status] ?? "slate"}>{HEALTH_LABEL[h.status] ?? h.status}</Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>

              <Card>
                <h2 className="mb-3 font-display text-base font-semibold text-ink">Elsewhere in settings</h2>
                <ul className="space-y-1">
                  {[
                    { icon: UserCog, label: "Staff and roles", href: "/dashboard/staff" },
                    { icon: KeyRound, label: "Roles & permissions", href: "/dashboard/settings/roles" },
                    { icon: FileClock, label: "System logs", href: "/dashboard/settings/logs" },
                    { icon: Activity, label: "Activity log", href: "/dashboard/settings/activity" },
                    { icon: Database, label: "Backup & restore", href: "/dashboard/settings/backup" },
                  ].map((l) => (
                    <li key={l.href}>
                      <Link href={l.href} className="flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left hover:bg-surface-hover">
                        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-inset text-ink-subtle">
                          <l.icon className="h-4 w-4" />
                        </span>
                        <span className="flex-1 text-sm font-medium text-ink-muted">{l.label}</span>
                        <ChevronRight className="h-4 w-4 text-ink-faint" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </Card>
            </div>
          </ResizableColumns>
        </>
      )}
    </div>
  );
}
