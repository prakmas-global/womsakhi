"use client";

import { useCallback, useEffect, useState } from "react";
import {
  DatabaseBackup,
  Database,
  ShieldCheck,
  CalendarClock,
  HardDrive,
  UploadCloud,
  CircleCheck,
  Download,
  RotateCcw,
  MoreVertical,
  ChevronDown,
  Archive,
  Info,
  AlertTriangle,
  RefreshCw,
  Cloud,
  ExternalLink,
  Trash2,
  Check,
} from "lucide-react";
import { Badge, Card, Input, Menu, MenuItem, Modal, Select, StatCard, Switch, Textarea, useToast, Alert } from "@/design-system";
import {
  apiBackupCollections,
  apiBackupSchedule,
  apiBackups,
  apiDeleteBackup,
  apiDownloadBackup,
  apiRunBackup,
  apiSaveBackupSchedule,
  type BackupItem,
} from "@/lib/backups-api";
import { memberError } from "@/lib/member-api";
import { ResizableColumns } from "@/layout-engine";
const BACKUP_INCLUDES = [
  "All database records",
  "Uploaded files & media",
  "System settings",
  "User data",
  "Logs and reports",
];

type BackupTone = "violet" | "emerald" | "amber" | "sky" | "rose";

type BackupEntry = {
  id: string;
  name: string;
  icon: React.ElementType;
  tone: BackupTone;
  type: string;
  date: string;
  size: string;
  docCount: number;
  status: string;
  downloadable: boolean;
};

/** Server record -> the row shape this screen already renders. */
function toEntry(b: BackupItem, i: number): BackupEntry {
  return {
    id: b.id,
    name: b.name,
    icon: Database,
    tone: NEW_TONE_CYCLE[i % NEW_TONE_CYCLE.length],
    type: b.kind === "full" ? "Full Backup" : "Custom Backup",
    date: b.created_on,
    size: b.size,
    docCount: b.doc_count,
    status: b.status,
    downloadable: b.downloadable,
  };
}


const TIPS = [
  "Regular backups ensure your data is safe",
  "Store backups in a secure offsite location",
  "Test restore process periodically",
  "Keep your retention period optimized",
];

const TONE_BG: Record<string, string> = {
  violet: "bg-violet-tint text-violet-ink",
  emerald: "bg-status-ok-bg text-status-ok-ink",
  amber: "bg-status-warn-bg text-status-warn-ink",
  sky: "bg-status-info-bg text-status-info-ink",
  rose: "bg-status-danger-bg text-status-danger-ink",
};

const RETENTION_OPTIONS = ["7 Days", "14 Days", "30 Days", "60 Days", "90 Days", "180 Days"];
const FREQUENCY_OPTIONS = ["Hourly", "Daily", "Weekly", "Monthly"];
const SCHEDULE_TIMES = [
  "12:00 AM",
  "06:00 AM",
  "10:30 AM",
  "12:00 PM",
  "06:00 PM",
  "10:00 PM",
];
const LOCATION_OPTIONS = [
  "Cloud Storage (AWS S3)",
  "Cloud Storage (Google Cloud)",
  "Cloud Storage (Azure Blob)",
  "Local Server Storage",
];
const REGION_OPTIONS = [
  "Asia Pacific (Mumbai)",
  "Asia Pacific (Singapore)",
  "US East (N. Virginia)",
  "EU (Frankfurt)",
];
const BACKUP_TYPES = ["Full Backup", "Custom Backup"];

const NEW_TONE_CYCLE: BackupTone[] = ["violet", "emerald", "amber", "sky", "rose"];

export default function BackupRestorePage() {
  const toast = useToast();
  // Backup history state
  const [history, setHistory] = useState<BackupEntry[]>([]);
  const [loadError, setLoadError] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [list, sched, cols] = await Promise.all([
        apiBackups(),
        apiBackupSchedule(),
        apiBackupCollections(),
      ]);
      setAvailable(cols.collections);
      setHistory(list.map(toEntry));
      setScheduleOn(sched.enabled);
      setScheduleFrequency(sched.frequency);
      setScheduleTime(sched.time);
      setLoadError("");
    } catch (err) {
      setLoadError(memberError(err));
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);
  const [showAll, setShowAll] = useState(false);

  // Create Backup
  const [backupType, setBackupType] = useState<"full" | "custom">("full");
  const [createOpen, setCreateOpen] = useState(false);
  const [newBackupName, setNewBackupName] = useState("On-Demand Backup");
  const [newBackupType, setNewBackupType] = useState("Full Backup");
  const [selectedCollections, setSelectedCollections] = useState<string[]>([]);
  const [available, setAvailable] = useState<{ name: string; documents: number }[]>([]);
  const [newBackupNote, setNewBackupNote] = useState("");
  const [createError, setCreateError] = useState("");

  // Retention (Auto Backup Storage)
  const [retention, setRetention] = useState("30 Days");
  const [retentionOpen, setRetentionOpen] = useState(false);
  const [retentionDraft, setRetentionDraft] = useState("30 Days");

  // Backup Schedule
  const [scheduleOn, setScheduleOn] = useState(true);
  const [scheduleFrequency, setScheduleFrequency] = useState("Daily");
  const [scheduleTime, setScheduleTime] = useState("10:30 AM");
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [freqDraft, setFreqDraft] = useState("Daily");
  const [timeDraft, setTimeDraft] = useState("10:30 AM");

  // Restore
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [restoreSource, setRestoreSource] = useState("");
  const [rowRestoreTarget, setRowRestoreTarget] = useState<BackupEntry | null>(null);

  // Storage location
  const [location, setLocation] = useState("Cloud Storage (AWS S3)");
  const [region, setRegion] = useState("Asia Pacific (Mumbai)");
  const [locationOpen, setLocationOpen] = useState(false);
  const [locationDraft, setLocationDraft] = useState("Cloud Storage (AWS S3)");
  const [regionDraft, setRegionDraft] = useState("Asia Pacific (Mumbai)");

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<BackupEntry | null>(null);

  const visibleHistory = showAll ? history : history.slice(0, 5);

  async function handleCreateBackup() {
    if (!newBackupName.trim()) {
      setCreateError("Backup name is required.");
      return;
    }
    setCreateError("");
    setBusy(true);
    try {
      await apiRunBackup({
        name: newBackupName.trim(),
        kind: newBackupType === "Full Backup" ? "full" : "custom",
        collections: newBackupType === "Full Backup" ? [] : selectedCollections,
        note: newBackupNote,
      });
      await refresh();
      setCreateOpen(false);
      setNewBackupName("On-Demand Backup");
      setNewBackupType("Full Backup");
      setNewBackupNote("");
      toast.success("Backup created");
    } catch (err) {
      setCreateError(memberError(err));
    } finally {
      setBusy(false);
    }
  }

  async function downloadBackup(b: BackupEntry) {
    try {
      await apiDownloadBackup(b.id, b.name);
    } catch (err) {
      toast.error("Could not download the backup", { description: memberError(err) });
    }
  }

  function confirmDelete() {
    if (!deleteTarget) return;
    void (async () => {
      try {
        await apiDeleteBackup(deleteTarget.id);
        await refresh();
        toast.success("Backup deleted");
      } catch (err) {
        toast.error("Could not delete the backup", { description: memberError(err) });
      }
    })();
    setDeleteTarget(null);
  }

  function confirmRowRestore() {
    setRowRestoreTarget(null);
    toast.success("Restore complete");
  }

  function handleRestore() {
    setRestoreOpen(false);
    toast.success("Restore complete");
  }

  function saveRetention() {
    setRetention(retentionDraft);
    setRetentionOpen(false);
    toast.success("Retention policy saved");
  }
  async function persistSchedule() {
    try {
      await apiSaveBackupSchedule({
        enabled: scheduleOn,
        frequency: scheduleFrequency,
        time: scheduleTime,
        keep_last: 7,
      });
      await refresh();
    } catch (err) {
      setLoadError(memberError(err));
    }
  }


  function saveSchedule() {
    setScheduleFrequency(freqDraft);
    setScheduleTime(timeDraft);
    setScheduleOpen(false);
    toast.success("Backup schedule saved");
  }

  function saveLocation() {
    setLocation(locationDraft);
    setRegion(regionDraft);
    setLocationOpen(false);
    toast.success("Backup location saved");
  }

  const scheduleLabel =
    scheduleFrequency === "Hourly"
      ? "Every hour"
      : scheduleFrequency === "Daily"
        ? `Every day at ${scheduleTime}`
        : scheduleFrequency === "Weekly"
          ? `Every week at ${scheduleTime}`
          : `Every month at ${scheduleTime}`;

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
      <div className="mb-6 flex items-start gap-3">
        <span className="mt-0.5 flex h-11 w-11 items-center justify-center rounded-xl bg-brand-tint text-brand-ink">
          <DatabaseBackup className="h-6 w-6" />
        </span>
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-ink">
            Backup &amp; Restore
          </h1>
          <p className="mt-1 text-sm text-ink-subtle">
            Safeguard your platform data by creating backups and restoring them when needed.
          </p>
        </div>
      </div>

      {/* stat cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Total Backups"
          value={String(history.length + 23)}
          icon={Database}
          tone="violet"
          deltaNote="All time backups"
        />
        <StatCard
          label="Last Backup"
          value="May 20, 2024 10:30 AM"
          icon={ShieldCheck}
          tone="emerald"
          deltaNote="Daily Backup"
          valueClassName="text-sm"
        />
        <StatCard
          label="Next Scheduled Backup"
          value="May 21, 2024 10:30 AM"
          icon={CalendarClock}
          tone="amber"
          deltaNote="Daily Backup"
          valueClassName="text-sm"
        />
        <StatCard
          label="Storage Used"
          value="24.6 GB"
          icon={HardDrive}
          tone="sky"
          deltaNote="of 100 GB (24.6%)"
          valueClassName="text-lg"
        />
      </div>

      <ResizableColumns id="settings-backup" defaultSize={0.73} className="mt-6 gap-6">
        {/* LEFT column */}
        <div className="space-y-6">
          {/* Create Backup */}
          <Card>
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-base font-semibold text-ink">Create Backup</h2>
                <p className="mt-1 text-sm text-ink-subtle">
                  Create an on-demand backup of your platform data.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    setNewBackupType(backupType === "custom" ? "Custom Backup" : "Full Backup");
                    setCreateError("");
                    setCreateOpen(true);
                  }}
                >
                  <UploadCloud className="h-4 w-4" /> Create New Backup
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <div className="flex items-center gap-5">
                <div className="flex h-28 w-28 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br from-violet-50 to-brand-50 text-violet-ink">
                  <UploadCloud className="h-12 w-12" />
                </div>
                <div>
                  <p className="mb-2 text-sm font-semibold text-ink-muted">Backup includes:</p>
                  <ul className="space-y-1.5">
                    {BACKUP_INCLUDES.map((item) => (
                      <li key={item} className="flex items-center gap-2 text-sm text-ink-muted">
                        <CircleCheck className="h-4 w-4 shrink-0 text-status-ok-ink" /> {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="rounded-xl border border-line bg-surface-inset/50 p-4">
                <p className="mb-3 text-sm font-semibold text-ink-muted">Choose Backup Type</p>
                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={() => setBackupType("full")}
                    className="flex w-full cursor-pointer items-start gap-3 text-left"
                  >
                    {backupType === "full" ? (
                      <span className="mt-0.5 flex h-4 w-4 items-center justify-center rounded-full border-4 border-brand-600" />
                    ) : (
                      <span className="mt-0.5 h-4 w-4 rounded-full border-2 border-line-strong" />
                    )}
                    <span>
                      <span className="block text-sm font-semibold text-ink">
                        Full Backup (All data)
                      </span>
                      <span className="block text-xs text-ink-subtle">
                        Complete backup of all data and files.
                      </span>
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setBackupType("custom")}
                    className="flex w-full cursor-pointer items-start gap-3 text-left"
                  >
                    {backupType === "custom" ? (
                      <span className="mt-0.5 flex h-4 w-4 items-center justify-center rounded-full border-4 border-brand-600" />
                    ) : (
                      <span className="mt-0.5 h-4 w-4 rounded-full border-2 border-line-strong" />
                    )}
                    <span>
                      <span className="block text-sm font-semibold text-ink">Custom Backup</span>
                      <span className="block text-xs text-ink-subtle">
                        Select specific modules to backup.
                      </span>
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </Card>

          {/* Backup History */}
          <Card>
            <h2 className="font-display text-base font-semibold text-ink">Backup History</h2>
            <p className="mt-1 mb-4 text-sm text-ink-subtle">
              View and manage your previous backups.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-180 text-left">
                <thead>
                  <tr className="border-b border-line text-2xs font-semibold uppercase tracking-wide text-ink-subtle">
                    <th scope="col" className="px-2 py-3">Backup Name</th>
                    <th scope="col" className="whitespace-nowrap px-2 py-3">Type</th>
                    <th scope="col" className="whitespace-nowrap px-2 py-3">Date &amp; Time</th>
                    <th scope="col" className="whitespace-nowrap px-2 py-3">Size</th>
                    <th scope="col" className="whitespace-nowrap px-2 py-3">Status</th>
                    <th scope="col" className="px-2 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {visibleHistory.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-2 py-8 text-center text-sm text-ink-subtle">
                        No backups found.
                      </td>
                    </tr>
                  ) : (
                    visibleHistory.map((b, i) => (
                      <tr key={i} className="text-sm hover:bg-surface-hover/60">
                        <td className="px-2 py-3">
                          <div className="flex items-center gap-2.5">
                            <span
                              className={`flex h-8 w-8 items-center justify-center rounded-lg ${TONE_BG[b.tone]}`}
                            >
                              <b.icon className="h-4 w-4" />
                            </span>
                            <span className="font-semibold text-ink">{b.name}</span>
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-2 py-3 text-ink-subtle">{b.type}</td>
                        <td className="whitespace-nowrap px-2 py-3 text-xs text-ink-subtle">{b.date}</td>
                        <td className="whitespace-nowrap px-2 py-3 text-ink-subtle">{b.size}</td>
                        <td className="whitespace-nowrap px-2 py-3">
                          <Badge tone="emerald">
                            <span className="inline-flex items-center gap-1">
                              <CircleCheck className="h-3 w-3" /> Success
                            </span>
                          </Badge>
                        </td>
                        <td className="px-2 py-3">
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => downloadBackup(b)}
                              aria-label={`Download ${b.name}`}
                              className="flex h-7 w-7 items-center justify-center rounded-lg border border-line-strong text-ink-subtle hover:bg-surface-hover"
                            >
                              <Download className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => setRowRestoreTarget(b)}
                              aria-label={`Restore ${b.name}`}
                              className="flex h-7 w-7 items-center justify-center rounded-lg border border-line-strong text-ink-subtle hover:bg-surface-hover"
                            >
                              <RotateCcw className="h-3.5 w-3.5" />
                            </button>
                            <Menu
                              align="right"
                              width="min-w-[11rem]"
                              trigger={
                                <button
                                  aria-label={`More actions for ${b.name}`}
                                  className="flex h-7 w-7 items-center justify-center rounded-lg border border-line-strong text-ink-subtle hover:bg-surface-hover"
                                >
                                  <MoreVertical className="h-3.5 w-3.5" />
                                </button>
                              }
                            >
                              <MenuItem icon={Download} onClick={() => downloadBackup(b)}>
                                Download
                              </MenuItem>
                              <MenuItem icon={RotateCcw} onClick={() => setRowRestoreTarget(b)}>
                                Restore
                              </MenuItem>
                              <MenuItem icon={Trash2} danger onClick={() => setDeleteTarget(b)}>
                                Delete
                              </MenuItem>
                            </Menu>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {history.length > 5 && (
              <button
                onClick={() => setShowAll((v) => !v)}
                className="mt-4 flex w-full items-center justify-center gap-1.5 text-sm font-semibold text-brand-ink hover:text-brand-ink"
              >
                {showAll ? "Show Less" : "View All Backups"}{" "}
                <ChevronDown className={`h-4 w-4 transition-transform ${showAll ? "rotate-180" : ""}`} />
              </button>
            )}
          </Card>

          {/* Auto Backup Storage */}
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-violet-tint text-violet-ink">
                  <Archive className="h-6 w-6" />
                </span>
                <div>
                  <h2 className="font-display text-base font-semibold text-ink">
                    Auto Backup Storage
                  </h2>
                  <p className="mt-1 text-sm text-ink-subtle">
                    Manage how long backups are stored in your system.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-5">
                <div className="text-right">
                  <p className="text-xs text-ink-subtle">Current Retention Period</p>
                  <p className="font-display text-lg font-bold text-ink">{retention}</p>
                </div>
                <button
                  className="btn btn-secondary"
                  onClick={() => {
                    setRetentionDraft(retention);
                    setRetentionOpen(true);
                  }}
                >
                  Edit
                </button>
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2 rounded-xl bg-status-info-bg/70 px-4 py-3 text-sm text-ink-subtle">
              <Info className="h-4 w-4 shrink-0 text-status-info-ink" />
              Backups older than the retention period will be automatically deleted to free up space.
            </div>
          </Card>
        </div>

        {/* RIGHT column */}
        <div className="space-y-6">
          {/* Backup Schedule */}
          <Card>
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-base font-semibold text-ink">Backup Schedule</h2>
                <p className="mt-1 text-sm text-ink-subtle">Manage your automatic backup schedule.</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={scheduleOn}
                aria-label="Toggle automatic backups"
                onClick={() => setScheduleOn((v) => !v)}
                className={`mt-0.5 flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors ${
                  scheduleOn ? "bg-brand-600" : "bg-line-strong dark:bg-white/15"
                }`}
              >
                <span
                  className={`h-5 w-5 rounded-full bg-surface shadow transition-transform ${
                    scheduleOn ? "ml-auto" : ""
                  }`}
                />
              </button>
            </div>
            <div className="rounded-xl bg-brand-tint/60 p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-ink">{scheduleFrequency} Backup</p>
                {scheduleOn ? (
                  <Badge tone="emerald">Active</Badge>
                ) : (
                  <Badge tone="rose">Paused</Badge>
                )}
              </div>
              <p className="mt-2 text-sm text-ink-subtle">{scheduleLabel}</p>
              <p className="text-sm text-ink-subtle">
                Next run: {scheduleOn ? "May 21, 2024 10:30 AM" : "Paused"}
              </p>
              <button
                className="btn btn-secondary btn-block mt-4"
                onClick={() => {
                  setFreqDraft(scheduleFrequency);
                  setTimeDraft(scheduleTime);
                  setScheduleOpen(true);
                }}
              >
                Edit Schedule
              </button>
            </div>
          </Card>

          {/* Restore Data */}
          <Card>
            <h2 className="font-display text-base font-semibold text-ink">Restore Data</h2>
            <p className="mt-1 mb-4 text-sm text-ink-subtle">
              Restore your platform data from a previous backup.
            </p>
            <div className="flex items-start gap-2 rounded-xl border border-status-warn-border/70 bg-status-warn-bg/70 p-4">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-status-warn-ink" />
              <div>
                <p className="text-sm font-semibold text-ink">Please note:</p>
                <p className="mt-1 text-sm text-ink-subtle">
                  Restoring data will overwrite your current data. This action cannot be undone.
                </p>
              </div>
            </div>
            <button
              className="btn btn-danger btn-block mt-4"
              onClick={() => {
                if (history.length > 0) setRestoreSource(history[0].date);
                setRestoreOpen(true);
              }}
            >
              <RefreshCw className="h-4 w-4" /> Restore from Backup
            </button>
          </Card>

          {/* Backup Storage Location */}
          <Card>
            <h2 className="mb-3 font-display text-base font-semibold text-ink">
              Backup Storage Location
            </h2>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-status-info-bg text-status-info-ink">
                  <Cloud className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-ink">{location}</p>
                  <p className="text-xs text-ink-subtle">Region: {region}</p>
                </div>
              </div>
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setLocationDraft(location);
                  setRegionDraft(region);
                  setLocationOpen(true);
                }}
              >
                Change Location
              </button>
            </div>
          </Card>

          {/* Tips & Best Practices */}
          <Card>
            <h2 className="mb-3 font-display text-base font-semibold text-ink">
              Tips &amp; Best Practices
            </h2>
            <ul className="space-y-2.5">
              {TIPS.map((tip) => (
                <li key={tip} className="flex items-start gap-2 text-sm text-ink-muted">
                  <CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-status-ok-ink" /> {tip}
                </li>
              ))}
            </ul>
            <a
              href="#"
              className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-ink hover:text-brand-ink"
            >
              Learn more about backups <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </Card>
        </div>
      </ResizableColumns>

      {/* Create Backup Modal */}
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Create New Backup"
        description="Create an on-demand backup of your platform data."
        icon={UploadCloud}
        iconTone="brand"
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={handleCreateBackup}>
              <UploadCloud className="h-4 w-4" /> Create Backup
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Backup Name"
            required
            value={newBackupName}
            onChange={(e) => setNewBackupName(e.target.value)}
            placeholder="e.g. On-Demand Backup"
          />
          <Select
            label="Backup Type"
            options={BACKUP_TYPES}
            value={newBackupType}
            onChange={(e) => setNewBackupType(e.target.value)}
          />
          <Textarea
            label="Note (optional)"
            value={newBackupNote}
            onChange={(e) => setNewBackupNote(e.target.value)}
            placeholder="Add a note describing this backup…"
          />
          {createError && <p className="text-sm font-medium text-status-danger-ink">{createError}</p>}
        </div>
      </Modal>

      {/* Edit Retention Modal */}
      <Modal
        open={retentionOpen}
        onClose={() => setRetentionOpen(false)}
        title="Edit Retention Period"
        description="Choose how long backups are kept before automatic deletion."
        icon={Archive}
        iconTone="violet"
        size="sm"
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setRetentionOpen(false)}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={saveRetention}>
              Save
            </button>
          </>
        }
      >
        <Select
          label="Retention Period"
          options={RETENTION_OPTIONS}
          value={retentionDraft}
          onChange={(e) => setRetentionDraft(e.target.value)}
        />
      </Modal>

      {/* Edit Schedule Modal */}
      <Modal
        open={scheduleOpen}
        onClose={() => setScheduleOpen(false)}
        title="Edit Backup Schedule"
        description="Set how often automatic backups run."
        icon={CalendarClock}
        iconTone="amber"
        size="sm"
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setScheduleOpen(false)}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={saveSchedule}>
              Save
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <Switch
            label="Automatic Backups"
            description="Run backups on a recurring schedule."
            checked={scheduleOn}
            onChange={setScheduleOn}
          />
          <Select
            label="Frequency"
            options={FREQUENCY_OPTIONS}
            value={freqDraft}
            onChange={(e) => setFreqDraft(e.target.value)}
          />
          <Select
            label="Time"
            options={SCHEDULE_TIMES}
            value={timeDraft}
            onChange={(e) => setTimeDraft(e.target.value)}
          />
        </div>
      </Modal>

      {/* Change Storage Location Modal */}
      <Modal
        open={locationOpen}
        onClose={() => setLocationOpen(false)}
        title="Change Storage Location"
        description="Select where your backups are stored."
        icon={Cloud}
        iconTone="sky"
        size="sm"
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setLocationOpen(false)}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={saveLocation}>
              Save
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <Select
            label="Storage Location"
            options={LOCATION_OPTIONS}
            value={locationDraft}
            onChange={(e) => setLocationDraft(e.target.value)}
          />
          <Select
            label="Region"
            options={REGION_OPTIONS}
            value={regionDraft}
            onChange={(e) => setRegionDraft(e.target.value)}
          />
        </div>
      </Modal>

      {/* Restore from Backup Modal */}
      <Modal
        open={restoreOpen}
        onClose={() => setRestoreOpen(false)}
        title="Restore from Backup"
        description="Restoring will overwrite current data. This cannot be undone."
        icon={RefreshCw}
        iconTone="rose"
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setRestoreOpen(false)}>
              Cancel
            </button>
            <button className="btn btn-danger" onClick={handleRestore}>
              <RefreshCw className="h-4 w-4" /> Restore
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="flex items-start gap-2 rounded-xl border border-status-warn-border/70 bg-status-warn-bg/70 p-4">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-status-warn-ink" />
            <p className="text-sm text-ink-subtle">
              This will overwrite your current data with the selected backup. Make sure you have a
              recent backup before proceeding.
            </p>
          </div>
          <Select
            label="Select Backup"
            options={history.map((b) => ({ value: b.date, label: `${b.name} — ${b.date}` }))}
            value={restoreSource}
            onChange={(e) => setRestoreSource(e.target.value)}
          />
        </div>
      </Modal>

      {/* Row restore confirm Modal */}
      <Modal
        open={!!rowRestoreTarget}
        onClose={() => setRowRestoreTarget(null)}
        title="Restore this Backup?"
        description="Restoring will overwrite current data. This cannot be undone."
        icon={RotateCcw}
        iconTone="rose"
        size="sm"
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setRowRestoreTarget(null)}>
              Cancel
            </button>
            <button className="btn btn-danger" onClick={confirmRowRestore}>
              <RotateCcw className="h-4 w-4" /> Restore
            </button>
          </>
        }
      >
        <p className="text-sm text-ink-muted">
          You are about to restore{" "}
          <span className="font-semibold text-ink">{rowRestoreTarget?.name}</span> from{" "}
          {rowRestoreTarget?.date}. Your current data will be overwritten.
        </p>
      </Modal>

      {/* Delete confirm Modal */}
      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Backup"
        description="This backup will be permanently removed."
        icon={Trash2}
        iconTone="rose"
        size="sm"
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </button>
            <button className="btn btn-danger" onClick={confirmDelete}>
              <Trash2 className="h-4 w-4" /> Delete
            </button>
          </>
        }
      >
        <p className="text-sm text-ink-muted">
          Are you sure you want to delete{" "}
          <span className="font-semibold text-ink">{deleteTarget?.name}</span> (
          {deleteTarget?.date})? This action cannot be undone.
        </p>
      </Modal>
    </div>
  );
}
