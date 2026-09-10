import { apiClient } from "./api";

/**
 * Her business, her payout accounts, her skill swaps — and the wallet's charts.
 *
 * Everything here is scoped to the signed-in woman by the server; nothing takes
 * a user id, so there is no id in a URL for anyone to change.
 */

const get = <T>(url: string, signal?: AbortSignal, params?: Record<string, unknown>) =>
  apiClient.get<T>(url, { signal, params }).then((r) => r.data);

/* ── Her business ────────────────────────────────────────────────────── */

export interface Listing {
  id: string;
  kind: "product" | "service";
  title: string;
  desc: string;
  price_minor: number;
  price_label: string;
  rate: string;
  /** Null means "not something you count" — a service has no stock, and zero
   *  would render a tailor's listing as out of stock. */
  stock: number | null;
  low_stock: boolean;
  out_of_stock: boolean;
  category: string;
  place: string;
  travels_km: number;
  photo: string;
  status: string;
  views: number;
}

export interface ShopOrder {
  id: string;
  buyer_name: string;
  listing_id: string;
  title: string;
  quantity: number;
  total_minor: number;
  total_label: string;
  note: string;
  state: string;
  next_state: string | null;
  /** The question she opens this screen with, answered as a field. */
  needs_her: boolean;
  placed_on: string;
}

export interface ShopReview {
  id: string; who: string; stars: number; text: string;
  what: string; reply: string; when: string;
}

export interface ShopSummary {
  name: string; handle: string; rating: number; review_count: number;
  needs_her: number; month_minor: number; last_month_minor: number;
  listings: number; week_orders: number[];
  /** Share of her buyers who came back — the best signal that what she
   *  makes is worth returning for. */
  repeat_buyers_pct: number;
}

export const apiShopSummary = (s?: AbortSignal) => get<ShopSummary>("/shop/summary", s);
export const apiListings = (s?: AbortSignal) => get<Listing[]>("/shop/listings", s);
export const apiShopOrders = (s?: AbortSignal) => get<ShopOrder[]>("/shop/orders", s);
export const apiShopReviews = (s?: AbortSignal) => get<ShopReview[]>("/shop/reviews", s);

/**
 * Take a listing out of the shop without deleting it.
 *
 * `status` existed on the model from the start and nothing could set it —
 * `PATCH` takes a `ListingCreate`, which has no `status`. So a woman whose
 * stock ran out could only delete the listing and lose its reviews with it.
 */
export async function apiPauseListing(id: string, paused = true) {
  const { data } = await apiClient.post<Listing>(
    `/shop/listings/${id}/pause`, null, { params: { paused } });
  return data;
}

export async function apiAdvanceOrder(id: string) {
  const { data } = await apiClient.post<ShopOrder>(`/shop/orders/${id}/advance`);
  return data;
}

export async function apiReplyToReview(id: string, reply: string) {
  const { data } = await apiClient.post<ShopReview>(`/shop/reviews/${id}/reply`, { reply });
  return data;
}

/** Call an order off. Only possible before it has been sent. */
export async function apiCancelShopOrder(id: string) {
  const { data } = await apiClient.post<ShopOrder>(`/shop/orders/${id}/cancel`);
  return data;
}

export async function apiSaveListing(body: Partial<Listing> & { kind: string; title: string }) {
  const { data } = await apiClient.post<Listing>("/shop/listings", body);
  return data;
}

export async function apiUpdateListing(id: string, body: Record<string, unknown>) {
  const { data } = await apiClient.patch<Listing>(`/shop/listings/${id}`, body);
  return data;
}

export const apiDeleteListing = (id: string) =>
  apiClient.delete(`/shop/listings/${id}`).then(() => undefined);

/* ── Getting paid ────────────────────────────────────────────────────── */

export interface PayoutAccount {
  id: string; kind: "Bank" | "UPI"; label: string; detail: string;
  holder: string; ifsc: string; primary: boolean; verified: boolean; added_on: string;
}

export const apiPayoutAccounts = (s?: AbortSignal) =>
  get<PayoutAccount[]>("/me/payout/accounts", s);

export async function apiAddBankAccount(body: {
  account_number: string; confirm_account_number: string;
  ifsc: string; holder: string; label?: string;
}) {
  const { data } = await apiClient.post<PayoutAccount>("/me/payout/accounts", { kind: "Bank", ...body });
  return data;
}

export async function apiAddUpi(upi_id: string, label = "") {
  const { data } = await apiClient.post<PayoutAccount>("/me/payout/accounts", { kind: "UPI", upi_id, label });
  return data;
}

export async function apiMakePrimary(id: string) {
  const { data } = await apiClient.post<PayoutAccount[]>(`/me/payout/accounts/${id}/primary`);
  return data;
}

export async function apiRemoveAccount(id: string) {
  const { data } = await apiClient.delete<PayoutAccount[]>(`/me/payout/accounts/${id}`);
  return data;
}

export interface WithdrawResult {
  id: string; amount_minor: number; amount_label: string;
  to: string; arrives: string; balance_after_minor: number;
}

export async function apiWithdraw(amountMinor: number, accountId?: string, attemptKey?: string) {
  const { data } = await apiClient.post<WithdrawResult>(
    "/me/payout/withdraw",
    { amount_minor: amountMinor, account_id: accountId },
    // The key was derived from the amount, which was wrong: withdrawing ₹200
    // twice in a day is ordinary, and the second one silently returned the
    // first one's answer and moved nothing. It is now one key per press —
    // see `useAttemptKey`.
    attemptKey ? { headers: { "Idempotency-Key": attemptKey } } : undefined,
  );
  return data;
}

/* ── Wallet insights ─────────────────────────────────────────────────── */

export interface WalletInsights {
  monthly_minor: number[];
  month_labels: string[];
  sources: { name: string; minor: number; tone: string }[];
  withdrawn_minor: number;
  /** Null when she has not set one. A goal she never chose is not a goal. */
  goal: { label: string; target_minor: number; current_minor: number } | null;
}

export const apiWalletInsights = (s?: AbortSignal) => get<WalletInsights>("/wallet/insights", s);

/* ── What she has paid for ───────────────────────────────────────────── */

export interface Order {
  id: string; purpose: string; reference_id: string; title: string;
  amount_minor: number; amount_label: string; currency: string;
  status: string; provider: string; provider_order_id: string;
  method: string; failure_reason: string; refunded_minor: number;
  created: string; created_at: string;
}

export const apiMyOrders = (s?: AbortSignal) => get<Order[]>("/payments/orders", s);

/* ── Skill exchange ──────────────────────────────────────────────────── */

export interface Swap {
  id: string; who: string; avatar: string; skill: string; detail: string;
  wants: string; place: string; online: boolean; tags: string[];
  status: string; asked: boolean; mine: boolean;
}

export interface Exchange {
  id: string;
  swap_id: string;
  agreed: boolean;
  agreement: { i_teach: string; she_teaches: string; sessions_each: number } | null;
  messages: { mine: boolean; text: string; at: string }[];
}

export interface ExchangeThread {
  id: string;
  swap_id: string;
  with_whom: string;
  avatar: string;
  /** Named from HER side by the server, because the same agreement reads
   *  backwards depending on who is looking at it. */
  you_teach: string;
  you_learn: string;
  state: string;
  next_step: string;
}

export const apiMyExchanges = (s?: AbortSignal) =>
  get<ExchangeThread[]>("/exchange/threads", s);

export const apiSwaps = (s?: AbortSignal, params?: { mine?: boolean; q?: string; tag?: string }) =>
  get<Swap[]>("/exchange/swaps", s, params);

export const apiExchange = (id: string, s?: AbortSignal) =>
  get<Exchange>(`/exchange/threads/${id}`, s);

export async function apiAskSwap(swapId: string, text: string) {
  const { data } = await apiClient.post<Exchange>(`/exchange/swaps/${swapId}/ask`, { text });
  return data;
}

export async function apiSayInExchange(threadId: string, text: string) {
  const { data } = await apiClient.post<Exchange>(`/exchange/threads/${threadId}/say`, { text });
  return data;
}

export async function apiAgree(threadId: string, body: {
  i_teach: string; she_teaches: string; sessions_each: number;
}) {
  const { data } = await apiClient.post<Exchange>(`/exchange/threads/${threadId}/agree`, body);
  return data;
}
