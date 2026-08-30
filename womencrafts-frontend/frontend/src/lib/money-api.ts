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
