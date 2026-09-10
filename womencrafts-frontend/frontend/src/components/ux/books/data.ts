/**
 * Her books — the ledger, the proof, and the season.
 *
 * ── Why the unglamorous module is the one to build first ────────────────────
 * A randomised trial of eBay's Seller Hub — a plain analytics dashboard, no AI
 * anywhere in it — produced a **3.6% revenue lift** for small sellers, with over
 * a third of the effect coming from sellers simply watching their own numbers.
 * That is the bar every clever feature should be measured against, and most do
 * not clear it.
 *
 * ── Meet her where she already sells ────────────────────────────────────────
 * She is not waiting for a marketplace. IFC found **61% of women selling on
 * Jumia also sell through WhatsApp**, more than men do. And the evidence on
 * marketplaces is poor — a nationwide randomised evaluation of rural e-commerce
 * found no income gains for producers. So this does not ask her to move. It
 * takes the part WhatsApp cannot do: who owes her money, what she promised, and
 * what she actually made.
 *
 * **Own the ledger, not the storefront.**
 *
 * ── And what the ledger turns into ──────────────────────────────────────────
 * Once the ledger exists, proof of income is nearly free — and proof of income
 * is the thing she cannot get anywhere. No payslip, no filings, money arriving
 * as cash and UPI from thirty different people. She cannot rent a room, enrol a
 * child or stand as a guarantor without it.
 *
 * Mock data throughout.
 */

/* ── the ledger ──────────────────────────────────────────────────────────── */

export type Entry = {
  id: string;
  who: string;
  what: string;
  minor: number;
  /** paid · owed · promised (she has committed to do it, no money yet) */
  state: "paid" | "owed" | "promised";
  on: string;
  /** Where the sale actually happened. Most of it is not on the platform. */
  via: "whatsapp" | "shop" | "person" | "circle";
  /** Days since it was due, when it is owed. */
  lateDays?: number;
};

export const ENTRIES: Entry[] = [
  { id: "e1", who: "Sunita Devi", what: "2 blouses", minor: 84000, state: "paid", on: "Today", via: "whatsapp" },
  { id: "e2", who: "Meera Joshi", what: "Saree fall and pico ×3", minor: 24000, state: "paid", on: "Today", via: "person" },
  { id: "e3", who: "Anand Cloth House", what: "20 ready blouses", minor: 700000, state: "owed", on: "Due 3 days ago", via: "shop", lateDays: 3 },
  { id: "e4", who: "Kavita Rao", what: "Cushion covers, pair", minor: 199000, state: "paid", on: "Yesterday", via: "circle" },
  { id: "e5", who: "Lakshmi", what: "Blouse alteration", minor: 8000, state: "owed", on: "Due 11 days ago", via: "whatsapp", lateDays: 11 },
  { id: "e6", who: "Ritu", what: "Bridal blouse", minor: 260000, state: "promised", on: "For the 14th", via: "whatsapp" },
  { id: "e7", who: "Sunrise Hostel", what: "12 uniforms", minor: 288000, state: "promised", on: "Before June", via: "person" },
  { id: "e8", who: "Anjali", what: "Kurta stitching", minor: 45000, state: "paid", on: "2 days ago", via: "whatsapp" },
  { id: "e9", who: "Priya's neighbour", what: "Petticoat ×2", minor: 30000, state: "paid", on: "3 days ago", via: "person" },
];

export const VIA_LABEL: Record<Entry["via"], string> = {
  whatsapp: "WhatsApp",
  shop: "A shop",
  person: "In person",
  circle: "Your circle",
};

/* ── proof of income ─────────────────────────────────────────────────────── */

export type MonthRow = { month: string; minor: number; orders: number; customers: number };

export const MONTHS: MonthRow[] = [
  { month: "April", minor: 1420000, orders: 19, customers: 12 },
  { month: "May", minor: 1680000, orders: 22, customers: 14 },
  { month: "June", minor: 2240000, orders: 28, customers: 17 },
  { month: "July", minor: 1960000, orders: 24, customers: 15 },
  { month: "August", minor: 2380000, orders: 31, customers: 19 },
  { month: "September", minor: 1340000, orders: 17, customers: 11 },
];

/** What a statement is actually FOR. Naming the use changes what goes in it. */
export const PROOF_USES = [
  { id: "u1", label: "Renting a room", note: "Six months, and how many people pay you", icon: "Home" },
  { id: "u2", label: "A child's school admission", note: "Yearly total, and that it is steady", icon: "GraduationCap" },
  { id: "u3", label: "A loan or a scheme", note: "Everything, with the ups and downs shown honestly", icon: "Landmark" },
  { id: "u4", label: "Standing as a guarantor", note: "That you have earned for six months without a gap", icon: "Handshake" },
];

/* ── the season ──────────────────────────────────────────────────────────── */

/**
 * Her year is not flat and it is not random.
 *
 * Weddings, festivals, harvest, school reopening, exam season — a tailor's year
 * and a food seller's year have completely different shapes, and every business
 * tool ever built assumes a smooth month. Volatility, not level, is what breaks
 * a micro-business: the money to buy cloth in the busy month has to survive the
 * lean one.
 */
export type Season = {
  id: string;
  name: string;
  when: string;
  /** How her trade behaves: rush · steady · quiet */
  shape: "rush" | "steady" | "quiet";
  expectMinor: number;
  /** What she should do about it, and how far ahead. */
  prepare: string;
  weeksAhead: number;
  icon: string;
};

export const SEASONS: Season[] = [
  { id: "sn1", name: "Wedding season", when: "November to February", shape: "rush", expectMinor: 3800000,
    prepare: "Buy lining and thread now — prices go up 30% once it starts", weeksAhead: 6, icon: "Crown" },
  { id: "sn2", name: "Diwali", when: "Late October", shape: "rush", expectMinor: 2900000,
    prepare: "Take bookings by the first week of October or they go elsewhere", weeksAhead: 4, icon: "Sparkles" },
  { id: "sn3", name: "School reopening", when: "June", shape: "rush", expectMinor: 2400000,
    prepare: "Ask the hostel in April. They order once and it covers three months", weeksAhead: 8, icon: "Shirt" },
  { id: "sn4", name: "Monsoon", when: "July to September", shape: "quiet", expectMinor: 900000,
    prepare: "Do not commit to a big pot instalment. This is when the money thins", weeksAhead: 3, icon: "CloudRain" },
  { id: "sn5", name: "Exam months", when: "March and April", shape: "quiet", expectMinor: 1100000,
    prepare: "Mothers stop spending. A good time to do alterations and repairs", weeksAhead: 3, icon: "BookOpen" },
];

/* ── derived ─────────────────────────────────────────────────────────────── */

export const paidTotal = (rows: Entry[]) =>
  rows.filter((e) => e.state === "paid").reduce((n, e) => n + e.minor, 0);
export const owedTotal = (rows: Entry[]) =>
  rows.filter((e) => e.state === "owed").reduce((n, e) => n + e.minor, 0);
export const promisedTotal = (rows: Entry[]) =>
  rows.filter((e) => e.state === "promised").reduce((n, e) => n + e.minor, 0);
export const offPlatform = (rows: Entry[]) =>
  Math.round((rows.filter((e) => e.via !== "circle").length / rows.length) * 100);
export const yearMinor = (rows: MonthRow[]) => rows.reduce((n, m) => n + m.minor, 0);
export const bestMonth = (rows: MonthRow[]) => rows.reduce((a, b) => (b.minor > a.minor ? b : a));
export const leanMonth = (rows: MonthRow[]) => rows.reduce((a, b) => (b.minor < a.minor ? b : a));
