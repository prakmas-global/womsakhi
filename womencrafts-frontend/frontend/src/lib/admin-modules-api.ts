import { apiClient } from "./api";

/**
 * The staff side of the member modules.
 *
 * Everything here is guarded server-side by an RBAC module key — "growth",
 * "community" or "safety" — so a role without that key gets a 403 no matter
 * what the sidebar shows it.
 */

/* ---------------- growth: events ---------------- */

export interface AdminEvent {
  id: string;
  title: string;
  desc: string;
  category: string;
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
  registered_count: number;
  seats_left: number;
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

export type EventInput = Omit<
  AdminEvent,
  "id" | "date_label" | "registered_count" | "seats_left"
>;

export async function apiAdminEvents(params: { q?: string; status?: string } = {}) {
  const { data } = await apiClient.get<AdminEvent[]>("/admin/growth/events", { params });
  return data;
}

export async function apiCreateEvent(body: EventInput) {
  const { data } = await apiClient.post<AdminEvent>("/admin/growth/events", body);
  return data;
}

export async function apiUpdateEvent(id: string, body: EventInput) {
  const { data } = await apiClient.put<AdminEvent>(`/admin/growth/events/${id}`, body);
  return data;
}

export async function apiCancelEventAdmin(id: string) {
  const { data } = await apiClient.delete<{ message: string }>(`/admin/growth/events/${id}`);
  return data;
}

export async function apiEventAttendees(id: string) {
  const { data } = await apiClient.get<EventAttendee[]>(`/admin/growth/events/${id}/attendees`);
  return data;
}

/* ---------------- growth: mentors ---------------- */

export interface AdminMentor {
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
  rating: number;
  rating_count: number;
  sessions_done: number;
  status: string;
  open_requests: number;
}

export type MentorInput = Pick<
  AdminMentor,
  | "name"
  | "headline"
  | "bio"
  | "photo"
  | "expertise"
  | "languages"
  | "experience_years"
  | "location"
  | "availability"
  | "status"
>;

export interface AdminMentorRequest {
  id: string;
  member_name: string;
  member_email: string;
  mentor_id: string;
  mentor_name: string;
  goal: string;
  preferred_time: string;
  status: string;
  staff_note: string;
  when: string;
}

export async function apiAdminMentors(params: { q?: string } = {}) {
  const { data } = await apiClient.get<AdminMentor[]>("/admin/growth/mentors", { params });
  return data;
}

export async function apiCreateMentor(body: MentorInput) {
  const { data } = await apiClient.post<AdminMentor>("/admin/growth/mentors", body);
  return data;
}

export async function apiUpdateMentor(id: string, body: MentorInput) {
  const { data } = await apiClient.put<AdminMentor>(`/admin/growth/mentors/${id}`, body);
  return data;
}

export async function apiRetireMentor(id: string) {
  const { data } = await apiClient.delete<{ message: string }>(`/admin/growth/mentors/${id}`);
  return data;
}

export async function apiMentorRequests(params: { status?: string } = {}) {
  const { data } = await apiClient.get<AdminMentorRequest[]>("/admin/growth/mentor-requests", {
    params,
  });
  return data;
}

export async function apiDecideMentorRequest(
  id: string,
  body: { status: string; staff_note?: string },
) {
  const { data } = await apiClient.patch<AdminMentorRequest>(
    `/admin/growth/mentor-requests/${id}`,
    body,
  );
  return data;
}

/* ---------------- growth: opportunities ---------------- */

export interface AdminOpportunity {
  id: string;
  title: string;
  org: string;
  kind: string;
  desc: string;
  location: string;
  mode: string;
  pay: string;
  skills: string[];
  openings: number;
  deadline: string;
  deadline_label: string;
  experience: string;
  contact_note: string;
  applicant_count: number;
  status: string;
  posted: string;
}

export type OpportunityInput = Omit<
  AdminOpportunity,
  "id" | "deadline_label" | "applicant_count" | "posted"
>;

export interface AdminApplication {
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
}

export async function apiAdminOpportunities(params: { q?: string; kind?: string } = {}) {
  const { data } = await apiClient.get<AdminOpportunity[]>("/admin/growth/opportunities", {
    params,
  });
  return data;
}

export async function apiCreateOpportunity(body: OpportunityInput) {
  const { data } = await apiClient.post<AdminOpportunity>("/admin/growth/opportunities", body);
  return data;
}

export async function apiUpdateOpportunity(id: string, body: OpportunityInput) {
  const { data } = await apiClient.put<AdminOpportunity>(
    `/admin/growth/opportunities/${id}`,
    body,
  );
  return data;
}

export async function apiCloseOpportunity(id: string) {
  const { data } = await apiClient.delete<{ message: string }>(
    `/admin/growth/opportunities/${id}`,
  );
  return data;
}

export async function apiAdminApplications(
  params: { opportunity_id?: string; status?: string } = {},
) {
  const { data } = await apiClient.get<AdminApplication[]>("/admin/growth/applications", {
    params,
  });
  return data;
}

export async function apiDecideApplication(
  id: string,
  body: { status: string; staff_note?: string },
) {
  const { data } = await apiClient.patch<AdminApplication>(
    `/admin/growth/applications/${id}`,
    body,
  );
  return data;
}

/* ---------------- community ---------------- */

export interface AdminCircle {
  id: string;
  name: string;
  topic: string;
  desc: string;
  guidelines: string;
  is_private: boolean;
  member_count: number;
  post_count: number;
  status: string;
}

export type CircleInput = Pick<
  AdminCircle,
  "name" | "topic" | "desc" | "guidelines" | "is_private" | "status"
>;

export interface AdminPost {
  id: string;
  circle_id: string;
  circle_name: string;
  author_name: string;
  body: string;
  likes: number;
  reply_count: number;
  pinned: boolean;
  hidden: boolean;
  when: string;
}

export interface AdminStory {
  id: string;
  author_name: string;
  member_email: string;
  title: string;
  body: string;
  program: string;
  status: string;
  featured: boolean;
  likes: number;
  when: string;
}

export async function apiAdminCircles(params: { q?: string } = {}) {
  const { data } = await apiClient.get<AdminCircle[]>("/admin/community/circles", { params });
  return data;
}

export async function apiCreateCircle(body: CircleInput) {
  const { data } = await apiClient.post<AdminCircle>("/admin/community/circles", body);
  return data;
}

export async function apiUpdateCircle(id: string, body: CircleInput) {
  const { data } = await apiClient.put<AdminCircle>(`/admin/community/circles/${id}`, body);
  return data;
}

export async function apiArchiveCircle(id: string) {
  const { data } = await apiClient.delete<{ message: string }>(`/admin/community/circles/${id}`);
  return data;
}

export async function apiAdminPosts(params: { circle_id?: string; hidden?: boolean } = {}) {
  const { data } = await apiClient.get<AdminPost[]>("/admin/community/posts", { params });
  return data;
}

export async function apiHidePost(id: string) {
  const { data } = await apiClient.post<{ message: string }>(`/admin/community/posts/${id}/hide`);
  return data;
}

export async function apiPinPost(id: string) {
  const { data } = await apiClient.post<{ message: string }>(`/admin/community/posts/${id}/pin`);
  return data;
}

export async function apiAdminStories(params: { status?: string } = {}) {
  const { data } = await apiClient.get<AdminStory[]>("/admin/community/stories", { params });
  return data;
}

export async function apiDecideStory(
  id: string,
  body: { status: string; featured?: boolean },
) {
  const { data } = await apiClient.patch<AdminStory>(`/admin/community/stories/${id}`, body);
  return data;
}

/* ---------------- safety & the support fund ---------------- */

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

export interface AdminReport {
  id: string;
  member_name: string;
  member_email: string;
  anonymous: boolean;
  category: string;
  about: string;
  details: string;
  status: string;
  staff_note: string;
  filed_on: string;
}

export interface AdminSupportRequest {
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
  status: string;
  staff_note: string;
  asked_on: string;
}

export interface ModuleCounts {
  pending_stories: number;
  open_alerts: number;
  open_reports: number;
  pending_support: number;
  new_applications: number;
  pending_mentor_requests: number;
}

export async function apiAdminAlerts(params: { status?: string } = {}) {
  const { data } = await apiClient.get<AdminAlert[]>("/admin/safety/alerts", { params });
  return data;
}

export async function apiDecideAlert(id: string, body: { status: string; resolution?: string }) {
  const { data } = await apiClient.patch<AdminAlert>(`/admin/safety/alerts/${id}`, body);
  return data;
}

export async function apiAdminReports(params: { status?: string } = {}) {
  const { data } = await apiClient.get<AdminReport[]>("/admin/safety/reports", { params });
  return data;
}

export async function apiDecideReport(id: string, body: { status: string; staff_note?: string }) {
  const { data } = await apiClient.patch<AdminReport>(`/admin/safety/reports/${id}`, body);
  return data;
}

export async function apiAdminSupport(params: { status?: string } = {}) {
  const { data } = await apiClient.get<AdminSupportRequest[]>("/admin/safety/support", { params });
  return data;
}

export async function apiDecideSupport(
  id: string,
  body: { status: string; granted?: number; staff_note?: string },
) {
  const { data } = await apiClient.patch<AdminSupportRequest>(
    `/admin/safety/support/${id}`,
    body,
  );
  return data;
}

export async function apiModuleCounts() {
  const { data } = await apiClient.get<ModuleCounts>("/admin/safety/counts");
  return data;
}
