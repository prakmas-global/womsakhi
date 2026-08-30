import { apiClient } from "./api";

/**
 * A staff member's own account, and the platform's settings.
 *
 * These back the six admin screens that used to render fixed arrays with Save
 * buttons that did nothing.
 */

export interface PlatformSettings {
  org_name: string;
  tagline: string;
  support_email: string;
  support_phone: string;
  website: string;
  timezone: string;
  currency: string;
  date_format: string;
  default_locale: string;
  allow_signups: boolean;
  require_document_verification: boolean;
  auto_approve_members: boolean;
  maintenance_mode: boolean;
  maintenance_message: string;
  session_timeout_minutes: number;
  updated_at: string;
}

export interface SystemHealthItem {
  name: string;
  status: "ok" | "degraded" | "down";
  detail: string;
}

export interface StaffProfile {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  avatar: string;
  role: string;
  modules: string[];
  created_at: string;
  last_active: string;
}

export interface StaffStats {
  logins_this_month: number;
  actions_performed: number;
  members_managed: number;
  content_published: number;
  reports_generated: number;
}

export interface NotificationRow {
  key: string;
  title: string;
  description: string;
  email: boolean;
  sms: boolean;
  push: boolean;
  in_app: boolean;
}

export interface StaffNotificationPrefs {
  rows: NotificationRow[];
  quiet_hours: { enabled: boolean; from: string; to: string };
}

export interface ActivityItem {
  id: string;
  user_name: string;
  action: string;
  category: string;
  target: string;
  detail: string;
  ip: string;
  when: string;
  created_at: string;
}

export interface ActivityOverview {
  total: number;
  today: number;
  this_week: number;
  timeline: { label: string; value: number }[];
  breakdown: { name: string; value: number; pct: string }[];
}

export interface Ticket {
  id: string;
  reference: string;
  subject: string;
  message: string;
  category: string;
  priority: string;
  status: string;
  replies: { body: string; by: string; when: string }[];
  raised_on: string;
}

export const TICKET_CATEGORIES = [
  "Account & access",
  "A bug or something broken",
  "Billing",
  "Feature request",
  "Data or reporting",
  "Something else",
] as const;

export const TICKET_PRIORITIES = ["Low", "Normal", "High", "Urgent"] as const;

/* ---- platform settings ---- */

export async function apiPlatformSettings() {
  const { data } = await apiClient.get<PlatformSettings>("/staff/settings");
  return data;
}

export async function apiSavePlatformSettings(body: Partial<PlatformSettings>) {
  const { data } = await apiClient.put<PlatformSettings>("/staff/settings", body);
  return data;
}

export async function apiSystemHealth() {
  const { data } = await apiClient.get<SystemHealthItem[]>("/staff/settings/health");
  return data;
}

/* ---- my staff account ---- */

export async function apiStaffProfile() {
  const { data } = await apiClient.get<StaffProfile>("/staff/profile");
  return data;
}

export async function apiSaveStaffProfile(body: {
  full_name?: string;
  phone?: string;
  avatar?: string;
}) {
  const { data } = await apiClient.put<StaffProfile>("/staff/profile", body);
  return data;
}

export async function apiStaffChangePassword(current_password: string, new_password: string) {
  const { data } = await apiClient.post<{ message: string }>("/staff/profile/password", {
    current_password,
    new_password,
  });
  return data;
}

export async function apiStaffStats() {
  const { data } = await apiClient.get<StaffStats>("/staff/profile/stats");
  return data;
}

/* ---- notification preferences ---- */

export async function apiStaffNotificationPrefs() {
  const { data } = await apiClient.get<StaffNotificationPrefs>("/staff/notifications");
  return data;
}

export async function apiSaveStaffNotificationPrefs(body: {
  rows: NotificationRow[];
  quiet_hours?: { enabled: boolean; from: string; to: string };
}) {
  const { data } = await apiClient.put<StaffNotificationPrefs>("/staff/notifications", body);
  return data;
}

/* ---- activity ---- */

export async function apiStaffActivity(
  params: { mine?: boolean; category?: string; days?: number; limit?: number } = {},
) {
  const { data } = await apiClient.get<ActivityItem[]>("/staff/activity", { params });
  return data;
}

export async function apiStaffActivityOverview(params: { mine?: boolean; days?: number } = {}) {
  const { data } = await apiClient.get<ActivityOverview>("/staff/activity/overview", { params });
  return data;
}

/* ---- support ---- */

export async function apiStaffTickets() {
  const { data } = await apiClient.get<Ticket[]>("/staff/support");
  return data;
}

export async function apiRaiseTicket(body: {
  subject: string;
  message: string;
  category: string;
  priority: string;
}) {
  const { data } = await apiClient.post<Ticket>("/staff/support", body);
  return data;
}
