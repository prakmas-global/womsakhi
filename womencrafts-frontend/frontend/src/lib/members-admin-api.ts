/**
 * The members directory, as an admin runs it.
 *
 * ── What this adds to `api.ts` ──────────────────────────────────────────────
 * `api.ts` has the plain list/create/update/delete calls. Everything an admin
 * needs beyond that — a member's real profile (directory row + login state +
 * what she has actually done), approve/reject/suspend/restore with a reason,
 * bulk status, CSV export, real growth figures, and segments defined by a
 * rule rather than a typed-in count — lives here.
 *
 * ── Nothing here reads her private data ─────────────────────────────────────
 * The profile counts bookings, enrolments, posts and orders from the
 * collections that record them. It never touches her vault or her
 * in-case-of-emergency data, and the server has no endpoint that would.
 */

import { apiClient, type ApiMember, type MemberListParams, type Paginated } from "./api";

export type { ApiMember, MemberListParams, Paginated };

// ── Figures ──────────────────────────────────────────────────────────────────

export interface MemberStats {
  total: number;
  active: number;
  inactive: number;
  pending: number;
  rejected: number;
  /** Accounts that completed verification — from `users`, where that lives. */
  verified: number;
  new_this_month: number;
  new_last_month: number;
  by_role: Record<string, number>;
  by_segment: Record<string, number>;
  by_status: Record<string, number>;
}

export interface GrowthPoint {
  label: string;
  /** Directory size at the end of that week. */
  value: number;
  /** Members who joined during that week. */
  new: number;
}

export const apiMemberStatsLive = () =>
  apiClient.get<MemberStats>("/members/stats").then((r) => r.data);

export const apiMemberGrowth = (weeks = 12) =>
  apiClient.get<{ points: GrowthPoint[]; weeks: number }>("/members/growth", { params: { weeks } })
    .then((r) => r.data);

export const apiListMembersLive = (params: MemberListParams & { ids?: string } = {}) =>
  apiClient.get<Paginated<ApiMember>>("/members", { params }).then((r) => r.data);

// ── One member ───────────────────────────────────────────────────────────────

export interface AccountSummary {
  id: string;
  verification_status: string;
  verification_label: string;
  verified_at: string;
  email_verified_at: string;
  is_active: boolean;
  locale: string;
  onboarding_complete: boolean;
  last_login_at: string;
  rejection_reason: string;
  created_at: string;
  /** What she said she needed at intake — the context staff use to help her. */
  needs: string[];
  /** Set when she asked for her account to be deleted; "" otherwise. */
  deletion_requested_at: string;
  deletion_reason: string;
}

export interface ActivityCounts {
  bookings: number;
  enrolments: number;
  posts: number;
  replies: number;
  circles: number;
  events: number;
  applications: number;
  orders: number;
  total: number;
}

export interface ProfileEnrolment {
  id: string;
  program_name: string;
  status: string;
  progress: number;
  started: string;
}

export interface ProfileBooking {
  id: string;
  service_name: string;
  date: string;
  time: string;
  mode: string;
  status: string;
}

export interface ProfileAuditRow {
  id: string;
  by: string;
  action: string;
  detail: string;
  when: string;
}

export interface MemberProfile {
  member: ApiMember;
  /** Null when the directory row has no login behind it (added by staff, never signed up). */
  account: AccountSummary | null;
  activity: ActivityCounts;
  enrolments: ProfileEnrolment[];
  bookings: ProfileBooking[];
  history: ProfileAuditRow[];
}

export const apiMemberProfile = (id: string) =>
  apiClient.get<MemberProfile>(`/members/${id}/profile`).then((r) => r.data);

export const apiApproveMember = (id: string, reason = "") =>
  apiClient.post<ApiMember>(`/members/${id}/approve`, { reason }).then((r) => r.data);

export const apiRejectMember = (id: string, reason: string) =>
  apiClient.post<ApiMember>(`/members/${id}/reject`, { reason }).then((r) => r.data);

export const apiSuspendMember = (id: string, reason: string) =>
  apiClient.post<ApiMember>(`/members/${id}/suspend`, { reason }).then((r) => r.data);

export const apiRestoreMember = (id: string, reason = "") =>
  apiClient.post<ApiMember>(`/members/${id}/restore`, { reason }).then((r) => r.data);

export const apiDeleteMemberWithReason = (id: string, reason = "") =>
  apiClient.delete<{ message: string }>(`/members/${id}`, { params: { reason } }).then((r) => r.data);

export const apiBulkMemberStatus = (ids: string[], status: "Active" | "Inactive", reason = "") =>
  apiClient.post<{ changed: number; skipped: number; message: string }>(
    "/members/bulk-status", { ids, status, reason },
  ).then((r) => r.data);

export const apiBulkMemberRegion = (ids: string[], region: string, reason = "") =>
  apiClient.post<{ changed: number; skipped: number; message: string }>(
    "/members/bulk-region", { ids, region, reason },
  ).then((r) => r.data);

/** The filtered list (or the given ids) as a CSV blob, ready to save. */
export const apiExportMembers = (params: MemberListParams & { ids?: string } = {}) =>
  apiClient.get("/members/export", { params, responseType: "blob" }).then((r) => r.data as Blob);

// ── Segments ─────────────────────────────────────────────────────────────────

/** A field left out means "any"; an explicit "" means "not set". */
export interface SegmentRule {
  segment?: string;
  role?: string;
  status?: string;
}

export interface LiveSegment {
  id: string;
  name: string;
  desc: string;
  status: string;
  icon: string;
  rule: SegmentRule;
  member_count: number;
  active_count: number;
  active_pct: number;
  pct_of_total: number;
  new_30d: number;
  prev_30d: number;
  created_at: string;
}

export interface SegmentList {
  items: LiveSegment[];
  total: number;
  members_total: number;
  /** Members no active segment claims. */
  unsegmented: number;
}

export interface SegmentGrowth {
  labels: string[];
  series: { id: string; name: string; points: number[] }[];
}

export interface SegmentInputLive {
  name: string;
  desc?: string;
  status?: "Active" | "Inactive";
  icon?: string;
  rule?: SegmentRule;
}

export const apiListSegmentsLive = (params: { q?: string; status?: string } = {}) =>
  apiClient.get<SegmentList>("/segments", { params }).then((r) => r.data);

export const apiSegmentGrowth = (weeks = 8) =>
  apiClient.get<SegmentGrowth>("/segments/growth", { params: { weeks } }).then((r) => r.data);

export const apiCreateSegmentLive = (body: SegmentInputLive) =>
  apiClient.post<LiveSegment>("/segments", body).then((r) => r.data);

export const apiUpdateSegmentLive = (id: string, body: Partial<SegmentInputLive>) =>
  apiClient.patch<LiveSegment>(`/segments/${id}`, body).then((r) => r.data);

export const apiDeleteSegmentLive = (id: string) =>
  apiClient.delete<{ message: string }>(`/segments/${id}`).then((r) => r.data);

// ── Small shared helpers for the two screens ─────────────────────────────────

/** Save a CSV blob through the browser's download path. */
export function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Give the click a tick to start before the URL is revoked.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** "12 Sep 2026" or "—" when the timestamp is missing. */
export function shortDate(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

/** "12 Sep 2026, 4:05 pm" or "—". */
export function shortDateTime(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-IN", {
    day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit",
  });
}

/** A rule in words: "Segment is Artisan · Role is Instructor". */
export function describeRule(rule: SegmentRule): string {
  const parts: string[] = [];
  if (rule.segment !== undefined) parts.push(rule.segment === "" ? "No segment set" : `Segment is ${rule.segment}`);
  if (rule.role !== undefined) parts.push(rule.role === "" ? "No role set" : `Role is ${rule.role}`);
  if (rule.status !== undefined) parts.push(rule.status === "" ? "No status set" : `Status is ${rule.status}`);
  return parts.length ? parts.join(" · ") : "All members";
}


/* ---------------- deletion requests ---------------- */

export interface DeletionRequestRow {
  user_id: string;
  member_id: string;
  name: string;
  email: string;
  code: string;
  reason: string;
  requested_at: string;
  days_waiting: number;
  overdue: boolean;
}

export interface DeletionRequestList {
  items: DeletionRequestRow[];
  total: number;
  overdue: number;
}

export const apiDeletionRequests = () =>
  apiClient.get<DeletionRequestList>("/members/deletions").then((r) => r.data);

export const apiCompleteDeletion = (userId: string, note = "") =>
  apiClient.post<{ message: string }>(`/members/deletions/${userId}/complete`, null, { params: { note } }).then((r) => r.data);

export const apiCancelDeletion = (userId: string, reason = "") =>
  apiClient.post<{ message: string }>(`/members/deletions/${userId}/cancel`, null, { params: { reason } }).then((r) => r.data);
