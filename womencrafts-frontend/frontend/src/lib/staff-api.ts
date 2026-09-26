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

/* ---- my own account (settings-account rebuild) ----
 *
 * Everything here is scoped to the caller on the server: there is no id in
 * any path. These back Settings › Profile / Security / Sessions / Switch role
 * and the log-out screen, which used to render a fixed "Admin User".
 */

export interface ThisSession {
  /** When the token this request carried was minted (sign-in or last refresh). */
  started_at: string;
  /** When it lapses if she stops using the app. */
  expires_at: string;
  generation: number;
}

/** One address this account has acted from, taken from the audit trail. */
export interface Origin {
  ip: string;
  first_seen: string;
  last_seen: string;
  actions: number;
}

export interface MyAccount {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  avatar: string;
  role: string;
  is_active: boolean;
  modules: string[];
  created_at: string;
  last_login_at: string;
  password_changed_at: string;
  /** Times every session was ended — the account's session generation. */
  token_version: number;
  sessions_ended_at: string;
  /** Failed attempts since the last successful sign-in. */
  failed_logins: number;
  locked_until: string;
  two_factor: { available: boolean; enabled: boolean; note: string };
  this_session: ThisSession;
  /** False: sign-in records the time, not the device. */
  devices_recorded: boolean;
  devices_note: string;
  origins: Origin[];
  activity: { total: number; this_month: number; last_at: string };
  tickets_open: number;
  /** False: preferences are stored, nothing sends by channel yet. */
  prefs_applied: boolean;
}

export async function apiMyAccount() {
  const { data } = await apiClient.get<MyAccount>("/staff/me/account");
  return data;
}

/** Ends every session on every device, THIS ONE INCLUDED. Sign in again after. */
export async function apiSignOutEverywhere() {
  const { data } = await apiClient.post<{ message: string; generation: number }>(
    "/staff/me/sign-out-everywhere",
  );
  return data;
}

export interface TwoFactorSetup {
  secret: string;
  provisioning_uri: string;
}

export async function apiStartTwoFactor(current_password: string) {
  const { data } = await apiClient.post<TwoFactorSetup>("/staff/me/two-factor/setup", { current_password });
  return data;
}

export async function apiEnableTwoFactor(code: string) {
  const { data } = await apiClient.post<{ enabled: boolean; recovery_codes: string[] }>(
    "/staff/me/two-factor/enable", { code },
  );
  return data;
}

export async function apiDisableTwoFactor(current_password: string, code: string) {
  const { data } = await apiClient.post<{ enabled: boolean }>(
    "/staff/me/two-factor/disable", { current_password, code },
  );
  return data;
}

export interface PasswordChanged {
  message: string;
  other_sessions_ended: boolean;
  access_token: string;
}

/** Verifies the current password, sets the new one, and ends every OTHER session. */
export async function apiChangeMyPassword(current_password: string, new_password: string) {
  const { data } = await apiClient.post<PasswordChanged>("/staff/profile/password", {
    current_password,
    new_password,
  });
  return data;
}

export interface RoleSummary {
  name: string;
  desc: string;
  status: string;
  modules: string[];
  is_mine: boolean;
}

export interface MyRoles {
  current: RoleSummary;
  /** Always false here: an account holds exactly one role. */
  holds_multiple: boolean;
  can_switch: boolean;
  note: string;
  roles: RoleSummary[];
  all_modules: string[];
}

export async function apiMyRoles() {
  const { data } = await apiClient.get<MyRoles>("/staff/me/roles");
  return data;
}

export interface NotificationDefaults {
  rows: NotificationRow[];
  quiet_hours: { enabled: boolean; from: string; to: string };
  /** False: nothing sends staff notifications by channel yet. */
  applied: boolean;
  applied_note: string;
}

export async function apiNotificationDefaults() {
  const { data } = await apiClient.get<NotificationDefaults>("/staff/notifications/defaults");
  return data;
}

/* ---- dates, the one way ---- */

/** "2026-09-26T05:00:00+00:00" → "26 Sep 2026, 10:30 am"; "" → "". */
export function formatWhen(iso: string, withTime = true): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    ...(withTime ? { hour: "numeric", minute: "2-digit" } : {}),
  });
}

/** Sidebar words for the module keys the API speaks. */
export const MODULE_LABEL: Record<string, string> = {
  dashboard: "Dashboard",
  users: "People",
  appointments: "Appointments",
  services: "Services",
  programs: "Programmes",
  calendar: "Calendar",
  messages: "Messages",
  analytics: "Analytics",
  reports: "Reports",
  content: "Content",
  feedback: "Feedback",
  ai: "Sakhi (AI)",
  community: "Community",
  growth: "Growth",
  safety: "Safety",
  settings: "Settings",
  notifications: "Notifications",
};
