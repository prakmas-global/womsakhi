import { apiClient } from "./api";
import type { HaqStates } from "./life-api";

/**
 * Haq's scheme catalogue (backend: routes/haq_catalogue.py) and her answers
 * (routes/haq.py `/me/haq/profile`). The catalogue is staff-managed reference
 * data — what exists, for whom, in which state; where HER claim stands stays in
 * `apiHaq` / `apiSetHaq` (lib/life-api.ts).
 */

export interface Scheme {
  id: string;
  /** What her status is stored under. */
  key: string;
  name: string;
  body_name: string;
  gives: string;
  who: string;
  category: string;
  amount_minor: number;
  amount: string;
  cadence: string;
  /** "all" or one state. */
  state: string;
  /** Who it is for — keys of `eligibility`. Empty = anyone. */
  eligibility: string[];
  /** Ids from her Papers list. */
  papers: string[];
  needs: string[];
  online: boolean;
  link: string;
  helpline: string;
  where: string;
  steps: string[];
  open_now: boolean;
  open_note: string;
  free: boolean | null;
  cost_label: string;
  /** Women on WomSakhi getting or claiming it — only when 5 or more. */
  claiming?: number | null;
}

export interface SchemeList {
  state: string;
  states: string[];
  eligibility: { key: string; label: string }[];
  schemes: Scheme[];
}

export interface HaqProfile { state: string; tags: string[]; answered: boolean }
export type HaqStatesWithProfile = HaqStates & { profile?: HaqProfile };

export const apiSchemes = (state: string, signal?: AbortSignal) =>
  apiClient.get<SchemeList>("/haq/schemes", { params: { state: state || undefined }, signal }).then((r) => r.data);

export const apiScheme = (key: string, signal?: AbortSignal) =>
  apiClient.get<Scheme>(`/haq/schemes/${encodeURIComponent(key)}`, { signal }).then((r) => r.data);

export const apiSaveHaqProfile = (state: string, tags: string[]) =>
  apiClient.put<HaqStatesWithProfile>("/me/haq/profile", { state, tags }).then((r) => r.data);

/** Does this scheme look like it fits her, from her own answers? */
export const mayFit = (s: Scheme, tags: string[]) =>
  s.eligibility.length === 0 || s.eligibility.some((t) => tags.includes(t));

/** An icon and tint per kind of scheme, so the list is not one picture repeated. */
export const lookFor = (category: string): { icon: string; tint: string; ink: string } => {
  const c = category.toLowerCase();
  if (c.includes("pension")) return { icon: "ShieldCheck", tint: "--ux-tint-violet", ink: "--ux-violet" };
  if (c.includes("mother") || c.includes("child")) return { icon: "Baby", tint: "--ux-tint-amber", ink: "--ux-amber-ink" };
  if (c.includes("food")) return { icon: "Wheat", tint: "--ux-tint-green", ink: "--ux-green-ink" };
  if (c.includes("house")) return { icon: "Flame", tint: "--ux-tint-orange", ink: "--ux-orange-ink" };
  if (c.includes("saving")) return { icon: "PiggyBank", tint: "--ux-tint-blue", ink: "--ux-blue-ink" };
  if (c.includes("loan") || c.includes("grant")) return { icon: "Landmark", tint: "--ux-tint-lilac", ink: "--ux-violet" };
  return { icon: "HeartHandshake", tint: "--ux-tint-pink", ink: "--ux-pink-ink" };
};
