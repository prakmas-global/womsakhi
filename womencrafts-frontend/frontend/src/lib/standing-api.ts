/**
 * Proof of who she has been.
 *
 * A record of standing she can hand to a shop, a landlord, or a new circle in
 * a new town. Every figure is a count of rows she created — nothing smoothed,
 * nothing rounded up, no score.
 *
 * ── Why it had to stop being a fixture ──────────────────────────────────────
 * It read the same for every woman: fourteen pot rounds "never late", 87
 * finished orders, eleven returning buyers, nine straight months of earnings,
 * eight women vouching for her. Under a heading that said "proof you keep your
 * word", on a page with a Share button, and with a name — "Priya Sharma" —
 * baked into the shared text.
 *
 * She is the one standing there when a shopkeeper checks it.
 */

import { apiClient } from "./api";

export interface Proof {
  id: string;
  label: string;
  detail: string;
  /** When her record starts. Empty when there is nothing behind it yet. */
  since: string;
  icon: string;
  tint: string;
  ink: string;
  count: number;
}

export interface Standing {
  proofs: Proof[];
  /** Months her record actually spans. 0 when she has written nothing. */
  months: number;
  since: string;
  /** False when there is nothing real to show — then no record is offered. */
  has_record: boolean;
}

export const apiStanding = (signal?: AbortSignal) =>
  apiClient.get<Standing>("/me/standing", { signal }).then((r) => r.data);
