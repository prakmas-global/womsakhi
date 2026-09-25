import { apiClient } from "@/lib/api";

// --- Dashboard (aggregate/overview screen) API ---
// Mirrors app/schemas/dashboard.py on the backend. Preformatted display strings
// (e.g. "$24,568", "1,248", "2 (0.2%)") arrive ready to paint verbatim.

export type StatTone = "violet" | "brand" | "emerald" | "amber" | "sky" | "rose";

export interface DashboardStatCard {
  key: string;
  label: string;
  value: string; // preformatted, e.g. "1,248" or "$24,568"
  delta: string; // "+12" — how many arrived in the window; "" when none
  delta_dir: "up" | "down";
  delta_note: string; // what the delta counts, e.g. "new in the last 30 days"
  tone: StatTone;
  icon: string; // lucide icon name, e.g. "Users"
  href: string;
}

export interface TrendPoint {
  label: string;
  value: number;
}

export interface ApptTile {
  label: string;
  value: string;
  tone: string; // tailwind "text-* bg-*" pair the UI splits
  href: string;
}

export interface AppointmentTrend {
  range: string;
  series: TrendPoint[];
  tiles: ApptTile[];
}

export interface RoleSlice {
  name: string;
  value: number;
  color: string;
}

export interface RoleLegendItem {
  name: string;
  value: string; // preformatted "N (pct%)", e.g. "1,198 (96.0%)"
  color: string;
}

export interface UsersByRole {
  segments: RoleSlice[];
  legend: RoleLegendItem[];
  center_value: string;
  center_label: string;
}

export interface RecentUser {
  name: string;
  email: string;
  date: string;
  status: string;
}

export interface RecentAppointment {
  title: string;
  who: string;
  date: string;
  time: string;
  status: string;
}

export interface SystemOverview {
  database_ok: boolean;
  database_latency_ms: number;
  status_label: string; // "Database reachable · 12 ms" | "Database unreachable"
  storage_bytes: number;
  storage_label: string; // "24.6 MB of data in 61 collections"
  collections: number;
  staff_signed_in_24h: number;
  last_backup_at: string; // ISO, or "" when there has never been one
  last_backup_label: string;
  last_backup_type: string; // "Full backup" | "Custom backup" | ""
}

export interface DashboardOverview {
  generated_at: string;
  stats: DashboardStatCard[];
  attention: AttentionItem[];
  appointment_trend: AppointmentTrend;
  users_by_role: UsersByRole;
  recent_users: RecentUser[];
  recent_appointments: RecentAppointment[];
  recent_activity: RecentActivity[];
  system_overview: SystemOverview;
}

// One call hydrating the whole dashboard screen.
export async function apiDashboardOverview(): Promise<DashboardOverview> {
  const { data } = await apiClient.get<DashboardOverview>("/dashboard/overview");
  return data;
}

// --- Granular endpoints (available if a section needs to refresh on its own) ---

export async function apiDashboardStats(): Promise<DashboardStatCard[]> {
  const { data } = await apiClient.get<DashboardStatCard[]>("/dashboard/stats");
  return data;
}

export async function apiDashboardApptTrend(): Promise<AppointmentTrend> {
  const { data } = await apiClient.get<AppointmentTrend>("/dashboard/appointments/trend");
  return data;
}

export async function apiDashboardUsersByRole(): Promise<UsersByRole> {
  const { data } = await apiClient.get<UsersByRole>("/dashboard/users/by-role");
  return data;
}

export async function apiDashboardRecentUsers(limit = 5): Promise<RecentUser[]> {
  const { data } = await apiClient.get<RecentUser[]>("/dashboard/users/recent", {
    params: { limit },
  });
  return data;
}

export async function apiDashboardRecentAppointments(limit = 5): Promise<RecentAppointment[]> {
  const { data } = await apiClient.get<RecentAppointment[]>("/dashboard/appointments/recent", {
    params: { limit },
  });
  return data;
}

export async function apiDashboardSystemOverview(): Promise<SystemOverview> {
  const { data } = await apiClient.get<SystemOverview>("/dashboard/system-overview");
  return data;
}

// --- What is waiting for a person ------------------------------------------

export interface AttentionItem {
  key: string;
  label: string;
  value: number;
  note: string; // what the number counts
  tone: "amber" | "rose" | "sky" | "emerald";
  icon: string; // lucide icon name
  href: string; // the screen where she deals with it
}

export async function apiDashboardAttention(): Promise<AttentionItem[]> {
  const { data } = await apiClient.get<AttentionItem[]>("/dashboard/attention");
  return data;
}

// --- Recent staff actions (the activity_log rows app/core/audit.py writes) ---

export interface RecentActivity {
  id: string;
  user_name: string;
  action: string; // dotted verb, e.g. "staff.invite"
  category: string;
  target: string;
  detail: string;
  when: string; // "Sep 26, 2026 · 10:14 AM"
  created_at: string;
}

export async function apiDashboardRecentActivity(limit = 8): Promise<RecentActivity[]> {
  const { data } = await apiClient.get<RecentActivity[]>("/dashboard/activity/recent", {
    params: { limit },
  });
  return data;
}

// --- Export ------------------------------------------------------------------

/** Every figure and list on the home, as of now, as a CSV blob. Needs
 *  `dashboard.export`; the server records the download in the audit trail. */
export async function apiDashboardExportCsv(): Promise<Blob> {
  const { data } = await apiClient.get<Blob>("/dashboard/export", { responseType: "blob" });
  return data;
}
