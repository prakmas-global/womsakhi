import { apiClient } from "./api";

/**
 * Her answers, her consents and her own WomSakhi — the screens AROUND the
 * onboarding questions: the personal home, Settings → My answers, Settings →
 * My data, and the staff "What women want" view.
 *
 * The questions themselves live in `onboarding-api.ts` (a separate flow, built
 * separately). This file only reads and changes what those questions saved.
 *
 * Every shape below is the backend's own (`app/routes/onboarding.py`,
 * `app/core/onboarding.py`, `HomePersonal` in `app/schemas/home.py`). Nothing
 * here computes a number about her: a count, a flag or a date is shown exactly
 * as the server sent it, or not at all.
 */

const get = <T>(url: string, signal?: AbortSignal, params?: Record<string, unknown>) =>
  apiClient.get<T>(url, { signal, params }).then((r) => r.data);

/* ── the personal block of GET /me/home ───────────────────────────────── */

export interface HomeChecklistItem {
  key: string;
  label: string;
  /** Read from real data every time — never ticked for her. */
  done: boolean;
  href: string;
}

export interface HomeJobMatch { id: string; title: string; org: string; location: string }

export interface ApiHomePersonal {
  goals: string[];
  /** Home block names to bring forward, in order (MeHome's own names, plus `shop_feed`). */
  order: string[];
  shop_feed: boolean;
  /** block name → "Because you chose Earn · Tailoring". */
  reasons: Record<string, string>;
  checklist: HomeChecklistItem[];
  make_it_yours: boolean;
  checkin_due: boolean;
  new_job_matches: { count: number; items: HomeJobMatch[] };
}

/* ── her answers ─────────────────────────────────────────────────────── */

/** A skill is a taxonomy key, or something she typed herself. */
export type SkillAnswer = string | { custom: string };

export interface OnboardingAnswers {
  goals: string[] | null;
  skills: SkillAnswer[] | null;
  learn_topics: string[] | null;
  meet: string[] | null;
  free_times: string[] | null;
  minutes_per_day: number | null;
  voice_prompts: boolean | null;
  helper_mode: boolean | null;
  shared_phone: boolean | null;
}

export type Purpose = "setup" | "job_updates" | "employer_visibility";

export interface ConsentState {
  /** null until she has answered this one. */
  granted: boolean | null;
  at: string | null;
  notice_version: string | null;
  language: string | null;
}

export interface OnboardingState {
  answers: OnboardingAnswers;
  /** The questions she has an answer (or a stored skip) for. */
  answered: (keyof OnboardingAnswers)[];
  consents: Record<Purpose, ConsentState>;
  notice_version: string;
  version: number;
  offered: boolean;
  completed: boolean;
  answered_at: string | null;
  updated_at: string | null;
  skipped_at: string | null;
  last_reviewed_at: string | null;
  checkin_due: boolean;
  make_it_yours: boolean;
  setup: { ready: boolean; last_run_at: string | null; items: number };
}

export type PreparedType =
  | "listing" | "saved_search" | "goal" | "reminder" | "programme" | "opportunity" | "circle" | "welcome";

export interface PreparedItem {
  key: string;
  type: PreparedType;
  id: string;
  title: string;
  /** draft · saved · proposed · kept · removed · suggested · dismissed · joined */
  state: string;
  /** only_you · public · members */
  visibility: string;
  reason: string;
  source: string;
  created_at: string | null;
  /** False when the answer it came from has since changed. It is kept, never deleted. */
  still_chosen: boolean;
  enabled?: boolean;
  created_id?: string;
  shows?: string;
  topic?: string;
}

export interface WorkProfile {
  name: string;
  mobile: string;
  email: string;
  city: string;
  languages: string[];
  skills: string[];
  wants: string[];
  free_times: string[];
  verified: boolean;
  visible_to_employers: boolean;
  /** Exactly the fields an employer's search shows. Empty while hidden. */
  employers_see: string[];
}

export interface ConsentEvent {
  purpose: Purpose;
  granted: boolean;
  at: string | null;
  notice_version: string;
  language: string;
}

export interface MyData {
  answers: OnboardingAnswers;
  consents: Record<Purpose, ConsentState>;
  consent_history: ConsentEvent[];
  /** null unless she holds the job-updates consent. */
  work_profile: WorkProfile | null;
  prepared: PreparedItem[];
  saved_searches: { id: string; type: string; skills: string[]; city: string; created_by: string; created_at: string | null }[];
}

export interface SkillOption { key: string; label: string; group: string; popular?: boolean }

export const apiOnboardingState = (s?: AbortSignal) => get<OnboardingState>("/me/onboarding", s);
export const apiPreparedItems = (s?: AbortSignal) =>
  get<{ items: PreparedItem[] }>("/me/onboarding/items", s).then((r) => r.items);
export const apiMyData = (s?: AbortSignal) => get<MyData>("/me/data", s);
export const apiFindSkills = (q: string, s?: AbortSignal) =>
  get<{ skills: SkillOption[] }>("/onboarding/skills", s, { q }).then((r) => r.skills);

export async function apiSetConsents(changes: Partial<Record<Purpose, boolean>>): Promise<OnboardingState> {
  return (await apiClient.post<OnboardingState>("/me/onboarding/consents", changes)).data;
}

export async function apiCheckin(): Promise<OnboardingState> {
  return (await apiClient.post<OnboardingState>("/me/onboarding/checkin", { still_same: true })).data;
}

export async function apiDismissMakeItYours(): Promise<OnboardingState> {
  return (await apiClient.post<OnboardingState>("/me/onboarding/dismiss-card")).data;
}

export async function apiDeleteAnswers(): Promise<OnboardingState> {
  return (await apiClient.delete<OnboardingState>("/me/onboarding")).data;
}

/** Re-runnable: prepares only what is new, never duplicates, never deletes. */
export async function apiRunSetup(): Promise<{ items: PreparedItem[]; created: number }> {
  return (await apiClient.post<{ items: PreparedItem[]; created: number }>("/me/onboarding/setup")).data;
}

/* ── what women want (staff) ─────────────────────────────────────────── */

export interface InsightBucket { key: string; label: string; count: number }
export interface InsightGroup { buckets: InsightBucket[]; suppressed: number }

export interface OnboardingInsights {
  /** null when fewer than `min_bucket` women have answered. */
  respondents: number | null;
  min_bucket: number;
  goals: InsightGroup;
  top_skills: InsightGroup;
  learn_topics: InsightGroup;
  meet: InsightGroup;
  free_times: InsightGroup;
  minutes_per_day: InsightGroup;
  usage: InsightGroup;
  /** Percent of respondents; null when there are too few to say. */
  consent_rates: Record<Purpose, number | null>;
  by_status: InsightGroup;
  goals_by_status: Record<string, InsightGroup>;
}

export const apiOnboardingInsights = (s?: AbortSignal) =>
  get<OnboardingInsights>("/admin/onboarding/insights", s);

/* ── words ───────────────────────────────────────────────────────────── */

/** The goal tiles as she saw them (Q2). */
export const GOAL_LABELS: Record<string, string> = {
  learn: "Learn a skill",
  earn_home: "Earn from home",
  find_job: "Find a job",
  sell: "Sell what I make",
  shop: "Shop fashion & more",
  meet: "Meet women like me",
  feel_good: "Feel good",
  just_looking: "Just looking around",
};

/** The backend's short goal names, as they appear inside a reason line. */
const SHORT_GOAL: Record<string, string> = {
  Learn: "learn", Earn: "earn_home", "Find work": "find_job", Sell: "sell",
  Shop: "shop", Meet: "meet", "Feel good": "feel_good", "Look around": "just_looking",
};

export const TOPIC_LABELS: Record<string, string> = {
  digital: "Phone & digital",
  career: "Career & jobs",
  money: "Money",
  personal: "Confidence & life",
  technology: "Technology",
  health: "Health",
};

export const MEET_LABELS: Record<string, string> = {
  women_near_me: "Women near me",
  same_skill: "Women with my skill",
  new_mothers: "New mothers",
  starting_business: "Women starting a business",
};

export const TIME_LABELS: Record<string, string> = {
  morning: "Mornings",
  afternoon: "Afternoons",
  evening: "Evenings",
  weekends: "Weekends",
};

export const PURPOSE_LABELS: Record<Purpose, string> = {
  setup: "Use my answers to set up my WomSakhi",
  job_updates: "Keep my details and tell me about jobs",
  employer_visibility: "Let employers see my work profile",
};

/**
 * The single question a "Change" or "Edit" link opens.
 *
 * `/app/onboarding?step=<screen>`, in the flow's own screen names
 * (`components/onboarding-flow`): one screen can hold more than one answer —
 * free times and minutes share "time", voice and helper share "language".
 */
export type Question = keyof OnboardingAnswers;

const STEP_OF: Record<Question, string> = {
  goals: "goals", skills: "skills", learn_topics: "learn", meet: "meet",
  free_times: "time", minutes_per_day: "time", voice_prompts: "language",
  helper_mode: "language", shared_phone: "phone",
};

/** `back` is where Save returns her: a Next <Link> doesn't set document.referrer. */
export const changeHref = (q: Question, back: string) =>
  `/app/onboarding?step=${STEP_OF[q]}&back=${encodeURIComponent(back)}`;

/**
 * Which question a home card's reason came from.
 *
 * A reason reads "Because you chose Earn · Tailoring". A goal with a follow-up
 * question opens that follow-up — the skill is what she would change about a
 * tailoring card, not the goal — and the others open the goals question.
 */
export function questionForReason(reason: string): Question {
  const m = /^Because you chose ([^·]+?)(?:\s·\s(.*))?$/.exec(reason.trim());
  const goal = m ? SHORT_GOAL[m[1].trim()] : undefined;
  if (goal === "earn_home" || goal === "sell" || goal === "find_job") return m?.[2] ? "skills" : "goals";
  if (goal === "learn") return m?.[2] ? "learn_topics" : "goals";
  if (goal === "meet") return "meet";
  return "goals";
}

/** "Tailoring" out of "Because you chose Earn · Tailoring", or "". */
export function reasonDetail(reason: string): string {
  const i = reason.indexOf(" · ");
  return i < 0 ? "" : reason.slice(i + 3).trim();
}

/** "Earn" out of "Because you chose Earn · Tailoring", or "". */
export function reasonGoal(reason: string): string {
  const m = /^Because you chose ([^·]+?)(?:\s·|$)/.exec(reason.trim());
  return m ? m[1].trim() : "";
}

/** "Jun 30, 2026, 7:30 PM" in her locale — for the consent record. */
export function when(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
}
