import { apiClient } from "./api";

/**
 * Organisation settings — the `org.*` tier.
 *
 * Reading is open to any staff account, because the shell needs the logo and
 * the default palette to render. Every write is guarded server-side by BOTH
 * Super Admin and the entitlement, so nothing here needs to be trusted: a
 * client that calls a write it should not have gets a 403 with a reason.
 */

export interface OrgSettings {
  name: string;
  logo: string;
  wordmark: string;
  default_theme_id: string;
  default_primary: string;
  default_secondary: string;
  default_mode: string;
  domain: string;
  domain_status: "unset" | "pending" | "verified" | "failed";
  domain_token: string;
  domain_checked_at: string | null;
  updated_at: string | null;
}

export interface OrgLayoutTemplate {
  id: string;
  name: string;
  role: string;
  app: string;
  applied_at: string | null;
  applied_count: number;
  created_at: string | null;
}

export async function apiOrgSettings(): Promise<OrgSettings> {
  const { data } = await apiClient.get<OrgSettings>("/org");
  return data;
}

export async function apiSetBranding(body: {
  name: string;
  logo: string;
  wordmark: string;
}): Promise<OrgSettings> {
  const { data } = await apiClient.put<OrgSettings>("/org/branding", body);
  return data;
}

export async function apiSetDefaultTheme(body: {
  theme_id: string;
  /** The preset's colours travel with its id — the server keeps no palette. */
  primary: string;
  secondary: string;
  mode: "" | "light" | "dark";
}): Promise<OrgSettings> {
  const { data } = await apiClient.put<OrgSettings>("/org/theme", body);
  return data;
}

export async function apiSetDomain(domain: string): Promise<OrgSettings> {
  const { data } = await apiClient.put<OrgSettings>("/org/domain", { domain });
  return data;
}

export async function apiVerifyDomain(): Promise<OrgSettings> {
  const { data } = await apiClient.post<OrgSettings>("/org/domain/verify");
  return data;
}

export async function apiOrgTemplates(): Promise<OrgLayoutTemplate[]> {
  const { data } = await apiClient.get<OrgLayoutTemplate[]>("/org/layout-templates");
  return data;
}

export async function apiCreateOrgTemplate(body: {
  name: string;
  role: string;
  app?: "staff" | "member";
}): Promise<OrgLayoutTemplate> {
  const { data } = await apiClient.post<OrgLayoutTemplate>("/org/layout-templates", body);
  return data;
}

export async function apiApplyOrgTemplate(
  id: string,
): Promise<{ applied_count: number; message: string }> {
  const { data } = await apiClient.post(`/org/layout-templates/${id}/apply`);
  return data;
}

export async function apiDeleteOrgTemplate(id: string): Promise<void> {
  await apiClient.delete(`/org/layout-templates/${id}`);
}

/**
 * A staff account's own language.
 *
 * Members write theirs through `/me/profile`, which requires an admitted
 * member — staff have no such row, so they go through the shared account
 * endpoint instead. One field, same effect: locale lives on the account
 * ([[ADR-006 Language lives on the account]]).
 */
export async function apiUpdateMyLocale(locale: string): Promise<void> {
  await apiClient.put("/users/me", { locale });
}
