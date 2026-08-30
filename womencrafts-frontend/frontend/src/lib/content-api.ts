import { apiClient } from "@/lib/api";

// --- Content module (pages, posts, media, banners, FAQs, programs, …) --------
// Typed wrappers over the backend /content endpoints. Response shapes mirror the
// FastAPI schemas in app/schemas/content.py exactly (snake_case `s_tone`).

export interface ApiContent {
  id: string; // mongo _id — used for update/delete/status calls
  title: string;
  slug: string;
  type: string;
  tone: string; // badge tone: violet | emerald | sky | amber | brand
  status: string;
  s_tone: string; // status-dot tone: emerald | sky | amber
  author: string;
  description: string;
  updated: string; // "May 20, 2024 10:30 AM" style label
  icon: string; // lucide icon NAME, mapped back to a component in the UI
  cover: string; // uploaded cover image URL ("" = use the placeholder tile)
}

export interface ContentListResult {
  items: ApiContent[];
  total: number;
  showing_from: number;
  showing_to: number;
  page: number;
  total_pages: number;
}

export interface ContentListParams {
  tab?: string;
  type?: string;
  status?: string;
  author?: string;
  q?: string;
  published_only?: boolean;
  page?: number;
  page_size?: number;
}

export interface ContentOverviewSlice {
  name: string;
  value: number;
  color: string;
  label: string;
}

export interface ContentCategoryBar {
  name: string;
  value: number;
  label: string;
}

export interface ContentStats {
  total_content: number;
  published: number;
  published_pct: number;
  draft: number;
  draft_pct: number;
  scheduled: number;
  scheduled_pct: number;
  trash: number;
  trash_pct: number;
  overview: ContentOverviewSlice[];
  overview_total: string;
  categories: ContentCategoryBar[];
  storage_used_gb: number;
  storage_total_gb: number;
  storage_percent: number;
}

export interface ContentActivity {
  id: string;
  icon: string; // lucide icon NAME
  tone: string;
  text: string;
  meta: string;
}

export interface ContentInput {
  title: string;
  type?: string;
  status?: string;
  author?: string;
  slug?: string;
  description?: string;
  cover?: string; // URL from POST /uploads
}

export type ContentBulkActionName = "publish" | "draft" | "trash";

export interface ContentBulkResult {
  action: ContentBulkActionName;
  affected: number;
  message: string;
}

export async function apiListContent(params: ContentListParams = {}): Promise<ContentListResult> {
  const { data } = await apiClient.get<ContentListResult>("/content", { params });
  return data;
}

export async function apiContentStats(): Promise<ContentStats> {
  const { data } = await apiClient.get<ContentStats>("/content/stats");
  return data;
}

export async function apiContentActivity(limit = 4): Promise<ContentActivity[]> {
  const { data } = await apiClient.get<ContentActivity[]>("/content/activity", { params: { limit } });
  return data;
}

export async function apiContentAuthors(): Promise<string[]> {
  const { data } = await apiClient.get<string[]>("/content/authors");
  return data;
}

export async function apiCreateContent(body: ContentInput): Promise<ApiContent> {
  const { data } = await apiClient.post<ApiContent>("/content", body);
  return data;
}

export async function apiUpdateContent(id: string, body: Partial<ContentInput>): Promise<ApiContent> {
  const { data } = await apiClient.put<ApiContent>(`/content/${id}`, body);
  return data;
}

export async function apiSetContentStatus(id: string, status: string): Promise<ApiContent> {
  const { data } = await apiClient.patch<ApiContent>(`/content/${id}/status`, { status });
  return data;
}

export async function apiDeleteContent(id: string): Promise<void> {
  await apiClient.delete(`/content/${id}`);
}

export async function apiBulkContent(ids: string[], action: ContentBulkActionName): Promise<ContentBulkResult> {
  const { data } = await apiClient.post<ContentBulkResult>("/content/bulk", { ids, action });
  return data;
}
