/**
 * In case something happens.
 *
 * Six plain questions, answered once, so that a week in hospital — or worse —
 * does not leave her family guessing. The most valuable answer is the least
 * dramatic one: where the papers are.
 *
 * ── Why this had to stop being a fixture ────────────────────────────────────
 * The screen used to open with three answers already filled in: a sister
 * called Sunita, papers in "the steel almirah, top shelf, blue folder", and
 * Sunita again for the circle. The same three for every woman — and anything
 * she typed over them lived in React state and was gone on reload.
 *
 * That is the worst failure this product could have. She reads "3 of 6
 * answered", believes her instructions are written down, and they are not.
 *
 * ── Private ─────────────────────────────────────────────────────────────────
 * No sharing, no export, no trusted-contact view. Each of those turns a place
 * she can be honest into a place she has to be careful, and a woman being
 * careful here writes nothing worth having.
 */

import { apiClient } from "./api";

export interface Wish {
  id: string;
  question: string;
  why: string;
  icon: string;
  /** Hers. Empty when she has not written it. */
  answer: string;
}

export interface InCase {
  wishes: Wish[];
  /** Counts what is actually written, not what she has looked at. */
  answered: number;
  total: number;
  updated_at: string;
}

export const apiInCase = (signal?: AbortSignal) =>
  apiClient.get<InCase>("/me/incase", { signal }).then((r) => r.data);

/** An empty string clears the answer — as easy as writing it. */
export const apiSetWish = (id: string, answer: string) =>
  apiClient.put<InCase>(`/me/incase/${id}`, { answer }).then((r) => r.data);
