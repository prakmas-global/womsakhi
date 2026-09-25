/**
 * Her week.
 *
 * Everything already on her calendar for one seven-day window: the sessions
 * she has booked and the events she has registered for. Nothing generated,
 * nothing suggested — a calendar showing things she never agreed to is one she
 * cannot trust to tell her where she has to be.
 *
 * ── What this replaced ──────────────────────────────────────────────────────
 * Twenty activities hardcoded into the screen — a "UI/UX Course" on Monday,
 * yoga at four, "Family Time" on Wednesday — identical for every woman, and
 * pinned to the 13th–19th whatever week it actually was, so the column marked
 * today was almost never today.
 */

import { apiClient } from "./api";

export type Cat =
  | "learning" | "work" | "health" | "community" | "personal" | "money" | "mentoring";

export interface WeekItem {
  id: string;
  kind: "booking" | "event";
  title: string;
  /** ISO date. */
  date: string;
  /** The label she was shown when she booked, e.g. "4:00 - 5:00 PM". */
  time: string;
  /** Where to draw it, or null when the label could not be read. */
  hour: number | null;
  hours: number;
  category: Cat;
  icon: string;
  where: string;
  with_whom: string;
  href: string;
}

export interface WeekDay {
  date: string;
  /** "Mon", "Tue", … */
  label: string;
  day: number;
  today: boolean;
}

export interface Week {
  start: string;
  days: WeekDay[];
  items: WeekItem[];
  count: number;
  /** Items with no readable time. Listed under the grid, never dropped. */
  untimed: number;
}

/** `start` is the ISO date of any day in the week she wants. */
export const apiWeek = (start?: string, signal?: AbortSignal) =>
  apiClient.get<Week>("/me/week", { params: start ? { start } : {}, signal })
    .then((r) => r.data);
