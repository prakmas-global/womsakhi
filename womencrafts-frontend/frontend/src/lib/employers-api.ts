/**
 * "Did they pay her?" — from women who worked for them.
 *
 * Nothing is seeded and nothing is scored. Before this existed the screen ran
 * on four invented businesses, one of them carrying "Four women say they were
 * never paid. Ask for money up front, or walk away." Nobody had said anything.
 * If the name had matched a real company that is a defamatory claim about
 * them; either way a woman was deciding whether to take work on evidence that
 * did not exist.
 */

import { apiClient } from "./api";

export type Outcome = "paid_on_time" | "paid_late" | "never_paid";

export interface EmployerRecord {
  id: string;
  name: string;
  kind: string;
  /** How many women have reported. Shown whatever the number is. */
  worked_by: number;
  /**
   * Whether enough women have reported to show any counts at all.
   *
   * One report is a dispute between two people, not a verdict about a
   * business. Below the threshold the counts below are `null` — withheld
   * rather than zeroed, because a zero reads as "nobody was ever unpaid".
   */
  enough: boolean;
  paid_on_time: number | null;
  paid_late: number | null;
  never_paid: number | null;
  last_report: string;
}

export const apiEmployers = (q = "", signal?: AbortSignal) =>
  apiClient
    .get<{ employers: EmployerRecord[]; reported_total: number }>(
      "/work/employers", { params: q ? { q } : undefined, signal })
    .then((r) => r.data);

export const apiAddEmployer = (name: string, kind = "") =>
  apiClient.post<EmployerRecord>("/work/employers", { name, kind }).then((r) => r.data);

export const apiReportEmployer = (id: string, body: {
  outcome: Outcome; what?: string; amount_minor?: number; days_late?: number;
}) => apiClient.post<EmployerRecord>(`/work/employers/${id}/report`, body).then((r) => r.data);
