import { apiClient } from "@/lib/api";

// --- Reports module (reports table + overview snapshot + side panels) ---
//
// Backed by two Mongo collections via /api/v1/reports:
//   reports          — one doc per "All Reports" table row
//   reports_overview — a singleton snapshot feeding the stat cards + widgets
// Mirrors the field names returned by app/routes/reports.py exactly.

export interface ApiReport {
  id: string; // mongo id (used for update/delete/run)
  name: string;
  description: string;
  category: string;
  tone: string; // badge/icon tone derived from category
  icon: string; // lucide icon name (mapped back on the client)
  type: string;
  schedule: string;
  schedule_detail: string;
  last_generated: string;
  created_by: string;
  scheduled: boolean;
  created_at: string;
}

export interface ReportListResponse {
  items: ApiReport[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

export interface GeneratedPoint {
  label: string;
  value: number;
}

export interface CategorySlice {
  name: string;
  value: number;
  color: string;
}

export interface ReportsOverview {
  total_reports: number;
  scheduled_reports: number;
  reports_generated: number;
  reports_generated_delta: number;
  avg_generation_time: string;
  data_points_analyzed: string;
  data_points_delta: number;
  generated_trend: GeneratedPoint[];
  data_points_trend: number[];
  top_categories: CategorySlice[];
}

export interface RecentReport {
  name: string;
  last_generated: string;
  icon: string;
}

export interface ScheduledReport {
  name: string;
  schedule_detail: string;
  status: string;
}

export interface ReportTemplate {
  category: string;
  name: string;
  description: string;
  tone: string;
  icon: string;
  status: string;
}

export interface ReportListParams {
  q?: string;
  category?: string;
  type?: string;
  page?: number;
  page_size?: number;
}

export interface ReportInput {
  name: string;
  category?: string;
  type?: string;
  schedule?: string;
  description?: string;
}

export interface ReportUpdateInput {
  name?: string;
  description?: string;
  category?: string;
  type?: string;
  schedule?: string;
}

export async function apiListReports(params: ReportListParams = {}): Promise<ReportListResponse> {
  const { data } = await apiClient.get<ReportListResponse>("/reports", { params });
  return data;
}

export async function apiReportStats(): Promise<ReportsOverview> {
  const { data } = await apiClient.get<ReportsOverview>("/reports/stats");
  return data;
}

export async function apiRecentReports(limit = 4): Promise<RecentReport[]> {
  const { data } = await apiClient.get<RecentReport[]>("/reports/recent", { params: { limit } });
  return data;
}

export async function apiScheduledReports(): Promise<ScheduledReport[]> {
  const { data } = await apiClient.get<ScheduledReport[]>("/reports/scheduled");
  return data;
}

export async function apiReportTemplates(): Promise<ReportTemplate[]> {
  const { data } = await apiClient.get<ReportTemplate[]>("/reports/templates");
  return data;
}

export async function apiCreateReport(body: ReportInput): Promise<ApiReport> {
  const { data } = await apiClient.post<ApiReport>("/reports", body);
  return data;
}

export async function apiUpdateReport(id: string, body: ReportUpdateInput): Promise<ApiReport> {
  const { data } = await apiClient.put<ApiReport>(`/reports/${id}`, body);
  return data;
}

export async function apiDeleteReport(id: string): Promise<void> {
  await apiClient.delete(`/reports/${id}`);
}

/** Regenerate a report now (the row's "Run now" action). */
export async function apiRunReport(id: string): Promise<ApiReport> {
  const { data } = await apiClient.post<ApiReport>(`/reports/${id}/run`);
  return data;
}

/** Download the filtered reports as a CSV blob from the backend. */
export async function apiExportReports(params: ReportListParams = {}): Promise<Blob> {
  const { data } = await apiClient.get("/reports/export", { params, responseType: "blob" });
  return data as Blob;
}
