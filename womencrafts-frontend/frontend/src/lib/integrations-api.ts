import { apiClient } from "@/lib/api";

// Typed client for Settings › Integrations (app/routes/settings_platform.py,
// the /integrations sub-router).
//
// An "integration" is a real adapter in the backend — email, storage,
// payments, SMS, WhatsApp, AI, push, speech, tracing — and its status is
// whether the process holds what that adapter needs. Secrets never come
// back; only whether one is set.

export type AdapterStatus = "configured" | "sandbox" | "not_configured" | "not_available";

export interface Adapter {
  key: string;
  name: string;
  category: string;
  status: AdapterStatus | string;
  summary: string;
  details: { label: string; value: string }[];
  can_test: boolean;
}

export interface AdapterList {
  items: Adapter[];
  checked_at: string;
  configured: number;
  sandbox: number;
  not_configured: number;
  not_available: number;
}

export async function apiListAdapters(): Promise<AdapterList> {
  const { data } = await apiClient.get<AdapterList>("/integrations");
  return data;
}

/** Sends a test email to the caller's own address, only when a real provider is in front of it. */
export async function apiSendTestEmail(): Promise<{ sent: boolean; to: string; message: string }> {
  const { data } = await apiClient.post("/integrations/email/test");
  return data;
}
