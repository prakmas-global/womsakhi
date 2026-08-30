"use client";

import { useCallback } from "react";

import { apiGoals, type Goal as ApiGoal } from "@/lib/money-api";
import { useResource, type Resource } from "@/lib/use-resource";
import {
  apiListings, apiPayoutAccounts, apiShopOrders, apiShopReviews,
  apiMyExchanges, apiMyOrders, apiShopSummary, apiSwaps, apiWalletInsights,
  type ExchangeThread, type Listing, type PayoutAccount, type ShopOrder, type ShopReview,
  type Swap, type WalletInsights,
} from "@/lib/shop-api";

import { ORDERS, PRODUCTS, REVIEWS, SERVICES, SHOP, type OrderState } from "./shop/data";
import { MY_SWAPS, SWAPS, type Swap as UxSwap } from "./exchange/data";

/**
 * Her business, her payout accounts, her swaps, and the wallet's charts.
 *
 * The same seam as `live.ts` and `entitlements.ts`: the server stores what a
 * listing *is*, not that its card carries a particular icon. Translate once,
 * here, not in each of the six screens that read it.
 */

const TINTS = ["violet", "green", "blue", "orange", "pink"] as const;
function tintFor(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  const t = TINTS[Math.abs(h) % TINTS.length];
  return { tint: `--ux-tint-${t}`, ink: `--ux-${t}` };
}

/* ── Her shop, in one request ────────────────────────────────────────── */

export interface Business {
  shop: typeof SHOP;
  stats: {
    month_minor: number; lastMonth_minor: number;
    listings: number; needsHer: number; repeatBuyers: number;
  };
  week: number[];
  // `UxProduct[]`, not `typeof PRODUCTS`: the mock's shape is not the
  // contract, and tying the type to it is what left the editor with a
  // hardcoded description where her own words belong.
  products: UxProduct[];
  services: typeof SERVICES;
  orders: typeof ORDERS;
  reviews: UxReview[];
}

/**
 * A product she sells.
 *
 * Written out rather than derived from the mock with `(typeof PRODUCTS)[number]`,
 * so it can carry a field the mock never had — her own description. Deriving
 * it is why the editor had a hardcoded sentence where her words belong.
 */
export interface UxProduct {
  id: string;
  name: string;
  price_minor: number;
  stock: number;
  sold: number;
  art: string;
  live: boolean;
  /** Optional: the mock fallback carries none, and a listing may have none. */
  about?: string;
}

const toProduct = (l: Listing): UxProduct => ({
  id: l.id,
  name: l.title,
  price_minor: l.price_minor,
  // Null stock means "not something you count". Only a real zero is out of
  // stock; conflating the two puts "sold out" on a tailor's listing.
  stock: l.stock ?? 0,
  // The API does not count sales per listing yet. Zero is honest; a made-up
  // "61 sold" is a number she would quote to a customer.
  sold: 0,
  art: l.photo || PRODUCTS[0].art,
  live: l.status === "live",
  // Her own words. The editor filled this with a hardcoded sentence about
  // hand-stitching, which would have been written into her listing on save.
  about: l.desc ?? "",
});

const toService = (l: Listing): (typeof SERVICES)[number] => ({
  id: l.id,
  name: l.title,
  category: l.category,
  rate_minor: l.price_minor,
  rateKind: (l.rate || "per piece") as (typeof SERVICES)[number]["rateKind"],
  // Where she works is derived from how far she travels: a woman who will go
  // twenty kilometres is not offering "at her place only".
  where: l.travels_km > 0 ? "Either" : "At her place",
  travelKm: l.travels_km,
  mins: 0,
  about: l.desc,
  art: l.photo || SERVICES[0].art,
  live: l.status === "live",
  booked: 0,
  rating: "—",
});

const toOrder = (o: ShopOrder): (typeof ORDERS)[number] => ({
  id: o.id,
  ref: `WS-O-${o.id.slice(-6).toUpperCase()}`,
  buyer: o.buyer_name,
  item: o.title,
  qty: o.quantity,
  amount_minor: o.total_minor,
  state: o.state as OrderState,
  when: o.placed_on,
  // The server does not promise a delivery date, and inventing one is a
  // promise made in her name to a buyer she has not spoken to.
  due: "",
  channel: "Shop",
  art: ORDERS[0].art,
});

/** A review of her work, and whether she has already answered it. */
export interface UxReview {
  id: string;
  who: string;
  avatar: string;
  stars: number;
  when: string;
  what: string;
  text: string;
  /**
   * Her reply, if she wrote one.
   *
   * Dropped until now — so a seller could not see that she had already
   * answered a review, and would write a second reply to the same buyer.
   * Optional because the mock fallback carries none.
   */
  reply?: string;
}

const toReview = (r: ShopReview): UxReview => ({
  id: r.id,
  who: r.who,
  // The API keeps no photograph of a buyer. This borrowed one from the first
  // fixture, so every reviewer wore the same face.
  avatar: "",
  stars: r.stars,
  when: r.when,
  what: r.what,
  text: r.text,
  reply: r.reply ?? "",
});

export function useBusiness(): Resource<Business> {
  return useResource(
    useCallback(async (signal: AbortSignal) => {
      // Four questions the screen asks at once, sent together: four round
      // trips to a cluster in another data centre would be four times the wait.
      const [summary, listings, orders, reviews] = await Promise.all([
        apiShopSummary(signal), apiListings(signal),
        apiShopOrders(signal), apiShopReviews(signal),
      ]);
      return {
        shop: {
          ...SHOP,
          name: summary.name,
          handle: summary.handle,
          rating: summary.rating ? summary.rating.toFixed(1) : "—",
          reviews: summary.review_count,
        },
        stats: {
          month_minor: summary.month_minor,
          lastMonth_minor: summary.last_month_minor,
          listings: summary.listings,
          needsHer: summary.needs_her,
          repeatBuyers: summary.repeat_buyers_pct,
        },
        week: summary.week_orders,
        products: listings.filter((l) => l.kind === "product").map(toProduct),
        services: listings.filter((l) => l.kind === "service").map(toService),
        orders: orders.map(toOrder),
        reviews: reviews.map(toReview),
      } satisfies Business;
    }, []),
    {
      shop: SHOP,
      stats: { month_minor: 0, lastMonth_minor: 0, listings: 0, needsHer: 0, repeatBuyers: 0 },
      week: [0, 0, 0, 0, 0, 0, 0],
      products: PRODUCTS, services: SERVICES, orders: ORDERS, reviews: REVIEWS,
    },
  );
}

/* ── Getting paid ────────────────────────────────────────────────────── */

export interface UxPayoutMethod {
  id: string; kind: string; label: string; detail: string;
  icon: string; tint: string; ink: string; primary: boolean; verified: boolean;
}

const toMethod = (a: PayoutAccount): UxPayoutMethod => ({
  id: a.id,
  kind: a.kind,
  label: a.label,
  detail: a.detail,
  icon: a.kind === "UPI" ? "Smartphone" : "Landmark",
  tint: a.kind === "UPI" ? "--ux-tint-violet" : "--ux-tint-blue",
  ink: a.kind === "UPI" ? "--ux-violet" : "--ux-blue",
  primary: a.primary,
  verified: a.verified,
});

export const usePayoutMethods = (): Resource<UxPayoutMethod[]> =>
  useResource(
    useCallback(async (s: AbortSignal) => (await apiPayoutAccounts(s)).map(toMethod), []),
    // Empty, not a plausible-looking bank account. A fabricated destination on
    // the withdraw screen is the worst possible fallback: she would press the
    // button believing her money had somewhere to go.
    [],
  );

/* ── Wallet charts ───────────────────────────────────────────────────── */

export const useWalletInsights = (): Resource<WalletInsights> =>
  useResource(
    useCallback((s: AbortSignal) => apiWalletInsights(s), []),
    { monthly_minor: [], month_labels: [], sources: [], withdrawn_minor: 0, goal: null },
  );

/* ── Skill exchange ──────────────────────────────────────────────────── */

const toSwap = (s: Swap): UxSwap => ({
  id: s.id,
  // Every row on this screen is an offer to teach; "Looking for" is the same
  // row read from the other side, which the detail screen shows.
  side: "Offering",
  skill: s.skill,
  detail: s.detail,
  who: s.who,
  avatar: s.avatar || SWAPS[0].avatar,
  place: s.place,
  online: s.online,
  level: "Any level",
  wants: s.wants,
  ...tintFor(s.id),
  icon: "RefreshCw",
  // The API does not count matches yet. Zero is honest; a made-up number on a
  // card that says "3 women want this" is not.
  matches: 0,
  mine: s.mine,
});

export type UxExchange = (typeof MY_SWAPS)[number];

const toExchange = (t: ExchangeThread): UxExchange => ({
  id: t.id,
  swapId: t.swap_id,
  with: t.with_whom,
  avatar: t.avatar || MY_SWAPS[0].avatar,
  youTeach: t.you_teach,
  youLearn: t.you_learn,
  state: t.state as UxExchange["state"],
  next: t.next_step,
});

export const useMyExchanges = (): Resource<UxExchange[]> =>
  useResource(
    useCallback(async (s: AbortSignal) => (await apiMyExchanges(s)).map(toExchange), []),
    // Empty, not the fixture: an invented exchange tells her she has agreed to
    // teach somebody something, and she would turn up.
    [],
  );

export const useSwaps = (mine = false): Resource<UxSwap[]> =>
  useResource(
    useCallback(async (s: AbortSignal) => (await apiSwaps(s, { mine })).map(toSwap), [mine]),
    SWAPS,
  );

/* ── Goals ───────────────────────────────────────────────────────────── */

export type { Goal } from "@/lib/money-api";

/**
 * What she is working towards.
 *
 * Progress is not stored — money goals are summed from the ledger and skill
 * goals from her enrolments, on every read. A goal that says "₹24,350 of
 * ₹30,000" while the wallet says something else is a goal she stops believing.
 */
export const useGoals = (): Resource<ApiGoal[]> =>
  useResource(
    useCallback((s: AbortSignal) => apiGoals(s), []),
    // Empty, not an example goal. A goal she did not set, shown as hers, is a
    // number she will measure herself against for no reason.
    [],
  );

/* ── What she has paid for ───────────────────────────────────────────── */

export interface UxOrder {
  id: string;
  ref: string;
  title: string;
  purpose: string;
  reference_id: string;
  amount_minor: number;
  status: "paid" | "failed" | "refunded" | "created";
  method: string;
  when: string;
  icon: string;
  tint: string;
  ink: string;
  failure_reason: string;
}

const PURPOSE_LOOK: Record<string, { label: string; icon: string; tint: string; ink: string }> = {
  program: { label: "Course", icon: "BookOpen", tint: "--ux-tint-violet", ink: "--ux-violet" },
  booking: { label: "Booking", icon: "Users", tint: "--ux-tint-orange", ink: "--ux-orange" },
  event:   { label: "Event", icon: "Store", tint: "--ux-tint-pink", ink: "--ux-pink" },
};

/**
 * Her payment history.
 *
 * `reference_id` is carried through because retrying a declined payment needs
 * it: the server gives a failed order its own record on purpose, so a retry
 * starts a fresh one for the same thing rather than reopening the refused one.
 */
export const useOrders = (): Resource<UxOrder[]> =>
  useResource(
    useCallback(async (s: AbortSignal) => {
      const rows = await apiMyOrders(s);
      return rows.map((o): UxOrder => {
        const look = PURPOSE_LOOK[o.purpose] ?? {
          label: o.purpose || "Payment", icon: "Receipt",
          tint: "--ux-surface-2", ink: "--ux-muted",
        };
        return {
          id: o.id,
          ref: o.id.slice(-8).toUpperCase(),
          title: o.title,
          purpose: look.label,
          reference_id: o.reference_id,
          amount_minor: o.amount_minor,
          status: (o.status as UxOrder["status"]) ?? "created",
          // The method is only known once a provider has taken it; before that
          // saying "UPI" would be a guess about how she is going to pay.
          method: o.method || (o.status === "paid" ? "Paid" : "Not paid yet"),
          when: o.created,
          icon: look.icon, tint: look.tint, ink: look.ink,
          failure_reason: o.failure_reason || "",
        };
      });
    }, []),
    [],
  );
