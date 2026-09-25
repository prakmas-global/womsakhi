"use client";

import { useCallback, useEffect, useState } from "react";
import { Bell, Send, Smartphone, MessageSquare, RotateCcw, Info, Moon, Clock, CalendarPlus, Clock3, Pencil, UserPlus, GraduationCap, CreditCard, TriangleAlert, Megaphone, ChevronDown } from "lucide-react";
import Link from "next/link";
import { Card, Menu, MenuItem, Select, StatCard, useToast } from "@/design-system";
import DonutChart from "@/components/charts/DonutChart";
import { apiSaveStaffNotificationPrefs, apiStaffNotificationPrefs } from "@/lib/staff-api";
import { memberError } from "@/lib/member-api";
import { ResizableColumns } from "@/layout-engine";
type Tone = "violet" | "emerald" | "amber" | "brand" | "sky" | "rose" | "slate";

const TONE_BG: Record<string, string> = {
  violet: "bg-violet-tint text-violet-ink",
  emerald: "bg-status-ok-bg text-status-ok-ink",
  amber: "bg-status-warn-bg text-status-warn-ink",
  brand: "bg-brand-tint text-brand-ink",
  sky: "bg-status-info-bg text-status-info-ink",
  rose: "bg-status-danger-bg text-status-danger-ink",
  slate: "bg-surface-inset text-ink-subtle",
};

type Channel = "email" | "sms" | "push" | "inApp";

type Row = {
  icon: React.ElementType;
  tone: Tone;
  title: string;
  desc: string;
  email: boolean;
  sms: boolean;
  push: boolean;
  inApp: boolean;
};

// Titles/descriptions and the on/off defaults now come from the server; these
// stay only as the icon + colour for each event key, which is presentation.
const ROW_STYLE: Record<string, { icon: React.ElementType; tone: Tone }> = {
  new_appointment: { icon: CalendarPlus, tone: "violet" },
  appointment_reminder: { icon: Clock3, tone: "emerald" },
  appointment_update: { icon: Pencil, tone: "amber" },
  new_member: { icon: UserPlus, tone: "sky" },
  enrollment: { icon: GraduationCap, tone: "emerald" },
  payment: { icon: CreditCard, tone: "amber" },
  safety_alert: { icon: TriangleAlert, tone: "rose" },
  support_fund: { icon: CreditCard, tone: "violet" },
  story_review: { icon: Megaphone, tone: "brand" },
  system: { icon: TriangleAlert, tone: "rose" },
};

const DEFAULT_ROWS: Row[] = [
  { icon: CalendarPlus, tone: "violet", title: "New Appointment", desc: "When a new appointment is created or booked.", email: true, sms: true, push: true, inApp: true },
  { icon: Clock3, tone: "emerald", title: "Appointment Reminders", desc: "Reminders before upcoming appointments.", email: true, sms: true, push: true, inApp: true },
  { icon: Pencil, tone: "amber", title: "Appointment Updates", desc: "Changes or updates to an existing appointment.", email: true, sms: false, push: true, inApp: true },
  { icon: UserPlus, tone: "sky", title: "New User Registration", desc: "When a new user registers on the platform.", email: true, sms: false, push: false, inApp: true },
  { icon: GraduationCap, tone: "emerald", title: "Program Enrollments", desc: "When a user enrolls in a program.", email: true, sms: false, push: true, inApp: true },
  { icon: CreditCard, tone: "amber", title: "Payment & Billing", desc: "Payment confirmations, invoices and failures.", email: true, sms: true, push: true, inApp: true },
  { icon: TriangleAlert, tone: "rose", title: "System Alerts", desc: "Important system updates and alerts.", email: true, sms: true, push: true, inApp: true },
  { icon: Megaphone, tone: "brand", title: "Marketing & Promotions", desc: "Offers, new features and promotional updates.", email: false, sms: false, push: true, inApp: false },
];

const OVERVIEW = [
  { name: "Email", value: 54.4, color: "var(--color-violet-500)" },
  { name: "SMS", value: 23.6, color: "var(--status-warn-solid)" },
  { name: "Push", value: 21.9, color: "var(--color-brand-600)" },
];

const RECENT: {
  icon: React.ElementType;
  tone: Tone;
  title: string;
  desc: string;
  when: string;
}[] = [
  { icon: Clock3, tone: "violet", title: "Appointment Reminder", desc: "Reminder for appointment tomorrow", when: "10:30 AM" },
  { icon: UserPlus, tone: "sky", title: "New User Registered", desc: "Sarah Johnson has joined", when: "09:15 AM" },
  { icon: CreditCard, tone: "amber", title: "Payment Successful", desc: "Payment of Rs.1,499 received", when: "Yesterday" },
  { icon: GraduationCap, tone: "emerald", title: "Program Enrollment", desc: "John Doe enrolled in Yoga Basics", when: "May 19" },
  { icon: TriangleAlert, tone: "rose", title: "System Maintenance", desc: "Scheduled maintenance on May 25", when: "May 18" },
];

const DEFAULT_DAYS: { label: string; active: boolean }[] = [
  { label: "Mon", active: true },
  { label: "Tue", active: true },
  { label: "Wed", active: true },
  { label: "Thu", active: true },
  { label: "Fri", active: true },
  { label: "Sat", active: false },
  { label: "Sun", active: false },
];

const TIME_OPTIONS = [
  "06:00 AM", "07:00 AM", "08:00 AM", "09:00 AM", "10:00 AM", "11:00 AM",
  "12:00 PM", "01:00 PM", "02:00 PM", "03:00 PM", "04:00 PM", "05:00 PM",
  "06:00 PM", "07:00 PM", "08:00 PM", "09:00 PM", "10:00 PM", "11:00 PM",
];

const PERIODS = ["This Month", "Last Month", "This Quarter", "This Year"];

/**
 * `label` is required, not optional.
 *
 * This control is a track and a knob — two empty spans — so it carries no text
 * of its own at all. Rendered 41 times on this screen, that is 41 controls
 * announcing "switch, on" with nothing to say WHICH setting is on. In the
 * matrix below they are worse than useless: four identical switches per row,
 * and the row's name lives in a different table cell.
 *
 * Requiring the label means the next one of these cannot be added without one.
 */
function Toggle({
  label,
  on,
  onClick,
  disabled = false,
}: {
  label: string;
  on: boolean;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex h-5 w-9 items-center rounded-full p-0.5 transition-colors ${
        on ? "bg-brand-600" : "bg-line"
      } ${disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
      role="switch"
      aria-checked={on}
    >
      <span
        className={`h-4 w-4 rounded-full bg-surface shadow-sm transition-transform ${
          on ? "translate-x-4" : "translate-x-0"
        }`}
      />
    </button>
  );
}

export default function NotificationsPage() {
  const toast = useToast();
  const [tab, setTab] = useState<"prefs" | "quiet">("prefs");
  const [rows, setRows] = useState<Row[]>([]);
  const [keys, setKeys] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);
  const [period, setPeriod] = useState("This Month");

  // Quiet Hours state
  const [days, setDays] = useState(DEFAULT_DAYS);
  const [fromTime, setFromTime] = useState("10:00 PM");
  const [toTime, setToTime] = useState("07:00 AM");
  const [quietOn, setQuietOn] = useState(false);

  // Load the saved preferences. The server owns the list of event types, so a
  // new one added there appears here without a frontend change.
  const load = useCallback(async () => {
    try {
      const prefs = await apiStaffNotificationPrefs();
      setKeys(prefs.rows.map((r) => r.key));
      setRows(
        prefs.rows.map((r) => ({
          icon: ROW_STYLE[r.key]?.icon ?? Megaphone,
          tone: ROW_STYLE[r.key]?.tone ?? "slate",
          title: r.title,
          desc: r.description,
          email: r.email,
          sms: r.sms,
          push: r.push,
          inApp: r.in_app,
        })),
      );
      setQuietOn(!!prefs.quiet_hours?.enabled);
      if (prefs.quiet_hours?.from) setFromTime(prefs.quiet_hours.from);
      if (prefs.quiet_hours?.to) setToTime(prefs.quiet_hours.to);
      setError("");
    } catch {
      // A failed LOAD, not a failed save. ConnectionBanner reports it at the
      // root and the screen keeps what it already had; a toast here would
      // greet her with "Could not save" for something she never pressed.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleChannel = (idx: number, ch: Channel) => {
    if (ch === "inApp") return; // in-app always enabled, cannot be disabled
    setRows((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, [ch]: !r[ch] } : r))
    );
  };

  const restoreDefaults = () => {
    setRows(DEFAULT_ROWS.map((r) => ({ ...r })));
  };

  const savePreferences = async () => {
    setWorking(true);
    setError("");
    try {
      await apiSaveStaffNotificationPrefs({
        rows: rows.map((r, i) => ({
          key: keys[i] ?? "",
          title: r.title,
          description: r.desc,
          email: r.email,
          sms: r.sms,
          push: r.push,
          in_app: r.inApp,
        })),
        quiet_hours: { enabled: quietOn, from: fromTime, to: toTime },
      });
      toast.success("Notification settings saved");
    } catch (err) {
      toast.error("Could not save", { description: memberError(err) });
    } finally {
      setWorking(false);
    }
  };

  const toggleDay = (idx: number) =>
    setDays((prev) =>
      prev.map((d, i) => (i === idx ? { ...d, active: !d.active } : d))
    );

  return (
    <div>
      <div className="mb-6 flex items-start gap-3">
        <span className="mt-0.5 flex h-11 w-11 items-center justify-center rounded-xl bg-brand-tint text-brand-ink">
          <Bell className="h-6 w-6" />
        </span>
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-ink">
            Notifications
          </h1>
          <p className="mt-1 text-sm text-ink-subtle">
            Manage how you receive updates and alerts from the platform.
          </p>
        </div>
      </div>

      {/* stat cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total Notifications Sent" value="12,458" icon={Bell} tone="violet" delta="18.6%" deltaDir="up" deltaNote="vs last month" />
        <StatCard label="Email Notifications" value="6,782" icon={Send} tone="emerald" delta="15.2%" deltaDir="up" deltaNote="vs last month" />
        <StatCard label="SMS Notifications" value="2,945" icon={Smartphone} tone="amber" delta="12.7%" deltaDir="up" deltaNote="vs last month" />
        <StatCard label="Push Notifications" value="2,731" icon={MessageSquare} tone="brand" delta="21.4%" deltaDir="up" deltaNote="vs last month" />
      </div>

      {/* main grid */}
      <ResizableColumns id="settings-notifications" defaultSize={0.74} className="mt-6 gap-6">
        {/* LEFT: preferences */}
        <Card>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
            <div className="flex items-center gap-6">
              <button
                onClick={() => setTab("prefs")}
                className={`relative pb-3 text-sm font-semibold ${
                  tab === "prefs"
                    ? "text-brand-ink"
                    : "text-ink-subtle hover:text-ink-muted"
                }`}
              >
                Notification Preferences
                {tab === "prefs" && (
                  <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-brand-600" />
                )}
              </button>
              <button
                onClick={() => setTab("quiet")}
                className={`relative pb-3 text-sm font-semibold ${
                  tab === "quiet"
                    ? "text-brand-ink"
                    : "text-ink-subtle hover:text-ink-muted"
                }`}
              >
                Quiet Hours
                {tab === "quiet" && (
                  <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-brand-600" />
                )}
              </button>
            </div>
          </div>

          {tab === "prefs" ? (
            <>
              <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-display text-base font-semibold text-ink">
                    Manage Notification Preferences
                  </h2>
                  <p className="mt-1 text-sm text-ink-subtle">
                    Choose the types of notifications you want to receive and how.
                  </p>
                </div>
                <button onClick={restoreDefaults} className="btn btn-secondary">
                  <RotateCcw className="h-4 w-4" /> Restore Defaults
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-line text-2xs font-semibold uppercase tracking-wide text-ink-subtle">
                      <th scope="col" className="px-2 py-3">Notification Type</th>
                      <th scope="col" className="px-2 py-3 text-center">Email</th>
                      <th scope="col" className="px-2 py-3 text-center">SMS</th>
                      <th scope="col" className="px-2 py-3 text-center">Push</th>
                      <th scope="col" className="px-2 py-3 text-center">In-App</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {rows.map((r, idx) => (
                      <tr key={r.title} className="hover:bg-surface-hover/60">
                        <td className="px-2 py-4">
                          <div className="flex items-center gap-3">
                            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${TONE_BG[r.tone]}`}>
                              <r.icon className="h-4.5 w-4.5" />
                            </span>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-ink">{r.title}</p>
                              <p className="text-xs text-ink-subtle">{r.desc}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-2 py-4 text-center"><Toggle label={`${r.title} — email`} on={r.email} onClick={() => toggleChannel(idx, "email")} /></td>
                        <td className="px-2 py-4 text-center"><Toggle label={`${r.title} — SMS`} on={r.sms} onClick={() => toggleChannel(idx, "sms")} /></td>
                        <td className="px-2 py-4 text-center"><Toggle label={`${r.title} — push`} on={r.push} onClick={() => toggleChannel(idx, "push")} /></td>
                        <td className="px-2 py-4 text-center"><Toggle label={`${r.title} — in-app`} on={r.inApp} disabled /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-5 flex items-center gap-2 text-xs text-ink-subtle">
                <Info className="h-4 w-4 shrink-0" />
                In-app notifications are always enabled and cannot be disabled.
              </div>

              <div className="mt-5 flex items-center justify-end gap-3 border-t border-line pt-4">
                <button onClick={savePreferences} className="btn btn-primary">
                  Save Preferences
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="mb-3 flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-tint text-violet-ink">
                  <Moon className="h-4 w-4" />
                </span>
                <h2 className="font-display text-base font-semibold text-ink">Quiet Hours</h2>
              </div>
              <p className="text-sm text-ink-subtle">
                Pause non-urgent notifications during specific hours.
              </p>

              <div className="mt-4 flex items-center gap-2">
                <Select
                  className="flex-1"
                  options={TIME_OPTIONS}
                  value={fromTime}
                  onChange={(e) => setFromTime(e.target.value)}
                />
                <span className="text-sm text-ink-subtle">to</span>
                <Select
                  className="flex-1"
                  options={TIME_OPTIONS}
                  value={toTime}
                  onChange={(e) => setToTime(e.target.value)}
                />
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {days.map((d, i) => (
                  <button
                    key={d.label}
                    onClick={() => toggleDay(i)}
                    className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                      d.active
                        ? "bg-brand-tint text-brand-ink"
                        : "bg-surface-inset text-ink-subtle hover:bg-line"
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>

              <div className="mt-5 flex items-center justify-between border-t border-line pt-4">
                <span className="text-sm font-medium text-ink-muted">Enable Quiet Hours</span>
                <Toggle label="Enable Quiet Hours" on={quietOn} onClick={() => setQuietOn((v) => !v)} />
              </div>
            </>
          )}
        </Card>

        {/* RIGHT: side column */}
        <div className="space-y-6">
          {/* Notification Overview */}
          <Card>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-base font-semibold text-ink">
                Notification Overview
              </h2>
              <Menu
                align="right"
                width="min-w-[10rem]"
                trigger={
                  <button className="btn btn-sm btn-outline">
                    {period} <ChevronDown className="h-3.5 w-3.5 text-ink-subtle" />
                  </button>
                }
              >
                {PERIODS.map((p) => (
                  <MenuItem key={p} onClick={() => setPeriod(p)}>
                    {p}
                  </MenuItem>
                ))}
              </Menu>
            </div>
            <div className="flex items-center gap-4">
              <DonutChart data={OVERVIEW} centerValue="12,458" centerLabel="Total Sent" size={140} thickness={18} />
              <ul className="flex-1 space-y-3">
                {OVERVIEW.map((o) => (
                  <li key={o.name} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 text-ink-muted">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: o.color }} />
                      {o.name}
                    </span>
                    <span className="font-semibold text-ink-subtle">{o.value}%</span>
                  </li>
                ))}
              </ul>
            </div>
          </Card>

          {/* Recent Notifications */}
          <Card>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-base font-semibold text-ink">
                Recent Notifications
              </h2>
              <Link
                href="/dashboard/settings/notifications"
                className="text-xs font-semibold text-brand-ink transition hover:underline"
              >
                View All
              </Link>
            </div>
            <ul className="space-y-4">
              {RECENT.map((n) => (
                <li key={n.title} className="flex items-start gap-3">
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${TONE_BG[n.tone]}`}>
                    <n.icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-ink">{n.title}</p>
                    <p className="truncate text-xs text-ink-subtle">{n.desc}</p>
                  </div>
                  <span className="shrink-0 text-xs text-ink-subtle">{n.when}</span>
                </li>
              ))}
            </ul>
          </Card>

          {/* Quiet Hours */}
          <Card>
            <div className="mb-3 flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-tint text-violet-ink">
                <Moon className="h-4 w-4" />
              </span>
              <h2 className="font-display text-base font-semibold text-ink">Quiet Hours</h2>
            </div>
            <p className="text-sm text-ink-subtle">
              Pause non-urgent notifications during specific hours.
            </p>

            <div className="mt-4 flex items-center gap-2">
              <div className="relative flex-1">
                <input aria-label="Quiet hours start"
                  readOnly
                  value={fromTime}
                  className="w-full rounded-lg border border-line-strong py-2 pl-3 pr-8 text-sm text-ink-muted outline-none"
                />
                <Clock className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
              </div>
              <span className="text-sm text-ink-subtle">to</span>
              <div className="relative flex-1">
                <input aria-label="Quiet hours end"
                  readOnly
                  value={toTime}
                  className="w-full rounded-lg border border-line-strong py-2 pl-3 pr-8 text-sm text-ink-muted outline-none"
                />
                <Clock className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {days.map((d, i) => (
                <button
                  key={d.label}
                  onClick={() => toggleDay(i)}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                    d.active
                      ? "bg-brand-tint text-brand-ink"
                      : "bg-surface-inset text-ink-subtle hover:bg-line"
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>

            <div className="mt-5 flex items-center justify-between border-t border-line pt-4">
              <span className="text-sm font-medium text-ink-muted">Enable Quiet Hours</span>
              <Toggle label="Enable Quiet Hours" on={quietOn} onClick={() => setQuietOn((v) => !v)} />
            </div>
          </Card>
        </div>
      </ResizableColumns>
    </div>
  );
}
