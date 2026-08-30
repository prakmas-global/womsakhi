import { apiClient } from "@/lib/api";

// --- Programs module -------------------------------------------------------
// Typed wrappers over the live /programs endpoints. JWT is auto-attached by
// the shared apiClient interceptor. Field names mirror the backend response
// (ProgramResponse) so the page can map API -> UI shape directly.

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

export interface ApiProgram {
  id: string; // mongo id (used for update / delete / status calls)
  name: string;
  desc: string;
  category: string;
  cat_tone: string;
  mode: string;
  duration: string;
  dates: string;
  days: string;
  enrolled: number;
  cap: number;
  pct: number;
  status: string;
  note: string;
  bar: string;
}

export interface ProgramStats {
  total_programs: number;
  active_programs: number;
  upcoming_programs: number;
  total_enrollments: number;
  completion_rate: number;
}

export interface OverviewPoint {
  label: string;
  value: number;
}

export interface ProgramOverview {
  range: string;
  series: OverviewPoint[];
  new_programs: number;
  enrollments: string;
  completions: string;
}

export interface ProgramCategory {
  name: string;
  value: number;
  color: string;
}

export interface ProgramListParams {
  q?: string;
  status?: string;
  category?: string;
  mode?: string;
  tab?: string;
  sort?: string;
  page?: number;
  page_size?: number;
}

export interface ProgramCreateInput {
  name: string;
  desc?: string;
  category?: string;
  mode?: string;
  duration?: string;
  cap?: number;
  startDate?: string;
  days?: string;
  status?: string;
}

export interface ProgramUpdateInput {
  name?: string;
  desc?: string;
  category?: string;
  mode?: string;
  duration?: string;
  cap?: number;
  startDate?: string;
  days?: string;
  enrolled?: number;
  status?: string;
}

export async function apiListPrograms(
  params: ProgramListParams = {},
): Promise<Paginated<ApiProgram>> {
  const { data } = await apiClient.get<Paginated<ApiProgram>>("/programs", { params });
  return data;
}

export async function apiProgramStats(): Promise<ProgramStats> {
  const { data } = await apiClient.get<ProgramStats>("/programs/stats");
  return data;
}

export async function apiProgramOverview(range?: string): Promise<ProgramOverview> {
  const { data } = await apiClient.get<ProgramOverview>("/programs/overview", {
    params: range ? { range } : {},
  });
  return data;
}

export async function apiProgramCategories(): Promise<ProgramCategory[]> {
  const { data } = await apiClient.get<ProgramCategory[]>("/programs/categories");
  return data;
}

export async function apiCreateProgram(body: ProgramCreateInput): Promise<ApiProgram> {
  const { data } = await apiClient.post<ApiProgram>("/programs", body);
  return data;
}

export async function apiUpdateProgram(
  id: string,
  body: ProgramUpdateInput,
): Promise<ApiProgram> {
  const { data } = await apiClient.patch<ApiProgram>(`/programs/${id}`, body);
  return data;
}

export async function apiDeleteProgram(id: string): Promise<void> {
  await apiClient.delete(`/programs/${id}`);
}

export async function apiCompleteProgram(id: string): Promise<ApiProgram> {
  const { data } = await apiClient.post<ApiProgram>(`/programs/${id}/complete`);
  return data;
}

export async function apiArchiveProgram(id: string): Promise<ApiProgram> {
  const { data } = await apiClient.post<ApiProgram>(`/programs/${id}/archive`);
  return data;
}
