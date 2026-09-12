"use client";

/**
 * Where "what do we know about her" comes from.
 *
 * ── The seam ────────────────────────────────────────────────────────────────
 * Everything above this file — the journey engine, Home, My Journey — asks for
 * a `JourneyState` and does not know or care where it came from. It used to be
 * assembled from the mock modules; the promise made here was that when the API
 * was ready only the body of this file would change and no screen would be
 * touched.
 *
 * That promise was kept in shape but not in signature. The old read was
 * synchronous, which a network cannot be, so the two callers now read a
 * `Resource` instead of a value — the same hook every other wired screen in
 * this app reads through. The engine (`services/journey`) is untouched apart
 * from learning what "we do not know" looks like.
 *
 * ── Deliberately assembled, not stored ──────────────────────────────────────
 * The state is DERIVED from things the app already records — orders finished,
 * money received, products listed. It is never a stored "stage" field, because
 * a stored stage goes stale the moment she does something and drifts from what
 * the rest of the app shows her.
 *
 * ── What is live, and what is not ───────────────────────────────────────────
 * Nine of the twelve fields are now read from the server. Three are `null`,
 * and they are `null` rather than `0`/`false` on purpose:
 *
 *   · `skills`       — nothing in this system stores a skill against a woman.
 *   · `hasPortfolio`  — there is no portfolio in this product yet.
 *   · `hasShop`       — "opening a shop" is not an event anything records.
 *
 * The fixtures they replaced were not harmless. `earnedMinor` came from a list
 * of fabricated payment requests, `productsListed` was the literal `5`,
 * `hasShop` was the literal `true` — which is what made "Open your shop" tick
 * itself for every woman on her first morning — and `monthsActive` came from a
 * "proof" fixture. A journey stage computed from those put her at the wrong
 * point in her own story, told confidently.
 *
 * ── Five requests, and why not one ──────────────────────────────────────────
 * There is no endpoint that answers all of this, so it is five in one wave:
 *
 *   · `/me/journey`                  courses, earnings, listings, circles, joined-when
 *                                    (itself a batch of the five endpoints it replaced)
 *   · `/me/profile`                  her photograph, her verification, her own words
 *   · `/shop/orders`                 work actually finished
 *   · `/growth/applications`         jobs she has put herself forward for
 *   · `/growth/mentors/requests/mine` whether a mentor ever said yes
 *
 * They go together, so they cost one round trip rather than five, and GETs are
 * deduped for ten seconds — so arriving here from Home does not re-ask.
 *
 * **Nothing here catches a failed block and substitutes an empty one.** The
 * difference between "she has no applications" and "we could not reach her
 * applications" is invisible once you replace the second with `[]`, and the
 * screens draw checkboxes from these numbers. If any part is missing the whole
 * read fails, `data` is `null`, and the screen says it does not know.
 */
import { useResource, type Resource } from "@/lib/use-resource";
import { apiMeProfile } from "@/lib/member-api";
import { apiMeJourney } from "@/lib/shell-api";
import { apiShopOrders } from "@/lib/shop-api";
import { apiApplications, apiMyMentorRequests } from "@/lib/growth-api";

import type { JourneyFacts } from "./journey";

/**
 * Everything the journey screens need about her, from the server.
 *
 * `JourneyFacts` rather than `JourneyState` because the profile half belongs
 * in the same read: the journey screen used to assemble it from `useMe`, whose
 * `tagline` is a module constant and whose `profilePct` is the wrong
 * percentage (see below). Two of the seven steps were ticking themselves on
 * the strength of those.
 */
export type MeFacts = JourneyFacts;

export async function fetchMeFacts(signal?: AbortSignal): Promise<MeFacts> {
  const [journey, profile, orders, applications, mentorRequests] = await Promise.all([
    apiMeJourney(signal),
    apiMeProfile(signal),
    apiShopOrders(signal),
    apiApplications(signal),
    apiMyMentorRequests(signal),
  ]);

  const { progress, insights, shop, circles } = journey;

  return {
    /* ── Nothing records these ─────────────────────────────────────────── */
    skills: null,
    hasPortfolio: null,
    hasShop: null,

    /* ── Her learning — `/me/progress`, via `/me/journey` ──────────────── */
    coursesDone: progress.programs_completed,
    coursesInProgress: progress.programs_active,

    /**
     * Work finished — `/shop/orders`, counting the state the shop calls done.
     *
     * "Done" is the last state in `ShopOrderModel.NEXT`; "Sent" is paid but
     * not yet confirmed received, and counting it would tick "Finish one
     * order" for work still in the post.
     */
    ordersDone: orders.filter((o) => o.state === "Done").length,

    /** Jobs she has put herself forward for — `/growth/applications`. */
    applications: applications.length,

    /**
     * Money that has reached her, in PAISE — `/wallet/insights.sources`, via
     * `/me/journey`.
     *
     * `sources` is every credit in her ledger with no date bound, which is the
     * only all-time figure the API carries; `monthly_minor` beside it is the
     * last twelve months and would read ₹0 for a woman whose earnings are
     * older than that, which on this screen means "you have never been paid".
     *
     * Minor units the whole way. Nothing here divides by 100 — that happens
     * once, in `formatRupees`, at the moment it is drawn.
     */
    earnedMinor: insights.sources.reduce((total, s) => total + s.minor, 0),

    /** What she sells — `/shop/summary.listings`, the server's own count. */
    productsListed: shop.listings,

    /**
     * Circles she is in — `/community/circles`, via `/me/journey`.
     *
     * The browse list is capped at 100 rows server-side. Both readings of this
     * field ask whether it is above 0 or above 1, so the cap cannot change an
     * answer; it would if anything ever printed the number.
     */
    circles: circles.filter((c) => c.joined).length,

    /**
     * Whether a mentor ever said yes — `/growth/mentors/requests/mine`.
     *
     * Accepted, not requested. A woman with twenty pending requests has asked
     * twenty times and has no mentor, and the screen must not tell her
     * otherwise while she is still waiting to hear back.
     */
    hasMentor: mentorRequests.some((r) => r.status === "accepted"),

    /** How long she has been here — `/me/progress.member_since`. */
    monthsActive: monthsSince(progress.member_since),

    /* ── Her profile — `/me/profile` ───────────────────────────────────── */
    verified: profile.verification_status === "active",
    hasAvatar: Boolean(profile.avatar),
    /** Her own line about her work, empty when she has not written one. */
    bio: (profile.bio || "").trim(),

    /**
     * **Not wired, deliberately.** `/me/profile` carries the five fields the
     * server counts — avatar, phone, location, bio, dob — but not the count,
     * and re-deriving it here would put a second copy of `PROFILE_STEPS` in
     * the app for the two to drift apart on.
     *
     * The number this screen used instead, `useMe().profilePct`, is
     * `/me/progress.completion_rate` — the furthest-along *course* percentage.
     * For the seeded member that is 100 while her real profile is 80 and her
     * bio is empty, so "Complete every part of it" was ticked. `null` drops
     * the check until `/me/home.me.profile.pct`, which is the real figure, is
     * carried by an endpoint this read already makes.
     */
    profilePct: null,
  };
}

/**
 * The live read, for the two screens that ask what we know about her.
 *
 * The fallback is `null`, not a fixture. Everywhere else in this app a mock
 * fallback is a kindness — a mock course is a course nobody is asked to act
 * on. Here the value decides where a woman is told she stands in her own life
 * and which of seven steps is lit, so a fixture behind a failed request is the
 * app inventing her history. `null` means "we do not know", and both screens
 * say so rather than drawing it.
 */
export function useMeFacts(): Resource<MeFacts | null> {
  // A module-level function is already referentially stable, so there is no
  // `useCallback` here — wrapping it would only hide that.
  return useResource<MeFacts | null>(fetchMeFacts, null);
}

/**
 * "August 2026" → how many whole months ago that was.
 *
 * The server sends the month as a printed label rather than a date, so this
 * parses it back. A twin of this lives in `components/ux/journey.ts` for the
 * progress screen; both exist because that one is a client hook and this is a
 * service, and neither should import the other.
 */
function monthsSince(memberSince: string): number {
  if (!memberSince) return 0;
  const when = new Date(`1 ${memberSince}`);
  if (Number.isNaN(when.getTime())) return 0;
  const now = new Date();
  return Math.max(
    0,
    (now.getFullYear() - when.getFullYear()) * 12 + (now.getMonth() - when.getMonth()),
  );
}
