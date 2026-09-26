import { apiClient } from "./api";
import { apiMyPermissions } from "./permissions-api";

/**
 * Staff side of the market: listings, orders, reviews, group buys, sellers.
 *
 * Everything under `/admin/market/*` is behind the "market" module guard and
 * every write names its action (`market.edit`, `.delete`, `.approve`,
 * `.create`, `.export`). The screens ask `apiMarketPermissions()` which of
 * those the signed-in account holds, so a button is only drawn when the
 * server would accept the click.
 *
 * Buyers and sellers arrive as name + avatar + member code only. The server
 * never sends an email or a phone number on these routes, so nothing here can
 * render one.
 */

/* ---------------- permissions ---------------- */

export type MarketAction = "view" | "create" | "edit" | "delete" | "approve" | "export";

export async function apiMarketPermissions(isSuperAdmin: boolean) {
  const all: MarketAction[] = ["view", "create", "edit", "delete", "approve", "export"];
  if (isSuperAdmin) return new Set<MarketAction>(all);
  const { permissions } = await apiMyPermissions();
  return new Set<MarketAction>(all.filter((a) => permissions.includes(`market.${a}`)));
}

/* ---------------- shared shapes ---------------- */

export interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

/** A member as the market shows her to staff: no contact details. */
export interface Person {
  id: string;
  name: string;
  avatar: string;
  member_id: string;
  suspended: boolean;
}

export type ModerationState = "visible" | "hidden" | "removed";

export interface Moderation {
  state: ModerationState;
  reason: string;
  by: string;
  at: string;
}

export interface HistoryEntry {
  at: string;
  action: string;
  who: string;
  detail: string;
}

export interface MarketSummary {
  listings: { total: number; live: number; paused: number; hidden: number };
  orders: { total: number; open: number; done: number; cancelled: number };
  reviews: { total: number; hidden: number };
  group_buys: { open: number; met: number; ordered: number; closed: number };
  sellers: { total: number; suspended: number };
}

export async function apiMarketSummary() {
  const { data } = await apiClient.get<MarketSummary>("/admin/market/summary");
  return data;
}

/* ---------------- listings ---------------- */

export interface AdminListing {
  id: string;
  kind: "product" | "service" | string;
  title: string;
  desc: string;
  price_minor: number;
  price_label: string;
  price_mode: string;
  rate: string;
  stock: number | null;
  low_stock: boolean;
  out_of_stock: boolean;
  category: string;
  place: string;
  travels_km: number;
  photo: string;
  photos: string[];
  status: "live" | "paused" | string;
  views: number;
  created_at: string;
  updated_at: string;
  orders: number;
  hidden: boolean;
  moderation: Moderation;
  seller: Person;
}

export interface ListingFilters {
  q?: string;
  status?: "" | "live" | "paused" | "hidden";
  kind?: "" | "product" | "service";
  seller?: string;
  page?: number;
  page_size?: number;
}

export async function apiAdminListings(params: ListingFilters = {}) {
  const { data } = await apiClient.get<Paged<AdminListing>>("/admin/market/listings", { params });
  return data;
}

export async function apiAdminListing(id: string) {
  const { data } = await apiClient.get<AdminListing & { recent_orders: AdminOrder[]; history: HistoryEntry[] }>(
    `/admin/market/listings/${id}`,
  );
  return data;
}

export async function apiHideListing(id: string, reason: string) {
  const { data } = await apiClient.post<AdminListing>(`/admin/market/listings/${id}/hide`, { reason });
  return data;
}

export async function apiRestoreListing(id: string, reason = "") {
  const { data } = await apiClient.post<AdminListing>(`/admin/market/listings/${id}/restore`, { reason });
  return data;
}

export async function apiRemoveListing(id: string, reason: string) {
  const { data } = await apiClient.post<AdminListing>(`/admin/market/listings/${id}/remove`, { reason });
  return data;
}

export const apiListingsCsv = (params: Omit<ListingFilters, "page" | "page_size"> = {}) =>
  apiClient
    .get("/admin/market/listings/export", { params, responseType: "blob" })
    .then((r) => r.data as Blob);

/* ---------------- orders ---------------- */

export type OrderState = "New" | "Making" | "Ready" | "Sent" | "Done" | "Cancelled";

export interface AdminOrder {
  id: string;
  buyer_id: string;
  buyer_name: string;
  listing_id: string;
  seller_id: string;
  title: string;
  quantity: number;
  total_minor: number;
  total_label: string;
  note: string;
  state: OrderState | string;
  next_state: string | null;
  needs_her: boolean;
  placed_on: string;
  placed_at: string;
  updated_at: string;
  buyer: Person;
  seller: Person;
  staff_cancel: { reason: string; by: string; at: string } | null;
}

export interface OrderTimelineEntry {
  at: string;
  label: string;
  who: string;
  detail: string;
}

export interface AdminOrderDetail extends AdminOrder {
  listing: { id: string; title: string; exists: boolean; hidden: boolean; status: string };
  timeline: OrderTimelineEntry[];
}

export interface OrderFilters {
  status?: "" | "open" | OrderState;
  q?: string;
  seller?: string;
  from?: string;
  to?: string;
  page?: number;
  page_size?: number;
}

export async function apiAdminOrders(params: OrderFilters = {}) {
  const { data } = await apiClient.get<Paged<AdminOrder>>("/admin/market/orders", { params });
  return data;
}

export async function apiAdminOrder(id: string) {
  const { data } = await apiClient.get<AdminOrderDetail>(`/admin/market/orders/${id}`);
  return data;
}

export async function apiForceCancelOrder(id: string, reason: string) {
  const { data } = await apiClient.post<AdminOrder>(`/admin/market/orders/${id}/cancel`, { reason });
  return data;
}

export const apiOrdersCsv = (params: Omit<OrderFilters, "page" | "page_size"> = {}) =>
  apiClient
    .get("/admin/market/orders/export", { params, responseType: "blob" })
    .then((r) => r.data as Blob);

/* ---------------- reviews ---------------- */

export interface AdminReview {
  id: string;
  who: string;
  stars: number;
  text: string;
  what: string;
  reply: string;
  when: string;
  created_at: string;
  order_id: string;
  hidden: boolean;
  moderation: Moderation;
  seller: Person;
}

export interface ReviewFilters {
  q?: string;
  state?: "" | "visible" | "hidden";
  stars?: number;
  seller?: string;
  page?: number;
  page_size?: number;
}

export async function apiAdminReviews(params: ReviewFilters = {}) {
  const { data } = await apiClient.get<Paged<AdminReview> & { hidden_total: number }>(
    "/admin/market/reviews",
    { params },
  );
  return data;
}

export async function apiHideReview(id: string, reason: string) {
  const { data } = await apiClient.post<AdminReview>(`/admin/market/reviews/${id}/hide`, { reason });
  return data;
}

export async function apiRestoreReview(id: string, reason = "") {
  const { data } = await apiClient.post<AdminReview>(`/admin/market/reviews/${id}/restore`, { reason });
  return data;
}

/* ---------------- group buys ---------------- */

export type GroupBuyStatus = "open" | "met" | "ordered" | "closed";
export type GroupBuyStage = GroupBuyStatus | "delivered" | "cancelled";

export interface AdminGroupBuy {
  id: string;
  item: string;
  unit: string;
  alone_minor: number;
  together_minor: number;
  saving_minor: number;
  saving_label: string;
  needed: number;
  joined: number;
  still_needed: number;
  full: boolean;
  supplier: string;
  note: string;
  status: GroupBuyStatus | string;
  stage: GroupBuyStage | string;
  closes: string;
  closed: boolean;
  closes_at: string;
  created_at: string;
  updated_at: string;
  joiner_count: number;
  ordered_at: string;
  ordered_by: string;
  order_reference: string;
  order_note: string;
  delivered_at: string;
  delivered_by: string;
  closed_at: string;
  closed_by: string;
  close_note: string;
  cancelled: { reason: string; by: string; at: string } | null;
  /** How many joiners were told, on the responses of the actions that tell them. */
  told?: number;
}

export interface GroupBuyJoiner extends Person {
  quantity: number;
  joined_at: string;
}

export interface GroupBuyInput {
  item: string;
  unit: string;
  alone_minor: number;
  together_minor: number;
  needed: number;
  /** ISO datetime. */
  closes_at: string;
  supplier: string;
  note: string;
}

export interface GroupBuyFilters {
  status?: "" | GroupBuyStatus;
  q?: string;
  page?: number;
  page_size?: number;
}

export async function apiAdminGroupBuys(params: GroupBuyFilters = {}) {
  const { data } = await apiClient.get<Paged<AdminGroupBuy>>("/admin/market/group-buys", { params });
  return data;
}

export async function apiAdminGroupBuy(id: string) {
  const { data } = await apiClient.get<AdminGroupBuy & { joiners: GroupBuyJoiner[]; history: HistoryEntry[] }>(
    `/admin/market/group-buys/${id}`,
  );
  return data;
}

export async function apiCreateGroupBuy(body: GroupBuyInput) {
  const { data } = await apiClient.post<AdminGroupBuy>("/admin/market/group-buys", body);
  return data;
}

export async function apiUpdateGroupBuy(id: string, body: GroupBuyInput) {
  const { data } = await apiClient.put<AdminGroupBuy>(`/admin/market/group-buys/${id}`, body);
  return data;
}

export async function apiPlaceGroupOrder(id: string, body: { reference: string; note: string }) {
  const { data } = await apiClient.post<AdminGroupBuy>(`/admin/market/group-buys/${id}/place-order`, body);
  return data;
}

export async function apiCloseGroupBuy(id: string, reason = "") {
  const { data } = await apiClient.post<AdminGroupBuy>(`/admin/market/group-buys/${id}/close`, { reason });
  return data;
}

export async function apiCancelGroupBuy(id: string, reason: string) {
  const { data } = await apiClient.post<AdminGroupBuy>(`/admin/market/group-buys/${id}/cancel`, { reason });
  return data;
}

export async function apiDeliverGroupBuy(id: string, note = "") {
  const { data } = await apiClient.post<AdminGroupBuy>(`/admin/market/group-buys/${id}/delivered`, { reason: note });
  return data;
}

export async function apiGroupBuyJoiners(id: string) {
  const { data } = await apiClient.get<GroupBuyJoiner[]>(`/admin/market/group-buys/${id}/joiners`);
  return data;
}

export const apiGroupBuysCsv = () =>
  apiClient.get("/admin/market/group-buys/export", { responseType: "blob" }).then((r) => r.data as Blob);

export const apiGroupBuyJoinersCsv = (id: string) =>
  apiClient
    .get(`/admin/market/group-buys/${id}/joiners/export`, { responseType: "blob" })
    .then((r) => r.data as Blob);

/* ---------------- sellers ---------------- */

export interface AdminSeller extends Person {
  account_exists: boolean;
  since: string;
  listings: { total: number; live: number; paused: number; hidden: number };
  orders: { total: number; open: number; done: number; cancelled: number; earned_minor: number };
  reviews: { count: number; rating: number };
  suspension: { reason: string; by: string; at: string } | null;
  kitchen: {
    licence_no: string;
    steps_done: number;
    verified: boolean;
    verified_by: string;
    verified_at: string;
  };
}

export interface AdminSellerDetail extends AdminSeller {
  listing_rows: AdminListing[];
  recent_orders: AdminOrder[];
  recent_reviews: AdminReview[];
  history: HistoryEntry[];
}

export interface SellerFilters {
  q?: string;
  state?: "" | "suspended" | "active" | "licensed";
  sort?: "listings" | "orders" | "name" | "newest";
  page?: number;
  page_size?: number;
}

export async function apiAdminSellers(params: SellerFilters = {}) {
  const { data } = await apiClient.get<Paged<AdminSeller> & { suspended_total: number; licensed_total: number }>(
    "/admin/market/sellers",
    { params },
  );
  return data;
}

export async function apiAdminSeller(id: string) {
  const { data } = await apiClient.get<AdminSellerDetail>(`/admin/market/sellers/${id}`);
  return data;
}

export async function apiSuspendSeller(id: string, reason: string) {
  const { data } = await apiClient.post<AdminSeller>(`/admin/market/sellers/${id}/suspend`, { reason });
  return data;
}

export async function apiUnsuspendSeller(id: string, reason = "") {
  const { data } = await apiClient.post<AdminSeller>(`/admin/market/sellers/${id}/unsuspend`, { reason });
  return data;
}

export async function apiVerifyLicence(id: string, note = "") {
  const { data } = await apiClient.post<AdminSeller>(`/admin/market/sellers/${id}/licence/verify`, { reason: note });
  return data;
}

export async function apiUnverifyLicence(id: string, reason: string) {
  const { data } = await apiClient.post<AdminSeller>(`/admin/market/sellers/${id}/licence/unverify`, { reason });
  return data;
}

export const apiSellersCsv = () =>
  apiClient.get("/admin/market/sellers/export", { responseType: "blob" }).then((r) => r.data as Blob);

/* ---------------- shared formatting ---------------- */

/** "12 Sep 2026", or "" when the timestamp is missing or unreadable. */
export function shortDate(iso: string) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

/** "12 Sep 2026, 4:05 pm" for timelines. */
export function shortDateTime(iso: string) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
}

/** Whole rupees read as whole rupees; paise only when there are any. */
export function rupees(minor: number) {
  const n = Number(minor) || 0;
  return n % 100 === 0 ? `₹${(n / 100).toLocaleString("en-IN")}` : `₹${(n / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** "Showing 1 to 20 of 273" for the pager, honest when the page is empty. */
export function showing(page: Paged<unknown>, noun: string) {
  if (page.total === 0) return `No ${noun}`;
  const from = (page.page - 1) * page.page_size + 1;
  const to = Math.min(page.total, from + page.items.length - 1);
  return `Showing ${from} to ${to} of ${page.total} ${noun}`;
}

/** Save a CSV blob through the browser's download path. */
export function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const EMPTY_PAGE = { items: [], total: 0, page: 1, page_size: 20, pages: 1 };
