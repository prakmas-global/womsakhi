import { apiClient } from "@/lib/api";

/**
 * Settings › platform: the audit trail, the platform-events slice of it, and
 * the support inbox. Typed wrappers over app/routes/settings_platform.py.
 *
 * Everything here is counted or stored server-side. The client never
 * filters a list it was handed in full; it asks for the page it shows.
 */

// --- activity log --------------------------------------------------------------

export interface ActivityRow {
  id: string;
  user_id: string;
  user_name: string;
  action: string;
  category: string;
  target: string;
  detail: string;
  ip: string;
  when: string;
  created_at: string;
}

export interface ActivityPage {
  items: ActivityRow[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

export interface ActivitySummary {
  total: number;
  today: number;
  last_7_days: number;
  actors: number;
  by_category: { name: string; value: number; pct: string }[];
  timeline: { label: string; value: number }[];
  top_actions: { action: string; category: string; n: number }[];
  range_from: string;
  range_to: string;
}

export interface ActivityActor {
  user_id: string;
  user_name: string;
  actions: number;
}

/** Server-side filters. Dates are YYYY-MM-DD; an empty string means "any". */
export interface ActivityFilters {
  user_id?: string;
  category?: string;
  q?: string;
  from?: string;
  to?: string;
}

export async function apiActivityLog(
  params: ActivityFilters & { page?: number; page_size?: number } = {},
): Promise<ActivityPage> {
  const { data } = await apiClient.get<ActivityPage>("/activity-log", { params });
  return data;
}

export async function apiActivitySummary(params: ActivityFilters = {}): Promise<ActivitySummary> {
  const { data } = await apiClient.get<ActivitySummary>("/activity-log/summary", { params });
  return data;
}

export async function apiActivityActors(): Promise<ActivityActor[]> {
  const { data } = await apiClient.get<ActivityActor[]>("/activity-log/actors");
  return data;
}

export async function apiActivityCategories(): Promise<string[]> {
  const { data } = await apiClient.get<string[]>("/activity-log/categories");
  return data;
}

export async function apiActivityExportCsv(params: ActivityFilters = {}): Promise<Blob> {
  const { data } = await apiClient.get("/activity-log/export.csv", { params, responseType: "blob" });
  return data as Blob;
}

// --- platform events -------------------------------------------------------------

export interface PlatformEvent {
  id: string;
  when: string;
  created_at: string;
  severity: "info" | "warning" | "error" | string;
  source: string;
  action: string;
  message: string;
  user_name: string;
  ip: string;
}

export interface PlatformEventPage {
  items: PlatformEvent[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

export interface PlatformLogSummary {
  total: number;
  by_severity: Record<string, number>;
  sources: string[];
  process_log_destination: string;
  environment: string;
  note: string;
}

export interface PlatformLogFilters {
  q?: string;
  source?: string;
  severity?: string;
}

export async function apiPlatformLogs(
  params: PlatformLogFilters & { page?: number; page_size?: number } = {},
): Promise<PlatformEventPage> {
  const { data } = await apiClient.get<PlatformEventPage>("/platform-logs", { params });
  return data;
}

export async function apiPlatformLogSummary(): Promise<PlatformLogSummary> {
  const { data } = await apiClient.get<PlatformLogSummary>("/platform-logs/summary");
  return data;
}

export async function apiPlatformLogsExportCsv(params: PlatformLogFilters = {}): Promise<Blob> {
  const { data } = await apiClient.get("/platform-logs/export.csv", { params, responseType: "blob" });
  return data as Blob;
}

// --- support inbox ---------------------------------------------------------------

export interface TicketAdmin {
  id: string;
  reference: string;
  subject: string;
  message: string;
  category: string;
  priority: string;
  status: "open" | "in_progress" | "resolved" | string;
  replies: { body: string; by: string; when: string }[];
  raised_on: string;
  created_at: string;
  updated_at: string;
  user_id: string;
  user_name: string;
  user_email: string;
  first_reply_hours: number | null;
}

export interface TicketPage {
  items: TicketAdmin[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

export interface TicketSummary {
  total: number;
  open: number;
  in_progress: number;
  resolved: number;
  raisers: number;
  replied: number;
  median_first_reply_hours: number | null;
}

export interface SupportContact {
  email: string;
  phone: string;
  source: string;
  email_delivery: boolean;
  email_note: string;
}

export async function apiSupportContact(): Promise<SupportContact> {
  const { data } = await apiClient.get<SupportContact>("/support-tickets/contact");
  return data;
}

export async function apiSupportInbox(
  params: { status?: string; q?: string; page?: number; page_size?: number } = {},
): Promise<TicketPage> {
  const { data } = await apiClient.get<TicketPage>("/support-tickets", { params });
  return data;
}

export async function apiSupportSummary(): Promise<TicketSummary> {
  const { data } = await apiClient.get<TicketSummary>("/support-tickets/summary");
  return data;
}

export async function apiSupportReply(
  id: string,
  body: string,
): Promise<{ ticket: TicketAdmin; email_sent: boolean; email_note: string }> {
  const { data } = await apiClient.post(`/support-tickets/${id}/reply`, { body });
  return data;
}

export async function apiSupportSetStatus(id: string, status: string): Promise<TicketAdmin> {
  const { data } = await apiClient.patch<TicketAdmin>(`/support-tickets/${id}/status`, { status });
  return data;
}

// --- a file the browser saves ----------------------------------------------------

export function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
