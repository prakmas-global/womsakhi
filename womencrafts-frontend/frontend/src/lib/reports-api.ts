import { apiClient } from "@/lib/api";

// --- Reports: real data, generated on demand -------------------------------------
// Every report is defined on the server (app/routes/reports.py CATALOGUE) and
// built from the live collections when generated. There is no stored "report"
// row to create or edit; a generation is recorded as a run.

export interface ReportRunSummary {
  at: string;          // ISO timestamp
  by: string;          // staff name
  rows: number;
  range_label: string;
}

export interface ReportDefinition {
  key: string;
  name: string;
  description: string;
  category: string;
  tone: string;
  icon: string;        // lucide icon name
  columns: string[];
  dated: boolean;      // a date range narrows it
  privacy_note: string;
  last_run: ReportRunSummary | null;
  runs: number;
}

export interface ReportRun {
  id: string;
  report_key: string;
  report_name: string;
  category: string;
  by: string;
  at: string;
  rows: number;
  range_label: string;
  duration_ms: number;
}

export interface CategorySlice {
  name: string;
  value: number;   // share of all generations, %
  runs: number;
  color: string;
}

export interface ReportsStats {
  available: number;
  generated_this_month: number;
  generated_last_month: number;
  generated_delta: string | null;
  generated_up: boolean;
  rows_this_month: number;
  last_generated_at: string | null;
  last_generated_by: string;
  top_categories: CategorySlice[];
  most_used: { key: string; name: string; runs: number }[];
}

export interface ReportPreview {
  key: string;
  name: string;
  columns: string[];
  total: number;
  range_label: string;
  rows: (string | number | null)[][];
}

export async function apiListReports(params: { q?: string; category?: string } = {}): Promise<{ items: ReportDefinition[]; total: number }> {
  const { data } = await apiClient.get<{ items: ReportDefinition[]; total: number }>("/reports", { params });
  return data;
}

export async function apiReportStats(): Promise<ReportsStats> {
  const { data } = await apiClient.get<ReportsStats>("/reports/stats");
  return data;
}

export async function apiReportRuns(limit = 8): Promise<ReportRun[]> {
  const { data } = await apiClient.get<ReportRun[]>("/reports/runs", { params: { limit } });
  return data;
}

export async function apiPreviewReport(key: string, dateRange?: string, limit = 8): Promise<ReportPreview> {
  const { data } = await apiClient.get<ReportPreview>(`/reports/${key}/preview`, {
    params: { ...(dateRange ? { date_range: dateRange } : {}), limit },
  });
  return data;
}

/** Builds the CSV on the server, records the run, and returns the file. */
export async function apiGenerateReport(key: string, dateRange?: string): Promise<Blob> {
  const { data } = await apiClient.get<Blob>(`/reports/${key}/generate`, {
    params: dateRange ? { date_range: dateRange } : {},
    responseType: "blob",
  });
  return data;
}
