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

// --- Admin rebuild (Sept 2026) ----------------------------------------------
// Every figure below is COUNTED from the `enrollments` collection on the
// server. `enrolled` and `pct` on a row are the live values; `seat_counter` is
// the stored number the member catalogue still reads for "seats left".

export interface ApiProgramModule {
  title: string;
  detail: string;
  duration: string;
}

export interface ApiProgramRow extends ApiProgram {
  curriculum: ApiProgramModule[];
  seat_counter: number;
  active_enrolled: number;
  completed: number;
  withdrawn: number;
  completion_rate: number;
  avg_progress: number;
  module_count: number;
  visible_to_members: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProgramStatsFull extends ProgramStats {
  completed_programs: number;
  draft_programs: number;
  archived_programs: number;
  visible_programs: number;
  learners: number;
  active_enrollments: number;
  completed_enrollments: number;
  withdrawn_enrollments: number;
  avg_progress: number;
}

export interface ProgramOverviewFull extends ProgramOverview {
  bucket: "day" | "week" | "month" | string;
  since: string;
  until: string;
}

export interface ProgramCategoryFull extends ProgramCategory {
  count: number;
  programs: number;
}

export type EnrolmentState = "active" | "completed" | "withdrawn";

export interface ApiEnrolment {
  id: string;
  user_id: string;
  member_id: string;
  name: string;
  email: string;
  status: EnrolmentState | string;
  progress: number;
  sessions_attended: number;
  enrolled_at: string;
  joined: string;
  completed_at: string;
  last_activity_at: string;
}

export interface ApiEnrolmentList {
  program_id: string;
  program_name: string;
  items: ApiEnrolment[];
  total: number;
  active: number;
  completed: number;
  withdrawn: number;
  completion_rate: number;
  avg_progress: number;
}

export async function apiListProgramRows(
  params: ProgramListParams = {},
): Promise<Paginated<ApiProgramRow>> {
  const { data } = await apiClient.get<Paginated<ApiProgramRow>>("/programs", { params });
  return data;
}

export async function apiProgramStatsFull(): Promise<ProgramStatsFull> {
  const { data } = await apiClient.get<ProgramStatsFull>("/programs/stats");
  return data;
}

export async function apiProgramOverviewFull(range?: string): Promise<ProgramOverviewFull> {
  const { data } = await apiClient.get<ProgramOverviewFull>("/programs/overview", {
    params: range ? { range } : {},
  });
  return data;
}

export async function apiProgramCategoriesFull(): Promise<ProgramCategoryFull[]> {
  const { data } = await apiClient.get<ProgramCategoryFull[]>("/programs/categories");
  return data;
}

export async function apiGetProgramRow(id: string): Promise<ApiProgramRow> {
  const { data } = await apiClient.get<ApiProgramRow>(`/programs/${id}`);
  return data;
}

export async function apiPublishProgram(id: string): Promise<ApiProgramRow> {
  const { data } = await apiClient.post<ApiProgramRow>(`/programs/${id}/publish`);
  return data;
}

export async function apiUnpublishProgram(id: string): Promise<ApiProgramRow> {
  const { data } = await apiClient.post<ApiProgramRow>(`/programs/${id}/unpublish`);
  return data;
}

export async function apiSaveProgramModules(
  id: string,
  modules: ApiProgramModule[],
): Promise<ApiProgramRow> {
  const { data } = await apiClient.put<ApiProgramRow>(`/programs/${id}/modules`, { modules });
  return data;
}

export async function apiProgramEnrollments(
  id: string,
  state?: EnrolmentState,
): Promise<ApiEnrolmentList> {
  const { data } = await apiClient.get<ApiEnrolmentList>(`/programs/${id}/enrollments`, {
    params: state ? { state } : {},
  });
  return data;
}

/** Needs `programs.export`; the server records the download in the audit trail. */
export async function apiExportProgramEnrollments(
  id: string,
  state?: EnrolmentState,
): Promise<Blob> {
  const { data } = await apiClient.get<Blob>(`/programs/${id}/enrollments/export`, {
    params: state ? { state } : {},
    responseType: "blob",
  });
  return data;
}

export async function apiSetEnrollmentStatus(
  programId: string,
  enrollmentId: string,
  status: EnrolmentState,
  reason?: string,
): Promise<ApiEnrolment> {
  const { data } = await apiClient.patch<ApiEnrolment>(
    `/programs/${programId}/enrollments/${enrollmentId}`,
    reason ? { status, reason } : { status },
  );
  return data;
}

/** Writes the live enrolment count back onto the programme's seat counter. */
export async function apiResyncProgramSeats(id: string): Promise<ApiProgramRow> {
  const { data } = await apiClient.post<ApiProgramRow>(`/programs/${id}/enrollments/resync`);
  return data;
}
