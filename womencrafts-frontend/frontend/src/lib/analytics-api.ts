import { apiClient } from "@/lib/api";

// --- Analytics screen API ---
// Mirrors app/schemas/analytics.py on the backend. Values arrive preformatted
// for display (e.g. "48,592", "4m 32s", "38.4%") so they can be painted verbatim.

export type Direction = "up" | "down";
export type PageTone = "emerald" | "amber" | "rose";

export interface AnalyticsStatCard {
  key: string;
  label: string;
  value: string; // preformatted, e.g. "48,592" / "4m 32s" / "38.4%"
  icon: string; // lucide icon name, e.g. "Users"
  tone: string;
  delta: string; // e.g. "14.2%"
  delta_dir: Direction;
}

export interface AnalyticsRealtime {
  active: number;
  change: number;
  change_dir: Direction;
}

export interface AnalyticsSummary {
  stats: AnalyticsStatCard[];
  realtime: AnalyticsRealtime;
}

export interface TrafficPoint {
  order: number;
  label: string;
  value: number;
}

export interface DeviceSlice {
  name: string;
  value: number;
  color: string;
}

export interface SourceBar {
  label: string;
  value: number;
  color: string;
}

export interface EngagementPoint {
  order: number;
  label: string;
  sessions: number;
  users: number;
}

export interface TopPageRow {
  page: string;
  views: string;
  unique: string;
  bounce: number;
  time: string;
  tone: PageTone;
}

export interface ReferrerRow {
  name: string;
  visits: string;
  pct: number;
  color: string;
}

export interface AnalyticsOverview {
  stats: AnalyticsStatCard[];
  realtime: AnalyticsRealtime;
  traffic: TrafficPoint[];
  devices: DeviceSlice[];
  sources: SourceBar[];
  engagement: EngagementPoint[];
  top_pages: TopPageRow[];
  referrers: ReferrerRow[];
}

// One call hydrating the whole analytics screen. `range`/`period` mirror the two
// header/traffic selectors (display-only on the backend, but sent so the toggles
// stay wired for a future data-backed range).
export async function apiAnalyticsOverview(
  range = "Last 30 Days",
  period = "This Month",
): Promise<AnalyticsOverview> {
  const { data } = await apiClient.get<AnalyticsOverview>("/analytics/overview", {
    params: { range, period },
  });
  return data;
}

// --- Granular endpoints (each section can refresh on its own if needed) ---

export async function apiAnalyticsSummary(range = "Last 30 Days"): Promise<AnalyticsSummary> {
  const { data } = await apiClient.get<AnalyticsSummary>("/analytics/summary", {
    params: { range },
  });
  return data;
}

export async function apiAnalyticsRealtime(): Promise<AnalyticsRealtime> {
  const { data } = await apiClient.get<AnalyticsRealtime>("/analytics/realtime");
  return data;
}

export async function apiAnalyticsTraffic(period = "This Month"): Promise<TrafficPoint[]> {
  const { data } = await apiClient.get<TrafficPoint[]>("/analytics/traffic", {
    params: { period },
  });
  return data;
}

export async function apiAnalyticsDevices(): Promise<DeviceSlice[]> {
  const { data } = await apiClient.get<DeviceSlice[]>("/analytics/devices");
  return data;
}

export async function apiAnalyticsSources(range = "Last 30 Days"): Promise<SourceBar[]> {
  const { data } = await apiClient.get<SourceBar[]>("/analytics/sources", {
    params: { range },
  });
  return data;
}

export async function apiAnalyticsEngagement(period = "This Month"): Promise<EngagementPoint[]> {
  const { data } = await apiClient.get<EngagementPoint[]>("/analytics/engagement", {
    params: { period },
  });
  return data;
}

export async function apiAnalyticsTopPages(range = "Last 30 Days"): Promise<TopPageRow[]> {
  const { data } = await apiClient.get<TopPageRow[]>("/analytics/top-pages", {
    params: { range },
  });
  return data;
}

export async function apiAnalyticsReferrers(): Promise<ReferrerRow[]> {
  const { data } = await apiClient.get<ReferrerRow[]>("/analytics/referrers");
  return data;
}
