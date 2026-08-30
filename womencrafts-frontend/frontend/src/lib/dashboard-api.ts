import { apiClient } from "@/lib/api";

// --- Dashboard (aggregate/overview screen) API ---
// Mirrors app/schemas/dashboard.py on the backend. Preformatted display strings
// (e.g. "$24,568", "1,248", "2 (0.2%)") arrive ready to paint verbatim.

export type StatTone = "violet" | "brand" | "emerald" | "amber" | "sky" | "rose";

export interface DashboardStatCard {
  key: string;
  label: string;
  value: string; // preformatted, e.g. "1,248" or "$24,568"
  delta: string; // e.g. "12.5%"
  delta_dir: "up" | "down";
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
  storage_percent: number;
  storage_percent_label: string;
  storage_used_gb: number;
  storage_total_gb: number;
  storage_label: string;
  active_sessions: number;
  system_status: string;
  status_label: string;
  last_backup_at: string;
  last_backup_label: string;
  last_backup_type: string;
}

export interface DashboardOverview {
  stats: DashboardStatCard[];
  appointment_trend: AppointmentTrend;
  users_by_role: UsersByRole;
  recent_users: RecentUser[];
  recent_appointments: RecentAppointment[];
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

export async function apiDashboardApptTrend(range = "This Month"): Promise<AppointmentTrend> {
  const { data } = await apiClient.get<AppointmentTrend>("/dashboard/appointments/trend", {
    params: { range },
  });
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
