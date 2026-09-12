/**
 * The eight remaining modules.
 *
 * Each exists for a specific reason from the research, noted at its section.
 * Mock data throughout.
 */

/* ── 2. Trust Record ─────────────────────────────────────────────────────── */

/**
 * Positive-only, user-held, never furnished.
 *
 * Turning repayment history into portable credit is a decade-scale business —
 * the US took from statute in 2018 to *optional* production use in April 2026,
 * and the bottleneck was institutional acceptance, not technology. Worse, a
 * record that reports negatives is a weapon pointed at the user: in Kenya, 2.7
 * million people were negatively listed by credit bureaus, half the bad loans
 * under US$10, until the central bank had to intervene.
 *
 * And in India, furnishing this to lenders would look like carrying on the
 * business of credit information, which CICRA s.3 prohibits without RBI
 * registration at ₹30 crore minimum capital.
 *
 * So: **she holds it, she exports it, nothing negative is ever recorded, and
 * there is no lender-facing feed.** Whether anyone outside accepts it is a
 * business development problem, and the screen says so.
 */
export type Proof = {
  id: string;
  label: string;
  detail: string;
  since: string;
  icon: string;
  tint: string;
  ink: string;
  /** Only ever counts things that went right. */
  count: number;
};

export const PROOFS: Proof[] = [
  { id: "p1", label: "Paid into the pot, every round", detail: "14 rounds, never late", since: "March 2025", icon: "Coins", tint: "--ux-tint-violet", ink: "--ux-violet", count: 14 },
  { id: "p2", label: "Orders finished", detail: "Delivered and paid for", since: "Jan 2025", icon: "Package", tint: "--ux-tint-green", ink: "--ux-green-ink", count: 87 },
  { id: "p3", label: "Buyers who came back", detail: "Bought more than once", since: "Jan 2025", icon: "Repeat", tint: "--ux-tint-blue", ink: "--ux-blue-ink", count: 11 },
  { id: "p4", label: "Months with earnings", detail: "Never a month with nothing", since: "Jan 2025", icon: "TrendingUp", tint: "--ux-tint-amber", ink: "--ux-amber-ink", count: 9 },
  { id: "p5", label: "Women who vouch for you", detail: "In your circle, by name", since: "March 2025", icon: "Users", tint: "--ux-tint-pink", ink: "--ux-pink-ink", count: 8 },
];

export const RECORD_USES = [
  { id: "r1", label: "A bank or a lender", note: "They may or may not accept it — most do not yet", icon: "Landmark", accepted: false },
  { id: "r2", label: "A shop wanting a supplier", note: "Works well. They care about finished orders", icon: "Store", accepted: true },
  { id: "r3", label: "A landlord", note: "Works well, alongside your earnings statement", icon: "Home", accepted: true },
  { id: "r4", label: "A new circle after you move", note: "Works well. This is what it was built for", icon: "Users", accepted: true },
];

/* ── 3. Kitchen to customer ──────────────────────────────────────────────── */

/**
 * The licence is ₹100 a year. Almost nobody knows.
 *
 * FSSAI Basic Registration costs ₹100/year, accepts a home address by
 * self-declaration with no landlord NOC, needs Aadhaar plus a photo, and clears
 * in about 7–30 days on FoSCoS. Meanwhile every aggregator legally must display
 * a valid 14-digit FSSAI number, so an unlicensed home cook is simply
 * unlistable.
 *
 * The blocker is not the licence. It is believing there is one.
 *
 * And do not build delivery: Curryful died on it, and its founder's own account
 * is that supply was never the problem — customers could not tell home food from
 * another cloud kitchen. HomeFoodi survives by being direct chef-to-customer
 * with zero platform fee and tiffin subscriptions. Sell to people who already
 * know her.
 */
export type LicenceStep = {
  id: string;
  what: string;
  detail: string;
  needs?: string;
  done: boolean;
};

export const LICENCE_STEPS: LicenceStep[] = [
  { id: "ls1", what: "Aadhaar and a photo", detail: "That is the identity part done", needs: "Aadhaar", done: true },
  { id: "ls2", what: "Your kitchen address", detail: "Your own home is fine. No landlord letter needed — you declare it yourself", done: true },
  { id: "ls3", what: "What you will cook", detail: "A simple list. Tiffin, pickles, snacks", done: false },
  { id: "ls4", what: "Pay ₹100", detail: "For one year. That is the whole fee", done: false },
  { id: "ls5", what: "Wait for the number", detail: "Usually 7 to 30 days. Then you can sell anywhere legally", done: false },
];

export type HygienePoint = { id: string; what: string; done: boolean };

export const HYGIENE: HygienePoint[] = [
  { id: "h1", what: "Hair covered while cooking", done: true },
  { id: "h2", what: "Separate cloth for wiping and drying", done: true },
  { id: "h3", what: "Water stored covered", done: true },
  { id: "h4", what: "Cooked food kept apart from raw", done: false },
  { id: "h5", what: "Containers washed in hot water", done: true },
  { id: "h6", what: "No cooking on a day you are unwell", done: true },
];

/* ── 4. Was she actually paid? ───────────────────────────────────────────── */

/**
 * Not a job board — discovery is thoroughly owned. Trust is not.
 *
 * Apna claims 55M+ registered users; Awign claims 1.5M workers. What none of
 * them fix is that a woman cannot tell a real listing from a fraud, has no proof
 * she was paid, and no record she can carry when she leaves. Urban Company's own
 * history is the illustration: worker protests over commissions and forced
 * product purchases, a monthly-job-minimum charge, auto-assign removing the
 * ability to decline a job for a family emergency, ID blocking — and an
 * injunction against its own protesting workers.
 */
export type Employer = {
  id: string;
  name: string;
  kind: string;
  /** Verified by women who actually worked there, not by a badge we sell. */
  workedBy: number;
  paidOnTime: number;
  paidLate: number;
  neverPaid: number;
  lastReport: string;
  flag?: string;
};

export const EMPLOYERS: Employer[] = [
  { id: "e1", name: "Rangoli Exports", kind: "Craft orders", workedBy: 14, paidOnTime: 13, paidLate: 1, neverPaid: 0, lastReport: "2 weeks ago" },
  { id: "e2", name: "Ghar Ka Khana", kind: "Tiffin partner", workedBy: 6, paidOnTime: 4, paidLate: 2, neverPaid: 0, lastReport: "a month ago" },
  { id: "e3", name: "Bright Future Exports", kind: "Embroidery", workedBy: 9, paidOnTime: 2, paidLate: 3, neverPaid: 4, lastReport: "5 days ago", flag: "Four women say they were never paid. Ask for money up front, or walk away." },
  { id: "e4", name: "Sunrise Hostel", kind: "Uniform contract", workedBy: 3, paidOnTime: 3, paidLate: 0, neverPaid: 0, lastReport: "3 months ago" },
];

export type WorkClaim = {
  id: string;
  employer: string;
  what: string;
  dueMinor: number;
  dueOn: string;
  state: "waiting" | "paid" | "late" | "disputed";
  daysLate?: number;
};

export const WORK_CLAIMS: WorkClaim[] = [
  { id: "w1", employer: "Rangoli Exports", what: "60 cushion covers", dueMinor: 252000, dueOn: "Paid 12 Sept", state: "paid" },
  { id: "w2", employer: "Ghar Ka Khana", what: "August tiffin", dueMinor: 148000, dueOn: "Due 5 Sept", state: "late", daysLate: 12 },
  { id: "w3", employer: "Bright Future Exports", what: "Embroidery, 24 pieces", dueMinor: 96000, dueOn: "Due 20 Aug", state: "disputed", daysLate: 28 },
];

/* ── 8. Family-facing view ───────────────────────────────────────────────── */

/**
 * A screen she can hand over.
 *
 * Handsets are shared. Every other product treats that as a hiding problem,
 * which is furtive and makes her the one doing something wrong. This treats it
 * as **a disclosure problem she controls** — the same mechanism, told in a way
 * she can say out loud to the person holding the phone: *"here, look."*
 *
 * Defaults are deliberately generous on work and silent on money, because the
 * thing that gets a woman into trouble is a visible balance, not a visible
 * order book.
 */
export type Showable = {
  id: string;
  label: string;
  detail: string;
  on: boolean;
  /** Some things can never be shown, and the screen says so rather than hiding it. */
  locked?: boolean;
  icon: string;
};

export const SHOWABLE: Showable[] = [
  { id: "sh1", label: "Orders you have finished", detail: "The work, not what it paid", on: true, icon: "Package" },
  { id: "sh2", label: "Your shop and what you sell", detail: "Prices are public anyway", on: true, icon: "Store" },
  { id: "sh3", label: "Classes and events you attend", detail: "Where you are on a Thursday", on: true, icon: "GraduationCap" },
  { id: "sh4", label: "This month's earnings", detail: "The total only, not where it went", on: false, icon: "Wallet" },
  { id: "sh5", label: "Your locker and pockets", detail: "Never shown to anyone, by anyone", on: false, locked: true, icon: "Lock" },
  { id: "sh6", label: "Your savings pot", detail: "Never shown. Your circle is private", on: false, locked: true, icon: "Coins" },
  { id: "sh7", label: "In case, and your papers", detail: "Never shown", on: false, locked: true, icon: "ShieldCheck" },
];

/* ── derived ─────────────────────────────────────────────────────────────── */

export const trustTotal = (rows: Proof[]) => rows.reduce((n, p) => n + p.count, 0);
export const licenceDone = (rows: LicenceStep[]) => rows.filter((s) => s.done).length;
export const hygieneScore = (rows: HygienePoint[]) =>
  Math.round((rows.filter((h) => h.done).length / rows.length) * 100);
export const owedFromWork = (rows: WorkClaim[]) =>
  rows.filter((w) => w.state !== "paid").reduce((n, w) => n + w.dueMinor, 0);
export const shownCount = (rows: Showable[]) => rows.filter((s) => s.on).length;
