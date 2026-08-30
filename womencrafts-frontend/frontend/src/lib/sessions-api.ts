import { apiClient } from "@/lib/api";

// --- Settings › Sessions (active devices, history, stats) ---
// Talks to the live /sessions endpoints. Response shapes mirror the backend
// SessionResponse / SessionStatCard / RevokeResult schemas exactly.

export interface ApiSession {
  id: string; // mongo id — used for sign-out (DELETE /sessions/{id})
  device_type: string; // lucide icon name, e.g. "Monitor" | "Smartphone"
  device: string; // e.g. "Chrome on Windows"
  details: string; // e.g. "Windows 11 · Chrome 124.0.6367.91"
  location: string; // e.g. "Mumbai, Maharashtra, India"
  ip: string;
  status: string; // "Active" | "Signed Out"
  is_current: boolean;
  tag: string | null; // e.g. "Current Session"
  location_note: string | null; // "Current Location" | "Trusted Device"
  last_active: string | null; // relative label, e.g. "2 mins ago"
  last_active_at: string | null; // absolute label, e.g. "May 20, 2024 10:30 AM"
  login_time: string | null; // history only
  logout_time: string | null; // history only
}

export interface SessionListResponse {
  items: ApiSession[];
  total: number;
}

export interface ApiSessionStatCard {
  label: string;
  value: string;
  icon: string; // lucide icon name
  tone: string; // "violet" | "emerald" | "amber"
  note: string;
  /**
   * Semantic tone, not a class. The API describes meaning; this client decides
   * the colour — see NOTE_TONE below.
   */
  note_tone: "ok" | "subtle" | "warn" | "danger";
  value_class?: string | null; // e.g. "text-lg" for wide values
}

export interface SessionStatsResponse {
  stat_cards: ApiSessionStatCard[];
}

export interface RevokeResult {
  revoked: number;
  message: string;
}

export async function apiListSessions(q?: string): Promise<SessionListResponse> {
  const { data } = await apiClient.get<SessionListResponse>("/sessions", {
    params: q && q.trim() ? { q } : undefined,
  });
  return data;
}

export async function apiSessionStats(): Promise<SessionStatsResponse> {
  const { data } = await apiClient.get<SessionStatsResponse>("/sessions/stats");
  return data;
}

export async function apiSessionHistory(q?: string): Promise<SessionListResponse> {
  const { data } = await apiClient.get<SessionListResponse>("/sessions/history", {
    params: q && q.trim() ? { q } : undefined,
  });
  return data;
}

export async function apiRevokeOtherSessions(): Promise<RevokeResult> {
  const { data } = await apiClient.post<RevokeResult>("/sessions/revoke-others");
  return data;
}

export async function apiRevokeSession(id: string): Promise<RevokeResult> {
  const { data } = await apiClient.delete<RevokeResult>(`/sessions/${id}`);
  return data;
}
