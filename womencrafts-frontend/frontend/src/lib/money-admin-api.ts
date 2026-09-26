import { apiClient } from "./api";
import { apiMyPermissions } from "./permissions-api";

/**
 * Staff side of money: payments, withdrawals, the ledger, payout accounts and
 * referrals. Everything under `/admin/money/*`.
 *
 * ── The platform holds no money ─────────────────────────────────────────────
 * Nothing these calls do moves a rupee, and the screens say so:
 *   - a refund asks the payment provider (the sandbox today) to send it back;
 *   - "mark paid" on a withdrawal RECORDS a transfer the organisation made
 *     from its own bank — the UTR is the evidence, not the trigger;
 *   - "mark failed" restores her balance with a reversing credit row;
 *   - an adjustment is a ledger correction with a mandatory reason.
 *
 * ── Amounts are minor units (paise) ─────────────────────────────────────────
 * Every `*_minor` field is paise. Format with `formatRupees` from
 * `@/components/ux/kit`, never `formatWholeRupees`.
 */

/* ---------------- permissions ---------------- */

export type MoneyAction = "view" | "edit" | "approve" | "export";

export async function apiMoneyPermissions(isSuperAdmin: boolean) {
  const all: MoneyAction[] = ["view", "edit", "approve", "export"];
  if (isSuperAdmin) return new Set<MoneyAction>(all);
  const { permissions } = await apiMyPermissions();
  return new Set<MoneyAction>(all.filter((a) => permissions.includes(`money.${a}`)));
}

/* ---------------- shared ---------------- */

export interface PageMeta {
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

/** A member as this side sees her: name and avatar, nothing private. */
export interface Person {
  user_id: string;
  name: string;
  avatar: string;
  member_id: string;
}

const get = <T,>(url: string, params?: object, signal?: AbortSignal) =>
  apiClient.get<T>(url, { params, signal }).then((r) => r.data);

const csv = (url: string, params?: object) =>
  apiClient.get(url, { params, responseType: "blob" }).then((r) => r.data as Blob);

/** Hand a CSV the server produced to the browser as a download. */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** ISO string → "26 Sep 2026, 3:10 pm"; empty when there is no date. */
export function whenLabel(iso: string | undefined | null, withTime = true) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("en-IN", {
    day: "numeric", month: "short", year: "numeric",
    ...(withTime ? { hour: "numeric", minute: "2-digit" } : {}),
  });
}

/* ---------------- 1. payments ---------------- */

export type OrderStatus = "created" | "paid" | "failed" | "refunded" | "cancelled";

export interface AdminOrder {
  id: string;
  purpose: string;
  reference_id: string;
  title: string;
  amount_minor: number;
  amount_label: string;
  currency: string;
  status: OrderStatus | string;
  provider: string;
  provider_order_id: string;
  provider_payment_id: string;
  method: string;
  failure_reason: string;
  refunded_minor: number;
  refunded_label: string;
  /** What can still be refunded; 0 unless the order is paid. */
  refundable_minor: number;
  created: string;
  created_at: string;
  paid_at: string;
  updated_at: string;
  user_id: string;
  member: Person;
}

export interface AdminRefund {
  id: string;
  order_id: string;
  amount_minor: number;
  amount_label: string;
  reason: string;
  status: string;
  by_name: string;
  created: string;
  created_at: string;
}

export interface ProviderNote {
  provider: string;
  sandbox: boolean;
  currency: string;
}

export interface AdminOrderDetail extends AdminOrder, ProviderNote {
  refunds: AdminRefund[];
}

export interface OrderFilters {
  status?: string;
  q?: string;
  from?: string;
  to?: string;
  page?: number;
  page_size?: number;
}

export interface OrdersPage extends ProviderNote {
  orders: AdminOrder[];
  pagination: PageMeta;
}

export interface StatusBucket {
  count: number;
  amount_minor: number;
  refunded_minor: number;
}

export interface OrdersSummary extends ProviderNote {
  total: number;
  by_status: Record<string, StatusBucket>;
  gross_minor: number;
  refunded_minor: number;
  refund_count: number;
  net_minor: number;
  last_30_days: { count: number; amount_minor: number };
}

export const apiMoneyOrders = (f: OrderFilters = {}, s?: AbortSignal) =>
  get<OrdersPage>("/admin/money/orders", f, s);

export const apiMoneyOrdersSummary = (s?: AbortSignal) =>
  get<OrdersSummary>("/admin/money/orders/summary", undefined, s);

export const apiMoneyOrder = (id: string, s?: AbortSignal) =>
  get<AdminOrderDetail>(`/admin/money/orders/${id}`, undefined, s);

export async function apiMoneyRefund(
  id: string,
  body: { amount_minor?: number | null; reason: string },
) {
  const { data } = await apiClient.post<{ refund: AdminRefund; order: AdminOrderDetail }>(
    `/admin/money/orders/${id}/refund`, body,
  );
  return data;
}

export const apiMoneyOrdersCsv = (f: Omit<OrderFilters, "page" | "page_size"> = {}) =>
  csv("/admin/money/orders/export.csv", f);

/* ---------------- 2. withdrawals ---------------- */

export type WithdrawalStatus = "pending" | "paid" | "failed";

/** Masked by the server: last four digits, or the UPI id. Never the full number. */
export interface MaskedAccount {
  id: string;
  kind: "Bank" | "UPI" | string;
  label: string;
  detail: string;
  holder: string;
  ifsc: string;
  primary: boolean;
  verified: boolean;
  added_on: string;
}

export interface AdminWithdrawal {
  id: string;
  user_id: string;
  member: Person;
  amount_minor: number;
  amount_label: string;
  label: string;
  /** null when she removed the account after asking. */
  account: MaskedAccount | null;
  requested_at: string;
  payout_status: WithdrawalStatus | string;
  utr: string;
  paid_at: string;
  paid_by: string;
  note: string;
  failed_reason: string;
  failed_at: string;
  failed_by: string;
  reversal_id: string;
}

export interface WithdrawalFilters {
  status?: WithdrawalStatus | "all" | string;
  q?: string;
  from?: string;
  to?: string;
  page?: number;
  page_size?: number;
}

export interface WithdrawalsPage {
  withdrawals: AdminWithdrawal[];
  pagination: PageMeta;
}

export interface WithdrawalsSummary {
  by_status: Record<WithdrawalStatus, { count: number; amount_minor: number }>;
  oldest_pending_at: string;
  currency: string;
}

export const apiMoneyWithdrawals = (f: WithdrawalFilters = {}, s?: AbortSignal) =>
  get<WithdrawalsPage>("/admin/money/withdrawals", f, s);

export const apiMoneyWithdrawalsSummary = (s?: AbortSignal) =>
  get<WithdrawalsSummary>("/admin/money/withdrawals/summary", undefined, s);

export async function apiMoneyMarkPaid(
  id: string,
  body: { utr: string; paid_at?: string; note?: string },
) {
  const { data } = await apiClient.post<AdminWithdrawal>(`/admin/money/withdrawals/${id}/mark-paid`, body);
  return data;
}

export async function apiMoneyMarkFailed(id: string, reason: string) {
  const { data } = await apiClient.post<AdminWithdrawal>(`/admin/money/withdrawals/${id}/mark-failed`, { reason });
  return data;
}

export const apiMoneyWithdrawalsCsv = (f: Omit<WithdrawalFilters, "page" | "page_size"> = {}) =>
  csv("/admin/money/withdrawals/export.csv", f);

/* ---------------- 3. ledger ---------------- */

export interface LedgerTxn {
  id: string;
  kind: "credit" | "debit" | string;
  label: string;
  source: string;
  amount_minor: number;
  amount_label: string;
  when: string;
  user_id: string;
  member: Person;
  reference_id: string;
  created_at: string;
  /** Only set on withdrawal rows. */
  payout_status: string;
  /** The staff member behind an adjustment, reversal or referral credit. */
  by: string;
  reason: string;
}

export interface LedgerFilters {
  user_id?: string;
  kind?: "credit" | "debit" | "" | string;
  source?: string;
  q?: string;
  from?: string;
  to?: string;
  page?: number;
  page_size?: number;
}

export interface LedgerPage {
  transactions: LedgerTxn[];
  pagination: PageMeta;
  currency: string;
}

export interface LedgerSummary {
  credits: { count: number; amount_minor: number };
  debits: { count: number; amount_minor: number };
  net_minor: number;
  members_with_balance: number;
  held_minor: number;
  by_source: { source: string; kind: string; count: number; amount_minor: number }[];
  sources: string[];
  currency: string;
}

export interface MemberBalance {
  member: Person;
  balance_minor: number;
  raw_minor: number;
  credits_minor: number;
  debits_minor: number;
  transactions: number;
  last_activity_at: string;
  currency: string;
}

export const apiMoneyLedger = (f: LedgerFilters = {}, s?: AbortSignal) =>
  get<LedgerPage>("/admin/money/ledger", f, s);

export const apiMoneyLedgerSummary = (s?: AbortSignal) =>
  get<LedgerSummary>("/admin/money/ledger/summary", undefined, s);

export const apiMoneyMemberBalance = (userId: string, s?: AbortSignal) =>
  get<MemberBalance>(`/admin/money/ledger/members/${userId}`, undefined, s);

export async function apiMoneyAdjust(body: {
  user_id: string;
  kind: "credit" | "debit";
  amount_minor: number;
  reason: string;
}) {
  const { data } = await apiClient.post<{ transaction: LedgerTxn; balance_minor: number }>(
    "/admin/money/ledger/adjustments", body,
  );
  return data;
}

export const apiMoneyLedgerCsv = (f: Omit<LedgerFilters, "page" | "page_size"> = {}) =>
  csv("/admin/money/ledger/export.csv", f);

/* ---------------- 4. payout accounts ---------------- */

export interface AdminPayoutAccount extends MaskedAccount {
  user_id: string;
  member: Person;
  created_at: string;
  verified_by: string;
  verified_at: string;
  unverified_reason: string;
}

export interface PayoutAccountFilters {
  q?: string;
  kind?: "Bank" | "UPI" | "" | string;
  verified?: "all" | "yes" | "no" | string;
  page?: number;
  page_size?: number;
}

export interface PayoutAccountsPage {
  accounts: AdminPayoutAccount[];
  pagination: PageMeta;
  summary: { total: number; verified: number; unverified: number };
}

export const apiMoneyPayoutAccounts = (f: PayoutAccountFilters = {}, s?: AbortSignal) =>
  get<PayoutAccountsPage>("/admin/money/payout-accounts", f, s);

export async function apiMoneyVerifyAccount(id: string, note = "") {
  const { data } = await apiClient.post<AdminPayoutAccount>(`/admin/money/payout-accounts/${id}/verify`, { note });
  return data;
}

export async function apiMoneyUnverifyAccount(id: string, reason: string) {
  const { data } = await apiClient.post<AdminPayoutAccount>(`/admin/money/payout-accounts/${id}/unverify`, { reason });
  return data;
}

/* ---------------- 5. referrals ---------------- */

export type ReferralCondition = "joined" | "signed_up";

export interface ReferralConfig {
  reward_minor: number;
  reward_label: string;
  condition: ReferralCondition;
  enabled: boolean;
  updated_at: string;
  updated_by: string;
}

export interface ReferralRow {
  referred_user_id: string;
  referred: Person;
  joined_at: string;
  status: string;
  admitted: boolean;
  code: string;
  /** null when no member holds that invite code any more. */
  referrer: (Person & { code: string }) | null;
  credited: boolean;
  credited_minor: number;
  credited_at: string;
  credited_by: string;
}

export interface ReferralFilters {
  q?: string;
  state?: "all" | "credited" | "uncredited" | "admitted" | string;
  page?: number;
  page_size?: number;
}

export interface ReferralsPage {
  referrals: ReferralRow[];
  pagination: PageMeta;
}

export interface ReferralsSummary {
  invited: number;
  joined: number;
  /** Referral credits in the ledger — counts every `source="referral"` row. */
  credited: number;
  credited_minor: number;
  config: ReferralConfig;
  top: { code: string; invited: number; joined: number; referrer: (Person & { code: string }) | null }[];
}

export const apiMoneyReferralConfig = (s?: AbortSignal) =>
  get<ReferralConfig>("/admin/money/referrals/config", undefined, s);

export async function apiMoneySetReferralConfig(body: {
  reward_minor: number;
  condition: ReferralCondition;
  enabled: boolean;
}) {
  const { data } = await apiClient.put<ReferralConfig>("/admin/money/referrals/config", body);
  return data;
}

export const apiMoneyReferrals = (f: ReferralFilters = {}, s?: AbortSignal) =>
  get<ReferralsPage>("/admin/money/referrals", f, s);

export const apiMoneyReferralsSummary = (s?: AbortSignal) =>
  get<ReferralsSummary>("/admin/money/referrals/summary", undefined, s);

export async function apiMoneyCreditReferral(
  referredUserId: string,
  body: { amount_minor?: number | null; note?: string } = {},
) {
  const { data } = await apiClient.post<ReferralRow>(`/admin/money/referrals/${referredUserId}/credit`, body);
  return data;
}
