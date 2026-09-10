/**
 * The eight remaining modules.
 *
 * Each exists for a specific reason from the research, noted at its section.
 * Mock data throughout.
 */

/* ── 1. Voice listing ────────────────────────────────────────────────────── */

/**
 * Listing by speaking, because typing excludes most of the user base.
 *
 * Adult female literacy in the rural sample behind this research was **36%**,
 * against 71% for men — so a text-first listing flow excludes roughly two-thirds
 * of the women it is for. And the clock is running: Meta shipped Business AI on
 * WhatsApp for Indian small businesses in May 2026, and Meesho launched a
 * Gen-AI voice shopping assistant in March 2026 aimed squarely at tier-II and
 * tier-III towns.
 *
 * The design rule is the one the AI evidence imposes: **well-specified tasks
 * only.** A trial of 640 Kenyan entrepreneurs given a GPT-4 business mentor
 * found high performers gained ~15% while low performers did ~8–10% *worse* —
 * AI closes gaps on tight, checkable jobs and widens them where judgment is
 * needed. "Turn what she said into a listing she can correct" is tight and
 * checkable. "Advise her on her business" is not, and is not offered.
 */
export type VoiceDraft = {
  id: string;
  heardText: string;
  lang: string;
  /** What was pulled out — every field editable, nothing auto-published. */
  title: string;
  price: number;
  unit: string;
  detail: string;
  /** Confidence per field, so she checks the shaky ones rather than all of them. */
  unsure: string[];
};

export const VOICE_SAMPLES: VoiceDraft[] = [
  {
    id: "vd1",
    heardText: "Blouse silai karti hoon, chaar sau rupaye, teen din mein ready",
    lang: "Hindi",
    title: "Blouse stitching",
    price: 40000,
    unit: "per blouse",
    detail: "Ready in three days",
    unsure: [],
  },
  {
    id: "vd2",
    heardText: "Aam ka achaar aadha kilo do sau rupaye ghar ka banaya hua",
    lang: "Hindi",
    title: "Mango pickle, 500g",
    price: 20000,
    unit: "per jar",
    detail: "Homemade",
    unsure: ["price"],
  },
];

export const VOICE_LANGS = ["Hindi", "Marathi", "Bengali", "Tamil", "Telugu", "Kannada", "Gujarati", "English"];

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

/* ── 5. Net-90 and consortium bidding ────────────────────────────────────── */

/**
 * The real corporate-buyer answer.
 *
 * Discovery is the cheapest problem in the supplier-diversity chain and the one
 * most already solved; WEConnect International reports 22,000+ certified
 * businesses against just 180+ corporate buyers after operating since 2009.
 * What actually stands between a certified woman-owned micro-business and
 * getting paid is insurance, documentation, capacity — and above all **payment
 * terms.**
 *
 * The causal evidence is unusually clean: when the US federal government
 * accelerated payments to small suppliers, **employment at those suppliers went
 * up.** The binding constraint was the timing of cash, not access to the
 * contract. So this module sells readiness and cash timing, not a directory.
 */
export type Contract = {
  id: string;
  buyer: string;
  what: string;
  valueMinor: number;
  paysInDays: number;
  /** Whether one woman can do it, or it needs the circle. */
  needsCircle: boolean;
  circleSize?: number;
  state: "open" | "bidding" | "won";
  /** Readiness gaps that would sink the bid. */
  missing: string[];
};

export const CONTRACTS: Contract[] = [
  { id: "c1", buyer: "Sunrise Hostel", what: "120 uniform shirts", valueMinor: 2880000, paysInDays: 60, needsCircle: true, circleSize: 8, state: "open", missing: ["Bulk capacity proof"] },
  { id: "c2", buyer: "Rangoli Exports", what: "300 embroidered covers", valueMinor: 12600000, paysInDays: 90, needsCircle: true, circleSize: 14, state: "bidding", missing: ["Insurance cover", "Bulk capacity proof"] },
  { id: "c3", buyer: "Anand Cloth House", what: "Ready blouses, monthly", valueMinor: 700000, paysInDays: 30, needsCircle: false, state: "won", missing: [] },
];

export type Readiness = { id: string; what: string; why: string; done: boolean; costMinor?: number };

export const READINESS: Readiness[] = [
  { id: "rd1", what: "Business registered", why: "Udyam. Free, and online", done: true },
  { id: "rd2", what: "Bank account in the business name", why: "Buyers will not pay a personal account", done: true },
  { id: "rd3", what: "Proof you can make the quantity", why: "The thing that loses most bids", done: false },
  { id: "rd4", what: "Basic insurance", why: "Bigger buyers ask. Around ₹2,000 a year", done: false, costMinor: 200000 },
  { id: "rd5", what: "GST, if you cross the limit", why: "Only if you have to. Do not register early", done: false },
];

/* ── 6. Bookable slots ───────────────────────────────────────────────────── */

export type Slot = {
  id: string;
  day: string;
  time: string;
  service: string;
  minutes: number;
  minor: number;
  bookedBy?: string;
  /** Blocked because she said so — a period, a child, a funeral. No reason asked. */
  blocked?: boolean;
};

export const SLOTS: Slot[] = [
  { id: "s1", day: "Today", time: "10:00", service: "Blouse fitting", minutes: 30, minor: 0, bookedBy: "Sunita Devi" },
  { id: "s2", day: "Today", time: "11:00", service: "Blouse fitting", minutes: 30, minor: 0 },
  { id: "s3", day: "Today", time: "16:00", service: "Mehendi, simple", minutes: 60, minor: 60000 },
  { id: "s4", day: "Tomorrow", time: "10:00", service: "Blouse fitting", minutes: 30, minor: 0 },
  { id: "s5", day: "Tomorrow", time: "11:00", service: "Bridal mehendi", minutes: 180, minor: 200000, bookedBy: "Meera Joshi" },
  { id: "s6", day: "Tomorrow", time: "16:00", service: "Mehendi, simple", minutes: 60, minor: 60000, blocked: true },
  { id: "s7", day: "Saturday", time: "10:00", service: "Bridal mehendi", minutes: 180, minor: 200000 },
  { id: "s8", day: "Saturday", time: "15:00", service: "Blouse fitting", minutes: 30, minor: 0 },
];

/* ── 7. Disputes in the circle ───────────────────────────────────────────── */

/**
 * A return handled by someone both women trust, not a ticket queue.
 *
 * This is what a trust network can do that a marketplace cannot. The neutral
 * party is a woman both of them know — and crucially, **nobody's shop is
 * downgraded for having a dispute**, because a system that punishes disputes
 * simply teaches women not to raise them.
 */
export type Dispute = {
  id: string;
  with: string;
  about: string;
  minor: number;
  raisedBy: "her" | "you";
  state: "talking" | "helper" | "settled";
  helper?: string;
  outcome?: string;
  when: string;
};

export const DISPUTES: Dispute[] = [
  { id: "d1", with: "Ritu", about: "Blouse too tight at the sleeve", minor: 42000, raisedBy: "her", state: "talking", when: "Yesterday" },
  { id: "d2", with: "Anand Cloth House", about: "They say 3 of 20 were badly finished", minor: 105000, raisedBy: "her", state: "helper", helper: "Sunita Devi", when: "4 days ago" },
  { id: "d3", with: "Lakshmi", about: "Alteration was never collected", minor: 8000, raisedBy: "you", state: "settled", outcome: "She collected it and paid. Sorted between you.", when: "2 weeks ago" },
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
export const openSlots = (rows: Slot[]) => rows.filter((s) => !s.bookedBy && !s.blocked).length;
export const shownCount = (rows: Showable[]) => rows.filter((s) => s.on).length;
