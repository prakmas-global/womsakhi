/**
 * Her books.
 *
 * Most of what she sells never touches an order record in this product — it
 * happens over WhatsApp, in person, or inside her circle. So this is its own
 * ledger rather than a view over orders, and it is the only place those sales
 * exist.
 *
 * Until this existed the three books screens ran entirely on a fixture whose
 * own comment read "Mock data throughout": she could add a row, watch the
 * totals move, and lose every rupee of it on reload.
 */

import { apiClient } from "./api";

export type EntryState = "paid" | "owed" | "promised";
export type EntryVia = "whatsapp" | "shop" | "person" | "circle";

export interface BookEntry {
  id: string;
  who: string;
  what: string;
  minor: number;
  state: EntryState;
  via: EntryVia;
  /** ISO. When the sale happened, which is hers to set — she enters late. */
  on: string;
  due: string;
  /** Counted on the server, so every screen says the same number. */
  late_days: number;
}

export interface Books {
  entries: BookEntry[];
  paid_minor: number;
  owed_minor: number;
  promised_minor: number;
  late_count: number;
}

export interface ProofMonth {
  month: string;
  minor: number;
  orders: number;
  customers: number;
}

export interface Proof {
  months: ProofMonth[];
  total_minor: number;
  months_counted: number;
  months_with_earnings: number;
  average_minor: number;
}

export const apiBooks = (signal?: AbortSignal) =>
  apiClient.get<Books>("/me/books", { signal }).then((r) => r.data);

export const apiAddEntry = (body: {
  who: string; what?: string; minor: number;
  state?: EntryState; via?: EntryVia; on?: string; due?: string | null;
}) => apiClient.post<BookEntry>("/me/books", body).then((r) => r.data);

export const apiEditEntry = (id: string, body: Partial<{
  who: string; what: string; minor: number;
  state: EntryState; via: EntryVia; on: string; due: string | null;
}>) => apiClient.patch<BookEntry>(`/me/books/${id}`, body).then((r) => r.data);

export const apiDeleteEntry = (id: string) =>
  apiClient.delete(`/me/books/${id}`).then((r) => r.data);

/**
 * Proof of income — only `paid` rows, every month in the window including the
 * empty ones. A statement that silently skips a bad month is one nobody can
 * rely on, and a statement counting money she is still owed is one nobody will.
 */
export const apiProof = (months = 6, signal?: AbortSignal) =>
  apiClient.get<Proof>("/me/books/proof", { params: { months }, signal }).then((r) => r.data);

/* ── her year ─────────────────────────────────────────────────────────────── */

/**
 * The trade calendar, with her own earnings against each window.
 *
 * The calendar itself is craft knowledge and is the same for everyone —
 * wedding season runs November to February whoever you are. `earned_minor`
 * and `weeks_ahead` are not: they are counted from her books and from today's
 * date, replacing a fixture that told every woman each rush was worth ₹38,000
 * and was permanently "6 weeks away".
 */
export interface Season {
  id: string;
  name: string;
  when: string;
  shape: "rush" | "steady" | "quiet";
  icon: string;
  prepare: string;
  /** Whole weeks until it opens. 0 means this week — check `now` too. */
  weeks_ahead: number;
  /** True only while she is inside the window. */
  now: boolean;
  /** What these months have actually paid her, across her whole ledger. */
  earned_minor: number;
  months_recorded: number;
  months_in_season: number;
}

export interface Seasons {
  seasons: Season[];
  rush_minor: number;
  quiet_minor: number;
  /** Distinct months she has any record for. Zero means nothing is grounded. */
  months_of_history: number;
}

export const apiSeasons = (signal?: AbortSignal) =>
  apiClient.get<Seasons>("/me/books/seasons", { signal }).then((r) => r.data);
