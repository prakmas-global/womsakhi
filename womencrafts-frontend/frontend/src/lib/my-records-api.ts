import { apiClient } from "./api";

/**
 * Her own small records — backend: routes/my_records.py. Never shown to anyone
 * else. The iron record is which weeks she ticked, nothing more.
 */

export type TestResult = "normal" | "low" | "very_low" | "not_told";

export interface IronWeek { week: string; starts: string; took: boolean; label: string }
export interface StrengthTest { date: string; result: TestResult }
export interface Strength {
  weeks: IronWeek[];
  took_this_week: boolean;
  last_test: StrengthTest | null;
  tests: StrengthTest[];
}

export const TEST_RESULT_LABEL: Record<TestResult, string> = {
  normal: "Normal",
  low: "A little low",
  very_low: "Very low",
  not_told: "They did not say",
};

export type ChecklistKey = "doctor" | "move";
export interface Checklist { key: ChecklistKey; items: string[]; done: string[]; updated_at: string }

export const apiStrength = (s?: AbortSignal) =>
  apiClient.get<Strength>("/me/health/strength", { signal: s }).then((r) => r.data);
export const apiTickIron = (took: boolean) =>
  apiClient.post<Strength>("/me/health/strength/iron", { took }).then((r) => r.data);
export const apiRecordStrengthTest = (date: string, result: TestResult) =>
  apiClient.post<Strength>("/me/health/strength/test", { date, result }).then((r) => r.data);

export const apiChecklist = (key: ChecklistKey, s?: AbortSignal) =>
  apiClient.get<Checklist>(`/me/checklists/${key}`, { signal: s }).then((r) => r.data);
export const apiSaveChecklist = (key: ChecklistKey, body: { items?: string[]; done?: string[] }) =>
  apiClient.put<Checklist>(`/me/checklists/${key}`, { items: body.items ?? [], done: body.done ?? [] }).then((r) => r.data);
