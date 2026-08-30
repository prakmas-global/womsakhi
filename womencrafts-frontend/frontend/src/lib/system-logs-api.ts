import { apiClient } from "@/lib/api";

// --- Settings › System Logs -------------------------------------------------
// Typed wrappers around the /system-logs endpoints. The JWT is auto-attached by
// the shared apiClient interceptor, so these just shape requests/responses.

/** A single audit-log row (matches the backend SystemLogResponse). */
export interface ApiSystemLog {
  id: string; // mongo id (used for the detail modal)
  time: string; // pre-formatted display timestamp, e.g. "May 20 10:32:14"
  level: string; // "Info" | "Success" | "Warning" | "Error"
  source: string; // module/action tag, e.g. "auth"
  message: string;
  user: string;
  ip: string;
}

export interface SystemLogListParams {
  level?: string;
  source?: string;
  q?: string;
  range?: string;
  page?: number;
  page_size?: number;
}

export interface SystemLogList {
  items: ApiSystemLog[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

/** One of the four stat cards above the table. */
export interface LogStatCard {
  label: string;
  value: string;
  icon: string; // lucide icon name the UI maps to a component
  tone: string; // "violet" | "rose" | "amber" | "sky"
  delta_note: string;
}

/** A slice of the "Log Levels" donut. */
export interface LogLevelSlice {
  name: string;
  value: number;
  color: string;
}

export interface RecentError {
  message: string;
  when: string;
}

export interface SystemLogStats {
  stat_cards: LogStatCard[];
  level_distribution: LogLevelSlice[];
  level_total: string;
  recent_errors: RecentError[];
}

/** GET /system-logs — list with level/source/q filters + pagination. */
export async function apiListSystemLogs(
  params: SystemLogListParams = {}
): Promise<SystemLogList> {
  const { data } = await apiClient.get<SystemLogList>("/system-logs", { params });
  return data;
}

/** GET /system-logs/stats — stat cards, level donut and recent errors. */
export async function apiSystemLogStats(): Promise<SystemLogStats> {
  const { data } = await apiClient.get<SystemLogStats>("/system-logs/stats");
  return data;
}

/** GET /system-logs/sources — distinct sources ("All Sources" first) for the filter menu. */
export async function apiSystemLogSources(): Promise<string[]> {
  const { data } = await apiClient.get<{ sources: string[] }>("/system-logs/sources");
  return data.sources;
}

/** GET /system-logs/{id} — a single log for the detail modal. */
export async function apiGetSystemLog(id: string): Promise<ApiSystemLog> {
  const { data } = await apiClient.get<ApiSystemLog>(`/system-logs/${id}`);
  return data;
}
