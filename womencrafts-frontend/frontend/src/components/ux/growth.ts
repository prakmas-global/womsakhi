"use client";

import { artFor } from "@/components/ux/media/art";
import { useCallback } from "react";

import { apiSearch, type SearchHit as ApiHit } from "@/lib/entitlements-api";
import { apiMentors } from "@/lib/me-api";
import { useResource, type Resource } from "@/lib/use-resource";
import {
  apiProgramDetail,
  type ApiProgramDetail,
  apiCircleSavings,
  type ApiCircleSavings,
  apiApplications, apiCatalogPrograms, apiEvents, apiMyPrograms, apiOpportunities, apiOpportunity,
  apiCircle, apiCirclePosts, apiMyMentorRequests,
  type Application, type CatalogProgramRow, type Enrollment,
  type CirclePost, type GrowthEvent, type MentorRequest, type Opportunity, type OpportunityMatch, type OpportunityQuery,
} from "@/lib/growth-api";

import { EVENTS, eventLook, type Ev } from "./events/data";
import { CIRCLE_POSTS, MY_CIRCLES, type Circle } from "./circles/data";
import { type Find } from "./discover/data";
import { MY_SESSIONS } from "./mentors/data";
import { initialsPhoto } from "./live";
import { type SearchHit } from "./home/data";
import { normCategory, realDuration, type Course } from "./learning/data";
import { APPLICATIONS, type Job, type WorkKind, type WorkMode } from "./work/data";

/**
 * Work, events and courses — the modules whose server existed all along.
 *
 * The most awkward mapping here is pay, and it is worth saying why rather than
 * hiding it: `growth.opportunities` stores pay as **free text** — "₹12,000–
 * ₹18,000 / month" — so it cannot be filtered, sorted or totalled, and it
 * breaks this codebase's own rule that money is minor units. The parser below
 * recovers the two numbers where it can and leaves them at zero where it
 * cannot, which is honest but is not a substitute for fixing the field. See
 * `docs/backend-plan.md`.
 */

const TINTS = ["pink", "green", "blue", "orange", "violet"] as const;
function tintFor(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  const t = TINTS[Math.abs(h) % TINTS.length];
  return { logoTint: `--ux-tint-${t}`, logoInk: `--ux-${t}` };
}

/* ── Work ────────────────────────────────────────────────────────────── */

/**
 * "₹12,000 – ₹18,000 / month" → [12000, 18000].
 *
 * Returns zeroes rather than guesses when the string does not carry numbers,
 * so a listing that says "negotiable" shows as "Pay not stated" instead of
 * "₹0 – ₹0 / month".
 */
function parsePay(pay: string): [number, number] {
  const found = (pay.match(/[\d,]+/g) ?? [])
    .map((n) => Number(n.replace(/,/g, "")))
    .filter((n) => Number.isFinite(n) && n > 0);
  if (!found.length) return [0, 0];
  // A daily or per-piece rate is not a monthly one, and multiplying to make it
  // comparable would invent a figure. Left as it stands; the label still shows
  // the original words.
  // Sorted: a "range" whose low is above its high is not a range, and it was
  // rendering as "₹55 – ₹20".
  const a = found[0], b = found[1] ?? found[0];
  return [Math.min(a, b), Math.max(a, b)];
}

const KIND: Record<string, WorkKind> = {
  Job: "Job", Internship: "Internship", Freelance: "Freelance",
  "Craft order": "Order", Training: "Job",
};

const MODE: Record<string, WorkMode> = {
  Remote: "Remote", Hybrid: "Hybrid", "On-site": "On-site",
};

/** The server's match, when the job names skills from the masters. */
const fitOf = (o: Opportunity): OpportunityMatch | undefined =>
  o.match && "of" in o.match && o.match.of ? (o.match as OpportunityMatch) : undefined;

export function toJob(o: Opportunity): Job {
  const [low, high] = parsePay(o.pay);
  return {
    id: o.id,
    title: o.title,
    org: o.org,
    ...tintFor(o.id),
    icon: "Briefcase",
    place: o.location,
    mode: MODE[o.mode] ?? "On-site",
    kind: KIND[o.kind] ?? "Job",
    payLow: low,
    payHigh: high,
    payText: o.pay,
    posted: o.posted,
    postedDays: 0,
    skills: o.skills ?? [],
    // Neither is in the API. Both default to false — claiming a listing is
    // verified when nobody has checked it is the kind of badge that gets a
    // woman to trust a stranger.
    verified: false,
    womenLed: false,
    applicants: o.applicant_count,
    // From the server: her work-profile skills against the job's skill keys.
    // Zero when there is nothing to compare, and the screen hides the badge.
    match: fitOf(o) ? Math.round((fitOf(o)!.have.length / fitOf(o)!.of) * 100) : 0,
    fit: fitOf(o),
    ownerKind: o.owner_kind ?? "staff",
    isMine: Boolean(o.is_mine),
    categoryName: o.category_name || undefined,
    category: o.category || undefined,
    skillKeys: o.skill_keys ?? [],
    cover: o.cover || undefined,
    about: o.desc,
    responsibilities: [],
    needs: o.experience ? [o.experience] : [],
    saved: o.saved,
    // Whether she has already applied. Carried by the API all along and never
    // mapped, so the detail screen started every visit at "Apply now" — and a
    // woman who had applied last week was invited to apply again.
    applied: o.applied,
    deadline: o.deadline,
    // Compared against the START of today, not the instant: a listing closing
    // "today" is open all day, and marking it shut at 00:01 would lose her a
    // day of a job she could still have applied for.
    // Or taken down by whoever posted it — a member's post, or the team's.
    closed: isPast(o.deadline) || o.status === "closed",
  };
}

/** True when a deadline has gone by. An absent or unparseable one is not past. */
function isPast(deadline: string | undefined): boolean {
  if (!deadline) return false;
  const t = new Date(deadline).getTime();
  if (Number.isNaN(t)) return false;
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  return t < startOfToday.getTime();
}

export const useJobs = (): Resource<Job[]> =>
  useResource(useCallback(async (s: AbortSignal) => (await apiOpportunities(s)).map(toJob), []), []);

/**
 * The board, narrowed on the server — "for my skills", a category, or skills
 * from the work masters. `key` is the query as a string so the fetch reruns
 * when (and only when) the filters change.
 */
export function useJobsFor(query: OpportunityQuery): Resource<Job[]> {
  const key = JSON.stringify(query);
  return useResource(
    useCallback(async (s: AbortSignal) => (await apiOpportunities(s, JSON.parse(key))).map(toJob), [key]),
    [],
  );
}

/** One opening, fetched by id — so a closed one, or her own post, still opens. */
export const useJob = (id: string): Resource<Job | null> =>
  useResource(useCallback(async (s: AbortSignal) => toJob(await apiOpportunity(id, s)), [id]), null);

export type UxApplication = (typeof APPLICATIONS)[number] & {
  /** Work done: "" | mine (she said so) | confirmed (the poster confirmed it). */
  done?: string;
};

// The server's words (models/growth.py ApplicationModel): offered, closed.
// "offer" and "rejected" were never sent, so Offers stayed at 0 for ever and
// a closed application read as still "Applied".
const STAGE: Record<string, string> = {
  applied: "Applied", shortlisted: "Shortlisted", interview: "Interview",
  offered: "Offer", closed: "Closed", withdrawn: "Closed",
  // The work was done — past the last rung (backend: app/core/work_done.py).
  completed: "Done",
};

const STAGE_LOOK: Record<string, { tone: string; ink: string; step: number }> = {
  Applied:     { tone: "--ux-tint-green",  ink: "--ux-green",  step: 1 },
  Shortlisted: { tone: "--ux-tint-blue",   ink: "--ux-blue",   step: 2 },
  Interview:   { tone: "--ux-tint-violet", ink: "--ux-violet", step: 3 },
  Offer:       { tone: "--ux-tint-orange", ink: "--ux-orange", step: 4 },
  Done:        { tone: "--ux-tint-green",  ink: "--ux-green",  step: 4 },
  Closed:      { tone: "--ux-surface-2",   ink: "--ux-muted",  step: 0 },
};

const WAITING: Record<string, string> = {
  Applied: "Waiting to be reviewed",
  Shortlisted: "They have looked at your profile",
  Interview: "An interview is the next step",
  Offer: "They have made you an offer. When the work is done, tap I finished this work.",
  Done: "Work done — it is on your work profile.",
  Closed: "This one is closed",
};

const toApplication = (a: Application): UxApplication => {
  const stage = STAGE[String(a.status).toLowerCase()] ?? "Applied";
  return {
    id: a.id,
    jobId: a.opportunity_id,
    title: a.opportunity_title,
    org: a.org,
    stage,
    // What is actually happening, in her words. The API gives a status word;
    // the screen needs a sentence, and a blank line here reads as "nothing is
    // happening" — which is the one thing she is worried about.
    // The hirer's last word on it — never her own application note.
    when: stage === "Done"
      ? (a.done === "confirmed" ? "The employer confirmed the work is done. It is on your work profile." : "You said it is done. Waiting for them to confirm.")
      : a.staff_note?.trim() || WAITING[stage] || "",
    at: a.applied_on,
    done: a.done ?? "",
    ...(STAGE_LOOK[stage] ?? STAGE_LOOK.Applied),
  };
};

/**
 * The numbers on the Work rail, counted from her own applications.
 *
 * `WORK_STATS` was a fixture — "12 applied, 33% response rate" beside a list
 * of three. Numbers that disagree with the list beside them are worse than no
 * numbers: she stops trusting the ones on the money screens too.
 *
 * `avgReply` is omitted rather than guessed. The API records when she applied,
 * not when anyone replied, so there is no honest average to show.
 */
export function workStats(apps: UxApplication[], saved = 0) {
  const at = (n: number) => apps.filter((a) => a.step >= n).length;
  const replied = at(2);
  return {
    applied: apps.length,
    shortlisted: apps.filter((a) => a.stage === "Shortlisted").length,
    interviews: apps.filter((a) => a.stage === "Interview").length,
    offers: apps.filter((a) => a.stage === "Offer").length,
    saved,
    responseRate: apps.length ? Math.round((replied * 100) / apps.length) : 0,
  };
}

export const useApplications = (): Resource<UxApplication[]> =>
  useResource(
    useCallback(async (s: AbortSignal) => (await apiApplications(s)).map(toApplication), []),
    [],
  );

/* ── Events ──────────────────────────────────────────────────────────── */

export function toEvent(e: GrowthEvent): Ev {
  // The staff-controlled category, as stored (backend masters).
  const kind = e.category || "Workshop";
  const d = new Date(e.date);
  const ok = !Number.isNaN(d.getTime());
  return {
    id: e.id,
    title: e.title,
    kind,
    when: e.date_label || (ok ? d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" }) : ""),
    day: ok ? d.toLocaleDateString("en-IN", { day: "2-digit" }) : "",
    month: ok ? d.toLocaleDateString("en-IN", { month: "short" }).toUpperCase() : "",
    time: e.time,
    place: e.venue || e.mode,
    online: /online|virtual/i.test(e.mode),
    art: e.cover || EVENTS[0].art,
    ...(({ icon, tint, ink }) => ({ icon, tint, ink }))(eventLook(kind)),
    blurb: e.desc,
    // The API carries a plain rupee number; every amount in this app is minor
    // units, so it is converted here rather than at the four call sites.
    fee_minor: Math.round((e.fee || 0) * 100),
    spots: e.seats,
    taken: Math.max(0, (e.seats || 0) - (e.seats_left ?? 0)),
    going: e.registered,
    host: e.host || undefined,
    language: e.language || undefined,
    duration: e.duration || undefined,
  };
}

export interface EventLists {
  upcoming: Ev[];
  past: Ev[];
}

/**
 * Upcoming and past, split once — in the fetcher, not during render.
 *
 * The screen did `const now = Date.now()` in its body, which makes the render
 * non-deterministic: the same props can produce different output, and React is
 * entitled to render twice. Reading the clock inside the fetch is fine because
 * a fetch is allowed to depend on when it happened.
 *
 * Compared on the day rather than the hour: a mela that started this morning is
 * still today's mela, and moving it to "past" at noon would take it off the
 * screen of a woman who is standing at it.
 */
export const useEvents = (): Resource<EventLists> =>
  useResource(
    useCallback(async (s: AbortSignal) => {
      const rows = (await apiEvents(s)).map(toEvent);
      const cutoff = Date.now() - 86_400_000;
      const when = (e: Ev) => {
        if (!e.day || !e.month) return Number.POSITIVE_INFINITY;
        const d = new Date(`${e.day} ${e.month} ${new Date().getFullYear()}`);
        return Number.isNaN(d.getTime()) ? Number.POSITIVE_INFINITY : d.getTime();
      };
      return {
        upcoming: rows.filter((e) => when(e) >= cutoff),
        past: rows.filter((e) => when(e) < cutoff),
      };
    }, []),
    { upcoming: [], past: [] },
  );

/* ── Mentor sessions ─────────────────────────────────────────────────── */

export type UxSession = (typeof MY_SESSIONS)[number] & {
  /** How to meet, once she may see it: a link, a number to call, or a place. */
  meeting?: string;
  priceMinor?: number;
  /** "" | awaiting | claimed | paid */
  paymentStatus?: string;
  upiId?: string;
  note?: string;
  /** The server's word — "closed" is a session that happened (and can be rated). */
  status?: string;
  /** ISO time, when a member mentor set one — for calendars. */
  scheduledFor?: string;
};

const SESSION_STATE: Record<string, UxSession["state"]> = {
  pending: "Requested", accepted: "Upcoming",
  completed: "Done", closed: "Done", declined: "Done", cancelled: "Done", withdrawn: "Done",
};

/**
 * Her mentor sessions — which are requests, until somebody accepts one.
 *
 * The screen calls them sessions and the server calls them requests, and the
 * difference matters: a pending request is not a session she should turn up
 * to. `state` keeps them apart so the screen can offer "Join" only for one a
 * mentor has actually accepted.
 */
const toSession = (r: MentorRequest): UxSession => ({
  id: r.id,
  mentorId: r.mentor_id,
  mentor: r.mentor_name,
  // Her initials, not one stock photo shared by every session.
  photo: initialsPhoto(r.mentor_name || "Mentor", r.mentor_id),
  topic: r.goal,
  // What she asked for, not a time anybody confirmed. Printing a confirmed
  // time for a pending request is how a woman ends up waiting on a call
  // nobody agreed to.
  when: r.scheduled_for || r.preferred_time || `Asked ${r.when}`,
  state: SESSION_STATE[String(r.status).toLowerCase()] ?? "Requested",
  mode: "Video call",
  meeting: r.meeting || "",
  priceMinor: r.price_minor || 0,
  paymentStatus: r.payment_status || "",
  upiId: r.upi_id || "",
  note: r.mentor_note || "",
  status: String(r.status || "").toLowerCase(),
  scheduledFor: r.scheduled_for || "",
});

export const useMentorSessions = (): Resource<UxSession[]> =>
  useResource(
    useCallback(async (s: AbortSignal) => (await apiMyMentorRequests(s)).map(toSession), []),
    // Empty, not the fixture: an invented session tells her a mentor is
    // expecting her on Monday.
    [],
  );

/* ── Courses ─────────────────────────────────────────────────────────── */

const toContinuing = (e: Enrollment): Course => ({
  id: e.program_id || e.id,
  title: e.program_name,
  lessons: 0,
  level: e.mode || "Beginner",
  rating: "—",
  count: "",
  pct: Math.round(e.progress || 0),
  thumb: artFor([e.program_name, e.category], "course", e.cover, e.program_id || e.id),
  ownCover: !!e.cover,
  category: normCategory(e.category || "Course"),
  hours: realDuration(e.duration),
  teacher: e.teacher_name || "WomSakhi team",
  byMember: e.owner_kind === "member",
  priceMinor: e.price_minor || 0,
  myStatus: e.status,
  paymentStatus: e.payment_status,
});

const toPick = (p: CatalogProgramRow): Course => ({
  id: p.id,
  title: p.name,
  lessons: p.curriculum?.length ?? 0,
  level: p.mode || "Beginner",
  rating: "—",
  count: p.enrolled ? `${p.enrolled} learning` : "",
  // What the course is about, not just its category — so two cooking courses
  // and a tailoring one do not share one picture.
  thumb: artFor([p.name, p.category], "course", p.cover, p.id),
  ownCover: !!p.cover,
  category: normCategory(p.category || "Course"),
  hours: realDuration(p.duration),
  tag: p.is_full ? undefined : "New",
  teacher: p.teacher_name || "WomSakhi team",
  byMember: p.owner_kind === "member",
  priceMinor: p.price_minor || 0,
  mine: p.is_mine,
  myStatus: p.my_status,
});

export interface Learning {
  /** Part-way through. */
  continuing: Course[];
  /** Asked to join a paid course; waiting on the teacher to confirm her payment. */
  pending: Course[];
  /** Everything she could start — not hers, not already joined. */
  picks: Course[];
  /** Every live course in Learn — hers and joined ones included, marked. */
  all: Course[];
}

export const useLearning = (): Resource<Learning> =>
  useResource(
    useCallback(async (s: AbortSignal) => {
      const [mine, catalog] = await Promise.all([apiMyPrograms(s), apiCatalogPrograms(s)]);
      const progress = new Map(mine.map((e) => [e.program_id, e]));
      return {
        all: catalog.map((p) => {
          const c = toPick(p);
          const e = progress.get(p.id);
          // Her progress on the ones she is learning; nothing invented on the rest.
          return e && (e.status === "active" || e.status === "completed")
            ? { ...c, pct: Math.round(e.progress || 0), tag: undefined } : { ...c, tag: undefined };
        }),
        // Only what she is actually part-way through. A finished course on the
        // "keep going" shelf is a screen telling her to do something twice.
        continuing: mine.filter((e) => e.status === "active").map(toContinuing),
        pending: mine.filter((e) => e.status === "pending").map(toContinuing),
        picks: catalog.filter((p) => !p.my_status || p.my_status === "withdrawn").filter((p) => !p.is_mine).map(toPick),
      };
    }, []),
    { continuing: [], pending: [], picks: [], all: [] },
  );

/* ── Search ──────────────────────────────────────────────────────────── */


const HIT_LOOK: Record<string, { kind: SearchHit["kind"]; icon: string; tint: string; ink: string }> = {
  work:    { kind: "Opportunity", icon: "Briefcase",     tint: "--ux-tint-blue",   ink: "--ux-blue" },
  course:  { kind: "Course",      icon: "GraduationCap", tint: "--ux-tint-violet", ink: "--ux-violet" },
  mentor:  { kind: "Mentor",      icon: "Users",         tint: "--ux-tint-orange", ink: "--ux-orange" },
  event:   { kind: "Page",        icon: "Ticket",        tint: "--ux-tint-pink",   ink: "--ux-pink" },
  service: { kind: "Page",        icon: "Store",         tint: "--ux-tint-green",  ink: "--ux-green" },
  scheme:  { kind: "Scheme",      icon: "Landmark",      tint: "--ux-tint-green",  ink: "--ux-green" },
  cover:   { kind: "Scheme",      icon: "ShieldCheck",   tint: "--ux-tint-blue",   ink: "--ux-blue" },
  health:  { kind: "Page",        icon: "HeartPulse",    tint: "--ux-tint-pink",   ink: "--ux-pink" },
  right:   { kind: "Page",        icon: "Scale",         tint: "--ux-tint-green",  ink: "--ux-green" },
};

/**
 * Search, on the server, across nine collections.
 *
 * The screen filtered a fixture before, which meant a woman searching for a
 * job that had been posted that morning found nothing — the index she was
 * searching had shipped weeks earlier with the app.
 *
 * `q` is a dependency, so typing re-runs it. The hook cancels the previous
 * request when a new one starts, so the answer she sees is the answer to what
 * she has actually typed rather than whichever request happened to land last.
 */
export const useSearch = (q: string): Resource<SearchHit[]> =>
  useResource(
    useCallback(async (s: AbortSignal) => {
      if (q.trim().length < 2) return [];
      const { hits } = await apiSearch(q, s);
      return hits.map((h: ApiHit): SearchHit => {
        const look = HIT_LOOK[h.kind] ?? {
          kind: "Page" as const, icon: "Search",
          tint: "--ux-surface-2", ink: "--ux-muted",
        };
        return { id: h.id, title: h.title, sub: h.sub, href: h.href, ...look };
      });
    }, [q]),
    [],
  );

/* ── One circle ──────────────────────────────────────────────────────── */

export interface CircleDetail {
  circle: Circle | null;
  posts: (typeof CIRCLE_POSTS);
}

const toPost = (p: CirclePost): (typeof CIRCLE_POSTS)[number] => ({
  id: p.id,
  who: p.author_name,
  avatar: p.author_avatar || CIRCLE_POSTS[0].avatar,
  when: p.when,
  text: p.body,
  // Pinned is a moderator action the API does not expose yet; false is the
  // honest default, and pinning nothing is better than pinning the wrong post
  // to the top of a circle's conversation.
  pinned: false,
  replies: p.reply_count,
});

/**
 * One circle and its conversation, in one round trip.
 *
 * The savings fields — how much a month, whose turn it is — are **not here**,
 * because the server does not hold them yet. A savings circle is a financial
 * commitment between real women; showing an invented turn order would have
 * somebody expecting a payout in March that nobody agreed to. The screen shows
 * the turn order only when the API starts carrying it.
 */
export const useCircle = (id: string): Resource<CircleDetail> =>
  useResource<CircleDetail>(
    useCallback(async (s: AbortSignal) => {
      const [circle, posts] = await Promise.all([
        apiCircle(id, s),
        apiCirclePosts(id, s),
      ]);
      return {
        circle: circle && {
          id: circle.id,
          name: circle.name,
          // Stated by the server — see the same note in `live.ts`.
          kind: circle.is_savings ? "Savings"
              : /trade|sell|craft|market/i.test(`${circle.topic} ${circle.name}`) ? "Trade"
              : "Community",
          members: circle.member_count,
          place: circle.topic || "Everywhere",
          art: circle.cover || MY_CIRCLES[0].art,
          tint: "--ux-tint-violet",
          ink: "--ux-violet",
          icon: circle.is_private ? "Lock" : "UsersRound",
          blurb: circle.desc,
          activity: `${circle.post_count} ${circle.post_count === 1 ? "post" : "posts"}`,
          joined: circle.joined,
          monthly_minor: circle.monthly_minor,
          pot_minor: circle.monthly_minor * circle.member_count,
          currentMonth: circle.round,
        },
        posts: posts.map(toPost),
      };
    }, [id]),
    { circle: null, posts: [] },
  );

/**
 * What this month costs, who has paid, and whose turn it is — one request.
 *
 * Kept apart from `useCircle` on purpose: the detail screen does not need the
 * member list, and the pay screen does not need the posts. Folding them
 * together would make each screen wait for the other's data.
 */
export const useCircleSavings = (id: string): Resource<ApiCircleSavings | null> =>
  useResource(
    useCallback((s: AbortSignal) => apiCircleSavings(id, s), [id]),
    null,
  );

/**
 * One enrolled course, with its real curriculum and how far through she is.
 *
 * The lesson screens shared a `CURRICULUM` constant — the same weeks under
 * every course in the app, with `done` flags that no request ever changed.
 */
export const useProgramDetail = (id: string): Resource<ApiProgramDetail | null> =>
  useResource(
    useCallback((s: AbortSignal) => apiProgramDetail(id, s), [id]),
    null,
  );

/* ── Explore ─────────────────────────────────────────────────────────── */

/**
 * Discover is a lens over the app, not a second store of it.
 *
 * Everything here already exists somewhere else — a job is a job, a course is
 * a course — so this assembles the feed from the modules that own them rather
 * than from a curated list that would go stale the day somebody posted a job.
 * Four requests, sent together, so the whole feed costs one round trip.
 */
export const useDiscover = (): Resource<Find[]> =>
  useResource(
    useCallback(async (s: AbortSignal) => {
      const [jobs, events, mentors, courses] = await Promise.all([
        apiOpportunities(s),
        apiEvents(s),
        apiMentors(s),
        apiCatalogPrograms(s),
      ]);

      const out: Find[] = [];
      for (const j of jobs.slice(0, 6)) {
        out.push({
          id: j.id, kind: "Work", title: j.title, sub: j.org,
          meta: j.pay || j.location, icon: "Briefcase",
          tint: "--ux-tint-blue", ink: "--ux-blue",
          href: `/app/opportunities/${j.id}`,
          // "New" only when the server says so. A badge on everything is a
          // badge on nothing.
          isNew: /today|yesterday/i.test(j.posted),
        });
      }
      for (const e of events.slice(0, 5)) {
        out.push({
          id: e.id, kind: "Event", title: e.title, sub: e.host || e.venue,
          meta: e.date_label, art: e.cover || undefined, icon: "Ticket",
          tint: "--ux-tint-pink", ink: "--ux-pink",
          href: `/app/events/${e.id}`,
          near: !/online|virtual/i.test(e.mode),
        });
      }
      for (const m of mentors.slice(0, 5)) {
        out.push({
          id: m.id, kind: "Mentor", title: m.name, sub: m.headline,
          meta: m.location, art: m.photo || undefined, icon: "Users",
          tint: "--ux-tint-orange", ink: "--ux-orange",
          href: `/app/mentors/${m.id}`,
        });
      }
      for (const c of courses.slice(0, 6)) {
        out.push({
          id: c.id, kind: "Course", title: c.name, sub: c.category,
          meta: c.duration, icon: "GraduationCap",
          tint: "--ux-tint-violet", ink: "--ux-violet",
          href: `/app/programs/${c.id}`,
        });
      }
      return out;
    }, []),
    [],
  );
