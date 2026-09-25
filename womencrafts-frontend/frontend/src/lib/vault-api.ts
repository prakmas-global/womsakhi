/**
 * Her vault.
 *
 * ── WomSakhi holds none of this money ───────────────────────────────────────
 * Every rupee stays where it already is — in her hand, in her own account, in
 * the chit. What the server stores is her earmark: that ₹3,400 of what she
 * already has is for an emergency and not for the house. That is the licensing
 * position and, more to the point, the honest one. A balance this app showed
 * but did not hold would be money she could not go and get.
 *
 * Until this existed, four screens ran on a fixture whose own comment read
 * "Mock data throughout" — ₹15,625 of savings she did not have, three rules
 * that had never once fired, and eight movements that never happened.
 *
 * A pocket's balance is summed from its movements on the server, so the total
 * on the screen can never disagree with the history underneath it.
 */

import { apiClient } from "./api";

export type MoveSource = "her" | "rule";
export type RuleTrigger = "order_paid" | "payment_over" | "pot_payout" | "any_money_in";

export interface Pocket {
  id: string;
  name: string;
  note: string;
  /** Summed from the movements, never stored. */
  minor: number;
  /** Reachable today, with nobody's permission. */
  instant: boolean;
  icon: string;
  tint: string;
  ink: string;
  goal_minor: number | null;
  moves: number;
}

export interface Vault {
  pockets: Pocket[];
  /** The sum of her earmarks. Never called a balance — we do not hold it. */
  total_minor: number;
  instant_minor: number;
  count: number;
}

export interface VaultMove {
  id: string;
  pocket_id: string;
  pocket: string;
  what: string;
  /** Signed: positive set aside, negative taken back out. */
  minor: number;
  source: MoveSource;
  automatic: boolean;
  on: string;
}

export interface Moves {
  moves: VaultMove[];
  in_minor: number;
  out_minor: number;
  count: number;
}

export interface VaultRule {
  id: string;
  trigger: RuleTrigger;
  pocket_id: string;
  into: string;
  keep_minor: number | null;
  keep_pct: number | null;
  over_minor: number | null;
  on: boolean;
  /** What it actually put aside — counted from the moves it produced. */
  saved_minor: number;
}

export interface Rules {
  rules: VaultRule[];
  saved_minor: number;
  count: number;
}

export interface Guards {
  hide_amount: boolean;
  pin_to_move: boolean;
  quiet_notifications: boolean;
  quick_exit: boolean;
}

/* ── pockets ──────────────────────────────────────────────────────────────── */

export const apiVault = (signal?: AbortSignal) =>
  apiClient.get<Vault>("/me/vault", { signal }).then((r) => r.data);

export const apiAddPocket = (body: {
  name: string; note?: string; instant?: boolean;
  icon?: string; tint?: string; ink?: string; goal_minor?: number | null;
}) => apiClient.post<Pocket>("/me/vault/pockets", body).then((r) => r.data);

export const apiEditPocket = (id: string, body: Partial<{
  name: string; note: string; instant: boolean;
  icon: string; tint: string; ink: string; goal_minor: number | null;
}>) => apiClient.patch<Pocket>(`/me/vault/pockets/${id}`, body).then((r) => r.data);

export const apiDeletePocket = (id: string) =>
  apiClient.delete(`/me/vault/pockets/${id}`).then((r) => r.data);

/* ── movements ────────────────────────────────────────────────────────────── */

export const apiVaultMoves = (limit = 100, signal?: AbortSignal) =>
  apiClient.get<Moves>("/me/vault/moves", { params: { limit }, signal }).then((r) => r.data);

/**
 * Set money aside, or take it back out. Taking it out is not a failure and is
 * never shown as one — the emergency pocket working *is* her taking from it.
 */
export const apiAddMove = (body: {
  pocket_id: string; what?: string; minor: number;
  source?: MoveSource; rule_id?: string | null; on?: string;
}) => apiClient.post<VaultMove>("/me/vault/moves", body).then((r) => r.data);

export const apiDeleteMove = (id: string) =>
  apiClient.delete(`/me/vault/moves/${id}`).then((r) => r.data);

/* ── rules ────────────────────────────────────────────────────────────────── */

export const apiVaultRules = (signal?: AbortSignal) =>
  apiClient.get<Rules>("/me/vault/rules", { signal }).then((r) => r.data);

export const apiAddRule = (body: {
  trigger: RuleTrigger; pocket_id: string;
  keep_minor?: number | null; keep_pct?: number | null;
  over_minor?: number | null; on?: boolean;
}) => apiClient.post<VaultRule>("/me/vault/rules", body).then((r) => r.data);

export const apiEditRule = (id: string, body: Partial<{
  on: boolean; keep_minor: number; keep_pct: number; over_minor: number;
}>) => apiClient.patch<VaultRule>(`/me/vault/rules/${id}`, body).then((r) => r.data);

export const apiDeleteRule = (id: string) =>
  apiClient.delete(`/me/vault/rules/${id}`).then((r) => r.data);

/* ── privacy ──────────────────────────────────────────────────────────────── */

export const apiGuards = (signal?: AbortSignal) =>
  apiClient.get<Guards>("/me/vault/guards", { signal }).then((r) => r.data);

export const apiEditGuards = (body: Partial<Guards>) =>
  apiClient.patch<Guards>("/me/vault/guards", body).then((r) => r.data);

/* ── what someone holding her phone can see ──────────────────────────────── */

/**
 * Note what is *not* here. Her vault, her savings pot and her papers have no
 * switch at all — they are never showable by anyone, so there is nothing for
 * a person leaning over her shoulder to flip.
 */
export interface Showing {
  finished_orders: boolean;
  shop: boolean;
  classes: boolean;
  month_earnings: boolean;
}

export const apiShowing = (signal?: AbortSignal) =>
  apiClient.get<Showing>("/me/vault/showing", { signal }).then((r) => r.data);

export const apiEditShowing = (body: Partial<Showing>) =>
  apiClient.patch<Showing>("/me/vault/showing", body).then((r) => r.data);

/* ── words for a rule, built once so every screen says it the same way ────── */

export const TRIGGER_LABEL: Record<RuleTrigger, string> = {
  order_paid: "Every time an order is paid",
  payment_over: "When a large payment lands",
  pot_payout: "On the day the pot pays out",
  any_money_in: "Any time money comes in",
};
