/**
 * My Shop, extended — the selling modules the research says are missing.
 *
 * ── The constraint this whole batch is built around ─────────────────────────
 * Not discovery, and not skill. **Capital.** In Africa the typical male-owned
 * firm holds over six times the capital investment of a female-owned one, the
 * gender profit gap averages 34%, and the gap in business *practices* is less
 * than half the capital gap. Training her harder does not close it. Letting her
 * sell without buying stock first does.
 *
 * So the modules here are, in order of how directly they attack that:
 *   pre-orders      — the buyer's money funds the materials
 *   subscriptions   — predictable income from people who already know her
 *   committed buyer — one repeat buyer beats a listings page
 *   buy together    — cut the input cost, since raising price is slow
 *   pricing         — she systematically underprices
 *   crossover       — women in male-dominated trades earn as much as men
 *   live            — sell to her own audience, hold no inventory
 *   streams         — several trades, one set of books
 *
 * ── And the two warnings ────────────────────────────────────────────────────
 * A nationwide randomised evaluation of rural e-commerce found "little evidence
 * for income gains to rural producers"; J-PAL's review of 15 trials found
 * limited benefit to small firms *on the platform*. What worked was matching a
 * producer to a specific committed buyer — Egyptian rug makers gained 16–26%.
 * Build the buyer relationship, not the listing page.
 *
 * And Meesho went from roughly 15 million resellers to ~575,000 sellers when it
 * went direct. Whatever is built here must never disintermediate her.
 *
 * Mock data throughout.
 */

/* ── streams: several trades, one set of books ───────────────────────────── */

export type Stream = {
  id: string;
  name: string;
  trade: string;
  /** She sells a thing, a skill by the hour, or food by subscription. */
  kind: "goods" | "skill" | "kitchen";
  live: boolean;
  monthMinor: number;
  orders: number;
  icon: string;
  tint: string;
  ink: string;
  /** Paused for a reason she chose — never a penalty. */
  pausedUntil?: string;
};

export const STREAMS: Stream[] = [
  { id: "s1", name: "Priya Tailoring", trade: "Blouses, falls and alterations", kind: "goods",
    live: true, monthMinor: 1840000, orders: 23, icon: "Scissors", tint: "--ux-tint-pink", ink: "--ux-pink-ink" },
  { id: "s2", name: "Mehendi by Priya", trade: "Bridal and festival mehendi", kind: "skill",
    live: true, monthMinor: 960000, orders: 8, icon: "Sparkles", tint: "--ux-tint-orange", ink: "--ux-orange-ink" },
  { id: "s3", name: "Priya's Kitchen", trade: "Tiffin, weekdays", kind: "kitchen",
    live: false, monthMinor: 0, orders: 0, icon: "UtensilsCrossed", tint: "--ux-tint-green", ink: "--ux-green-ink",
    pausedUntil: "after the festival" },
];

/* ── pricing: she underprices ────────────────────────────────────────────── */

export type PriceCheck = {
  id: string;
  item: string;
  yoursMinor: number;
  lowMinor: number;
  highMinor: number;
  typicalMinor: number;
  /** How many women near her are in this figure. Fewer than 4 and we say so. */
  from: number;
};

export const PRICES: PriceCheck[] = [
  { id: "pc1", item: "Blouse, stitched to measure", yoursMinor: 28000, lowMinor: 25000, highMinor: 60000, typicalMinor: 42000, from: 11 },
  { id: "pc2", item: "Saree fall and pico", yoursMinor: 6000, lowMinor: 5000, highMinor: 12000, typicalMinor: 8000, from: 14 },
  { id: "pc3", item: "Bridal mehendi, two hands", yoursMinor: 120000, lowMinor: 90000, highMinor: 350000, typicalMinor: 200000, from: 6 },
  { id: "pc4", item: "Simple alteration", yoursMinor: 4000, lowMinor: 3000, highMinor: 8000, typicalMinor: 5000, from: 3 },
];

/** Better-paid trades women near her moved into from hers. */
export type Crossover = {
  id: string;
  trade: string;
  why: string;
  typicalMonthMinor: number;
  women: number;
  icon: string;
};

export const CROSSOVERS: Crossover[] = [
  { id: "x1", trade: "Bridal wear and blouse design", why: "Same machine, same skill — the order is four times the size.", typicalMonthMinor: 3200000, women: 4, icon: "Crown" },
  { id: "x2", trade: "School uniform contracts", why: "One order in June covers three months. Needs a bulk quote, not a listing.", typicalMonthMinor: 2800000, women: 2, icon: "Shirt" },
  { id: "x3", trade: "Curtains and home furnishing", why: "Households pay more than individuals, and repeat every festival.", typicalMonthMinor: 2400000, women: 3, icon: "Home" },
];

/* ── pre-orders: the buyer funds the materials ───────────────────────────── */

export type PreOrder = {
  id: string;
  what: string;
  buyer: string;
  /** What she needs upfront to buy cloth and thread. */
  materialsMinor: number;
  totalMinor: number;
  paidMinor: number;
  dueBy: string;
  state: "asking" | "funded" | "making" | "done";
};

export const PREORDERS: PreOrder[] = [
  { id: "o1", what: "6 festival blouses", buyer: "Sunita Devi", materialsMinor: 180000, totalMinor: 420000, paidMinor: 180000, dueBy: "in 9 days", state: "making" },
  { id: "o2", what: "Bridal lehenga fall and lining", buyer: "Meera Joshi", materialsMinor: 240000, totalMinor: 650000, paidMinor: 240000, dueBy: "in 3 weeks", state: "funded" },
  { id: "o3", what: "12 school uniforms", buyer: "Anjali (for her hostel)", materialsMinor: 360000, totalMinor: 840000, paidMinor: 0, dueBy: "before June", state: "asking" },
  { id: "o4", what: "2 cushion cover sets", buyer: "Kavita Rao", materialsMinor: 60000, totalMinor: 199000, paidMinor: 199000, dueBy: "delivered", state: "done" },
];

/* ── subscriptions: recurring beats one-off ──────────────────────────────── */

export type Sub = {
  id: string;
  who: string;
  what: string;
  everyMinor: number;
  cadence: string;
  since: string;
  nextOn: string;
  /** Paid in advance — this is what makes it working capital. */
  prepaid: boolean;
  state: "running" | "paused" | "ending";
};

export const SUBS: Sub[] = [
  { id: "sb1", who: "Sunita Devi", what: "Weekday tiffin, one box", everyMinor: 180000, cadence: "monthly", since: "March", nextOn: "1 October", prepaid: true, state: "running" },
  { id: "sb2", who: "Ramesh & family", what: "Weekday tiffin, two boxes", everyMinor: 340000, cadence: "monthly", since: "January", nextOn: "1 October", prepaid: true, state: "running" },
  { id: "sb3", who: "Meera Joshi", what: "Weekday tiffin, one box", everyMinor: 180000, cadence: "monthly", since: "June", nextOn: "1 October", prepaid: false, state: "running" },
  { id: "sb4", who: "Lakshmi", what: "Weekday tiffin, one box", everyMinor: 180000, cadence: "monthly", since: "May", nextOn: "—", prepaid: false, state: "paused" },
];

/* ── buyers: one committed buyer beats a listings page ───────────────────── */

export type Buyer = {
  id: string;
  name: string;
  kind: "woman" | "shop" | "institution";
  bought: number;
  spentMinor: number;
  lastOn: string;
  /** The signal that matters: she came back and never complained. */
  repeat: boolean;
  complaints: number;
  /** Whether she has agreed to a standing order. */
  committed: boolean;
  note: string;
};

export const BUYERS: Buyer[] = [
  { id: "b1", name: "Sunita Devi", kind: "woman", bought: 14, spentMinor: 1240000, lastOn: "2 days ago", repeat: true, complaints: 0, committed: true, note: "Buys every festival, and brings her sister." },
  { id: "b2", name: "Anand Cloth House", kind: "shop", bought: 6, spentMinor: 2100000, lastOn: "3 weeks ago", repeat: true, complaints: 0, committed: false, note: "Takes 20 blouses at a time. Would take more." },
  { id: "b3", name: "Meera Joshi", kind: "woman", bought: 9, spentMinor: 680000, lastOn: "a week ago", repeat: true, complaints: 0, committed: false, note: "Never haggles, always collects on time." },
  { id: "b4", name: "Sunrise Hostel", kind: "institution", bought: 2, spentMinor: 1680000, lastOn: "last June", repeat: true, complaints: 0, committed: false, note: "Uniforms every June. Ask them in April." },
  { id: "b5", name: "Ritu", kind: "woman", bought: 1, spentMinor: 42000, lastOn: "2 months ago", repeat: false, complaints: 0, committed: false, note: "Bought once." },
];

/* ── live: sell to her own audience, hold no stock ───────────────────────── */

export type LiveSale = {
  id: string;
  title: string;
  when: string;
  state: "scheduled" | "live" | "ended";
  watching: number;
  sold: number;
  takenMinor: number;
  circle: string;
};

export const LIVES: LiveSale[] = [
  { id: "lv1", title: "Festival blouse colours", when: "Saturday, 6pm", state: "scheduled", watching: 0, sold: 0, takenMinor: 0, circle: "Tailoring & Stitching Sisters" },
  { id: "lv2", title: "New cotton arrivals", when: "Last Saturday", state: "ended", watching: 34, sold: 11, takenMinor: 486000, circle: "Tailoring & Stitching Sisters" },
  { id: "lv3", title: "Mehendi designs for Diwali", when: "Two weeks ago", state: "ended", watching: 51, sold: 7, takenMinor: 840000, circle: "Near you" },
];

/* ── wholesale ───────────────────────────────────────────────────────────── */

export type BulkAsk = {
  id: string;
  from: string;
  what: string;
  qty: number;
  perMinor: number;
  byWhen: string;
  /** Whether she can do it alone, or needs the circle. */
  needsCircle: boolean;
  state: "new" | "quoted" | "won" | "declined";
};

export const BULK: BulkAsk[] = [
  { id: "w1", from: "Sunrise Hostel", what: "School uniform shirts", qty: 120, perMinor: 24000, byWhen: "before 30 May", needsCircle: true, state: "new" },
  { id: "w2", from: "Anand Cloth House", what: "Ready blouses, assorted", qty: 20, perMinor: 35000, byWhen: "in 3 weeks", needsCircle: false, state: "quoted" },
  { id: "w3", from: "Rangoli Exports", what: "Embroidered cushion covers", qty: 60, perMinor: 42000, byWhen: "in 6 weeks", needsCircle: true, state: "won" },
];

/* ── derived ─────────────────────────────────────────────────────────────── */

export const monthTotal = (rows: Stream[]) => rows.reduce((n, s) => n + s.monthMinor, 0);
export const prepaidHeld = (rows: Sub[]) =>
  rows.filter((s) => s.state === "running" && s.prepaid).reduce((n, s) => n + s.everyMinor, 0);
export const fundedUpfront = (rows: PreOrder[]) =>
  rows.filter((o) => o.state !== "asking").reduce((n, o) => n + o.paidMinor, 0);

/** Nosko & Tadelis: score on what buyers DON'T do. Most sellers have no
 *  ratings at all, and displayed stars are biased upward — repeat purchase and
 *  the absence of complaint are richer and much harder to game. */
export const quietScore = (b: Buyer) => (b.repeat ? 60 : 20) + Math.min(b.bought * 3, 30) - b.complaints * 25;
