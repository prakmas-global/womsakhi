import { apiClient } from "./api";

/**
 * Safety, money, and credentials.
 *
 * `apiHelplines` is the one call in the whole member app that works without a
 * session — deliberately, so an expired token can never stand between a woman
 * and an emergency number.
 */

export interface Helpline {
  name: string;
  number: string;
  desc: string;
  urgent: boolean;
}

export interface TrustedContact {
  id: string;
  name: string;
  phone: string;
  relation: string;
  notify_on_alert: boolean;
}

export interface SafetyAlert {
  id: string;
  note: string;
  status: "open" | "acknowledged" | "resolved";
  contacts_notified: number;
  resolution: string;
  raised_at: string;
  /**
   * The capability for the link SHE forwards.
   *
   * Nothing in this product can reach a phone number — no SMS, no WhatsApp,
   * no voice — so `contacts_notified` only ever counted how many people she
   * had named. Her own phone can reach them, and this is what she sends.
   */
  share_token?: string;
  /** Who has opened that link and said they have it. */
  acknowledged_by?: string[];
}

export interface SafetyReport {
  id: string;
  category: string;
  details: string;
  about: string;
  anonymous: boolean;
  status: "open" | "reviewing" | "actioned" | "closed";
  filed_on: string;
}

export interface SafetyCentre {
  helplines: Helpline[];
  contacts: TrustedContact[];
  open_alert: SafetyAlert | null;
  reports: SafetyReport[];
}

/** The categories the server will accept — kept in step with SafetyReportModel. */
export const REPORT_CATEGORIES = [
  "Harassment or abuse",
  "A man on the platform",
  "Fake or impersonating account",
  "Money or fraud",
  "Something in a circle or post",
  "Something else",
] as const;

export async function apiSafetyCentre() {
  const { data } = await apiClient.get<SafetyCentre>("/safety");
  return data;
}

export async function apiHelplines() {
  const { data } = await apiClient.get<Helpline[]>("/safety/helplines");
  return data;
}

export async function apiAddContact(body: {
  name: string;
  phone: string;
  relation?: string;
  notify_on_alert?: boolean;
}) {
  const { data } = await apiClient.post<TrustedContact>("/safety/contacts", body);
  return data;
}

export async function apiDeleteContact(id: string) {
  await apiClient.delete(`/safety/contacts/${id}`);
}

export async function apiRaiseAlert(body: { note?: string; location?: string }) {
  const { data } = await apiClient.post<SafetyAlert>("/safety/alert", body);
  return data;
}

export async function apiStandDown(id: string) {
  const { data } = await apiClient.post<SafetyAlert>(`/safety/alert/${id}/stand-down`);
  return data;
}

export async function apiFileReport(body: {
  category: string;
  details: string;
  about?: string;
  anonymous?: boolean;
}) {
  const { data } = await apiClient.post<SafetyReport>("/safety/reports", body);
  return data;
}

/**
 * This file used to carry a second half — wallet, the support fund,
 * certificates, documents, referrals and programme detail. Fifteen exports,
 * every one of them a same-named twin of a function that is actually wired up
 * somewhere else, and every one of them imported by nobody:
 *
 *     apiWallet, apiSupportRequests, apiRequestSupport   → lib/wallet-api.ts
 *     apiCertificates, apiMyDocuments, apiReferrals      → lib/me-api.ts
 *     apiProgramDetail                                   → lib/growth-api.ts
 *
 * They were removed on 2026-08-26. Import the modules named above; a twin in
 * a file called `safety-api` is not the one the app is running.
 */
