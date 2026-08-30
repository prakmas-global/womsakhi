"use client";

import { useCallback } from "react";

import { useResource, type Resource } from "@/lib/use-resource";
import {
  apiAssessments, apiCover, apiDigitalSteps, apiFamily, apiGroupBuys,
  apiHealth, apiRights, apiSaved, apiSchemes, apiTravel,
  type Assessment, type DigitalStep, type GroupBuy, type Reference, type SavedItem,
} from "@/lib/entitlements-api";

import { ASSESSMENTS, DIGITAL_STEPS, GROUP_BUYS } from "./more/data";
import { SCHEMES, type Scheme } from "./schemes/data";
import {
  CRECHES, HEALTH_CHECKS, RIGHTS, ROUTES,
} from "./wellbeing/data";

/**
 * The ten modules that had no server until the backend pass.
 *
 * The server stores what a scheme *is*; it does not store that its card is
 * tinted green or which lucide icon sits on it. So the same seam as
 * `live.ts` — translate once, here, not in each screen that reads it.
 *
 * The rule these adapters follow is the one the mentor adapter learned: a
 * field the API does not carry is **derived or defaulted to the unflattering
 * answer**, never invented. A scheme whose eligibility nobody has established
 * is not "you qualify".
 */

const TINTS = ["green", "violet", "blue", "orange", "pink", "amber"] as const;

/** Same input, same colour, every load. Deterministic beats random here. */
function tintFor(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  const t = TINTS[Math.abs(h) % TINTS.length];
  return { tint: `--ux-tint-${t}`, ink: `--ux-${t}` };
}

const str = (v: unknown, fallback = "") => (typeof v === "string" && v ? v : fallback);
const list = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x) => typeof x === "string") : []);

/* ── Schemes ─────────────────────────────────────────────────────────── */

const SCHEME_ICONS: Record<string, string> = {
  Loan: "Landmark", Savings: "PiggyBank", Training: "GraduationCap",
  Grant: "Gift", Insurance: "ShieldCheck",
};

function toScheme(r: Reference): Scheme {
  const p = r.payload;
  const category = (str(p.category, "Grant") as Scheme["category"]);
  return {
    id: r.id,
    name: r.title,
    body: str(p.body_name, "Government of India"),
    who: r.who,
    gives: r.body,
    amount: str(p.amount, r.cost_label),
    category,
    // The API does not decide who qualifies — that depends on her documents and
    // her business, and asserting it would send her to a counter to be turned
    // away. So the screen says what the scheme is FOR, and `reason` is the
    // scheme's own wording rather than a verdict about her.
    eligible: true,
    reason: r.who,
    needs: list(p.needs),
    deadline: str(p.deadline, "Check before you go"),
    icon: SCHEME_ICONS[category] ?? "Landmark",
    ...tintFor(r.id),
    applied: r.mine?.state === "applied" || r.mine?.state === "active",
  };
}

export const useSchemes = (): Resource<Scheme[]> =>
  useResource(useCallback(async (s: AbortSignal) => (await apiSchemes(s)).map(toScheme), []), SCHEMES);

/* ── Insurance & pension ─────────────────────────────────────────────── */

export interface UxCover {
  id: string; name: string; kind: string; pays: string; costs: string;
  who: string; have: boolean; renews: string | null;
  icon: string; tint: string; ink: string; steps: string[];
}

const COVER_ICONS: Record<string, string> = {
  Accident: "ShieldCheck", Life: "HeartHandshake", Pension: "PiggyBank", Health: "Stethoscope",
};

const toCover = (r: Reference): UxCover => {
  const p = r.payload;
  const kind = str(p.kind, "Cover");
  return {
    id: r.id,
    name: r.title,
    kind,
    pays: str(p.pays, r.body),
    costs: r.cost_label || (r.free ? "Free" : ""),
    who: r.who,
    have: r.mine?.state === "active",
    renews: str(p.renews) || null,
    icon: COVER_ICONS[kind] ?? "ShieldCheck",
    ...tintFor(r.id),
    steps: list(p.steps),
  };
};

export const useCover = (): Resource<UxCover[]> =>
  useResource(useCallback(async (s: AbortSignal) => (await apiCover(s)).map(toCover), []), []);

/* ── Wellbeing ───────────────────────────────────────────────────────── */

export type UxHealthCheck = (typeof HEALTH_CHECKS)[number];

const toHealthCheck = (r: Reference): UxHealthCheck => ({
  id: r.id,
  label: r.title,
  every: str(r.payload.every, "As advised"),
  // The API records that she marked it done and when — not a clinical history.
  // "Never" is the honest default; inventing a last-checked date would tell her
  // she is up to date when nobody knows.
  last: r.mine?.state === "done" ? r.mine.since : "Never",
  due: r.mine?.state !== "done",
  free: r.free === true,
  where: str(r.payload.where, r.cost_label),
  icon: "HeartPulse",
  ...tintFor(r.id),
});

export const useHealthChecks = (): Resource<UxHealthCheck[]> =>
  useResource(
    useCallback(async (s: AbortSignal) => (await apiHealth(s)).map(toHealthCheck), []),
    HEALTH_CHECKS,
  );

export type UxRight = (typeof RIGHTS)[number];

const toRight = (r: Reference): UxRight => ({
  id: r.id,
  title: r.title,
  body: r.body,
  law: str(r.payload.law, ""),
  icon: "Scale",
  ...tintFor(r.id),
});

export const useRights = (): Resource<UxRight[]> =>
  useResource(useCallback(async (s: AbortSignal) => (await apiRights(s)).map(toRight), []), RIGHTS);

/**
 * A creche or childcare place.
 *
 * Written out rather than derived from the mock, so it can carry the two
 * things the API sends and the mock never had: the description, and the
 * practical steps — what to take, what to ask. Those were dropped, and the
 * screen filled the gap with generic advice.
 */
export type UxCreche = (typeof CRECHES)[number] & {
  body?: string;
  steps?: string[];
};

const toCreche = (r: Reference): UxCreche => ({
  id: r.id,
  name: r.title,
  kind: r.free ? "Government" : "Private",
  ages: str(r.payload.ages, "Ask when you visit"),
  hours: str(r.payload.hours, ""),
  fee: r.cost_label || (r.free ? "Free" : ""),
  // Distance needs her location and a place's coordinates. The API has
  // neither yet, so the screen says where rather than pretending to know how
  // far — a wrong distance sends a woman on a bus for nothing.
  distance: "",
  meals: r.payload.meals === true,
  art: CRECHES[0].art,
  body: r.body || undefined,
  steps: Array.isArray(r.payload.steps) ? (r.payload.steps as string[]) : undefined,
});

export const useCreches = (): Resource<UxCreche[]> =>
  useResource(useCallback(async (s: AbortSignal) => (await apiFamily(s)).map(toCreche), []), CRECHES);

export type UxRoute = (typeof ROUTES)[number];

const toRoute = (r: Reference): UxRoute => ({
  id: r.id,
  name: r.title,
  how: r.body,
  // Null, not zero. "0 min" is a duration somebody stated; a missing one is
  // not, and the screen omits the line rather than printing a false number.
  mins: typeof r.payload.mins === "number" ? r.payload.mins : null,
  cost: r.cost_label || (r.free ? "Free" : ""),
  // Null, not true. Defaulting an unknown to "fine after dark" is the one
  // fabrication in this app that could get a woman hurt — she plans a journey
  // home around it. The server records this only where somebody has actually
  // checked; everywhere else the screen says nobody has.
  safeAfterDark:
    typeof r.payload.safe_after_dark === "boolean" ? r.payload.safe_after_dark : null,
  note: str(r.payload.tip, ""),
});

export const useRoutes = (): Resource<UxRoute[]> =>
  useResource(useCallback(async (s: AbortSignal) => (await apiTravel(s)).map(toRoute), []), ROUTES);

/* ── Buying together ─────────────────────────────────────────────────── */

/**
 * A group buy, as the screens need it.
 *
 * Written out rather than derived from the mock with `(typeof GROUP_BUYS)[number]`.
 * Deriving it meant the type had nowhere to put `joined_by_me`, so the adapter
 * dropped it: joining worked, and a fresh visit offered her "Join this buy" on
 * an order she was already in.
 */
export interface UxGroupBuy {
  id: string;
  what: string;
  unit: string;
  alone_minor: number;
  together_minor: number;
  need: number;
  joined: number;
  closes: string;
  by: string;
  art: string;
  /** Whether she is already in it. */
  joined_by_me?: boolean;
  /** How many more are needed, and whether it is closed to new joiners. */
  still_needed?: number;
  full?: boolean;
  note?: string;
  saving_label?: string;
}

const toGroupBuy = (g: GroupBuy): UxGroupBuy => ({
  id: g.id,
  what: g.item,
  unit: g.unit,
  alone_minor: g.alone_minor,
  together_minor: g.together_minor,
  need: g.needed,
  joined: g.joined,
  closes: g.closed ? "closed" : `closes ${g.closes}`,
  by: g.supplier,
  art: GROUP_BUYS[0].art,
  joined_by_me: g.joined_by_me,
  still_needed: g.still_needed,
  full: g.full,
  note: g.note,
  saving_label: g.saving_label,
});

export const useGroupBuys = (): Resource<UxGroupBuy[]> =>
  useResource(
    useCallback(async (s: AbortSignal) => (await apiGroupBuys(s)).map(toGroupBuy), []),
    GROUP_BUYS,
  );

/* ── Saved · assessments · digital ───────────────────────────────────── */

export const useSavedItems = (): Resource<SavedItem[]> =>
  useResource(useCallback((s: AbortSignal) => apiSaved(s), []), []);

export const useAssessments = (): Resource<Assessment[]> =>
  useResource(useCallback((s: AbortSignal) => apiAssessments(s), []), []);

export const useDigitalSteps = (): Resource<DigitalStep[]> =>
  useResource(useCallback((s: AbortSignal) => apiDigitalSteps(s), []), []);

/* ── Prove your skills, and using a phone ────────────────────────────── */


/**
 * A skills test.
 *
 * `title` and `pass_mark` come from the server and were dropped: the screen
 * showed the skill name in place of the test's own title, and could not tell
 * her what score she needed to pass.
 */
export type UxAssessment = (typeof ASSESSMENTS)[number] & {
  title?: string;
  passMark?: number;
};

const SKILL_ICONS: Record<string, string> = {
  Tailoring: "Scissors", Money: "BadgeIndianRupee", Digital: "Smartphone",
  English: "Languages", Cooking: "ChefHat", Beauty: "Sparkles",
};

const toAssessment = (a: Assessment): UxAssessment => ({
  id: a.id,
  skill: a.skill,
  // Her result, in the words the screen uses. Only from an attempt she has
  // actually made — an untried test has no level, and defaulting to
  // "Beginner" tells an employer something nobody established.
  level: a.attempts === 0 ? ""
    : a.best_score! >= 80 ? "Experienced"
    : a.best_score! >= 60 ? "Capable" : "Beginner",
  pct: a.best_score ?? 0,
  taken: a.attempts ? `${a.attempts} attempt${a.attempts > 1 ? "s" : ""}` : "",
  mins: a.minutes,
  questions: a.question_count,
  badge: a.passed,
  icon: SKILL_ICONS[a.skill] ?? "BadgeCheck",
  ...tintFor(a.id),
  note: a.blurb,
  title: a.title || undefined,
  passMark: a.pass_mark,
});

export const useAssessmentList = (): Resource<UxAssessment[]> =>
  useResource(
    useCallback(async (s: AbortSignal) => (await apiAssessments(s)).map(toAssessment), []),
    ASSESSMENTS,
  );

export type UxDigitalStep = (typeof DIGITAL_STEPS)[number];

const toStep = (d: DigitalStep): UxDigitalStep => ({
  id: d.id,
  label: d.label,
  mins: d.minutes,
  done: d.done,
  note: d.note,
});

export const useDigitalStepList = (): Resource<UxDigitalStep[]> =>
  useResource(
    useCallback(async (s: AbortSignal) => (await apiDigitalSteps(s)).map(toStep), []),
    DIGITAL_STEPS,
  );
