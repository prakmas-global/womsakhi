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
 * Mock data. Every figure here is illustrative, not hers.
 */

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
  | "waiting";

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
};

export const HAQ: Haq[] = [
  {
    id: "h1",
    name: "Ladki Bahin",
    body: "Government of Maharashtra",
    gives: "A monthly payment for women in the household",
    amountMinor: 150000,
    cadence: "every month",
    status: "at-risk",
    action: "Finish e-KYC",
    dueDays: 9,
    needs: ["aadhaar", "bank"],
    online: true,
    icon: "HeartHandshake",
    tint: "--ux-tint-pink",
    ink: "--ux-pink-ink",
    openNow: true,
  },
  {
    id: "h2",
    name: "Widow pension",
    body: "State social welfare",
    gives: "A monthly pension",
    amountMinor: 90000,
    cadence: "every month",
    status: "stopped",
    stoppedBecause:
      "The yearly life certificate was not submitted. This is the most common reason, and it can be undone.",
    needs: ["aadhaar", "life-cert", "bank"],
    online: false,
    icon: "ShieldCheck",
    tint: "--ux-tint-violet",
    ink: "--ux-violet",
    openNow: true,
  },
  {
    id: "h3",
    name: "Maternity benefit",
    body: "PMMVY · Ministry of Women & Child Development",
    gives: "₹5,000 for a first child, in two parts",
    amountMinor: 500000,
    cadence: "once",
    status: "waiting",
    action: "Second instalment after the first vaccination",
    dueDays: 41,
    needs: ["aadhaar", "bank", "mcp-card"],
    online: true,
    icon: "Baby",
    tint: "--ux-tint-amber",
    ink: "--ux-amber-ink",
    openNow: true,
  },
  {
    id: "h4",
    name: "Free gas refill",
    body: "Ujjwala",
    gives: "A subsidy on each cylinder",
    amountMinor: 30000,
    cadence: "each refill",
    status: "receiving",
    needs: ["aadhaar", "bank"],
    online: true,
    icon: "Flame",
    tint: "--ux-tint-orange",
    ink: "--ux-orange-ink",
    openNow: true,
  },
  {
    id: "h5",
    name: "Ration card food grain",
    body: "Public Distribution System",
    gives: "Monthly grain for the household",
    amountMinor: 0,
    cadence: "every month",
    status: "at-risk",
    action: "Re-verify the family list",
    dueDays: 24,
    needs: ["aadhaar", "ration"],
    online: false,
    icon: "Wheat",
    tint: "--ux-tint-green",
    ink: "--ux-green-ink",
    openNow: true,
  },
  {
    id: "h6",
    name: "Girl child savings",
    body: "Sukanya Samriddhi · Post Office",
    gives: "A high-interest account in your daughter's name",
    amountMinor: 25000,
    cadence: "you choose",
    status: "can-claim",
    needs: ["aadhaar", "birth-cert"],
    online: false,
    icon: "PiggyBank",
    tint: "--ux-tint-blue",
    ink: "--ux-blue-ink",
    openNow: true,
  },
  {
    id: "h7",
    name: "Old age pension",
    body: "State social welfare",
    gives: "A monthly pension for a parent living with you",
    amountMinor: 60000,
    cadence: "every month",
    status: "can-claim",
    needs: ["aadhaar", "age-proof", "bank"],
    online: false,
    icon: "Users",
    tint: "--ux-tint-lilac",
    ink: "--ux-violet",
    openNow: false,
    openNote:
      "Your district has not sanctioned a new pension since January 2024. You can prepare the papers, but do not expect a decision yet.",
  },
];

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

/* ── Accompany ───────────────────────────────────────────────────────────── */

/**
 * The +70% arm.
 *
 * Haqdarshak pays field agents a salary to do this. You have groups of eight to
 * twelve women who already meet and already vouch for each other — so the
 * expensive arm of the trial is the cheap one here. Matched on who has done
 * *this* office before, because that is the knowledge that matters.
 */
export type Companion = {
  id: string;
  name: string;
  avatar: string;
  /** What she has actually done, not a rating. */
  did: string;
  /** Which office she knows. */
  knows: string;
  circle: string;
  free: string;
};

export const COMPANIONS: Companion[] = [
  { id: "c1", name: "Sunita Devi", avatar: "", did: "Restored her own widow pension last year", knows: "Block office", circle: "Tailoring & Stitching Sisters", free: "Tuesday morning" },
  { id: "c2", name: "Kavita Rao", avatar: "", did: "Finished e-KYC for four women in the circle", knows: "CSC on the main road", circle: "Tailoring & Stitching Sisters", free: "Any morning" },
  { id: "c3", name: "Ananya Sharma", avatar: "", did: "Got her ration family list corrected", knows: "Ration office", circle: "Near you", free: "Thursday" },
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

export const LATE: Late[] = [
  { id: "l1", what: "Ladki Bahin — March", dueOn: "5 March", paidOn: "2 April", daysLate: 28, owedMinor: 4200, filed: false },
  { id: "l2", what: "Ladki Bahin — April", dueOn: "5 April", paidOn: "19 April", daysLate: 14, owedMinor: 2100, filed: false },
  { id: "l3", what: "Widow pension — January", dueOn: "7 January", daysLate: 61, owedMinor: 9150, filed: true },
];

/* ── Derived helpers ─────────────────────────────────────────────────────── */

export const atRisk = (rows: Haq[]) => rows.filter((h) => h.status === "at-risk");
export const stopped = (rows: Haq[]) => rows.filter((h) => h.status === "stopped");
export const receiving = (rows: Haq[]) =>
  rows.filter((h) => h.status === "receiving" || h.status === "at-risk");
export const claimable = (rows: Haq[]) => rows.filter((h) => h.status === "can-claim");

/** What stops arriving if nothing is done. The number that should lead. */
export const atRiskMonthlyMinor = (rows: Haq[]) =>
  atRisk(rows)
    .filter((h) => h.cadence === "every month")
    .reduce((n, h) => n + h.amountMinor, 0);

export const STATUS_LABEL: Record<HaqStatus, string> = {
  receiving: "Arriving",
  "at-risk": "Will stop",
  stopped: "Stopped",
  "can-claim": "You qualify",
  waiting: "Waiting on them",
};

export const STATUS_TONE: Record<HaqStatus, { tint: string; ink: string }> = {
  receiving: { tint: "--ux-tint-green", ink: "--ux-green-ink" },
  "at-risk": { tint: "--ux-tint-amber", ink: "--ux-amber-ink" },
  stopped: { tint: "--ux-danger-tint", ink: "--ux-danger-solid" },
  "can-claim": { tint: "--ux-tint-blue", ink: "--ux-blue-ink" },
  waiting: { tint: "--ux-tint-lilac", ink: "--ux-violet" },
};
