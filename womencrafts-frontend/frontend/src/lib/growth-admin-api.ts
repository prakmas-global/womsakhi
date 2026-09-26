import { apiClient } from "./api";

/**
 * The staff side of Growth: events, mentors, mentorship requests, work and
 * applications. Every call is behind the "growth" module key server-side.
 *
 * Every count in these shapes is counted from rows by the server —
 * registrations, applications, requests, sessions — never read from a stored
 * counter. The seeds fill those counters with plausible numbers nothing backs.
 */

/* ── the numbers on the tiles ────────────────────────────────────────────── */

export interface GrowthSummary {
  events: { total: number; published: number; draft: number; cancelled: number; upcoming: number; registrations: number };
  mentors: { total: number; active: number; retired: number; pending_requests: number; mentees: number; sessions: number };
  requests: { total: number; pending: number; accepted: number; declined: number };
  opportunities: { total: number; open: number; closed: number; applications: number; openings: number };
  applications: { total: number; applied: number; shortlisted: number; interview: number; offered: number; closed: number; withdrawn: number };
}

export const apiGrowthSummary = () =>
  apiClient.get<GrowthSummary>("/admin/growth/summary").then((r) => r.data);

/* ── events ──────────────────────────────────────────────────────────────── */

export interface EventRow {
  id: string;
  title: string;
  desc: string;
  category: string;
  cover: string;
  date: string;
  date_label: string;
  time: string;
  duration: string;
  mode: string;
  venue: string;
  host: string;
  language: string;
  fee: number;
  seats: number;
  /** Rows in event_registrations holding a seat (registered + attended). */
  registered_count: number;
  attended_count: number;
  seats_left: number;
  status: string;
  cancel_reason: string;
}

export interface EventInput {
  title: string;
  desc: string;
  category: string;
  date: string;
  time: string;
  duration: string;
  mode: string;
  venue: string;
  host: string;
  seats: number;
  fee: number;
  language: string;
  status: string;
}

export interface EventAttendee {
  id: string;
  name: string;
  email: string;
  phone: string;
  member_code: string;
  status: string;
  registered_on: string;
}

export const apiGrowthEvents = (params: { q?: string; status?: string } = {}) =>
  apiClient.get<EventRow[]>("/admin/growth/events", { params }).then((r) => r.data);

export const apiGrowthCreateEvent = (body: EventInput) =>
  apiClient.post<EventRow>("/admin/growth/events", body).then((r) => r.data);

export const apiGrowthUpdateEvent = (id: string, body: EventInput) =>
  apiClient.put<EventRow>(`/admin/growth/events/${id}`, body).then((r) => r.data);

/** Cancels, never deletes; everyone registered is told the reason. */
export const apiGrowthCancelEvent = (id: string, reason: string) =>
  apiClient.post<EventRow>(`/admin/growth/events/${id}/cancel`, { reason }).then((r) => r.data);

export const apiGrowthAttendees = (id: string) =>
  apiClient.get<EventAttendee[]>(`/admin/growth/events/${id}/attendees`).then((r) => r.data);

export const apiGrowthAttendeesCsv = (id: string) =>
  apiClient
    .get(`/admin/growth/events/${id}/attendees/export`, { responseType: "blob" })
    .then((r) => r.data as Blob);

export const apiGrowthSetAttendee = (
  eventId: string,
  registrationId: string,
  status: "registered" | "attended" | "cancelled",
) =>
  apiClient
    .patch<EventAttendee>(`/admin/growth/events/${eventId}/attendees/${registrationId}`, { status })
    .then((r) => r.data);

/* ── mentors ─────────────────────────────────────────────────────────────── */

export interface MentorRow {
  id: string;
  name: string;
  headline: string;
  bio: string;
  photo: string;
  expertise: string[];
  languages: string[];
  experience_years: number;
  location: string;
  availability: string;
  status: string;
  /** Pending requests naming her. */
  open_requests: number;
  /** Accepted requests naming her. */
  mentees: number;
  /** Sessions staff have logged for her. */
  sessions: number;
  created_on: string;
}

export type MentorInput = Pick<
  MentorRow,
  | "name" | "headline" | "bio" | "photo" | "expertise" | "languages"
  | "experience_years" | "location" | "availability" | "status"
>;

export interface MentorSessionRow {
  id: string;
  mentor_id: string;
  request_id: string;
  member_name: string;
  held_on: string;
  note: string;
  logged_by: string;
  logged_on: string;
}

export const apiGrowthMentors = (params: { q?: string; status?: string } = {}) =>
  apiClient.get<MentorRow[]>("/admin/growth/mentors", { params }).then((r) => r.data);

export const apiGrowthCreateMentor = (body: MentorInput) =>
  apiClient.post<MentorRow>("/admin/growth/mentors", body).then((r) => r.data);

export const apiGrowthUpdateMentor = (id: string, body: MentorInput) =>
  apiClient.put<MentorRow>(`/admin/growth/mentors/${id}`, body).then((r) => r.data);

export const apiGrowthRetireMentor = (id: string) =>
  apiClient.delete<MentorRow>(`/admin/growth/mentors/${id}`).then((r) => r.data);

export const apiGrowthReactivateMentor = (id: string) =>
  apiClient.post<MentorRow>(`/admin/growth/mentors/${id}/reactivate`).then((r) => r.data);

export const apiGrowthMentorSessions = (id: string) =>
  apiClient.get<MentorSessionRow[]>(`/admin/growth/mentors/${id}/sessions`).then((r) => r.data);

export const apiGrowthLogSession = (
  id: string,
  body: { request_id: string; held_on: string; note: string },
) => apiClient.post<MentorSessionRow>(`/admin/growth/mentors/${id}/sessions`, body).then((r) => r.data);

/* ── mentorship requests ─────────────────────────────────────────────────── */

export interface MentorRequestRow {
  id: string;
  member_name: string;
  member_email: string;
  member_code: string;
  mentor_id: string;
  mentor_name: string;
  goal: string;
  preferred_time: string;
  status: string;
  staff_note: string;
  when: string;
  decided_by: string;
  decided_on: string;
}

export const apiGrowthRequests = (params: { status?: string; mentor_id?: string } = {}) =>
  apiClient.get<MentorRequestRow[]>("/admin/growth/mentor-requests", { params }).then((r) => r.data);

/**
 * Accept, decline (reason required — she is told it), close, or hand the
 * request to a different mentor with `mentor_id`.
 */
export const apiGrowthDecideRequest = (
  id: string,
  body: { status: string; staff_note?: string; mentor_id?: string },
) => apiClient.patch<MentorRequestRow>(`/admin/growth/mentor-requests/${id}`, body).then((r) => r.data);

/* ── opportunities ───────────────────────────────────────────────────────── */

export interface OpportunityRow {
  id: string;
  title: string;
  org: string;
  kind: string;
  desc: string;
  location: string;
  mode: string;
  pay: string;
  pay_low_minor: number;
  pay_high_minor: number;
  pay_period: string;
  skills: string[];
  openings: number;
  deadline: string;
  deadline_label: string;
  experience: string;
  contact_note: string;
  /** Applications rows that are not withdrawn. */
  applicant_count: number;
  status: string;
  posted: string;
}

export type OpportunityInput = Omit<
  OpportunityRow,
  "id" | "deadline_label" | "applicant_count" | "posted" | "pay_low_minor" | "pay_high_minor" | "pay_period"
>;

export const apiGrowthOpportunities = (params: { q?: string; kind?: string; status?: string } = {}) =>
  apiClient.get<OpportunityRow[]>("/admin/growth/opportunities", { params }).then((r) => r.data);

export const apiGrowthCreateOpportunity = (body: OpportunityInput) =>
  apiClient.post<OpportunityRow>("/admin/growth/opportunities", body).then((r) => r.data);

export const apiGrowthUpdateOpportunity = (id: string, body: OpportunityInput) =>
  apiClient.put<OpportunityRow>(`/admin/growth/opportunities/${id}`, body).then((r) => r.data);

export const apiGrowthCloseOpportunity = (id: string) =>
  apiClient.delete<OpportunityRow>(`/admin/growth/opportunities/${id}`).then((r) => r.data);

export const apiGrowthReopenOpportunity = (id: string) =>
  apiClient.post<OpportunityRow>(`/admin/growth/opportunities/${id}/reopen`).then((r) => r.data);

/* ── applications ────────────────────────────────────────────────────────── */

export interface HistoryEntry {
  status: string;
  /** ISO timestamp. */
  at: string;
  by: string;
  note: string;
}

export interface ApplicationRow {
  id: string;
  member_name: string;
  member_email: string;
  member_phone: string;
  member_code: string;
  opportunity_id: string;
  opportunity_title: string;
  org: string;
  note: string;
  status: string;
  staff_note: string;
  applied_on: string;
  updated_on: string;
  history: HistoryEntry[];
}

export const apiGrowthApplications = (params: { opportunity_id?: string; status?: string } = {}) =>
  apiClient.get<ApplicationRow[]>("/admin/growth/applications", { params }).then((r) => r.data);

/** Closing requires a reason; the server refuses a silent decline. */
export const apiGrowthDecideApplication = (id: string, body: { status: string; staff_note?: string }) =>
  apiClient.patch<ApplicationRow>(`/admin/growth/applications/${id}`, body).then((r) => r.data);

/* ── shared ──────────────────────────────────────────────────────────────── */

/** Save a CSV blob through the browser's download path. */
export function saveGrowthBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** "12 Sep 2026, 4:05 pm" from an ISO stamp, or "" when missing. */
export function whenLabel(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
}
