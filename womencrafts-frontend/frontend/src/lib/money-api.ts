import { apiClient } from "./api";

/**
 * Goals, and the one request the Earn screen opens with.
 *
 * **Money targets are minor units**, like every other amount in this codebase.
 * A goal of "₹30,000 a month" is `3_000_000` here, and the only place it stops
 * being paise is `<Money>`.
 */

const get = <T>(url: string, signal?: AbortSignal) =>
  apiClient.get<T>(url, { signal }).then((r) => r.data);

export interface Goal {
  id: string;
  label: string;
  kind: "money" | "skill" | "count";
  target: number;
  current: number;
  pct: number;
  reached: boolean;
  unit: string;
  by: string;
  icon: string;
  status: string;
  /** Whether she moves it herself. Money and skill goals count themselves, and
   *  the screen shows no +/- for those — a money goal that could be edited by
   *  hand is a money goal that can be made to say anything. */
  manual: boolean;
  set_on: string;
  note: string;
}

export const apiGoals = (s?: AbortSignal) => get<Goal[]>("/me/goals", s);

export async function apiAddGoal(body: {
  label: string; kind: Goal["kind"]; target: number; by: string; unit?: string;
}) {
  const { data } = await apiClient.post<Goal[]>("/me/goals", body);
  return data;
}

export async function apiMoveGoal(id: string, current: number) {
  const { data } = await apiClient.patch<Goal[]>(`/me/goals/${id}`, { current });
  return data;
}

export async function apiEditGoal(id: string, body: {
  label: string; target: number; by: string; unit: string; note: string;
}) {
  const { data } = await apiClient.patch<Goal[]>(`/me/goals/${id}/details`, body);
  return data;
}

export async function apiDropGoal(id: string) {
  const { data } = await apiClient.delete<Goal[]>(`/me/goals/${id}`);
  return data;
}

export interface MoneyOverview {
  balance_minor: number;
  balance_label: string;
  transactions: {
    id: string; kind: "credit" | "debit"; label: string; source: string;
    amount_minor: number; amount_label: string; when: string;
  }[];
  accounts: {
    id: string; kind: string; label: string; detail: string;
    primary: boolean; verified: boolean;
  }[];
  goals: Goal[];
}

/** Everything the Earn screen needs, in one round trip instead of four. */
export const apiMoneyOverview = (s?: AbortSignal) => get<MoneyOverview>("/money/overview", s);

/* ── is there enough for the things that cannot wait? ─────────────────────── */

/**
 * The budget screen, which is deliberately not a budget.
 *
 * No categories, no limits, no score, nothing that turns red. A woman who had
 * to spend it did not overspend. The one warning this data supports is the one
 * that actually costs her money: counting a maybe as money.
 *
 * Separate from `MoneyOverview` above, which is her wallet and her goals. This
 * is what she has promised to pay and what is actually coming.
 *
 * ── Only commitments are stored ─────────────────────────────────────────────
 * Money coming in is read off her books — an `owed` row is work she delivered
 * and is waiting to be paid for, a `promised` row is work she has agreed to and
 * not done. Those are exactly the agreed / not-agreed halves this screen has to
 * keep apart, and she has already typed them once.
 *
 * Until this existed the screen ran on a fixture: ₹2,300 in hand, a school fee
 * for a child called Meena, and a ₹12,500 circle payout — the same for every
 * woman, on a screen that exists to tell her whether she can cover that fee.
 */
export type Weight = "cannot-wait" | "should-pay" | "can-move";

export interface Commitment {
  id: string;
  what: string;
  minor: number;
  /** ISO, or "" when she set no date. */
  due: string;
  /** What actually happens if it is missed. Empty where nothing much does. */
  if_missed: string;
  weight: Weight;
  icon: string;
  tint: string;
  ink: string;
  paid: boolean;
}

export interface Incoming {
  id: string;
  from: string;
  minor: number;
  when: string;
  /** False for anything not agreed. Never added into what she can spend. */
  certain: boolean;
}

export interface Budget {
  commitments: Commitment[];
  incoming: Incoming[];
  in_hand_minor: number;
  must_pay_minor: number;
  committed_minor: number;
  sure_minor: number;
  maybe_minor: number;
  spare_minor: number;
  /** The answer. Worked out on the server so the heading and the numbers
   *  underneath it can never disagree. */
  covers_must: boolean;
}

export const apiBudget = (s?: AbortSignal) => get<Budget>("/me/money", s);

export const apiAddCommitment = (body: {
  what: string; minor: number; due?: string | null; if_missed?: string;
  weight?: Weight; icon?: string; tint?: string; ink?: string;
}) => apiClient.post<Commitment>("/me/money/commitments", body).then((r) => r.data);

export const apiEditCommitment = (id: string, body: Partial<{
  what: string; minor: number; due: string | null; if_missed: string;
  weight: Weight; paid: boolean;
}>) => apiClient.patch<Commitment>(`/me/money/commitments/${id}`, body).then((r) => r.data);

export const apiDeleteCommitment = (id: string) =>
  apiClient.delete(`/me/money/commitments/${id}`).then((r) => r.data);

export const WEIGHT_LABEL: Record<Weight, string> = {
  "cannot-wait": "Cannot wait",
  "should-pay": "Should pay",
  "can-move": "Can wait",
};

/** What a commitment looks like, by weight. Colour is a rank, not decoration. */
export const WEIGHT_LOOK: Record<Weight, { tint: string; ink: string }> = {
  "cannot-wait": { tint: "--ux-tint-blue", ink: "--ux-blue-ink" },
  "should-pay": { tint: "--ux-tint-amber", ink: "--ux-amber-ink" },
  "can-move": { tint: "--ux-surface-2", ink: "--ux-muted" },
};
