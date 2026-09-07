import { apiClient } from "./api";

import type { Layout, LayoutFeatures } from "@/layout-engine";
import type { UnreadCounts } from "./member-api";

/**
 * `GET /me/shell` — everything the member shell needs, in one request.
 *
 * Replaces `/auth/session` + `/layout/me` + `/layout/me/features` +
 * `/me/progress` + `/me/unread`.
 *
 * **There is no null `user` here.** `/auth/session` answers 200 with
 * `{ user: null }` when signed out, deliberately. This one is behind the member
 * gate, so signed-out is a 401 — anything reading `user === null` to mean
 * "signed out" has to read the status instead.
 */
export interface MeShellProgress {
  completion_rate?: number;
  [key: string]: unknown;
}

export interface MeShell {
  user: { id: string; full_name: string; email: string; avatar?: string; verification_status?: string;[key: string]: unknown };
  layout: Layout;
  features: LayoutFeatures;
  progress: MeShellProgress;
  unread: UnreadCounts;
}

export const apiMeShell = (signal?: AbortSignal) =>
  apiClient.get<MeShell>("/me/shell", { signal }).then((r) => r.data);


/**
 * `GET /me/journey` — everything `/app/progress` shows, in one request.
 *
 * Replaces `/me/progress` + `/wallet/insights` + `/shop/summary` +
 * `/me/referrals` + `/community/circles` — five requests and fourteen queries,
 * three of which ran their own waterfalls internally, so it was more round
 * trips than requests.
 *
 * Typed loosely on purpose: each section is passed straight through to the code
 * that already consumed the endpoint it came from, and restating five payload
 * shapes here would create a second definition to keep in step with the first.
 */
export interface MeJourney {
  progress: Awaited<ReturnType<typeof import("./me-api").apiProgress>>;
  insights: Awaited<ReturnType<typeof import("./shop-api").apiWalletInsights>>;
  shop: Awaited<ReturnType<typeof import("./shop-api").apiShopSummary>>;
  referrals: Awaited<ReturnType<typeof import("./me-api").apiReferrals>>;
  // From me-api, which is the one `useJourney` reads — community-api
  // exports a same-named call with a different row type.
  circles: Awaited<ReturnType<typeof import("./me-api").apiCircles>>;
}

export const apiMeJourney = (signal?: AbortSignal) =>
  apiClient.get<MeJourney>("/me/journey", { signal }).then((r) => r.data);
