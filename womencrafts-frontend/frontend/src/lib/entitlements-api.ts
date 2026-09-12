import { apiClient } from "./api";

/**
 * The ten modules that had no server until 2026-08-25.
 *
 * Every call takes an `AbortSignal`, for the reason the rest of this layer
 * does: `useResource` cancels in flight when a woman taps away, and a layer
 * that cannot be cancelled turns that into a reply arriving at a component
 * that no longer exists.
 */

const get = <T>(url: string, signal?: AbortSignal, params?: Record<string, unknown>) =>
  apiClient.get<T>(url, { signal, params }).then((r) => r.data);

/* ── What she is entitled to ─────────────────────────────────────────── */

export interface MyState {
  state: "saved" | "applied" | "active" | "done" | "declined";
  note: string;
  since: string;
}

export interface Reference {
  id: string;
  topic: string;
  title: string;
  body: string;
  city: string;
  /** Three-valued on purpose: null means nobody has established it, and
   *  rendering that as "paid" tells her something untrue about what she is owed. */
  free: boolean | null;
  cost_label: string;
  who: string;
  payload: Record<string, unknown>;
  mine: MyState | null;
}

export const apiSchemes = (s?: AbortSignal) => get<Reference[]>("/schemes", s);
export const apiCover = (s?: AbortSignal) => get<Reference[]>("/cover", s);
export const apiHealth = (s?: AbortSignal) => get<Reference[]>("/wellbeing/health", s);
export const apiRights = (s?: AbortSignal) => get<Reference[]>("/wellbeing/rights", s);
export const apiFamily = (s?: AbortSignal) => get<Reference[]>("/wellbeing/family", s);
export const apiTravel = (s?: AbortSignal) => get<Reference[]>("/wellbeing/travel", s);

/**
 * Numbers she can ring, and the steps to take.
 *
 * Both take a `context` — "legal", "health", "family", "travel", "money" — so
 * the rights screen gets the legal ones and the health screen the health ones.
 * The server always includes the "general" entries (112, 181) in every context,
 * because a woman in trouble should not have to be on the right screen to find
 * the emergency number.
 *
 * These lived in a TypeScript constant until 2026-08-30, which meant a helpline
 * that changed could only be corrected by a deploy — and that one of them was a
 * Jaipur district number shown to every member in the country.
 */
export const apiHelplines = (context: string, s?: AbortSignal) =>
  get<Reference[]>("/wellbeing/helplines", s, { context });
export const apiGuidance = (context: string, s?: AbortSignal) =>
  get<Reference[]>("/wellbeing/guidance", s, { context });

export async function apiMarkReference(id: string, state: MyState["state"], note = "") {
  const { data } = await apiClient.post<Reference>(`/reference/${id}/mark`, { state, note });
  return data;
}

/* ── Saved ───────────────────────────────────────────────────────────── */

/** Must match `SavedModel.KINDS` on the server — a kind it does not know is
 *  refused with "That is not something you can save". */
export type SavedKind =
  | "job" | "program" | "event" | "scheme" | "mentor" | "service"
  /** Something another woman sells in the market. */
  | "listing"
  /** Something another woman wrote in a circle. */
  | "post";

export interface SavedItem {
  id: string;
  kind: SavedKind;
  ref_id: string;
  /** The thing she saved has since been taken down. Shown, not hidden —
   *  finding out it closed is information too. */
  gone: boolean;
  title: string;
  sub: string;
  /** Where to open it, when its own id is not its address — a circle post
   *  lives inside a circle, so its link has to name one. Empty otherwise. */
  href: string;
  saved_on: string;
}

/** Everything, or one kind of thing. The Circle screens ask for `post` alone
 *  rather than reading her whole bookmark list to find three of them. */
export const apiSaved = (s?: AbortSignal, kind?: SavedKind) =>
  get<SavedItem[]>("/saved", s, kind ? { kind } : undefined);

export async function apiSave(kind: SavedKind, refId: string) {
  const { data } = await apiClient.post<SavedItem>("/saved", { kind, ref_id: refId });
  return data;
}

export const apiUnsave = (kind: SavedKind, refId: string) =>
  apiClient.delete(`/saved/${kind}/${refId}`).then(() => undefined);

/* ── Buying together ─────────────────────────────────────────────────── */

export interface GroupBuy {
  id: string;
  item: string;
  unit: string;
  alone_minor: number;
  together_minor: number;
  saving_minor: number;
  /** The saving as a number, not an adjective — "cheaper" persuades nobody
   *  who is counting. */
  saving_label: string;
  needed: number;
  joined: number;
  still_needed: number;
  full: boolean;
  supplier: string;
  note: string;
  status: string;
  closes: string;
  closed: boolean;
  joined_by_me: boolean;
}

export const apiGroupBuys = (s?: AbortSignal) => get<GroupBuy[]>("/group-buy", s);

export async function apiJoinBuy(id: string, quantity = 1) {
  const { data } = await apiClient.post<GroupBuy>(`/group-buy/${id}/join`, { quantity });
  return data;
}

export const apiLeaveBuy = (id: string) =>
  apiClient.delete(`/group-buy/${id}/join`).then(() => undefined);

/* ── Prove your skills ───────────────────────────────────────────────── */

export interface Assessment {
  id: string;
  skill: string;
  title: string;
  blurb: string;
  minutes: number;
  pass_mark: number;
  question_count: number;
  best_score: number | null;
  passed: boolean;
  attempts: number;
  /** Populated only on the detail call — and never carrying the answer key,
   *  which the server strips before it leaves. */
  questions: { n: number; ask: string; options: string[] }[];
}

export const apiAssessments = (s?: AbortSignal) => get<Assessment[]>("/assess", s);
export const apiAssessment = (id: string, s?: AbortSignal) => get<Assessment>(`/assess/${id}`, s);

export async function apiSubmitAttempt(id: string, answers: number[]) {
  const { data } = await apiClient.post<{
    id: string; assessment_id: string; score: number; passed: boolean; taken_on: string;
  }>(`/assess/${id}/attempt`, { answers });
  return data;
}

/* ── Using a phone ───────────────────────────────────────────────────── */

export interface DigitalStep {
  id: string;
  n: number;
  label: string;
  note: string;
  minutes: number;
  done: boolean;
}

export const apiDigitalSteps = (s?: AbortSignal) => get<DigitalStep[]>("/digital", s);

export async function apiStepDone(id: string, done: boolean) {
  const { data } = done
    ? await apiClient.post<DigitalStep[]>(`/digital/${id}/done`)
    : await apiClient.delete<DigitalStep[]>(`/digital/${id}/done`);
  return data;
}

/* ── Search ──────────────────────────────────────────────────────────── */

export interface SearchHit {
  id: string;
  kind: string;
  title: string;
  sub: string;
  /** Built on the server so the route for a kind lives in one place. */
  href: string;
}

export const apiSearch = (q: string, s?: AbortSignal) =>
  get<{ query: string; hits: SearchHit[] }>("/search", s, { q });
