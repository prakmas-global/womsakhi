import { apiClient } from "./api";

/**
 * People — backend: routes/people.py.
 *
 * Her username (unique, changeable once every 90 days) and finding another
 * member by hers. Search only ever matches usernames of admitted members.
 */

export interface UsernameState {
  username: string;
  /** What other members see: the username, else her verified account name. */
  display_name: string;
  can_change: boolean;
  /** ISO date she may change it again; "" when she may now. */
  next_change_at: string;
  cooldown_days: number;
}

export interface UsernameCheck {
  username: string;
  available: boolean;
  reason: string;
  /** Free names built from her own, to tap instead of type. */
  suggestions: string[];
}

/** none | friends | sent | received | self */
export type Relation = "none" | "friends" | "sent" | "received" | "self";

export interface PersonRow {
  id: string;
  username: string;
  name: string;
  avatar: string;
  verified: boolean;
  location: string;
  relation: Relation;
}

export interface PersonProfile extends PersonRow {
  bio: string;
  member_since: string;
  friends: number;
  posts: number;
}

export const apiMyUsername = (signal?: AbortSignal) =>
  apiClient.get<UsernameState>("/me/username", { signal }).then((r) => r.data);

export const apiCheckUsername = (u: string, signal?: AbortSignal) =>
  apiClient.get<UsernameCheck>("/me/username/check", { signal, params: { u } }).then((r) => r.data);

export const apiSetUsername = (username: string) =>
  apiClient.put<UsernameState>("/me/username", { username }).then((r) => r.data);

export const apiSearchPeople = (q: string, signal?: AbortSignal) =>
  apiClient.get<PersonRow[]>("/people/search", { signal, params: { q } }).then((r) => r.data);

/** By username, or by account id for a member who has not picked one yet. */
export const apiPerson = (handle: string, signal?: AbortSignal) =>
  apiClient.get<PersonProfile>(`/people/u/${encodeURIComponent(handle)}`, { signal }).then((r) => r.data);

/** "@priya.sews" — or her name when she has no username yet. */
export const handleOf = (p: { username?: string; name?: string; full_name?: string }) =>
  p.username ? `@${p.username}` : p.name || p.full_name || "";

/** The same rules the server keeps (app/core/usernames.py), so she hears early. */
export function usernameProblem(raw: string): string {
  const n = raw.trim().replace(/^@/, "").toLowerCase();
  if (n.length < 3) return "Use at least 3 characters.";
  if (n.length > 20) return "Use at most 20 characters.";
  if (!/^[a-z0-9._]+$/.test(n)) return "Use only small letters, numbers, dots (.) and underscores (_).";
  if (!/[a-z]/.test(n)) return "Add at least one letter.";
  if (n.startsWith(".") || n.endsWith(".")) return "A username cannot start or end with a dot.";
  if (n.includes("..")) return "Two dots cannot sit together.";
  if (/womsakhi|admin|official|moderator|helpline|support|staff/.test(n)) return "That name is kept for WomSakhi. Try another.";
  return "";
}
