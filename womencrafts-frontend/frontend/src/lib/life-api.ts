/**
 * Her children, her food licence, the swap board, and who she helps.
 *
 * Four small domains that shared one failing: each shipped with a family, a
 * half-finished licence, a neighbourhood or a set of consents already written
 * into the screen, identical for every woman who opened it.
 */

import { apiClient } from "./api";

const get = <T>(url: string, signal?: AbortSignal, params?: object) =>
  apiClient.get<T>(url, { signal, params }).then((r) => r.data);

/* ── her children, and the school dates that cost money ──────────────────── */

export interface Child {
  id: string;
  name: string;
  cls: string;
  school: string;
  fee_minor: number;
  saved_minor: number;
}

export type SchoolKind = "fee" | "form" | "date" | "buy" | "paper";

export interface SchoolTask {
  id: string;
  child_id: string;
  what: string;
  detail: string;
  kind: SchoolKind;
  due: string;
  /** Counted on the server, so a stored "in 6 days" can never go stale. */
  due_in: number | null;
  cost_minor: number;
  done: boolean;
}

export interface School {
  children: Child[];
  tasks: SchoolTask[];
  due_minor: number;
  fee_minor: number;
  saved_minor: number;
  pending: number;
}

export const apiSchool = (s?: AbortSignal) => get<School>("/me/school", s);

export const apiAddChild = (body: {
  name: string; cls?: string; school?: string; fee_minor?: number; saved_minor?: number;
}) => apiClient.post<School>("/me/school/children", body).then((r) => r.data);

export const apiEditChild = (id: string, body: Partial<Omit<Child, "id">>) =>
  apiClient.patch<School>(`/me/school/children/${id}`, body).then((r) => r.data);

export const apiRemoveChild = (id: string) =>
  apiClient.delete<School>(`/me/school/children/${id}`).then((r) => r.data);

export const apiAddSchoolTask = (body: {
  child_id?: string; what: string; detail?: string;
  kind?: SchoolKind; due?: string | null; cost_minor?: number;
}) => apiClient.post<School>("/me/school/tasks", body).then((r) => r.data);

export const apiEditSchoolTask = (id: string, body: Partial<{
  done: boolean; what: string; detail: string; due: string | null; cost_minor: number;
}>) => apiClient.patch<School>(`/me/school/tasks/${id}`, body).then((r) => r.data);

export const apiRemoveSchoolTask = (id: string) =>
  apiClient.delete<School>(`/me/school/tasks/${id}`).then((r) => r.data);

/* ── her food licence ─────────────────────────────────────────────────────── */

export interface Kitchen {
  /** Step ids she has ticked. Everyone starts with none. */
  done: string[];
  hygiene: string[];
  licence_no: string;
}

export const apiKitchen = (s?: AbortSignal) => get<Kitchen>("/me/kitchen", s);

export const apiKitchenStep = (id: string, done: boolean) =>
  apiClient.put<Kitchen>(`/me/kitchen/steps/${id}`, { done }).then((r) => r.data);

export const apiKitchenHygiene = (id: string, done: boolean) =>
  apiClient.put<Kitchen>(`/me/kitchen/hygiene/${id}`, { done }).then((r) => r.data);

export const apiKitchenLicence = (licence_no: string) =>
  apiClient.put<Kitchen>("/me/kitchen/licence", { licence_no }).then((r) => r.data);

/* ── pass it on ───────────────────────────────────────────────────────────── */

export type SwapCondition = "as new" | "good" | "worn but fine";

export interface SwapItem {
  id: string;
  what: string;
  from: string;
  size: string;
  condition: SwapCondition;
  /** What she would like in return, in her words. Never an amount. */
  wants: string;
  icon: string;
  tint: string;
  ink: string;
  taken: boolean;
  mine: boolean;
}

export interface Swaps {
  items: SwapItem[];
  available: number;
  count: number;
}

export const apiSwaps = (mine = false, s?: AbortSignal) =>
  get<Swaps>("/community/swap", s, { mine });

export const apiOfferSwap = (body: {
  what: string; size?: string; condition?: SwapCondition;
  wants?: string; icon?: string; tint?: string; ink?: string;
}) => apiClient.post<Swaps>("/community/swap", body).then((r) => r.data);

export const apiSwapTaken = (id: string) =>
  apiClient.post<Swaps>(`/community/swap/${id}/taken`).then((r) => r.data);

export const apiRemoveSwap = (id: string) =>
  apiClient.delete<Swaps>(`/community/swap/${id}`).then((r) => r.data);

/* ── women helping women ──────────────────────────────────────────────────── */

export interface AssistLink {
  id: string;
  name: string;
  because: string;
  owns_phone: boolean;
  since: string;
  /** The date she agreed, shown on both their screens. */
  consent_on: string;
  consented: boolean;
  done_count: number;
  last_did: string;
}

export interface AssistTask {
  id: string;
  link_id: string;
  who: string;
  what: string;
  urgent: boolean;
}

export interface Lesson {
  id: string;
  what: string;
  from: string;
  pays_in: string;
  learners: number;
  icon: string;
  tint: string;
  ink: string;
  mine: boolean;
}

export interface Together {
  helping: AssistLink[];
  queue: AssistTask[];
  teaching: Lesson[];
  helped_count: number;
  /** Only links the other woman actually agreed to. */
  consented_count: number;
  waiting: number;
}

export const apiTogether = (s?: AbortSignal) => get<Together>("/me/together", s);

export const apiAddHelping = (body: {
  name: string; because?: string; owns_phone?: boolean; consented?: boolean;
}) => apiClient.post<Together>("/me/together/helping", body).then((r) => r.data);

export const apiGiveConsent = (id: string) =>
  apiClient.post<Together>(`/me/together/helping/${id}/consent`).then((r) => r.data);

export const apiEndHelping = (id: string) =>
  apiClient.delete<Together>(`/me/together/helping/${id}`).then((r) => r.data);

export const apiAddAssistTask = (body: { link_id: string; what: string; urgent?: boolean }) =>
  apiClient.post<Together>("/me/together/queue", body).then((r) => r.data);

export const apiFinishAssistTask = (id: string) =>
  apiClient.post<Together>(`/me/together/queue/${id}/done`).then((r) => r.data);

export const apiOfferLesson = (body: {
  what: string; pays_in?: string; icon?: string; tint?: string; ink?: string;
}) => apiClient.post<Together>("/me/together/lessons", body).then((r) => r.data);

export const apiRemoveLesson = (id: string) =>
  apiClient.delete<Together>(`/me/together/lessons/${id}`).then((r) => r.data);

/* ── her entitlements ─────────────────────────────────────────────────────── */

export type HaqStatus = "receiving" | "at-risk" | "stopped" | "can-claim" | "waiting";

export interface HaqState {
  status: HaqStatus;
  action: string;
  due_on: string;
  /** Counted on the server, like every other day count in this product. */
  due_days: number | null;
  stopped_because: string;
}

export interface HaqStates {
  /** Keyed by scheme id. Anything absent is `default`. */
  states: Record<string, HaqState>;
  /** "can-claim" — what a woman who has never applied actually is. */
  default: HaqStatus;
  tracked: number;
}

export const apiHaq = (s?: AbortSignal) => get<HaqStates>("/me/haq", s);

export const apiSetHaq = (schemeId: string, body: {
  status: HaqStatus; action?: string; due_on?: string; stopped_because?: string;
}) => apiClient.put<HaqStates>(`/me/haq/${schemeId}`, body).then((r) => r.data);

/** A woman she shares a circle with. No distance, no invented reason. */
export interface Sister {
  id: string;
  name: string;
  /** What she sells, or "" — never a guess. */
  trade: string;
  where: string;
  avatar: string;
}

export const apiSisters = (s?: AbortSignal) =>
  get<{ sisters: Sister[]; count: number }>("/me/together/sisters", s);

/* ── her papers, and what the state owes her ──────────────────────────────── */

export type PaperState = "held" | "expiring" | "missing";

export interface PaperStates {
  /** Keyed by paper id. Absent means `missing`. */
  states: Record<string, { state: PaperState; expires: string }>;
  default: PaperState;
  held: number;
}

export const apiPapers = (s?: AbortSignal) => get<PaperStates>("/me/haq/papers", s);

export const apiSetPaper = (id: string, body: { state: PaperState; expires?: string }) =>
  apiClient.put<PaperStates>(`/me/haq/papers/${id}`, body).then((r) => r.data);

export interface LatePayment {
  id: string;
  what: string;
  due_on: string;
  paid_on: string;
  /** Counted from the dates, so it cannot go stale overnight. */
  days_late: number;
  owed_minor: number;
  filed: boolean;
}

export interface LatePayments {
  late: LatePayment[];
  /** Only what she has not yet complained about. */
  owed_minor: number;
  count: number;
}

export const apiLate = (s?: AbortSignal) => get<LatePayments>("/me/haq/late", s);

export const apiAddLate = (body: {
  what: string; due_on: string; paid_on?: string | null; owed_minor?: number;
}) => apiClient.post<LatePayments>("/me/haq/late", body).then((r) => r.data);

export const apiEditLate = (id: string, body: { filed?: boolean; paid_on?: string }) =>
  apiClient.patch<LatePayments>(`/me/haq/late/${id}`, body).then((r) => r.data);

export const apiRemoveLate = (id: string) =>
  apiClient.delete<LatePayments>(`/me/haq/late/${id}`).then((r) => r.data);

/* ── how she wants the app read to her ────────────────────────────────────── */

export interface VoicePrefs {
  /** Which things get read aloud, by preference id. */
  on: string[];
  lang: string;
  /**
   * Whether amounts are spoken. Off unless she turns it on — handsets are
   * shared, and a screen reading "twenty-three thousand rupees" out loud in
   * a room is a different exposure from one reading a course title.
   */
  read_money: boolean;
}

export const apiVoicePrefs = (s?: AbortSignal) => get<VoicePrefs>("/me/settings/voice", s);

export const apiSetVoicePrefs = (body: VoicePrefs) =>
  apiClient.put<VoicePrefs>("/me/settings/voice", body).then((r) => r.data);
