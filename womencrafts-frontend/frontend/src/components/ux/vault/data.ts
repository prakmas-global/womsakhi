/**
 * Her vault — money that is unambiguously hers.
 *
 * ── Why this is the first thing to build ────────────────────────────────────
 * This is the cheapest, best-replicated and least-copied finding in the whole
 * evidence base. Four randomised trials, four countries, one direction: *how*
 * money reaches a woman matters as much as whether it does.
 *
 *   India         — public-works wages paid into her OWN account rather than
 *                   her husband's raised her work in public and private jobs,
 *                   and three years later had shifted her own work norms.
 *   Uganda        — the same loan paid onto a digital account instead of as
 *                   cash produced +11% business capital and +15% profits,
 *                   largest for women who reported pressure to share money.
 *   Kenya         — free savings accounts raised market women's business
 *                   investment 38–56%, and did nothing at all for men.
 *   Côte d'Ivoire — when an account was private rather than visible to her
 *                   network, take-up went from 14% to 60%.
 *
 * And the reason a savings pot works at all is the same reason: research on
 * Nairobi ROSCAs found participation is "a strategy a wife employs to protect
 * her savings against claims by her husband for immediate consumption."
 *
 * **The pot is a shield. This screen is the shield made explicit.**
 *
 * ── What that means for the design ──────────────────────────────────────────
 * The balance is HIDDEN BY DEFAULT. Not as a security theatre gesture — as the
 * product. Handsets are shared; GSMA names safety and security as a top barrier
 * to women's further use of mobile internet, and in Pakistan only 48% of women
 * who use mobile internet on someone else's phone use it daily, against 94% of
 * those who own theirs. A balance visible over her shoulder is not her money.
 *
 * Mock data throughout.
 */

export type Pocket = {
  id: string;
  name: string;
  note: string;
  minor: number;
  /** Emergency money must be reachable with no waiting and no permission. */
  instant: boolean;
  icon: string;
  tint: string;
  ink: string;
  /** A goal, if she set one. */
  goalMinor?: number;
};

export const POCKETS: Pocket[] = [
  {
    id: "p1", name: "For an emergency", note: "Yours the moment you need it — no turn to wait for",
    minor: 340000, instant: true, icon: "LifeBuoy",
    tint: "--ux-tint-green", ink: "--ux-green-ink", goalMinor: 500000,
  },
  {
    id: "p2", name: "Just mine", note: "Not for the house, not for anyone else",
    minor: 812500, instant: true, icon: "Lock",
    tint: "--ux-tint-violet", ink: "--ux-violet",
  },
  {
    id: "p3", name: "Stock for the shop", note: "Cloth and thread for the festival season",
    minor: 260000, instant: true, icon: "Package",
    tint: "--ux-tint-blue", ink: "--ux-blue-ink", goalMinor: 600000,
  },
  {
    id: "p4", name: "If someone falls ill", note: "So a hospital day does not become a loan",
    minor: 150000, instant: true, icon: "HeartPulse",
    tint: "--ux-tint-pink", ink: "--ux-pink-ink", goalMinor: 400000,
  },
];

/* ── rules ───────────────────────────────────────────────────────────────── */

/**
 * Saving by default rather than by decision.
 *
 * The behavioural evidence that survives replication is about defaults and
 * commitment, not exhortation — and her income is irregular, so a fixed monthly
 * amount fails in a lean month and under-saves in a good one. Every rule here
 * is therefore a share of something that just happened, not a calendar event.
 */
export type Rule = {
  id: string;
  when: string;
  keep: string;
  into: string;
  on: boolean;
  /** What it has quietly put aside so far. */
  savedMinor: number;
};

export const RULES: Rule[] = [
  { id: "r1", when: "Every time an order is paid", keep: "₹20", into: "Just mine", on: true, savedMinor: 148000 },
  { id: "r2", when: "When a payment over ₹500 lands", keep: "10%", into: "For an emergency", on: true, savedMinor: 92000 },
  { id: "r3", when: "On the day the pot pays out", keep: "₹500", into: "Stock for the shop", on: false, savedMinor: 0 },
];

/* ── movements ───────────────────────────────────────────────────────────── */

export type Move = {
  id: string;
  what: string;
  /** Positive in, negative out. */
  minor: number;
  when: string;
  pocket: string;
  /** Set when a rule did it rather than she did. */
  automatic?: boolean;
};

export const MOVES: Move[] = [
  { id: "m1", what: "Blouse order — Sunita", minor: 45000, when: "Today", pocket: "Just mine", automatic: true },
  { id: "m2", what: "Kept from the tiffin payment", minor: 2000, when: "Today", pocket: "Just mine", automatic: true },
  { id: "m3", what: "Cushion covers — pair", minor: 99500, when: "Yesterday", pocket: "Just mine" },
  { id: "m4", what: "Thread and lining", minor: -68000, when: "Yesterday", pocket: "Stock for the shop" },
  { id: "m5", what: "Kept from a large payment", minor: 12000, when: "2 days ago", pocket: "For an emergency", automatic: true },
  { id: "m6", what: "Mehendi — two hands", minor: 60000, when: "3 days ago", pocket: "Just mine" },
  { id: "m7", what: "Medicine for Amma", minor: -42000, when: "4 days ago", pocket: "If someone falls ill" },
  { id: "m8", what: "Bridal blouse — advance", minor: 150000, when: "6 days ago", pocket: "Just mine" },
];

/* ── privacy ─────────────────────────────────────────────────────────────── */

/**
 * The shared-handset settings, treated as product rather than as a settings
 * page nobody opens. Default state is the private one.
 */
export type Guard = {
  id: string;
  label: string;
  note: string;
  on: boolean;
  icon: string;
};

export const GUARDS: Guard[] = [
  { id: "g1", label: "Keep the amount hidden", note: "Tap to see it. It hides again when you leave the screen.", on: true, icon: "EyeOff" },
  { id: "g2", label: "Ask for the PIN before money moves", note: "Anyone can look. Only you can take.", on: true, icon: "KeyRound" },
  { id: "g3", label: "No amounts in notifications", note: "A message says a payment arrived, never how much.", on: true, icon: "BellOff" },
  { id: "g4", label: "Quick exit", note: "Press and hold the back arrow to jump to the home screen.", on: false, icon: "DoorOpen" },
];

/* ── derived ─────────────────────────────────────────────────────────────── */

export const total = (rows: Pocket[]) => rows.reduce((n, p) => n + p.minor, 0);
export const emergency = (rows: Pocket[]) => rows.find((p) => p.id === "p1");
export const savedByRules = (rows: Rule[]) =>
  rows.filter((r) => r.on).reduce((n, r) => n + r.savedMinor, 0);
