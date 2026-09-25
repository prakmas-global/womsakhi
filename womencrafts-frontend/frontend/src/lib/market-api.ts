import { apiClient } from "./api";

/**
 * The market, from the buyer's side.
 *
 * Separate from `shop-api.ts`, which is the seller's: every endpoint there is
 * scoped to "mine" on the server, which is why the market screens had nothing
 * to call and rendered eight fixtures instead.
 *
 * Every call that reads takes an `AbortSignal`, like `me-api.ts`, because
 * `useResource` cancels in flight when she taps away.
 *
 * **Money is in MINOR units (paise).** `price_minor`, `total_minor` — render
 * them with `formatRupees` from `@/components/ux/kit` and never with a local
 * `Intl.NumberFormat`, which is how this repo has shipped a 100x bug twice.
 * `price_label` and `total_label` are already formatted by the server and
 * carry the rate ("₹450 per piece"), which a bare number would lose.
 */

const get = <T>(url: string, signal?: AbortSignal, params?: Record<string, unknown>) =>
  apiClient.get<T>(url, { signal, params }).then((r) => r.data);

/** The woman selling it. Only what the server actually knows about her. */
export interface MarketSeller {
  id: string;
  name: string;
  avatar: string;
  /**
   * How close she is to the buyer: `circle` | `bought-before` | `new`.
   * Computed server-side from real circle memberships and her real order
   * history — it is what the ordering of the list is built on.
   */
  tie: string;
  /** Ready to print. The server owns the wording so two screens cannot disagree. */
  tie_label: string;
  orders_done: number;
  repeat_buyers: number;
  place: string;
}

export interface MarketListing {
  id: string;
  /** product | service */
  kind: string;
  title: string;
  desc: string;
  /** MINOR units — paise. */
  price_minor: number;
  /** Formatted server-side, and it carries the rate: "₹450 per piece". */
  price_label: string;
  rate: string;
  /** null means "not something you count" — a service has no stock. */
  stock: number | null;
  low_stock: boolean;
  out_of_stock: boolean;
  category: string;
  place: string;
  travels_km: number;
  photo: string;
  photos?: string[];
  price_mode?: "fixed" | "range" | "quote";
  seller: MarketSeller;
  /** Women in her circles who have ordered this. A real count, often zero. */
  bought_by_circle: number;
  saved: boolean;
}

export interface MyMarketOrder {
  id: string;
  listing_id: string;
  title: string;
  quantity: number;
  total_minor: number;
  total_label: string;
  note: string;
  state: string;
  placed_on: string;
  seller_id: string;
  seller_name: string;
}

export interface MarketListingDetail extends MarketListing {
  also_hers: MarketListing[];
  /** What she has already ordered from this listing. Survives a reload. */
  my_orders: MyMarketOrder[];
  conversation_id: string | null;
}

/**
 * What placing an order actually did.
 *
 * `pay_note` is the server's sentence and must be shown as it is: **WomSakhi
 * takes no money for a market order and holds none** — the buyer pays the
 * seller directly. A screen that quietly implies otherwise is making a promise
 * about her money that this platform has not made.
 */
export interface PlacedOrder {
  order: MyMarketOrder;
  seller_name: string;
  pay_directly: boolean;
  pay_note: string;
}

/** A message that exists, and the thread it landed in. */
export interface AskResult {
  conversation_id: string;
  delivered_to: string;
  text: string;
}

export const apiMarket = (s?: AbortSignal, params?: Record<string, unknown>) =>
  get<MarketListing[]>("/market/listings", s, params);

export const apiMarketListing = (id: string, s?: AbortSignal) =>
  get<MarketListingDetail>(`/market/listings/${id}`, s);

export const apiMyMarketOrders = (s?: AbortSignal) => get<MyMarketOrder[]>("/market/orders", s);

/**
 * Place an order.
 *
 * `attemptKey` is one press and its retries — see `useAttemptKey`. Without it a
 * double tap on 2G is two orders, and the woman on the other end starts cutting
 * cloth for both.
 */
export async function apiPlaceOrder(
  listingId: string,
  body: { quantity?: number; note?: string } = {},
  attemptKey?: string,
) {
  const { data } = await apiClient.post<PlacedOrder>(
    `/market/listings/${listingId}/order`,
    { quantity: body.quantity ?? 1, note: body.note ?? "" },
    attemptKey ? { headers: { "Idempotency-Key": attemptKey } } : undefined,
  );
  return data;
}

export async function apiAskSeller(listingId: string, text: string) {
  const { data } = await apiClient.post<AskResult>(`/market/listings/${listingId}/ask`, { text });
  return data;
}
