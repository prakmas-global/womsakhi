import { apiClient } from "@/lib/api";

// --- Feedback module -------------------------------------------------------
// Typed wrappers over the live /feedback endpoints. JWT is auto-attached by
// the shared apiClient interceptor. Field names mirror the backend response
// (see app/schemas/feedback.py) so the page can map API -> UI shape directly.

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

// One row of the feedback table. `id` is the mongo id (used for status/delete).
export interface ApiFeedback {
  id: string;
  seq: number;
  face: string; // sentiment icon name: "Smile" | "Meh" | "Frown"
  face_tone: string; // "emerald" | "amber" | "rose"
  text: string;
  user: string;
  email: string;
  type: string;
  t_type: string; // type badge tone
  program: string;
  rating: number;
  sentiment: string;
  date: string; // e.g. "Jun 20, 2024 10:30 AM"
  status: string;
  s_tone: string; // status badge tone
  created_at: string;
  /** Staff replies and internal notes on this entry, oldest first. */
  replies: FeedbackReply[];
}

export interface FeedbackReply {
  id: string;
  by: string;        // staff name
  text: string;
  at: string;        // ISO timestamp
  internal: boolean; // true = note only she never sees
  emailed: boolean;  // true = the reply went out by email
}

export interface FeedbackStats {
  total_feedback: string;
  average_rating: string;
  positive_percentage: string;
  /** Change vs the previous 30 days; absent when there is nothing to compare. */
  positive_delta: string | null;
  positive_up: boolean;
  responses_this_month: string;
  responses_delta: string | null;
  responses_up: boolean;
  feedback_users: string;
  unresolved: number;
  programs: string[]; // every programme feedback has named, for the filter
}

export interface FeedbackOverviewItem {
  name: string;
  value: number;
  legend: string;
  color: string;
}

export interface FeedbackOverview {
  total: string;
  center_label: string;
  items: FeedbackOverviewItem[];
}

export interface ApiFeedbackTheme {
  key: string;
  label: string;
  icon: string; // lucide icon name
  tone: string;
  count: number;
  mentions: string; // e.g. "12 in the last 30 days"
  delta: string | null; // vs the 30 days before; null when nothing to compare
  up: boolean;
}

export interface ApiProgramRating {
  name: string;
  rating: string; // average of real ratings, e.g. "4.8"
  count: number;  // how many ratings that average rests on
}

export interface FeedbackListParams {
  q?: string;
  type?: string;
  program?: string;
  rating?: string;
  date_range?: string;
  tab?: string;
  sort?: string;
  page?: number;
  page_size?: number;
}

export interface FeedbackRequestInput {
  recipient: string; // her email
  program?: string;
  message?: string;
}

export interface FeedbackRequestResult {
  id: string;
  emailed: boolean;
  message: string;
}

export async function apiListFeedback(
  params: FeedbackListParams = {},
): Promise<Paginated<ApiFeedback>> {
  const { data } = await apiClient.get<Paginated<ApiFeedback>>("/feedback", { params });
  return data;
}

export async function apiFeedbackStats(): Promise<FeedbackStats> {
  const { data } = await apiClient.get<FeedbackStats>("/feedback/stats");
  return data;
}

export async function apiFeedbackOverview(dateRange?: string): Promise<FeedbackOverview> {
  const { data } = await apiClient.get<FeedbackOverview>("/feedback/overview", {
    params: dateRange ? { date_range: dateRange } : {},
  });
  return data;
}

export async function apiFeedbackThemes(dateRange?: string): Promise<ApiFeedbackTheme[]> {
  const { data } = await apiClient.get<{ items: ApiFeedbackTheme[]; total: number }>(
    "/feedback/themes",
    { params: dateRange ? { date_range: dateRange } : {} },
  );
  return data.items;
}

export async function apiProgramRatings(): Promise<ApiProgramRating[]> {
  const { data } = await apiClient.get<{ items: ApiProgramRating[]; total: number }>(
    "/feedback/program-ratings",
  );
  return data.items;
}

export async function apiSetFeedbackStatus(
  id: string,
  status: string,
): Promise<ApiFeedback> {
  const { data } = await apiClient.patch<ApiFeedback>(`/feedback/${id}/status`, { status });
  return data;
}

export async function apiDeleteFeedback(id: string): Promise<void> {
  await apiClient.delete(`/feedback/${id}`);
}

export async function apiRequestFeedback(body: FeedbackRequestInput): Promise<FeedbackRequestResult> {
  const { data } = await apiClient.post<FeedbackRequestResult>("/feedback/requests", body);
  return data;
}

export async function apiReplyToFeedback(
  id: string,
  body: { text: string; internal: boolean },
): Promise<ApiFeedback> {
  const { data } = await apiClient.post<ApiFeedback>(`/feedback/${id}/replies`, body);
  return data;
}

/** The server builds the CSV from the same filters the table uses. */
export async function apiExportFeedback(params: FeedbackListParams = {}): Promise<Blob> {
  const { data } = await apiClient.get<Blob>("/feedback/export", { params, responseType: "blob" });
  return data;
}
