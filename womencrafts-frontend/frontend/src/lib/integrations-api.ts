import { apiClient } from "@/lib/api";

// Typed client for the Settings → Integrations backend
// (app/routes/settings_platform.py, the /integrations sub-router).

// --- Types --------------------------------------------------------------------

export interface ApiIntegration {
  id: string;
  name: string;
  icon: string; // lucide icon NAME, e.g. "Calendar"
  tone: string;
  category: string;
  cat_tone: string;
  desc: string;
  status: string; // "Connected" | "Inactive" | "Not Connected"
  synced: string;
  notifications: boolean;
  auto_sync: boolean;
  connected_at: string | null;
}

export interface IntegrationListResponse {
  items: ApiIntegration[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

export interface IntegrationListParams {
  tab?: string;
  status?: string;
  category?: string;
  q?: string;
  page?: number;
  page_size?: number;
}

export interface ApiIntegrationStats {
  total_integrations: number;
  active_integrations: number;
  available_integrations: string;
  sync_status: string;
  last_checked: string;
}

export interface ApiOverviewSlice {
  name: string;
  value: number;
  color: string;
  pct: string;
}

export interface ApiIntegrationOverview {
  overview: ApiOverviewSlice[];
  total: number;
}

export interface ApiRecentIntegration {
  name: string;
  icon: string;
  tone: string;
  when: string;
}

export interface ApiWebhook {
  url: string;
  signing_secret: string;
}

export interface IntegrationRequestInput {
  service: string;
  category?: string;
  details?: string;
}

export interface ApiIntegrationRequest {
  id: string;
  service: string;
  category: string;
  details: string;
  createdAt: string | null;
}

export interface IntegrationUpdateInput {
  action?: "connect" | "disconnect" | "sync";
  status?: "Connected" | "Inactive" | "Not Connected";
  notifications?: boolean;
  auto_sync?: boolean;
}

// --- Reads --------------------------------------------------------------------

export async function apiListIntegrations(
  params: IntegrationListParams = {}
): Promise<IntegrationListResponse> {
  const { data } = await apiClient.get<IntegrationListResponse>("/integrations", { params });
  return data;
}

export async function apiIntegrationStats(): Promise<ApiIntegrationStats> {
  const { data } = await apiClient.get<ApiIntegrationStats>("/integrations/stats");
  return data;
}

export async function apiIntegrationOverview(): Promise<ApiIntegrationOverview> {
  const { data } = await apiClient.get<ApiIntegrationOverview>("/integrations/overview");
  return data;
}

export async function apiIntegrationCategories(): Promise<string[]> {
  const { data } = await apiClient.get<string[]>("/integrations/categories");
  return data;
}

export async function apiRecentIntegrations(limit = 3): Promise<ApiRecentIntegration[]> {
  const { data } = await apiClient.get<ApiRecentIntegration[]>("/integrations/recent", {
    params: { limit },
  });
  return data;
}

export async function apiGetWebhook(): Promise<ApiWebhook> {
  const { data } = await apiClient.get<ApiWebhook>("/integrations/webhook");
  return data;
}

// --- Writes -------------------------------------------------------------------

export async function apiUpdateWebhook(url: string): Promise<ApiWebhook> {
  const { data } = await apiClient.put<ApiWebhook>("/integrations/webhook", { url });
  return data;
}

export async function apiCreateIntegrationRequest(
  body: IntegrationRequestInput
): Promise<ApiIntegrationRequest> {
  const { data } = await apiClient.post<ApiIntegrationRequest>("/integrations/requests", body);
  return data;
}

export async function apiUpdateIntegration(
  id: string,
  body: IntegrationUpdateInput
): Promise<ApiIntegration> {
  const { data } = await apiClient.patch<ApiIntegration>(`/integrations/${id}`, body);
  return data;
}

export async function apiConnectIntegration(id: string): Promise<ApiIntegration> {
  const { data } = await apiClient.post<ApiIntegration>(`/integrations/${id}/connect`);
  return data;
}

export async function apiDisconnectIntegration(id: string): Promise<ApiIntegration> {
  const { data } = await apiClient.post<ApiIntegration>(`/integrations/${id}/disconnect`);
  return data;
}

export async function apiSyncIntegration(id: string): Promise<ApiIntegration> {
  const { data } = await apiClient.post<ApiIntegration>(`/integrations/${id}/sync`);
  return data;
}

export async function apiDeleteIntegration(id: string): Promise<void> {
  await apiClient.delete(`/integrations/${id}`);
}
