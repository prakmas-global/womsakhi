import { apiClient } from "./api";

/**
 * Money, as the server tells it.
 *
 * Amounts stay in **minor units** the whole way from Mongo to the screen and
 * are formatted only at the edge. A float rupee that has been through JSON and
 * a division is a rupee that eventually shows ₹24,349.99, and on a screen about
 * her earnings that is not a rounding error, it is a support ticket.
 */

/**
 * What `/wallet` really sends — read off the running API, not off the schema
 * name in the OpenAPI document.
 *
 * That distinction cost a bug: the schema is called `WalletTxnModel` and has
 * `reason`, `note` and `created_at`; the endpoint returns `label`, `source`
 * and an already-formatted `when`. Mapping against the model's field names
 * produced rows that all said "Payment" and were all dated today.
 */
export interface WalletTxn {
  id: string;
  kind: "credit" | "debit";
  /** What a person would call it — "Refund · cancelled session". */
  label: string;
  /** The machine word behind it — "refund", "program", "scholarship". */
  source: string;
  amount_minor: number;
  amount_label: string;
  /** Already formatted by the server — "May 11, 2026". */
  when: string;
}

export interface WalletResponse {
  balance_minor: number;
  balance_label: string;
  currency: string;
  transactions: WalletTxn[];
}

export interface SupportRequest {
  id: string;
  what_for: string;
  reason: string;
  amount_needed_minor: number;
  amount_label: string;
  status: string;
  created_at: string;
  decided_at?: string | null;
  staff_note?: string | null;
}

export async function apiWallet(signal?: AbortSignal) {
  const { data } = await apiClient.get<WalletResponse>("/wallet", { signal });
  return data;
}

export async function apiSupportRequests(signal?: AbortSignal) {
  const { data } = await apiClient.get<SupportRequest[]>("/wallet/support", { signal });
  return data;
}

export async function apiRequestSupport(body: {
  what_for: string;
  reason: string;
  amount_needed: number;
}) {
  const { data } = await apiClient.post<SupportRequest>("/wallet/support", body);
  return data;
}
