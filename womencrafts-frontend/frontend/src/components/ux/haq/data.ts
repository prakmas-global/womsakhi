/**
 * Haq — what she is owed, and what she is about to lose.
 *
 * ── Why this is not a scheme directory ──────────────────────────────────────
 * The obvious product here is a list of government schemes with an eligibility
 * check. That product exists, it is free, and the evidence says it does not
 * work: MyScheme already lists 4,772 schemes, and in the incumbent's own
 * randomised pilot an agent standing in the household's doorway with a working
 * eligibility app converted 468 households into **17 completed applications**.
 * Making the screening free took take-up from 38% to 99% and produced no extra
 * applications at all. Discovery is solved. Completion is not.
 *
 * ── So this is built around losing, not finding ─────────────────────────────
 * The biggest pool of unclaimed money is not women who never applied. It is
 * women who were enrolled and then removed for paperwork. Maharashtra's Ladki
 * Bahin scheme went from 2.47 crore beneficiaries to 1.66 crore — **92 lakh
 * women removed, 62 lakh of them purely for not completing e-KYC**. Two-thirds
 * of removals were paperwork, not ineligibility. In South Africa, 60% of
 * children on the Child Support Grant had payments interrupted for
 * bureaucratic reasons and 80% of those interruptions were errors.
 *
 * Nobody helps her appeal. That is this module.
 *
 * ── The four jobs, in the order the evidence supports ───────────────────────
 * KEEP      — a dated compliance action on money she already receives.
 * CLAIM     — the documents, because both trials that worked name documents
 *             as the binding constraint.
 * ACCOMPANY — a circle member who goes with her. In the Delhi trial, help with
 *             the form raised applications 41%; help **plus going to the
 *             office** raised them 70%, with the largest gains for women with
 *             least household autonomy. That arm is a circle.
 * RECOVER   — delay compensation is a legal right that is essentially never
 *             paid.
 *
 * The catalogue itself is NOT here any more: which schemes exist, for whom
 * and in which state comes from the server (lib/haq-api.ts, staff-managed),
 * and `fromScheme` below lays her own status over it. What stays here is the
 * vocabulary — statuses, the paper types — and the arithmetic.
 */

import type { HaqState } from "@/lib/life-api";
import { lookFor, mayFit, type Scheme } from "@/lib/haq-api";

export type HaqStatus =
  /** Money arriving now. */
  | "receiving"
  /** Money arriving now, with a deadline that will stop it. */
  | "at-risk"
  /** Already stopped. This is the appeal queue. */
  | "stopped"
  /** She qualifies and has not applied. */
  | "can-claim"
  /** Applied, waiting on the department. */
  | "waiting"
  /** She has not said — the default. Never "you qualify" by assumption. */
  | "unknown";

export type Haq = {
  id: string;
  name: string;
  body: string;
  /** What lands, in her words. */
  gives: string;
  amountMinor: number;
  /** "every month", "once", "twice a year" */
  cadence: string;
  status: HaqStatus;
  /** The dated thing that must happen, if there is one. */
  action?: string;
  /** Days until that action is due. Negative means overdue. */
  dueDays?: number;
  /** Why it stopped, in the department's words, translated. */
  stoppedBecause?: string;
  /** Papers this needs. Matched against PAPERS below. */
  needs: string[];
  /** Whether the office visit can be avoided entirely. */
  online: boolean;
  icon: string;
  tint: string;
  ink: string;
  /** Honest per-scheme state. Telling her she qualifies for something the
   *  state has not sanctioned since January 2024 is worse than saying nothing. */
  openNow: boolean;
  openNote?: string;
  /** Catalogue extras (from the server). */
  key: string;
  state: string;
  link: string;
  helpline: string;
  where: string;
  steps: string[];
  /** Documents in words (papers she can track are in `needs`). */
  needsText: string[];
  amountLabel: string;
  eligibility: string[];
  /** Her own answers say this may be for her. A suggestion, not a status. */
  fits: boolean;
};


/** One catalogue row, with her own status laid over it. */
export function fromScheme(s: Scheme, mine: HaqState | undefined, tags: string[]): Haq {
  const look = lookFor(s.category);
  return {
    id: s.key, key: s.key, name: s.name, body: s.body_name, gives: s.gives,
    amountMinor: s.amount_minor, amountLabel: s.amount, cadence: s.cadence,
    status: (mine?.status as HaqStatus) ?? "unknown",
    action: mine?.action || undefined,
    dueDays: mine?.due_days ?? undefined,
    stoppedBecause: mine?.stopped_because || undefined,
    needs: s.papers, needsText: s.needs, online: s.online,
    icon: look.icon, tint: look.tint, ink: look.ink,
    openNow: s.open_now, openNote: s.open_note || undefined,
    state: s.state, link: s.link, helpline: s.helpline, where: s.where, steps: s.steps,
    eligibility: s.eligibility, fits: mayFit(s, tags),
  };
}

/* ── Papers ──────────────────────────────────────────────────────────────── */

/**
 * The document layer is the product.
 *
 * Both trials that moved the needle named obtaining supporting documents as
 * the binding constraint — and the gap is sharply gendered. In one rural
 * sample, PAN was held by 24.5% of household heads and **8.2% of spouses**;
 * residential certificates 28% against 9.8%. She is not missing motivation.
 * She is missing paper that takes a day off work to obtain.
 */
export type Paper = {
  id: string;
  name: string;
  note: string;
  /** held · expiring · missing */
  state: "held" | "expiring" | "missing";
  /** Where it came from or must come from. */
  from: string;
  expires?: string;
  /** How many of her benefits need it — the reason to fix it first. */
  unlocks: number;
};

export const PAPERS: Paper[] = [
  { id: "aadhaar", name: "Aadhaar", note: "Linked to your own mobile number", state: "held", from: "Held in your papers", unlocks: 7 },
  { id: "bank", name: "Bank passbook", note: "Account seeded and active", state: "held", from: "Held in your papers", unlocks: 5 },
  { id: "ration", name: "Ration card", note: "Family list needs updating", state: "expiring", from: "Ration office", expires: "in 24 days", unlocks: 2 },
  { id: "life-cert", name: "Life certificate", note: "Needed once a year for any pension", state: "missing", from: "Any CSC, or the bank", unlocks: 2 },
  { id: "mcp-card", name: "Mother and child card", note: "From the anganwadi", state: "held", from: "Held in your papers", unlocks: 1 },
  { id: "birth-cert", name: "Birth certificate", note: "For your daughter", state: "missing", from: "Municipal office", unlocks: 1 },
  { id: "age-proof", name: "Age proof", note: "For your mother-in-law", state: "missing", from: "Municipal office", unlocks: 1 },
];

/* ── Recover ─────────────────────────────────────────────────────────────── */

/**
 * Delay compensation is a legal right that is essentially never paid. In one
 * ten-state study of 31 million wage transactions, 63% of payments breached
 * the statutory deadline and the compensation owed was "neither acknowledged
 * nor paid". A calculator and a pre-filled grievance is cheap and unambiguous.
 */
export type Late = {
  id: string;
  what: string;
  dueOn: string;
  paidOn?: string;
  daysLate: number;
  owedMinor: number;
  filed: boolean;
};

/* ── Derived helpers ─────────────────────────────────────────────────────── */

export const atRisk = (rows: Haq[]) => rows.filter((h) => h.status === "at-risk");
export const stopped = (rows: Haq[]) => rows.filter((h) => h.status === "stopped");
export const receiving = (rows: Haq[]) =>
  rows.filter((h) => h.status === "receiving" || h.status === "at-risk");
export const claimable = (rows: Haq[]) => rows.filter((h) => h.status === "can-claim");
/** Not checked yet, but her answers say it may be for her. */
export const mayFitHer = (rows: Haq[]) => rows.filter((h) => h.status === "unknown" && h.fits);

/** What stops arriving if nothing is done. The number that should lead. */
export const atRiskMonthlyMinor = (rows: Haq[]) =>
  atRisk(rows)
    .filter((h) => h.cadence === "every month")
    .reduce((n, h) => n + h.amountMinor, 0);

export const STATUS_LABEL: Record<HaqStatus, string> = {
  receiving: "Arriving",
  "at-risk": "Will stop",
  stopped: "Stopped",
  "can-claim": "I qualify",
  waiting: "Waiting on them",
  unknown: "Not checked yet",
};

export const STATUS_TONE: Record<HaqStatus, { tint: string; ink: string }> = {
  receiving: { tint: "--ux-tint-green", ink: "--ux-green-ink" },
  "at-risk": { tint: "--ux-tint-amber", ink: "--ux-amber-ink" },
  stopped: { tint: "--ux-danger-tint", ink: "--ux-danger-solid" },
  "can-claim": { tint: "--ux-tint-blue", ink: "--ux-blue-ink" },
  waiting: { tint: "--ux-tint-lilac", ink: "--ux-violet-ink" },
  unknown: { tint: "--ux-surface-2", ink: "--ux-muted" },
};
