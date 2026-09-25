import { apiClient } from "./api";

/**
 * Backup & restore.
 *
 * The download endpoint streams a file and the restore endpoint is destructive,
 * so both are Super Admin only server-side — this client just mirrors that.
 */

export interface BackupItem {
  id: string;
  name: string;
  kind: string;
  collections: string[];
  collection_count: number;
  note: string;
  status: "running" | "complete" | "failed";
  doc_count: number;
  size_bytes: number;
  size: string;
  error: string;
  created_by_name: string;
  created_on: string;
  created_at: string;
  downloadable: boolean;
  /** Whether the file this row points at is on the server's disk. */
  file_present: boolean;
  file_note: string;
}

export interface BackupSchedule {
  enabled: boolean;
  frequency: string;
  time: string;
  keep_last: number;
  note: string;
}

export interface BackupCollections {
  collections: { name: string; documents: number }[];
  excluded: string[];
  excluded_reason: string;
}

export async function apiBackups() {
  const { data } = await apiClient.get<BackupItem[]>("/backups");
  return data;
}

export async function apiBackupCollections() {
  const { data } = await apiClient.get<BackupCollections>("/backups/collections");
  return data;
}

export async function apiRunBackup(body: {
  name?: string;
  kind: "full" | "custom";
  collections?: string[];
  note?: string;
}) {
  const { data } = await apiClient.post<BackupItem>("/backups", body);
  return data;
}

export async function apiDeleteBackup(id: string) {
  await apiClient.delete(`/backups/${id}`);
}

/** Streams the JSON file straight to the browser's downloads. */
export async function apiDownloadBackup(id: string, name: string) {
  const res = await apiClient.get(`/backups/${id}/download`, { responseType: "blob" });
  const url = URL.createObjectURL(res.data as Blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${name.replace(/[^\w \-]/g, "") || "backup"}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function apiRestoreBackup(id: string, confirm: string, collections?: string[]) {
  const { data } = await apiClient.post<{ message: string }>(`/backups/${id}/restore`, {
    confirm,
    collections: collections ?? [],
  });
  return data;
}

export async function apiBackupSchedule() {
  const { data } = await apiClient.get<BackupSchedule>("/backups/schedule/current");
  return data;
}

export async function apiSaveBackupSchedule(body: {
  enabled: boolean;
  frequency: string;
  time: string;
  keep_last: number;
}) {
  const { data } = await apiClient.put<BackupSchedule>("/backups/schedule/current", body);
  return data;
}

/** Counted and measured on the server: rows, files on disk, bytes, the last real backup. */
export interface BackupSummary {
  on_disk: number;
  records: number;
  missing_files: number;
  last_backup_at: string;
  last_backup_name: string;
  storage_bytes: number;
  storage_label: string;
  location: string;
  schedule_enabled: boolean;
  schedule_label: string;
  /** False: there is no scheduler process; the schedule is a stored preference. */
  runs_automatically: boolean;
}

export async function apiBackupSummary() {
  const { data } = await apiClient.get<BackupSummary>("/backups/summary");
  return data;
}
