/**
 * The post-sign-up questions ("Post-Auth Flow") and what her answers prepare.
 *
 * Backend: app/routes/onboarding.py (rules in app/core/onboarding.py).
 *
 *   While she waits    GET/PUT /me/onboarding, POST …/consents, …/skip,
 *                      GET /onboarding/skills — answers only, nothing created
 *   Once approved      POST /me/onboarding/setup, GET …/items,
 *                      POST …/items/{type}/{id}/keep | remove
 *
 * Every call is `expected()`: a 409 "already preparing", a 403 while she is
 * still waiting, or a 422 on a skill she typed are answers these screens show
 * in place, not a lost connection, so none of them raise the app-wide banner.
 */
import { apiClient, expected } from "./api";

const ANSWER = expected();

// ── vocabulary (the backend's keys) ─────────────────────────────────────────

export type Goal = "learn" | "earn_home" | "find_job" | "sell" | "shop" | "meet" | "feel_good" | "just_looking";
export type LearnTopic = "digital" | "career" | "money" | "personal" | "technology" | "health";
export type MeetChoice = "women_near_me" | "same_skill" | "new_mothers" | "starting_business";
export type FreeTime = "morning" | "afternoon" | "evening" | "weekends";
export type Minutes = 10 | 20 | 30;
export type Purpose = "setup" | "job_updates" | "employer_visibility";

/** A taxonomy key, or a skill she typed herself. */
export type SkillValue = string | { custom: string };

/** Her answers. `null` is a question she skipped; a key absent from `answered` was never reached. */
export interface Answers {
  goals: Goal[] | null;
  skills: SkillValue[] | null;
  learn_topics: LearnTopic[] | null;
  meet: MeetChoice[] | null;
  free_times: FreeTime[] | null;
  minutes_per_day: Minutes | null;
  voice_prompts: boolean | null;
  helper_mode: boolean | null;
  shared_phone: boolean | null;
}

export type AnswerKey = keyof Answers;

export interface ConsentState {
  /** null until she has answered this purpose. */
  granted: boolean | null;
  at: string | null;
  notice_version: string | null;
  language: string | null;
}

export interface OnboardingState {
  answers: Answers;
  answered: AnswerKey[];
  consents: Record<Purpose, ConsentState>;
  notice_version: string;
  version: number;
  /** Whether the app should open the questions by itself. */
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

/** One thing prepared for her: a private draft, a suggestion, or a proposal she can keep. */
export interface PreparedItem {
  key: string;
  type: PreparedType;
  id: string;
  title: string;
  /** draft · saved · proposed · suggested · joined · kept · removed · dismissed */
  state: string;
  visibility: string;
  reason: string;
  source: string;
  created_at: string | null;
  still_chosen?: boolean;
  proposal?: { label?: string; local_time?: string; days?: number[]; minutes?: number; [k: string]: unknown };
  topic?: string;
  shows?: string;
  enabled?: boolean;
  created_id?: string;
}

export interface Skill {
  key: string;
  label: string;
  group: string;
  group_label: string;
  service_category: string;
  popular: boolean;
}

export interface CircleInfo {
  id: string;
  name: string;
  topic: string;
  desc: string;
  is_private: boolean;
  member_count: number;
  joined: boolean;
}

// ── her answers ─────────────────────────────────────────────────────────────

export async function apiOnboarding(): Promise<OnboardingState> {
  const { data } = await apiClient.get<OnboardingState>("/me/onboarding", ANSWER);
  return data;
}

/** Any subset of the answers; `completed: true` marks the end of the questions. */
export async function apiSaveAnswers(
  answers: Partial<Answers> & { completed?: boolean },
): Promise<OnboardingState> {
  const { data } = await apiClient.put<OnboardingState>("/me/onboarding", answers, ANSWER);
  return data;
}

/** true grants, false withdraws, absent leaves a purpose as it was. */
export async function apiSetConsents(
  consents: Partial<Record<Purpose, boolean>>,
  meta: { notice_version?: string; language?: string } = {},
): Promise<OnboardingState> {
  const { data } = await apiClient.post<OnboardingState>(
    "/me/onboarding/consents", { ...consents, ...meta }, ANSWER);
  return data;
}

export async function apiSkipOnboarding(): Promise<OnboardingState> {
  const { data } = await apiClient.post<OnboardingState>("/me/onboarding/skip", null, ANSWER);
  return data;
}

export async function apiFindSkills(q: string, signal?: AbortSignal): Promise<Skill[]> {
  const { data } = await apiClient.get<{ skills: Skill[] }>(
    "/onboarding/skills", expected({ params: { q }, signal }));
  return data.skills;
}

// ── once she is approved ────────────────────────────────────────────────────

export async function apiRunSetup(): Promise<{ items: PreparedItem[]; created: number }> {
  const { data } = await apiClient.post<{ items: PreparedItem[]; created: number }>(
    "/me/onboarding/setup", null, ANSWER);
  return data;
}

export async function apiPreparedItems(): Promise<PreparedItem[]> {
  const { data } = await apiClient.get<{ items: PreparedItem[] }>("/me/onboarding/items", ANSWER);
  return data.items;
}

/** Keep a proposed goal, or a reminder (`enable` switches the reminder on; it stays off otherwise). */
export async function apiKeepItem(type: PreparedType, id: string, enable = false): Promise<PreparedItem> {
  const { data } = await apiClient.post<{ item: PreparedItem }>(
    `/me/onboarding/items/${type}/${encodeURIComponent(id)}/keep`, { enable }, ANSWER);
  return data.item;
}

/** Delete a draft, or put a suggestion aside. */
export async function apiRemoveItem(type: PreparedType, id: string): Promise<PreparedItem> {
  const { data } = await apiClient.post<{ item: PreparedItem }>(
    `/me/onboarding/items/${type}/${encodeURIComponent(id)}/remove`, null, ANSWER);
  return data.item;
}

/** A suggested circle, for "See who's there" (the community API's own shape, trimmed). */
export async function apiCircleInfo(id: string): Promise<CircleInfo> {
  const { data } = await apiClient.get<CircleInfo>(`/community/circles/${encodeURIComponent(id)}`, ANSWER);
  return data;
}

/** The existing community join — the only way she enters a circle, and only by her tap. */
export async function apiJoinSuggestedCircle(id: string): Promise<CircleInfo> {
  const { data } = await apiClient.post<CircleInfo>(
    `/community/circles/${encodeURIComponent(id)}/join`, null, ANSWER);
  return data;
}

// ── where the app should send her ───────────────────────────────────────────

/**
 * For an approved member: the questions if they are still on offer, the
 * setting-up step if she answered while waiting and nothing has been prepared
 * yet, or null (home as usual).
 */
export function onboardingDestination(state: OnboardingState): string | null {
  if (state.completed && state.consents.setup.granted && !state.setup.last_run_at) return "/app/onboarding?step=setup";
  if (state.offered) return "/app/onboarding";
  return null;
}

/*
  Once she has finished or said "Not now", the member gate stops asking the
  server on every screen of this visit. Kept in memory and in the tab's
  session storage (a reload keeps it; a new tab asks once again).
*/
const SETTLED_KEY = "ws.onboarding.settled";
let settledFor: string | null = null;

export function markOnboardingSettled(userId: string): void {
  settledFor = userId;
  try { window.sessionStorage.setItem(SETTLED_KEY, userId); } catch { /* private mode: memory is enough */ }
}

export function isOnboardingSettled(userId: string): boolean {
  if (settledFor === userId) return true;
  try { return window.sessionStorage.getItem(SETTLED_KEY) === userId; } catch { return false; }
}
