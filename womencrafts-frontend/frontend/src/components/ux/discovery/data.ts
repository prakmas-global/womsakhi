"use client";

import { useCallback } from "react";

import { apiCircles, apiHome, apiMentors } from "@/lib/me-api";
import { apiGoals, type Goal } from "@/lib/money-api";
import { useResource, type Resource } from "@/lib/use-resource";

/**
 * Discover, and her goals — on the rows the server actually holds.
 *
 * ── What this file used to be ───────────────────────────────────────────────
 * Three fixture rails and five fixture goals, and the premise of all of them
 * was a **personalised reason**: every card carried a `because:` line saying
 * what about HER had produced it. Every one of those reasons was invented.
 *
 *   · "You charge ₹280 for blouses. Women near you charge up to ₹600" — she
 *     has never entered a blouse price, and nothing in this product records
 *     what anyone near her charges. `/app/shop/pricing` was rewritten to say
 *     exactly that, so the app contradicted itself one tap apart.
 *   · "You have finished 87 orders and this needs someone who delivers" — the
 *     seeded member has three.
 *   · "Six women you have sold to are already in it", "3 women in your circle
 *     do it", "One school near you orders 120 sets", "2 km away" — there is no
 *     buyer graph, no trade-adjacency table and no geography in this database.
 *     None of it came from anywhere.
 *
 * A fabricated reason is worse than no reason. It is the app telling a woman
 * it knows her, using facts about her life that it made up — and the moment
 * she notices one is wrong, every true thing on the screen goes with it.
 *
 * ── The rule the rails follow now ───────────────────────────────────────────
 * **A `because:` line may only repeat something the server sent.** `/me/home`
 * derives a real one for courses (`reason`, computed from her own enrolment).
 * Nothing else in this product derives one, so nothing else has one — those
 * cards render without the line rather than with a generic sentence dressed up
 * as personal.
 *
 * Everything else on a card is the row's own facts: the organisation that
 * posted the work, the pay the buyer typed, how many women are in the circle,
 * where the mentor lives. Those are true about the row, and none of them is a
 * claim about her.
 *
 * ── Where the rows come from ────────────────────────────────────────────────
 *   · work    `GET /me/home` → `opportunities` — the same rows
 *             `/growth/opportunities` serves, so `applied` and `saved` are hers
 *   · learn   `GET /me/home` → `recommended` — catalogue programmes she has not
 *             joined, each with the server's own `reason`
 *   · circles `GET /community/circles` — the ones she is not already in
 *   · women   `GET /growth/mentors` — real mentors, with the city they gave
 *
 * One wave, not four screens' worth of waterfalls, and one `source` for the
 * page: either the rails are hers or the screen says it could not load them.
 * There is no fixture fallback anywhere in this file — an empty rail is the
 * honest answer to a failed request, and the screen prints the difference.
 */

export type DiscoverKind = "opportunity" | "course" | "circle" | "woman";

export interface DiscoverItem {
  id: string;
  kind: DiscoverKind;
  title: string;
  /** The row's own facts — who posted it, where it is, how big it is. */
  detail: string;
  /** More of the same, on its own line. Empty when the server said nothing. */
  meta: string;
  href: string;
  icon: string;
  tint: string;
  ink: string;
  /**
   * Why this reached her — **only ever a sentence the server sent**.
   *
   * Optional, and absent for three of the four rails, because nothing in this
   * product can derive one for work, circles or mentors. A card with no reason
   * renders with no reason line. See the header.
   */
  because?: string;
  /** A fact the server states about her and this row — "You applied". */
  badge?: string;
  /** Her own photograph, when she has uploaded one. Never a stock face. */
  photo?: string;
  /** What a mentor says she knows, in her own words on her own profile. */
  tags?: string[];
  /** Opportunities only: the server tracks this bookmark and can toggle it. */
  saved?: boolean;
}

export interface DiscoverRails {
  women: DiscoverItem[];
  work: DiscoverItem[];
  learn: DiscoverItem[];
  circles: DiscoverItem[];
}

/**
 * The four rails, narrowed to the fields they draw.
 *
 * `/me/home` types its list blocks as `Record<string, unknown>` — it gathers
 * eleven endpoints and does not re-declare eleven shapes — so the rows are
 * narrowed here instead. These names are the wire names (`OpportunityResponse`,
 * `HomeRecommendation`, `CircleResponse`, `MentorResponse`); nothing is
 * renamed on the way in, which is what makes a mismatch visible in one place
 * rather than as an empty card on a screen.
 */
interface WorkRow {
  id: string; title: string; org: string; mode: string; location: string;
  pay: string; deadline_label: string; applied: boolean; saved: boolean;
  openings: number;
}

interface CourseRow {
  id: string; name: string; category: string; duration: string; mode: string;
  seats_left: number | null; reason: string;
}

const NO_RAILS: DiscoverRails = { women: [], work: [], learn: [], circles: [] };

const join = (parts: (string | undefined | null)[]) =>
  parts.map((p) => (p ?? "").trim()).filter(Boolean).join(" · ");

const toWork = (o: WorkRow): DiscoverItem => ({
  id: o.id,
  kind: "opportunity",
  title: o.title,
  detail: join([o.org, o.location]),
  // `pay` is the sentence the buyer wrote — printed, never re-formatted. The
  // minor-unit fields beside it are for sorting, not for display.
  meta: join([o.pay, o.deadline_label ? `Apply by ${o.deadline_label}` : ""]),
  // True, and about her: the server knows whether she has applied.
  badge: o.applied ? "You applied" : undefined,
  saved: Boolean(o.saved),
  href: `/app/opportunities/${o.id}`,
  icon: "Briefcase",
  tint: "--ux-tint-green",
  ink: "--ux-green-ink",
});

const toCourse = (c: CourseRow): DiscoverItem => ({
  id: c.id,
  kind: "course",
  title: c.name,
  detail: join([c.category, c.duration, c.mode]),
  meta: typeof c.seats_left === "number" ? `${c.seats_left} places left` : "",
  // The only real reason in this product: `/me/home` computes it from the
  // course she is actually enrolled on. Empty strings are dropped rather than
  // printed, so a blank one shows no line at all.
  because: c.reason?.trim() || undefined,
  href: `/app/programs/${c.id}`,
  icon: "GraduationCap",
  tint: "--ux-tint-violet",
  ink: "--ux-violet-ink",
});

export function useDiscoverRails(): Resource<DiscoverRails> {
  return useResource(
    useCallback(async (s: AbortSignal): Promise<DiscoverRails> => {
      const [home, mentors, circles] = await Promise.all([
        apiHome(s), apiMentors(s), apiCircles(s),
      ]);
      return {
        women: mentors.slice(0, 4).map((m) => ({
          id: m.id,
          kind: "woman" as const,
          title: m.name,
          detail: m.headline,
          // Where she is, in her own words on her own profile — never a
          // distance. Nothing in this database can measure one.
          meta: join([m.location, m.availability]),
          tags: (m.expertise ?? []).slice(0, 3),
          photo: m.photo || undefined,
          href: `/app/mentors/${m.id}`,
          icon: "UserRoundCheck",
          tint: "--ux-tint-pink",
          ink: "--ux-pink-ink",
        })),
        work: (home.opportunities as unknown as WorkRow[]).slice(0, 4).map(toWork),
        learn: (home.recommended as unknown as CourseRow[]).slice(0, 4).map(toCourse),
        circles: circles
          // The ones she is not already in. A "you could join this" card for a
          // circle she joined last month is not a suggestion, it is noise.
          .filter((c) => !c.joined)
          .slice(0, 4)
          .map((c) => ({
            id: c.id,
            kind: "circle" as const,
            title: c.name,
            detail: join([
              `${c.member_count} ${c.member_count === 1 ? "woman" : "women"}`,
              c.topic,
            ]),
            meta: join([
              c.is_savings ? "Saves money together" : "",
              `${c.post_count} ${c.post_count === 1 ? "post" : "posts"}`,
            ]),
            href: `/app/circles/${c.id}`,
            icon: c.is_private ? "Lock" : "UsersRound",
            tint: "--ux-tint-blue",
            ink: "--ux-blue-ink",
          })),
      };
    }, []),
    NO_RAILS,
  );
}

/* ── Goals ────────────────────────────────────────────────────────────────── */

/**
 * Her goals, from `/me/goals`.
 *
 * The five that used to live here were written in the first person — "Buy my
 * own machine", "So I stop paying rent on someone else's", "We have not all
 * been together at her house in three years" — under a heading that said *My
 * goals*. They were somebody's idea of what a woman on this platform wants,
 * shown to every woman on this platform as though she had typed it.
 *
 * The real ones have been in Mongo since August, and the server scores them:
 * a money goal counts her wallet credits this month, a learning goal counts
 * the sessions she has attended, and a counted goal holds the number she moved
 * herself. **Nothing is recomputed on this side** — a percentage that
 * disagrees with the screen that produced it is how a woman stops believing
 * both.
 *
 * The fixture carried four fields the server does not: `why` (the sentence
 * about why the goal matters to her), `art` (a photograph of the thing),
 * `targetOn` (a calendar date) and a "needs attention" status computed from
 * that date. She never wrote any of them. `by` is the only deadline this
 * product holds and it is her own words — "before Diwali", "by September" —
 * so a date is never printed and nothing is ever late.
 */
export type { Goal } from "@/lib/money-api";

const NO_GOALS: Goal[] = [];

export const useMyGoals = (): Resource<Goal[]> =>
  useResource(useCallback((s: AbortSignal) => apiGoals(s), []), NO_GOALS);

/** The server's three kinds, and what each one is called on a screen. */
export const GOAL_KINDS = [
  { id: "money", label: "Money", icon: "TrendingUp", tint: "--ux-tint-green", ink: "--ux-green-ink" },
  { id: "skill", label: "Learning", icon: "GraduationCap", tint: "--ux-tint-violet", ink: "--ux-violet-ink" },
  { id: "count", label: "Counted by you", icon: "Target", tint: "--ux-tint-amber", ink: "--ux-amber-ink" },
] as const;

export const goalKind = (g: Goal) => GOAL_KINDS.find((k) => k.id === g.kind) ?? GOAL_KINDS[2];

/**
 * Where a goal stands — and only what can be told from what is stored.
 *
 * The old statuses included **"needs attention"**, which fired when a target
 * date had passed. There is no target date: `by` is free text she wrote, and
 * parsing "before Diwali" into a deadline to then tell her she has missed it
 * is the failure mode this screen is supposed to avoid, arrived at by
 * arithmetic on a sentence.
 *
 * So there are three, all of them facts: she reached it, it has moved, or it
 * has not moved yet. None of them is a judgement about her.
 */
export type GoalState = "reached" | "moving" | "not-started";

export function goalState(g: Goal): GoalState {
  if (g.reached || g.status === "reached") return "reached";
  return g.current > 0 ? "moving" : "not-started";
}

/**
 * "₹12,500 of ₹30,000", or "1 of 2 clients".
 *
 * Money goals are **minor units** on the wire, like every amount in this
 * codebase, and `money` is `formatRupees` — the one formatter that divides by
 * 100. Counted goals are plain numbers and must never go through it.
 */
export function goalProgressLine(g: Goal, money: (minor: number) => string) {
  if (g.kind === "money") return { have: money(g.current), of: `of ${money(g.target)}` };
  // The unit is hers when she gave one ("clients"), and absent otherwise —
  // "3 of 5 lessons" would be this screen guessing what she is counting.
  const unit = g.unit && g.unit !== "₹" ? ` ${g.unit}` : "";
  return { have: String(g.current), of: `of ${g.target}${unit}` };
}
