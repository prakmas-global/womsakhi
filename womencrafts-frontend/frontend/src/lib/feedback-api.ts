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
}

export interface FeedbackStats {
  total_feedback: string;
  average_rating: string;
  positive_percentage: string;
  positive_delta: string;
  responses_this_month: string;
  responses_delta: string;
  feedback_users: string;
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
  id: string;
  seq: number;
  label: string;
  icon: string; // lucide icon name: "ThumbsUp" | "BookOpen" | "Clock" | "FileText"
  tone: string;
  mentions: string; // e.g. "128 mentions"
  delta: string; // e.g. "20%"
  up: boolean;
}

export interface ApiProgramRating {
  id: string;
  seq: number;
  name: string;
  rating: string; // e.g. "4.8"
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
  recipient: string;
  program?: string;
  message?: string;
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

export async function apiFeedbackThemes(): Promise<ApiFeedbackTheme[]> {
  const { data } = await apiClient.get<{ items: ApiFeedbackTheme[]; total: number }>(
    "/feedback/themes",
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

export async function apiRequestFeedback(
  body: FeedbackRequestInput,
): Promise<{ message: string }> {
  const { data } = await apiClient.post<{ message: string }>("/feedback/requests", body);
  return data;
}
