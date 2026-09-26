import { apiClient } from "./api";

/**
 * The staff side of Safety: alerts, reports, helplines and the support fund.
 *
 * Everything here sits behind `/admin/safety`, which main.py mounts behind
 * the `safety` module guard; each write additionally needs `safety.edit` or
 * `safety.approve`. A role without the module gets 403 on all of it.
 *
 * Deliberately NOT here: anything from a member's private vault or her
 * in-case-of-emergency data. There is no endpoint for those and this file
 * must never grow one.
 */

/* ---------------- alerts ---------------- */

export interface AdminAlert {
  id: string;
  member_name: string;
  member_email: string;
  member_phone: string;
  note: string;
  location: string;
  contacts_notified: number;
  status: string;
  handled_by: string;
  resolution: string;
  raised_at: string;
  contacts: { id: string; name: string; phone: string; relation: string }[];
}

export async function apiSafetyAlerts(params: { status?: string } = {}) {
  const { data } = await apiClient.get<AdminAlert[]>("/admin/safety/alerts", { params });
  return data;
}

export async function apiDecideSafetyAlert(id: string, body: { status: string; resolution?: string }) {
  const { data } = await apiClient.patch<AdminAlert>(`/admin/safety/alerts/${id}`, body);
  return data;
}

/* ---------------- reports ---------------- */

export type ReportStatus = "open" | "reviewing" | "actioned" | "closed";

export interface SafetyReportRow {
  id: string;
  member_name: string;
  member_email: string;
  anonymous: boolean;
  category: string;
  about: string;
  details: string;
  status: ReportStatus;
  staff_note: string;
  filed_on: string;
  filed_at: string;
  updated_at: string;
  evidence: string;
  assigned_to: string;
  assigned_to_name: string;
  assigned_at: string;
  resolved_at: string;
  resolved_by: string;
  notes_count: number;
}

export interface ReportNote {
  id: string;
  by_id: string;
  by_name: string;
  text: string;
  at: string;
}

export interface ReportHistoryEntry {
  kind: "status" | "assign";
  at: string;
  by_id: string;
  by_name: string;
  from: string;
  to: string;
  reason: string;
  told_member?: boolean;
}

export interface SafetyReportDetail extends SafetyReportRow {
  notes: ReportNote[];
  history: ReportHistoryEntry[];
}

export interface ReportSummary {
  open: number;
  reviewing: number;
  actioned: number;
  closed: number;
  resolved: number;
  total: number;
  unassigned_open: number;
  assigned_to_me: number;
}

export interface Assignee {
  id: string;
  full_name: string;
  email: string;
  role: string;
  is_me: boolean;
}

export const REPORT_STATUS_LABEL: Record<ReportStatus, string> = {
  open: "New",
  reviewing: "In review",
  actioned: "Resolved · action taken",
  closed: "Resolved · closed",
};

export const REPORT_STATUS_TONE: Record<ReportStatus, "rose" | "amber" | "emerald" | "slate"> = {
  open: "rose",
  reviewing: "amber",
  actioned: "emerald",
  closed: "slate",
};

export function isResolved(status: string) {
  return status === "actioned" || status === "closed";
}

export async function apiSafetyReports(params: { status?: string; assigned?: string } = {}) {
  const { data } = await apiClient.get<SafetyReportRow[]>("/admin/safety/reports", { params });
  return data;
}

export async function apiReportSummary() {
  const { data } = await apiClient.get<ReportSummary>("/admin/safety/reports/summary");
  return data;
}

export async function apiSafetyReport(id: string) {
  const { data } = await apiClient.get<SafetyReportDetail>(`/admin/safety/reports/${id}`);
  return data;
}

export async function apiAssignees() {
  const { data } = await apiClient.get<Assignee[]>("/admin/safety/assignees");
  return data;
}

/** `"me"` assigns to the caller, `""` clears the assignment. */
export async function apiAssignReport(id: string, assignee_id: string) {
  const { data } = await apiClient.post<SafetyReportDetail>(`/admin/safety/reports/${id}/assign`, {
    assignee_id,
  });
  return data;
}

export async function apiAddReportNote(id: string, text: string) {
  const { data } = await apiClient.post<SafetyReportDetail>(`/admin/safety/reports/${id}/notes`, {
    text,
  });
  return data;
}

export async function apiChangeReportStatus(
  id: string,
  body: { status: ReportStatus; reason: string; staff_note?: string },
) {
  const { data } = await apiClient.patch<SafetyReportDetail>(`/admin/safety/reports/${id}`, body);
  return data;
}

/* ---------------- helplines ---------------- */

export interface HelplineRow {
  id: string;
  name: string;
  number: string;
  desc: string;
  urgent: boolean;
  order: number;
  builtin: boolean;
  updated_at: string;
}

export interface HelplineList {
  items: HelplineRow[];
  managed: boolean;
  builtin_count: number;
}

export interface HelplineInput {
  name: string;
  number: string;
  desc: string;
  urgent: boolean;
  order: number;
}

export async function apiHelplineList() {
  const { data } = await apiClient.get<HelplineList>("/admin/safety/helplines");
  return data;
}

export async function apiImportDefaultHelplines() {
  const { data } = await apiClient.post<HelplineList>("/admin/safety/helplines/import-defaults");
  return data;
}

export async function apiAddHelpline(body: HelplineInput) {
  const { data } = await apiClient.post<HelplineList>("/admin/safety/helplines", body);
  return data;
}

export async function apiEditHelpline(id: string, body: HelplineInput) {
  const { data } = await apiClient.put<HelplineList>(`/admin/safety/helplines/${id}`, body);
  return data;
}

export async function apiRemoveHelpline(id: string) {
  const { data } = await apiClient.delete<HelplineList>(`/admin/safety/helplines/${id}`);
  return data;
}

/* ---------------- support fund ---------------- */

export type SupportStatus = "pending" | "approved" | "partial" | "declined";

export interface SupportRequestRow {
  id: string;
  member_name: string;
  member_email: string;
  member_code: string;
  what_for: string;
  reason: string;
  amount_needed_minor: number;
  amount_needed_label: string;
  household_income: string;
  dependants: number;
  granted_minor: number;
  granted_label: string;
  status: SupportStatus;
  staff_note: string;
  asked_on: string;
  asked_at: string;
  decided_by: string;
  decided_at: string;
  decision_reason: string;
}

export interface SupportSummary {
  pending: number;
  approved: number;
  partial: number;
  declined: number;
  total: number;
  pending_asked_minor: number;
  approved_granted_minor: number;
  ledger_credit_count: number;
  ledger_credit_minor: number;
  ledger_linked_count: number;
  ledger_linked_minor: number;
  currency: string;
}

export async function apiSupportRequests(params: { status?: string } = {}) {
  const { data } = await apiClient.get<SupportRequestRow[]>("/admin/safety/support", { params });
  return data;
}

export async function apiSupportSummary() {
  const { data } = await apiClient.get<SupportSummary>("/admin/safety/support/summary");
  return data;
}

export async function apiDecideSupportRequest(
  id: string,
  body: { status: SupportStatus; granted: number; staff_note: string; reason: string },
) {
  const { data } = await apiClient.patch<SupportRequestRow>(`/admin/safety/support/${id}`, body);
  return data;
}

/* ---------------- counts ---------------- */

export interface SafetyCounts {
  pending_stories: number;
  open_alerts: number;
  open_reports: number;
  pending_support: number;
  new_applications: number;
  pending_mentor_requests: number;
}

export async function apiSafetyCounts() {
  const { data } = await apiClient.get<SafetyCounts>("/admin/safety/counts");
  return data;
}

/** Minor units → "₹1,234". Guarded: a missing or NaN input renders as zero. */
export function rupees(minor: number | undefined | null, currency = "₹") {
  const n = Number(minor);
  const whole = Number.isFinite(n) ? Math.round(n / 100) : 0;
  return `${currency}${whole.toLocaleString("en-IN")}`;
}

/** ISO string → "26 Sep 2026, 3:10 pm"; empty when there is no date. */
export function when(iso: string | undefined | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("en-IN", {
    day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit",
  });
}


/* ---------------- assist links ---------------- */

export interface AssistLinkRow {
  id: string;
  helper_id: string;
  helper_name: string;
  helper_code: string;
  helped_name: string;
  because: string;
  owns_phone: boolean;
  consented: boolean;
  consent_on: string;
  done_count: number;
  last_did: string;
  open_tasks: number;
  created_at: string;
  revoked_at: string;
  revoked_reason: string;
  revoked_by: string;
}

export interface AssistLinkList {
  items: AssistLinkRow[];
  total: number;
  consented: number;
  unconsented: number;
  revoked: number;
}

export async function apiAssistLinks(params: { state?: string; q?: string } = {}) {
  const { data } = await apiClient.get<AssistLinkList>("/admin/safety/assist-links", { params });
  return data;
}

export async function apiRevokeAssistLink(id: string, reason: string) {
  const { data } = await apiClient.post<AssistLinkRow>(`/admin/safety/assist-links/${id}/revoke`, { reason });
  return data;
}
