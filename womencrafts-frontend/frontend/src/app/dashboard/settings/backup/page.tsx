"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle, CalendarClock, CircleCheck, CircleX, Database, DatabaseBackup, Download, FileWarning,
  HardDrive, Info, Loader2, MoreHorizontal, RotateCcw, ShieldCheck, Trash2, UploadCloud,
} from "lucide-react";

import {
  Badge, Card, Checkbox, EmptyState, Input, Menu, MenuItem, Modal, Select, Spinner, StatCard, Switch,
  Textarea, useConfirm, useToast,
} from "@/design-system";
import { ResizableColumns } from "@/layout-engine";
import { useAuth } from "@/context/AuthContext";
import {
  apiBackupCollections, apiBackupSchedule, apiBackupSummary, apiBackups, apiDeleteBackup, apiDownloadBackup,
  apiRestoreBackup, apiRunBackup, apiSaveBackupSchedule,
  type BackupCollections, type BackupItem, type BackupSchedule, type BackupSummary,
} from "@/lib/backups-api";
import { memberError } from "@/lib/member-api";

/**
 * Backup & restore.
 *
 * Every backup here is a real JSON export written under the private media
 * root; every number is counted from the rows or measured from the disk.
 *
 * ── What was wrong ────────────────────────────────────────────────────────
 * "Total backups" added 23 to the row count. "Last backup" was May 20, 2024.
 * "Storage used" was 24.6 GB of a 100 GB that does not exist. Restore showed
 * a toast and touched nothing. The schedule form saved to local state and
 * the AWS S3 location was a dropdown over nothing. Five seeded rows pointed
 * at `.archive.gz` files no disk has ever held.
 *
 * ── What is true now ──────────────────────────────────────────────────────
 * Rows whose file is missing say so and can only be deleted. Restore is the
 * server's real restore, Super Admin only, and demands the backup's name be
 * typed back. The schedule is saved — and labelled as a stored preference,
 * because no scheduler process runs on this installation.
 */

const FREQUENCIES = ["Hourly", "Daily", "Weekly", "Monthly"];

/** Everything the screen shows, in one wave. */
async function fetchBackupState() {
  const [list, sm, cols, sched] = await Promise.all([
    apiBackups(), apiBackupSummary(), apiBackupCollections(), apiBackupSchedule(),
  ]);
  return { list, sm, cols, sched };
}

export default function BackupRestorePage() {
  const toast = useToast();
  const confirm = useConfirm();
  const { user } = useAuth();
  const isSuper = user?.role === "Super Admin";

  const [rows, setRows] = useState<BackupItem[]>([]);
  const [summary, setSummary] = useState<BackupSummary | null>(null);
  const [collections, setCollections] = useState<BackupCollections | null>(null);
  const [schedule, setSchedule] = useState<BackupSchedule | null>(null);
  const [loading, setLoading] = useState(true);

  // Back up now
  const [kind, setKind] = useState<"full" | "custom">("full");
  const [chosen, setChosen] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [running, setRunning] = useState(false);

  // Schedule preference
  const [schedDraft, setSchedDraft] = useState({ enabled: false, frequency: "Daily", time: "02:00", keep_last: 7 });
  const [savingSched, setSavingSched] = useState(false);

  // Restore
  const [restoring, setRestoring] = useState<BackupItem | null>(null);
  const [typed, setTyped] = useState("");
  const [restoreBusy, setRestoreBusy] = useState(false);

  // After an action, from a click.
  const refresh = useCallback(async () => {
    try {
      const { list, sm, cols, sched } = await fetchBackupState();
      setRows(list);
      setSummary(sm);
      setCollections(cols);
      setSchedule(sched);
      setSchedDraft({ enabled: sched.enabled, frequency: sched.frequency, time: sched.time, keep_last: sched.keep_last });
    } catch (e) {
      toast.error("Could not load backups", { description: memberError(e) });
    }
  }, [toast]);

  // The first load, inline so every setState provably follows an await.
  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const { list, sm, cols, sched } = await fetchBackupState();
        if (!alive) return;
        setRows(list);
        setSummary(sm);
        setCollections(cols);
        setSchedule(sched);
        setSchedDraft({ enabled: sched.enabled, frequency: sched.frequency, time: sched.time, keep_last: sched.keep_last });
      } catch (e) {
        if (alive) toast.error("Could not load backups", { description: memberError(e) });
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [toast]);

  const runBackup = async () => {
    if (kind === "custom" && chosen.length === 0) {
      toast.error("Choose at least one collection");
      return;
    }
    setRunning(true);
    try {
      const b = await apiRunBackup({ name: name.trim(), kind, collections: kind === "custom" ? chosen : [], note: note.trim() });
      if (b.status === "complete") toast.success(`Backed up ${b.doc_count} documents`, { description: `${b.name} · ${b.size} · ${b.collection_count} collections` });
      else toast.error("The backup failed", { description: b.error || "See the platform events." });
      setName(""); setNote("");
      await refresh();
    } catch (e) {
      toast.error("Could not run the backup", { description: memberError(e) });
    } finally {
      setRunning(false);
    }
  };

  const saveSchedule = async () => {
    setSavingSched(true);
    try {
      const s = await apiSaveBackupSchedule(schedDraft);
      setSchedule(s);
      toast.success(schedDraft.enabled ? "Preference saved" : "Preference turned off", { description: s.note });
      await refresh();
    } catch (e) {
      toast.error("Could not save the preference", { description: memberError(e) });
    } finally {
      setSavingSched(false);
    }
  };

  const download = async (b: BackupItem) => {
    try {
      await apiDownloadBackup(b.id, b.name);
    } catch (e) {
      toast.error("Could not download the backup", { description: memberError(e) });
    }
  };

  const remove = async (b: BackupItem) => {
    const ok = await confirm({
      title: `Delete ${b.name}?`,
      description: b.file_present
        ? `The ${b.size} file is removed from this server. This cannot be undone.`
        : "Only the record is removed — there is no file behind it.",
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    try {
      await apiDeleteBackup(b.id);
      toast.success("Backup deleted");
      await refresh();
    } catch (e) {
      toast.error("Could not delete the backup", { description: memberError(e) });
    }
  };

  const restore = async () => {
    if (!restoring) return;
    setRestoreBusy(true);
    try {
      const res = await apiRestoreBackup(restoring.id, typed);
      toast.success("Restore complete", { description: res.message });
      setRestoring(null);
      setTyped("");
      await refresh();
    } catch (e) {
      toast.error("Restore refused", { description: memberError(e) });
    } finally {
      setRestoreBusy(false);
    }
  };

  const lastBackup = summary?.last_backup_at
    ? new Date(summary.last_backup_at).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : "Never";

  return (
    <div>
      <div className="mb-6 flex items-start gap-3">
        <span className="mt-0.5 flex h-11 w-11 items-center justify-center rounded-xl bg-brand-tint text-brand-ink">
          <DatabaseBackup className="h-6 w-6" />
        </span>
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-ink">Backup &amp; restore</h1>
          <p className="mt-1 text-sm text-ink-subtle">
            Real exports of the database to this server&apos;s private storage. Identity documents and sign-in tokens are never included.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Backups on disk" value={String(summary?.on_disk ?? 0)} icon={Database} tone="violet"
                  deltaNote={summary ? `${summary.records} record${summary.records === 1 ? "" : "s"}${summary.missing_files ? ` · ${summary.missing_files} without a file` : ""}` : "…"} />
        <StatCard label="Last backup" value={lastBackup} icon={ShieldCheck} tone={summary?.on_disk ? "emerald" : "amber"} valueClassName="text-sm"
                  deltaNote={summary?.last_backup_name || "Nothing on disk yet"} />
        <StatCard label="Storage used" value={summary?.storage_label ?? "0 B"} icon={HardDrive} tone="sky" valueClassName="text-lg"
                  deltaNote="Measured from the files on disk" />
        <StatCard label="Schedule" value={summary?.schedule_label ?? "Off"} icon={CalendarClock} tone="amber" valueClassName="text-sm"
                  deltaNote="Stored preference — does not run by itself" />
      </div>

      {summary && summary.missing_files > 0 && (
        <div className="mt-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <FileWarning className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div className="text-sm">
            <p className="font-semibold text-amber-900">{summary.missing_files} record{summary.missing_files === 1 ? " points" : "s point"} at a file that is not on this server</p>
            <p className="mt-0.5 text-amber-800">
              They cannot be downloaded or restored. They are marked below; a Super Admin can delete the records.
            </p>
          </div>
        </div>
      )}

      <ResizableColumns id="settings-backup" defaultSize={0.68} className="mt-6 gap-6">
        <div className="space-y-6">
          <Card>
            <h2 className="font-display text-base font-semibold text-ink">Back up now</h2>
            <p className="mt-1 text-sm text-ink-subtle">Writes a JSON export of the chosen collections and records who ran it.</p>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div className="space-y-3">
                <div className="rounded-xl border border-line bg-surface-inset/50 p-3">
                  {(["full", "custom"] as const).map((k) => (
                    <button key={k} type="button" onClick={() => setKind(k)} className="flex w-full items-start gap-3 py-1.5 text-left">
                      <span className={`mt-0.5 h-4 w-4 shrink-0 rounded-full border-2 ${kind === k ? "border-[5px] border-brand-600" : "border-line-strong"}`} />
                      <span>
                        <span className="block text-sm font-semibold text-ink">{k === "full" ? "Everything" : "Chosen collections"}</span>
                        <span className="block text-xs text-ink-subtle">
                          {k === "full"
                            ? `${collections?.collections.length ?? 0} collections, ${(collections?.collections ?? []).reduce((n, c) => n + c.documents, 0)} documents`
                            : "Pick what to include"}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
                <Input label="Name (optional)" value={name} onChange={(e) => setName(e.target.value)} placeholder="Before the September import" />
                <Textarea label="Note (optional)" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
                <button className="btn btn-primary" disabled={running || loading} onClick={() => void runBackup()}>
                  {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />} {running ? "Backing up…" : "Back up now"}
                </button>
              </div>
              <div>
                {kind === "custom" ? (
                  <div className="max-h-72 overflow-y-auto rounded-xl border border-line p-3">
                    <div className="mb-2 flex items-center justify-between text-xs">
                      <span className="font-semibold text-ink-muted">{chosen.length} chosen</span>
                      <button className="text-brand-ink" onClick={() => setChosen(chosen.length ? [] : (collections?.collections ?? []).map((c) => c.name))}>
                        {chosen.length ? "Clear" : "Select all"}
                      </button>
                    </div>
                    <ul className="space-y-1.5">
                      {(collections?.collections ?? []).map((c) => (
                        <li key={c.name} className="flex items-center justify-between gap-2">
                          <Checkbox checked={chosen.includes(c.name)} label={c.name}
                                    onChange={(on) => setChosen((prev) => on ? [...prev, c.name] : prev.filter((x) => x !== c.name))} />
                          <span className="font-mono text-2xs text-ink-subtle">{c.documents}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <div className="rounded-xl border border-line p-3 text-sm text-ink-muted">
                    <p className="font-semibold text-ink">A full backup includes</p>
                    <p className="mt-1 text-xs text-ink-subtle">{(collections?.collections ?? []).map((c) => c.name).join(", ") || "…"}</p>
                    <p className="mt-3 font-semibold text-ink">Never included</p>
                    <p className="mt-1 text-xs text-ink-subtle">{collections?.excluded.join(", ")} — {collections?.excluded_reason}</p>
                  </div>
                )}
              </div>
            </div>
          </Card>

          <Card>
            <h2 className="font-display text-base font-semibold text-ink">History</h2>
            <p className="mt-1 mb-4 text-sm text-ink-subtle">Every backup record, with whether its file is still on this server.</p>
            {loading ? (
              <div className="flex items-center justify-center py-12"><Spinner /></div>
            ) : rows.length === 0 ? (
              <EmptyState icon={Database} title="No backups yet" description="Run one above. It appears here with its size and who ran it." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-line text-2xs font-semibold uppercase tracking-wide text-ink-subtle">
                      <th className="px-2 py-2.5">Backup</th>
                      <th className="px-2 py-2.5">Scope</th>
                      <th className="px-2 py-2.5">When</th>
                      <th className="px-2 py-2.5">Size</th>
                      <th className="px-2 py-2.5">State</th>
                      <th className="px-2 py-2.5 text-right">&nbsp;</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((b) => (
                      <tr key={b.id} className={`border-b border-line text-sm last:border-0 hover:bg-surface-2 ${b.file_present ? "" : "opacity-70"}`}>
                        <td className="px-2 py-3">
                          <p className="font-semibold text-ink">{b.name}</p>
                          <p className="text-2xs text-ink-subtle">{b.created_by_name || "—"}{b.note ? ` · ${b.note}` : ""}</p>
                        </td>
                        <td className="whitespace-nowrap px-2 py-3 text-ink-subtle">{b.kind === "full" ? "Everything" : `${b.collection_count} collections`}</td>
                        <td className="whitespace-nowrap px-2 py-3 text-xs text-ink-subtle">{b.created_on}</td>
                        <td className="whitespace-nowrap px-2 py-3 text-ink-subtle">{b.file_present ? b.size : "—"}</td>
                        <td className="px-2 py-3">
                          {!b.file_present ? (
                            <span title={b.file_note}><Badge tone="amber"><span className="inline-flex items-center gap-1"><FileWarning className="h-3 w-3" /> File missing</span></Badge></span>
                          ) : b.status === "complete" ? (
                            <Badge tone="emerald"><span className="inline-flex items-center gap-1"><CircleCheck className="h-3 w-3" /> Complete · {b.doc_count} docs</span></Badge>
                          ) : b.status === "failed" ? (
                            <span title={b.error}><Badge tone="rose"><span className="inline-flex items-center gap-1"><CircleX className="h-3 w-3" /> Failed</span></Badge></span>
                          ) : (
                            <Badge tone="sky">Running</Badge>
                          )}
                        </td>
                        <td className="px-2 py-3 text-right">
                          {isSuper ? (
                            <Menu trigger={<span className="btn btn-sm btn-ghost"><MoreHorizontal className="h-4 w-4" /></span>}>
                              {b.downloadable && <MenuItem icon={Download} onClick={() => void download(b)}>Download</MenuItem>}
                              {b.downloadable && <MenuItem icon={RotateCcw} onClick={() => { setRestoring(b); setTyped(""); }}>Restore from this…</MenuItem>}
                              <MenuItem icon={Trash2} danger onClick={() => void remove(b)}>{b.file_present ? "Delete" : "Delete record"}</MenuItem>
                            </Menu>
                          ) : (
                            <span className="text-2xs text-ink-subtle">Super Admin only</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-base font-semibold text-ink">Schedule preference</h2>
                <p className="mt-1 text-sm text-ink-subtle">What the organisation wants. Saved and recorded.</p>
              </div>
              <Badge tone={schedule?.enabled ? "amber" : "slate"}>{schedule?.enabled ? "Stored" : "Off"}</Badge>
            </div>
            <div className="mt-3 flex items-start gap-2 rounded-xl bg-status-info-bg/70 px-3.5 py-3 text-xs text-status-info-ink">
              <Info className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{schedule?.note ?? "No scheduler process runs on this installation; backups happen when someone presses Back up now."}</span>
            </div>
            <div className="mt-4 space-y-3">
              <Switch label="Keep a schedule preference" description="Nothing runs on its own yet — this records the intent."
                      checked={schedDraft.enabled} onChange={(v) => setSchedDraft({ ...schedDraft, enabled: v })} />
              <div className="grid grid-cols-2 gap-3">
                <Select label="Frequency" options={FREQUENCIES} value={schedDraft.frequency} onChange={(e) => setSchedDraft({ ...schedDraft, frequency: e.target.value })} />
                <Input label="At" type="time" value={schedDraft.time} onChange={(e) => setSchedDraft({ ...schedDraft, time: e.target.value })} />
              </div>
              <Input label="Keep the last" type="number" min={1} max={365} value={schedDraft.keep_last}
                     onChange={(e) => setSchedDraft({ ...schedDraft, keep_last: Math.max(1, Math.min(365, Number(e.target.value) || 1)) })}
                     hint="How many backups to retain once a scheduler exists." />
              <button className="btn btn-secondary btn-block" disabled={savingSched} onClick={() => void saveSchedule()}>
                {savingSched ? "Saving…" : "Save preference"}
              </button>
            </div>
          </Card>

          <Card>
            <h2 className="font-display text-base font-semibold text-ink">Where backups live</h2>
            <p className="mt-1 text-sm text-ink-muted">{summary?.location ?? "…"}</p>
            <p className="mt-2 text-xs text-ink-subtle">
              There is no cloud bucket and no off-site copy. A downloaded file is the only copy that leaves this server — keep one somewhere else.
            </p>
          </Card>

          <Card>
            <h2 className="font-display text-base font-semibold text-ink">Restoring</h2>
            <div className="mt-3 flex items-start gap-2 rounded-xl border border-status-warn-border/70 bg-status-warn-bg/70 p-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-status-warn-ink" />
              <p className="text-sm text-ink-subtle">
                A restore replaces the live collections with the file&apos;s contents. It is Super Admin only, it asks you to type the backup&apos;s name, and it is recorded. Run a fresh backup first.
              </p>
            </div>
          </Card>
        </div>
      </ResizableColumns>

      <Modal open={!!restoring} onClose={() => setRestoring(null)} title="Restore from this backup?" icon={RotateCcw} iconTone="rose"
             description={restoring ? `${restoring.name} · ${restoring.created_on} · ${restoring.doc_count} documents` : undefined}
             footer={<>
               <button className="btn btn-outline" onClick={() => setRestoring(null)}>Cancel</button>
               <button className="btn btn-danger" disabled={restoreBusy || !restoring || typed.trim() !== restoring.name} onClick={() => void restore()}>
                 {restoreBusy ? "Restoring…" : "Replace live data"}
               </button>
             </>}>
        {restoring && (
          <div className="space-y-4">
            <div className="flex items-start gap-2 rounded-xl border border-status-danger-border/70 bg-status-danger-bg/70 p-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-status-danger-ink" />
              <p className="text-sm text-ink-muted">
                {restoring.collection_count} collection{restoring.collection_count === 1 ? "" : "s"} will be emptied and refilled from the file. Everyone signed in may need to sign in again. This cannot be undone.
              </p>
            </div>
            <Input label={`Type the backup's name to confirm: ${restoring.name}`} value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={restoring.name} />
          </div>
        )}
      </Modal>
    </div>
  );
}
