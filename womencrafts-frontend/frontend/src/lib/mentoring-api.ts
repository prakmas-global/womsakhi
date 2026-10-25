import { apiClient } from "./api";

/**
 * Mentoring (a member who mentors) and "Your services" — backend:
 * routes/mentoring.py. No approval anywhere: she switches each one on herself.
 */

export interface MentorProfile {
  id: string;
  live: boolean;
  headline: string;
  bio: string;
  expertise: string[];
  languages: string[];
  experience_years: number;
  location: string;
  availability: string;
  session_mode: string;
  session_minutes: number;
  price_minor: number;
  upi_id: string;
  sessions_done: number;
}

export interface MentorInput {
  headline: string;
  bio: string;
  expertise: string[];
  languages: string[];
  experience_years: number;
  location: string;
  availability: string;
  session_mode: string;
  session_minutes: number;
  price_rupees: number;
  upi_id: string;
}

export interface IncomingRequest {
  id: string;
  learner: string;
  goal: string;
  preferred_time: string;
  /** pending | accepted | declined | closed */
  status: string;
  asked_on: string;
  scheduled_for: string;
  meeting: string;
  mentor_note: string;
  price_minor: number;
  /** "" | awaiting | claimed | paid */
  payment_status: string;
  reference: string;
}

export interface ServiceStep { label: string; done: boolean; href: string }
export interface Service {
  active: boolean;
  headline: string;
  steps: ServiceStep[];
  /** Things waiting on her: orders to make, payments to confirm, requests to answer. */
  to_do: number;
  /** This month, paise. */
  earned_minor: number;
}
export interface MyServices { seller: Service; teacher: Service; mentor: Service }

export const SESSION_MODES = ["Video call", "Phone call", "In person"];

const get = <T,>(url: string, signal?: AbortSignal) => apiClient.get<T>(url, { signal }).then((r) => r.data);

export const apiMyServices = (s?: AbortSignal) => get<MyServices>("/services/me", s);
export const apiMyMentorProfile = (s?: AbortSignal) => get<MentorProfile | null>("/mentoring/me", s);
export const apiIncomingRequests = (s?: AbortSignal) => get<IncomingRequest[]>("/mentoring/requests", s);

export async function apiSaveMentorProfile(input: MentorInput) {
  const { data } = await apiClient.put<MentorProfile>("/mentoring/me", input);
  return data;
}

export async function apiSetMentoringLive(live: boolean) {
  const { data } = await apiClient.post<MentorProfile>(`/mentoring/me/${live ? "resume" : "pause"}`);
  return data;
}

export async function apiAcceptRequest(id: string, scheduled_for: string, meeting: string, note = "") {
  const { data } = await apiClient.post<IncomingRequest>(`/mentoring/requests/${id}/accept`, { scheduled_for, meeting, note });
  return data;
}

export async function apiDeclineRequest(id: string, note = "") {
  const { data } = await apiClient.post<IncomingRequest>(`/mentoring/requests/${id}/decline`, { note });
  return data;
}

export async function apiSessionPaymentReceived(id: string) {
  const { data } = await apiClient.post<IncomingRequest>(`/mentoring/requests/${id}/payment-received`);
  return data;
}

export async function apiSessionDone(id: string) {
  const { data } = await apiClient.post<IncomingRequest>(`/mentoring/requests/${id}/done`);
  return data;
}
