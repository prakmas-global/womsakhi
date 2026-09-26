"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bell, CalendarPlus, Clock3, CreditCard, GraduationCap, HandCoins, Info, Megaphone, Moon,
  Pencil, RotateCcw, TriangleAlert, UserPlus,
} from "lucide-react";
import { Alert, Card, Select, Spinner, Switch, useToast } from "@/design-system";
import {
  apiNotificationDefaults, apiSaveStaffNotificationPrefs, apiStaffNotificationPrefs,
  type NotificationRow,
} from "@/lib/staff-api";
import { memberError } from "@/lib/member-api";
import { ResizableColumns } from "@/layout-engine";

/**
 * Notification preferences, for the signed-in staff member.
 *
 * ── What was here before ────────────────────────────────────────────────────
 * "12,458 notifications sent, up 18.6%", a donut of channel shares, five
 * fixed "recent notifications", a Restore Defaults that swapped in a stale
 * eight-row list which the Save then mis-keyed against the server's ten
 * events, and day-of-week buttons that were never stored.
 *
 * ── What is here now ────────────────────────────────────────────────────────
 * The matrix, read from and saved to the account. Defaults come from the
 * server, so restoring them cannot drift. And the fact, stated at the top,
 * that nothing sends staff notifications by email, SMS or push yet — these
 * choices are stored, not applied. A screen that let you switch on SMS
 * alerts and said nothing would be promising something that does not exist.
 */

type Tone = "violet" | "emerald" | "amber" | "brand" | "sky" | "rose" | "slate";

const TONE_BG: Record<Tone, string> = {
  violet: "bg-violet-tint text-violet-ink",
  emerald: "bg-status-ok-bg text-status-ok-ink",
  amber: "bg-status-warn-bg text-status-warn-ink",
  brand: "bg-brand-tint text-brand-ink",
  sky: "bg-status-info-bg text-status-info-ink",
  rose: "bg-status-danger-bg text-status-danger-ink",
  slate: "bg-surface-inset text-ink-subtle",
};

// Presentation only: the titles, descriptions and defaults come from the server.
const ROW_STYLE: Record<string, { icon: React.ElementType; tone: Tone }> = {
  new_appointment: { icon: CalendarPlus, tone: "violet" },
  appointment_reminder: { icon: Clock3, tone: "emerald" },
  appointment_update: { icon: Pencil, tone: "amber" },
  new_member: { icon: UserPlus, tone: "sky" },
  enrollment: { icon: GraduationCap, tone: "emerald" },
  payment: { icon: CreditCard, tone: "amber" },
  safety_alert: { icon: TriangleAlert, tone: "rose" },
  support_fund: { icon: HandCoins, tone: "violet" },
  story_review: { icon: Megaphone, tone: "brand" },
  system: { icon: TriangleAlert, tone: "rose" },
};

type Channel = "email" | "sms" | "push";
const CHANNELS: { key: Channel; label: string }[] = [
  { key: "email", label: "Email" },
  { key: "sms", label: "SMS" },
  { key: "push", label: "Push" },
];

const HOURS = Array.from({ length: 24 }, (_, h) => `${String(h).padStart(2, "0")}:00`);

type Quiet = { enabled: boolean; from: string; to: string };

/** What "unsaved changes" is judged against. */
const snapshot = (r: NotificationRow[], q: Quiet) => JSON.stringify({ r, q });

function Toggle({ label, on, onClick, disabled = false }: { label: string; on: boolean; onClick?: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      role="switch"
      aria-checked={on}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex h-5 w-9 items-center rounded-full p-0.5 transition-colors ${on ? "bg-brand-600" : "bg-line"} ${
        disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"
      }`}
    >
      <span className={`h-4 w-4 rounded-full bg-surface shadow-sm transition-transform ${on ? "translate-x-4" : "translate-x-0"}`} />
    </button>
  );
}

export default function NotificationsPage() {
  const toast = useToast();
  const [rows, setRows] = useState<NotificationRow[]>([]);
  const [saved, setSaved] = useState<string>("");
  const [quiet, setQuiet] = useState<Quiet>({ enabled: false, from: "22:00", to: "07:00" });
  const [defaults, setDefaults] = useState<{ rows: NotificationRow[]; quiet: Quiet; note: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  // One wave on mount, the way the reference screen does it: state is set only
  // after the request answers, never synchronously in the effect body.
  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const [prefs, defs] = await Promise.all([apiStaffNotificationPrefs(), apiNotificationDefaults()]);
        if (!alive) return;
        const q: Quiet = {
          enabled: !!prefs.quiet_hours?.enabled,
          from: prefs.quiet_hours?.from || "22:00",
          to: prefs.quiet_hours?.to || "07:00",
        };
        setRows(prefs.rows);
        setQuiet(q);
        setSaved(snapshot(prefs.rows, q));
        setDefaults({ rows: defs.rows, quiet: defs.quiet_hours, note: defs.applied_note });
        setError("");
      } catch (e) {
        if (alive) setError(memberError(e));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  const dirty = useMemo(() => snapshot(rows, quiet) !== saved, [rows, quiet, saved]);

  const toggle = (key: string, ch: Channel) =>
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, [ch]: !r[ch] } : r)));

  const restoreDefaults = () => {
    if (!defaults) return;
    setRows(defaults.rows.map((r) => ({ ...r })));
    setQuiet({ ...defaults.quiet });
  };

  const save = useCallback(async () => {
    setSaving(true);
    try {
      const res = await apiSaveStaffNotificationPrefs({ rows, quiet_hours: quiet });
      setRows(res.rows);
      setSaved(snapshot(res.rows, quiet));
      toast.success("Preferences saved", { description: "Stored on your account. They apply once staff notifications are sent by channel." });
    } catch (e) {
      toast.error("Could not save", { description: memberError(e) });
    } finally {
      setSaving(false);
    }
  }, [quiet, rows, toast]);

  const onCount = rows.reduce((n, r) => n + Number(r.email) + Number(r.sms) + Number(r.push), 0);

  return (
    <div>
      <div className="mb-6 flex items-start gap-3">
        <span className="mt-0.5 flex h-11 w-11 items-center justify-center rounded-xl bg-brand-tint text-brand-ink">
          <Bell className="h-6 w-6" />
        </span>
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-ink">Notifications</h1>
          <p className="mt-1 text-sm text-ink-subtle">Which events you want to hear about, and on which channel.</p>
        </div>
      </div>

      {error && <Alert variant="danger" className="mb-4">{error}</Alert>}
      {defaults && <Alert variant="warning" className="mb-6" title="Stored, not applied yet">{defaults.note}</Alert>}

      {loading ? (
        <div className="flex items-center justify-center py-16"><Spinner /></div>
      ) : (
        <ResizableColumns id="settings-notifications" defaultSize={0.7} className="gap-6">
          <Card>
            <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-base font-semibold text-ink">Events and channels</h2>
                <p className="mt-1 text-sm text-ink-subtle">
                  {onCount} channel switch{onCount === 1 ? "" : "es"} on across {rows.length} events. In-app notices are always on.
                </p>
              </div>
              <button onClick={restoreDefaults} className="btn btn-secondary" disabled={!defaults}>
                <RotateCcw className="h-4 w-4" /> Restore defaults
              </button>
            </div>

            {rows.length === 0 ? (
              <p className="py-8 text-center text-sm text-ink-subtle">No notification events are defined.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-line text-2xs font-semibold uppercase tracking-wide text-ink-subtle">
                      <th scope="col" className="px-2 py-3">Event</th>
                      {CHANNELS.map((c) => <th key={c.key} scope="col" className="px-2 py-3 text-center">{c.label}</th>)}
                      <th scope="col" className="px-2 py-3 text-center">In-app</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {rows.map((r) => {
                      const style = ROW_STYLE[r.key] ?? { icon: Bell, tone: "slate" as Tone };
                      return (
                        <tr key={r.key} className="hover:bg-surface-hover/60">
                          <td className="px-2 py-4">
                            <div className="flex items-center gap-3">
                              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${TONE_BG[style.tone]}`}>
                                <style.icon className="h-4.5 w-4.5" />
                              </span>
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-ink">{r.title}</p>
                                <p className="text-xs text-ink-subtle">{r.description}</p>
                              </div>
                            </div>
                          </td>
                          {CHANNELS.map((c) => (
                            <td key={c.key} className="px-2 py-4 text-center">
                              <Toggle label={`${r.title} — ${c.label}`} on={r[c.key]} onClick={() => toggle(r.key, c.key)} />
                            </td>
                          ))}
                          <td className="px-2 py-4 text-center">
                            <Toggle label={`${r.title} — in-app (always on)`} on disabled />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
              <p className="flex items-center gap-2 text-xs text-ink-subtle">
                <Info className="h-4 w-4 shrink-0" /> In-app notices cannot be switched off — they are the one channel that exists today.
              </p>
              <button onClick={() => void save()} className="btn btn-primary" disabled={saving || !dirty}>
                {saving ? "Saving…" : dirty ? "Save preferences" : "Saved"}
              </button>
            </div>
          </Card>

          <div className="space-y-6">
            <Card>
              <div className="mb-3 flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-tint text-violet-ink">
                  <Moon className="h-4 w-4" />
                </span>
                <h2 className="font-display text-base font-semibold text-ink">Quiet hours</h2>
              </div>
              <p className="text-sm text-ink-subtle">Hold non-urgent notifications between these times. Stored with the rest; saved with the same button.</p>
              <div className="mt-4">
                <Switch
                  label="Quiet hours"
                  description={quiet.enabled ? `${quiet.from} to ${quiet.to}` : "Off"}
                  checked={quiet.enabled}
                  onChange={(v) => setQuiet((q) => ({ ...q, enabled: v }))}
                />
              </div>
              <div className="mt-4 flex items-center gap-2">
                <Select label="From" className="flex-1" options={HOURS} value={quiet.from} onChange={(e) => setQuiet((q) => ({ ...q, from: e.target.value }))} />
                <Select label="To" className="flex-1" options={HOURS} value={quiet.to} onChange={(e) => setQuiet((q) => ({ ...q, to: e.target.value }))} />
              </div>
            </Card>

            <Card>
              <h3 className="text-sm font-semibold text-ink">What exists today</h3>
              <ul className="mt-2 space-y-2 text-xs leading-relaxed text-ink-muted">
                <li>In-app notices are written to your account when something happens that concerns you.</li>
                <li>Email, SMS and push for staff are not sent by anything yet. The switches above are kept so that when a sender exists it starts from your choices, not ours.</li>
                <li>Quiet hours are stored the same way and will be honoured by the same sender.</li>
              </ul>
            </Card>
          </div>
        </ResizableColumns>
      )}
    </div>
  );
}
