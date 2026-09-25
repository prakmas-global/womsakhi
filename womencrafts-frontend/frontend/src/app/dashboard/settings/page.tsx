"use client";

import { useCallback, useEffect, useState } from "react";
import { Settings as SettingsIcon, CalendarDays, ChevronDown, Building2, Mail, Globe, Users, PieChart, DatabaseBackup, Tag, ImageIcon, Star, Phone, Clock, Languages, Trash2, CheckCircle2, ChevronRight, Eraser, FileClock, KeyRound, Info, Database, Server, HardDrive, Mailbox, MessageSquare, AlertTriangle, Check, UploadCloud } from "lucide-react";
import { Badge, Card, Input, Menu, MenuItem, Modal, ThemeSelect, useToast, Alert } from "@/design-system";
import Link from "next/link";
import { apiPlatformSettings, apiSavePlatformSettings } from "@/lib/staff-api";
import { memberError } from "@/lib/member-api";
import { ResizableColumns } from "@/layout-engine";

const TONE_BG: Record<string, string> = {
  brand: "bg-brand-tint text-brand-ink",
  violet: "bg-violet-tint text-violet-ink",
  emerald: "bg-status-ok-bg text-status-ok-ink",
  amber: "bg-status-warn-bg text-status-warn-ink",
  sky: "bg-status-info-bg text-status-info-ink",
};

const SYSTEM = [
  { name: "Database", icon: Database },
  { name: "Server", icon: Server },
  { name: "Storage", icon: HardDrive },
  { name: "Email Service", icon: Mailbox },
  { name: "SMS Gateway", icon: MessageSquare },
  { name: "Backup Service", icon: DatabaseBackup },
];

const DATE_RANGES = ["Today", "Last 7 Days", "Last 30 Days", "This Month", "This Year"];

const TIMEZONE_OPTIONS = [
  "Asia/Kolkata (GMT+5:30)",
  "UTC (GMT+0:00)",
  "America/New_York (GMT-5:00)",
  "Europe/London (GMT+0:00)",
  "Asia/Dubai (GMT+4:00)",
  "Asia/Singapore (GMT+8:00)",
  "Australia/Sydney (GMT+11:00)",
];

const DATE_FORMAT_OPTIONS = [
  "May 20, 2024 (MMM DD, YYYY)",
  "20 May 2024 (DD MMM YYYY)",
  "05/20/2024 (MM/DD/YYYY)",
  "20/05/2024 (DD/MM/YYYY)",
  "2024-05-20 (YYYY-MM-DD)",
];

const LANGUAGE_OPTIONS = [
  "English (US)",
  "English (UK)",
  "Hindi",
  "Marathi",
  "Tamil",
  "Bengali",
  "French",
  "Spanish",
];

/**
 * Controlled inline text input matching the original neutral display styling.
 *
 * `label` is required rather than optional: the visible heading lives in the
 * surrounding SettingRow, so without it this control announces nothing at all —
 * a row of five identical "edit text, blank" fields. Making it required means
 * the next one of these cannot be added without a name.
 */
function InputField({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <input
      type={type}
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-lg border border-line-strong bg-surface px-3.5 py-2.5 text-sm text-ink-muted outline-none focus:border-brand-300 focus:ring-4 focus:ring-brand-50"
    />
  );
}

/** Inline dropdown matching the original select display styling (never a native <select>). */
function InlineSelect({
  value,
  options,
  onChange,
}: {
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <Menu
      align="left"
      width="min-w-[16rem]"
      trigger={
        <div className="flex w-full items-center justify-between rounded-lg border border-line-strong bg-surface px-3.5 py-2.5 text-sm text-ink-muted">
          <span className="min-w-0 truncate whitespace-nowrap">{value}</span>
          <ChevronDown className="h-4 w-4 shrink-0 text-ink-subtle" />
        </div>
      }
    >
      {options.map((o) => (
        <MenuItem key={o} icon={value === o ? Check : undefined} onClick={() => onChange(o)}>
          {o}
        </MenuItem>
      ))}
    </Menu>
  );
}

/** Small emerald "Saved" confirmation shown briefly after a Save. */
function SaveButton({ onSave, saved }: { onSave: () => void; saved: boolean }) {
  return (
    <div className="flex shrink-0 items-center gap-2">
      {saved && (
        <span className="flex items-center gap-1 text-xs font-semibold text-status-ok-ink">
          <Check className="h-3.5 w-3.5" /> Saved
        </span>
      )}
      <button className="btn btn-primary shrink-0" onClick={onSave}>
        Save
      </button>
    </div>
  );
}

function SettingRow({
  icon: Icon,
  title,
  desc,
  control,
}: {
  icon: React.ElementType;
  title: string;
  desc: string;
  control: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-tint text-brand-ink">
          <Icon className="h-5 w-5" />
        </span>
        <div>
          <p className="text-sm font-semibold text-ink">{title}</p>
          <p className="mt-0.5 text-xs text-ink-subtle">{desc}</p>
        </div>
      </div>
      <div className="flex items-center gap-3 sm:w-105 sm:justify-end">{control}</div>
    </div>
  );
}

type FieldKey =
  | "platformName"
  | "tagline"
  | "adminEmail"
  | "contactEmail"
  | "contactPhone"
  | "timeZone"
  | "dateFormat"
  | "timeFormat"
  | "language";

export default function SettingsPage() {
  const toast = useToast();
  // ---- editable form data ----
  const [form, setForm] = useState({
    platformName: "",
    tagline: "",
    adminEmail: "",
    contactEmail: "",
    contactPhone: "",
    timeZone: "",
    dateFormat: "",
    timeFormat: "12" as "12" | "24",
    language: "English (US)",
  });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const set = (key: keyof typeof form, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  // The form maps onto the platform_settings document; these two functions are
  // the only place the two vocabularies meet.
  const load = useCallback(async () => {
    try {
      const s = await apiPlatformSettings();
      setForm((f) => ({
        ...f,
        platformName: s.org_name,
        tagline: s.tagline,
        adminEmail: s.support_email,
        contactEmail: s.support_email,
        contactPhone: s.support_phone,
        timeZone: s.timezone,
        dateFormat: s.date_format,
      }));
      setLoadError("");
    } catch (err) {
      setLoadError(memberError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const FIELD_TO_API: Record<string, string> = {
    platformName: "org_name",
    tagline: "tagline",
    adminEmail: "support_email",
    contactEmail: "support_email",
    contactPhone: "support_phone",
    timeZone: "timezone",
    dateFormat: "date_format",
  };

  // ---- per-row "Saved" confirmation ----
  const [savedKey, setSavedKey] = useState<FieldKey | null>(null);
  const [errorKey, setErrorKey] = useState<FieldKey | null>(null);

  const save = (key: FieldKey, required = true) => {
    const val = String(form[key] ?? "").trim();
    if (required && !val) {
      setErrorKey(key);
      setTimeout(() => setErrorKey((k) => (k === key ? null : k)), 2200);
      return;
    }
    setErrorKey((k) => (k === key ? null : k));

    // The inline tick beside each row's Save button stays — feedback belongs
    // where the action was, and there are nine of these rows. The toast is
    // added because the tick announces nothing: a screen-reader user pressing
    // Save had no way to know whether it worked.
    const confirmSaved = () => {
      setSavedKey(key);
      setTimeout(() => setSavedKey((k) => (k === key ? null : k)), 2000);
      toast.success("Saved");
    };

    const apiField = FIELD_TO_API[key as string];
    if (!apiField) {
      confirmSaved();
      return;
    }
    void apiSavePlatformSettings({ [apiField]: val })
      .then(confirmSaved)
      .catch((err) => {
        // This used to set `errorKey`, the SAME flag the empty-field check
        // uses — so a network failure told the admin "Platform Name is
        // required." about a field that was filled in. The interface blamed
        // her for the server's problem.
        toast.error("Could not save", { description: memberError(err) });
      });
  };

  // ---- logo / favicon presence ----
  const [hasLogo, setHasLogo] = useState(true);
  const [hasFavicon, setHasFavicon] = useState(true);

  // ---- header date range ----
  const [dateRange, setDateRange] = useState("May 20, 2024");

  // ---- modals ----
  const [uploadTarget, setUploadTarget] = useState<null | "logo" | "favicon">(null);
  const [confirm, setConfirm] = useState<null | "cache" | "reset">(null);

  const closeUpload = () => setUploadTarget(null);
  const applyUpload = () => {
    if (uploadTarget === "logo") setHasLogo(true);
    if (uploadTarget === "favicon") setHasFavicon(true);
    closeUpload();
  };

  return (
    <div>
      {/*
        A failed LOAD is a state, not an event: the data is still missing after
        a toast would have faded. This message was being assigned to a variable
        that no JSX ever read, so the screen simply rendered empty fields and
        said nothing — indistinguishable from settings that have never been
        filled in.
      */}
      {loadError && (
        <Alert variant="danger" className="mb-4">
          {loadError}
        </Alert>
      )}
      {/* header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-11 w-11 items-center justify-center rounded-xl bg-brand-tint text-brand-ink">
            <SettingsIcon className="h-6 w-6" />
          </span>
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-ink">Settings</h1>
            <p className="mt-1 text-sm text-ink-subtle">Manage your platform preferences and configurations.</p>
          </div>
        </div>
        <Menu
          trigger={
            <button className="btn btn-sm btn-outline">
              <CalendarDays className="h-4 w-4 text-ink-subtle" />
              {dateRange}
              <ChevronDown className="h-4 w-4 text-ink-subtle" />
            </button>
          }
        >
          {DATE_RANGES.map((r) => (
            <MenuItem
              key={r}
              icon={dateRange === r ? Check : undefined}
              onClick={() => setDateRange(r)}
            >
              {r}
            </MenuItem>
          ))}
        </Menu>
      </div>

      {/* summary stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {[
          { label: "Platform Name", value: form.platformName, sub: form.tagline, icon: Building2, tone: "brand", big: false },
          { label: "Admin Email", value: form.adminEmail, sub: "Primary Contact", icon: Mail, tone: "violet", big: false },
          { label: "Time Zone", value: form.timeZone, sub: "Local Time: 10:30 AM", icon: Globe, tone: "emerald", big: false },
          { label: "Active Users", value: "12,845", sub: "Registered Users", icon: Users, tone: "sky", big: true },
          { label: "Storage Used", value: "24.6 GB / 100 GB", sub: "24.6% Used", icon: PieChart, tone: "amber", big: false },
        ].map((s) => (
          <div key={s.label} className="wc-card p-5">
            <div className="flex items-center gap-4">
              <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${TONE_BG[s.tone]}`}>
                <s.icon className="h-6 w-6" strokeWidth={2} />
              </span>
              <div className="min-w-0">
                <p className={`truncate text-xsm font-semibold ${TONE_BG[s.tone].split(" ")[1]}`}>{s.label}</p>
                <p
                  className={`truncate font-display font-bold text-ink ${s.big ? "text-2xl" : "text-lg"}`}
                  title={s.value}
                >
                  {s.value}
                </p>
                <p className="mt-0.5 truncate text-xs text-ink-subtle">{s.sub}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* main grid */}
      <ResizableColumns id="settings" defaultSize={0.75} className="mt-6 gap-6">
        {/* CENTER */}
        <div className="space-y-6">
        <Card>
          <h2 className="font-display text-base font-semibold text-ink">General Settings</h2>
          <p className="mt-1 text-sm text-ink-subtle">Manage your platform general settings and preferences.</p>

          <div className="mt-2 divide-y divide-line">
            <SettingRow
              icon={Building2}
              title="Platform Name"
              desc={errorKey === "platformName" ? "Platform Name is required." : "This name will be shown across the platform."}
              control={
                <>
                  <InputField label="Platform Name" value={form.platformName} onChange={(v) => set("platformName", v)} />
                  <SaveButton onSave={() => save("platformName")} saved={savedKey === "platformName"} />
                </>
              }
            />
            <SettingRow
              icon={Tag}
              title="Platform Tagline"
              desc={errorKey === "tagline" ? "Tagline is required." : "Short tagline describing your platform."}
              control={
                <>
                  <InputField label="Platform Tagline" value={form.tagline} onChange={(v) => set("tagline", v)} />
                  <SaveButton onSave={() => save("tagline")} saved={savedKey === "tagline"} />
                </>
              }
            />
            <SettingRow
              icon={ImageIcon}
              title="Platform Logo"
              desc="Upload your platform logo. Recommended size 512x512px."
              control={
                <>
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-brand-tint text-brand-ink">
                    <Building2 className="h-5 w-5" />
                  </span>
                  <button className="btn btn-secondary" onClick={() => setUploadTarget("logo")}>
                    Change Logo
                  </button>
                  <button
                    className="btn btn-danger h-10 w-10 shrink-0 disabled:opacity-40"
                    onClick={() => setHasLogo(false)}
                    disabled={!hasLogo}
                    aria-label="Remove logo"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </>
              }
            />
            <SettingRow
              icon={Star}
              title="Favicon"
              desc="Upload favicon for browser tab."
              control={
                <>
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-brand-tint text-brand-ink">
                    <Star className="h-5 w-5" />
                  </span>
                  <button className="btn btn-secondary" onClick={() => setUploadTarget("favicon")}>
                    Change Favicon
                  </button>
                  <button
                    className="btn btn-danger h-10 w-10 shrink-0 disabled:opacity-40"
                    onClick={() => setHasFavicon(false)}
                    disabled={!hasFavicon}
                    aria-label="Remove favicon"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </>
              }
            />
            <SettingRow
              icon={Mail}
              title="Admin Email"
              desc={errorKey === "adminEmail" ? "Admin Email is required." : "Primary email address for all communications."}
              control={
                <>
                  <InputField label="Admin Email" type="email" value={form.adminEmail} onChange={(v) => set("adminEmail", v)} />
                  <SaveButton onSave={() => save("adminEmail")} saved={savedKey === "adminEmail"} />
                </>
              }
            />
            <SettingRow
              icon={Mail}
              title="Contact Email"
              desc={errorKey === "contactEmail" ? "Contact Email is required." : "This email will be visible to users."}
              control={
                <>
                  <InputField label="Contact Email" type="email" value={form.contactEmail} onChange={(v) => set("contactEmail", v)} />
                  <SaveButton onSave={() => save("contactEmail")} saved={savedKey === "contactEmail"} />
                </>
              }
            />
            <SettingRow
              icon={Phone}
              title="Contact Phone"
              desc={errorKey === "contactPhone" ? "Contact Phone is required." : "Primary contact phone number."}
              control={
                <>
                  <InputField label="Contact Phone" value={form.contactPhone} onChange={(v) => set("contactPhone", v)} />
                  <SaveButton onSave={() => save("contactPhone")} saved={savedKey === "contactPhone"} />
                </>
              }
            />
            <SettingRow
              icon={Globe}
              title="Time Zone"
              desc="Select your platform time zone."
              control={
                <>
                  <InlineSelect
                    value={form.timeZone}
                    options={TIMEZONE_OPTIONS}
                    onChange={(v) => set("timeZone", v)}
                  />
                  <SaveButton onSave={() => save("timeZone")} saved={savedKey === "timeZone"} />
                </>
              }
            />
            <SettingRow
              icon={CalendarDays}
              title="Date Format"
              desc="Choose the date format for the platform."
              control={
                <>
                  <InlineSelect
                    value={form.dateFormat}
                    options={DATE_FORMAT_OPTIONS}
                    onChange={(v) => set("dateFormat", v)}
                  />
                  <SaveButton onSave={() => save("dateFormat")} saved={savedKey === "dateFormat"} />
                </>
              }
            />
            <SettingRow
              icon={Clock}
              title="Time Format"
              desc="Choose the time format."
              control={
                <>
                  <div className="flex flex-1 items-center gap-6">
                    <button
                      type="button"
                      onClick={() => set("timeFormat", "12")}
                      className={`flex items-center gap-2 text-sm ${
                        form.timeFormat === "12" ? "text-ink-muted" : "text-ink-subtle"
                      }`}
                    >
                      {form.timeFormat === "12" ? (
                        <span className="flex h-4 w-4 items-center justify-center rounded-full border-[5px] border-brand-600" />
                      ) : (
                        <span className="h-4 w-4 rounded-full border-2 border-line-strong" />
                      )}
                      12 Hours (AM/PM)
                    </button>
                    <button
                      type="button"
                      onClick={() => set("timeFormat", "24")}
                      className={`flex items-center gap-2 text-sm ${
                        form.timeFormat === "24" ? "text-ink-muted" : "text-ink-subtle"
                      }`}
                    >
                      {form.timeFormat === "24" ? (
                        <span className="flex h-4 w-4 items-center justify-center rounded-full border-[5px] border-brand-600" />
                      ) : (
                        <span className="h-4 w-4 rounded-full border-2 border-line-strong" />
                      )}
                      24 Hours
                    </button>
                  </div>
                  <SaveButton onSave={() => save("timeFormat", false)} saved={savedKey === "timeFormat"} />
                </>
              }
            />
            <SettingRow
              icon={Languages}
              title="Language"
              desc="Select default language for platform."
              control={
                <>
                  <InlineSelect
                    value={form.language}
                    options={LANGUAGE_OPTIONS}
                    onChange={(v) => set("language", v)}
                  />
                  <SaveButton onSave={() => save("language")} saved={savedKey === "language"} />
                </>
              }
            />
          </div>
        </Card>

        <Card>
          <h2 className="font-display text-base font-semibold text-ink">Appearance</h2>
          <p className="mt-1 text-sm text-ink-subtle">Choose how WomSakhi looks to you.</p>
          <p className="mt-4 mb-2 text-sm font-medium text-ink-muted">Theme</p>
          <ThemeSelect />
        </Card>
        </div>

        {/* RIGHT column */}
        <div className="space-y-6">
          <Card>
            <div className="mb-4 flex items-center justify-between gap-2">
              <h2 className="font-display text-base font-semibold text-ink">System Status</h2>
              <Badge tone="emerald">All Systems Operational</Badge>
            </div>
            <ul className="space-y-3.5">
              {SYSTEM.map((s) => (
                <li key={s.name} className="flex items-center justify-between">
                  <span className="flex items-center gap-2.5 text-sm font-medium text-ink-muted">
                    <CheckCircle2 className="h-4.5 w-4.5 text-status-ok-ink" />
                    {s.name}
                  </span>
                  <span className="text-sm font-medium text-status-ok-ink">Operational</span>
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <h2 className="mb-4 font-display text-base font-semibold text-ink">Quick Links</h2>
            <ul className="space-y-1">
              <li>
                <button
                  onClick={() => setConfirm("cache")}
                  className="flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left hover:bg-surface-hover"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-inset text-ink-subtle">
                    <Eraser className="h-4 w-4" />
                  </span>
                  <span className="flex-1 text-sm font-medium text-ink-muted">Clear Cache</span>
                  <ChevronRight className="h-4 w-4 text-ink-faint" />
                </button>
              </li>
              <li>
                <Link
                  href="/dashboard/settings/logs"
                  className="flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left hover:bg-surface-hover"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-inset text-ink-subtle">
                    <FileClock className="h-4 w-4" />
                  </span>
                  <span className="flex-1 text-sm font-medium text-ink-muted">View System Logs</span>
                  <ChevronRight className="h-4 w-4 text-ink-faint" />
                </Link>
              </li>
              <li>
                <Link
                  href="/dashboard/settings/integrations"
                  className="flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left hover:bg-surface-hover"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-inset text-ink-subtle">
                    <KeyRound className="h-4 w-4" />
                  </span>
                  <span className="flex-1 text-sm font-medium text-ink-muted">Manage API Keys</span>
                  <ChevronRight className="h-4 w-4 text-ink-faint" />
                </Link>
              </li>
              <li>
                <Link
                  href="/dashboard/settings/activity"
                  className="flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left hover:bg-surface-hover"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-inset text-ink-subtle">
                    <Info className="h-4 w-4" />
                  </span>
                  <span className="flex-1 text-sm font-medium text-ink-muted">System Information</span>
                  <ChevronRight className="h-4 w-4 text-ink-faint" />
                </Link>
              </li>
              <li>
                <Link
                  href="/dashboard/settings/backup"
                  className="flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left hover:bg-surface-hover"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-inset text-ink-subtle">
                    <Database className="h-4 w-4" />
                  </span>
                  <span className="flex-1 text-sm font-medium text-ink-muted">Database Backup</span>
                  <ChevronRight className="h-4 w-4 text-ink-faint" />
                </Link>
              </li>
            </ul>
          </Card>

          <Card className="border-status-danger-border">
            <h2 className="font-display text-base font-semibold text-status-danger-ink">Danger Zone</h2>
            <p className="mt-1 text-xs text-ink-subtle">
              These actions are irreversible. Please be certain before proceeding.
            </p>
            <div className="mt-4 space-y-3">
              <button className="btn btn-danger btn-block" onClick={() => setConfirm("cache")}>
                <Trash2 className="h-4 w-4" /> Clear All Cache
              </button>
              <button className="btn btn-danger btn-block" onClick={() => setConfirm("reset")}>
                <AlertTriangle className="h-4 w-4" /> Reset Platform
              </button>
            </div>
          </Card>
        </div>
      </ResizableColumns>

      {/* Upload logo / favicon modal */}
      <Modal
        open={uploadTarget !== null}
        onClose={closeUpload}
        title={uploadTarget === "favicon" ? "Change Favicon" : "Change Logo"}
        description={
          uploadTarget === "favicon"
            ? "Upload a new favicon for the browser tab."
            : "Upload a new platform logo. Recommended size 512x512px."
        }
        icon={uploadTarget === "favicon" ? Star : ImageIcon}
        footer={
          <>
            <button className="btn btn-outline" onClick={closeUpload}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={applyUpload}>
              <UploadCloud className="h-4 w-4" /> Upload
            </button>
          </>
        }
      >
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-line-strong bg-surface-inset/60 px-6 py-10 text-center dark:bg-white/3">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-tint text-brand-ink">
            <UploadCloud className="h-6 w-6" />
          </span>
          <p className="text-sm font-medium text-ink-muted">Drag &amp; drop your file here</p>
          <p className="text-xs text-ink-subtle">PNG, JPG or SVG — up to 2MB</p>
        </div>
        <Input
          label="Or paste an image URL"
          placeholder="https://…"
          className="mt-4"
        />
      </Modal>

      {/* Clear cache confirm modal */}
      <Modal
        open={confirm === "cache"}
        onClose={() => setConfirm(null)}
        title="Clear All Cache?"
        description="This will clear all cached data across the platform. Users may experience a brief slowdown while the cache rebuilds."
        icon={Eraser}
        iconTone="amber"
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setConfirm(null)}>
              Cancel
            </button>
            <button className="btn btn-danger" onClick={() => setConfirm(null)}>
              <Trash2 className="h-4 w-4" /> Clear Cache
            </button>
          </>
        }
      >
        <p className="text-sm text-ink-subtle">
          Cached templates, images, and query results will be removed. This action cannot be undone.
        </p>
      </Modal>

      {/* Reset platform confirm modal */}
      <Modal
        open={confirm === "reset"}
        onClose={() => setConfirm(null)}
        title="Reset Platform?"
        description="This will reset the platform to its default configuration. All custom settings will be lost."
        icon={AlertTriangle}
        iconTone="rose"
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setConfirm(null)}>
              Cancel
            </button>
            <button className="btn btn-danger" onClick={() => setConfirm(null)}>
              <AlertTriangle className="h-4 w-4" /> Reset Platform
            </button>
          </>
        }
      >
        <p className="text-sm text-ink-subtle">
          This is an irreversible action. Please make sure you have a recent backup before proceeding.
        </p>
      </Modal>
    </div>
  );
}
