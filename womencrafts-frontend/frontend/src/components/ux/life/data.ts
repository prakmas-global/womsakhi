/**
 * The life modules — Batch 5.
 *
 * ── The school year ─────────────────────────────────────────────────────────
 * The emptiest space found in the entire competitive review. Schools broadcast
 * *to* parents (ClassDojo, ParentSquare, Remind). Portals serve students. Fee
 * lenders serve schools. The one mother-side product found anywhere is a
 * $9.99/month US assistant for affluent families. **Nobody serves the mother as
 * the operator of her child's school year** — and she is the one holding all of
 * it: fees, exam dates, RTE windows, scholarship deadlines, uniforms, documents.
 *
 * It is deadline-shaped, which means it earns its returns without a single
 * engagement gimmick; it plugs into the savings pot (a fee pot per child, per
 * term); and mothers at one school are already a circle.
 *
 * ── If something happens to me ──────────────────────────────────────────────
 * Widowhood, divorce, abandonment and migration are the moments a woman loses
 * her economic identity outright — accounts she cannot access, papers in someone
 * else's name, a shop that stops being hers. It happens to enormous numbers of
 * women and no platform anywhere prepares for it.
 *
 * ── Circle swap ─────────────────────────────────────────────────────────────
 * Resale marketplaces lose money at the ₹200 price point: fees eat sub-₹500
 * items alive and the whole operational load — sourcing, sizing, hygiene,
 * counterfeits, photography, returns — lands on the seller. But India already
 * has a working women-run second-hand economy: the Waghri *bartanwali* trade,
 * clothes bartered for steel utensils, door to door. Local, trust-based, no
 * logistics. That is the thing to build, not Poshmark.
 *
 * Mock data.
 */

/* ── the school year ─────────────────────────────────────────────────────── */

export type Child = {
  id: string;
  name: string;
  cls: string;
  school: string;
  /** Fee pot progress for this term. */
  feeMinor: number;
  savedMinor: number;
};

export const CHILDREN: Child[] = [
  { id: "k1", name: "Anaya", cls: "Class 4", school: "Govt. Primary, Sector 9", feeMinor: 0, savedMinor: 180000 },
  { id: "k2", name: "Vihaan", cls: "Class 8", school: "Saraswati Vidya Mandir", feeMinor: 840000, savedMinor: 520000 },
];

export type SchoolTask = {
  id: string;
  childId: string;
  what: string;
  detail: string;
  dueIn: number;
  kind: "fee" | "form" | "date" | "buy" | "paper";
  /** Money it will cost, when it costs money. */
  costMinor?: number;
  done: boolean;
};

export const SCHOOL_TASKS: SchoolTask[] = [
  { id: "t1", childId: "k2", what: "Second term fees", detail: "Late after the 10th, then ₹50 a day", dueIn: 6, kind: "fee", costMinor: 420000, done: false },
  { id: "t2", childId: "k1", what: "Scholarship renewal", detail: "Pre-matric — must be renewed every year or it stops", dueIn: 12, kind: "form", done: false },
  { id: "t3", childId: "k2", what: "Half-yearly exams begin", detail: "Nine days of exams. Do not book work you cannot leave", dueIn: 21, kind: "date", done: false },
  { id: "t4", childId: "k1", what: "New uniform", detail: "She has outgrown last year's — check the swap first", dueIn: 30, kind: "buy", costMinor: 90000, done: false },
  { id: "t5", childId: "k1", what: "RTE seat confirmation", detail: "Confirm the seat or it is offered to someone else", dueIn: 3, kind: "paper", done: false },
  { id: "t6", childId: "k2", what: "Bus pass renewal", detail: "Renewed for the year", dueIn: 0, kind: "fee", costMinor: 60000, done: true },
];

export const SCHOOL_KIND: Record<SchoolTask["kind"], { tint: string; ink: string; icon: string; label: string }> = {
  fee: { tint: "--ux-tint-amber", ink: "--ux-amber-ink", icon: "Wallet", label: "Money" },
  form: { tint: "--ux-tint-violet", ink: "--ux-violet", icon: "FileText", label: "A form" },
  date: { tint: "--ux-tint-blue", ink: "--ux-blue-ink", icon: "CalendarDays", label: "A date" },
  buy: { tint: "--ux-tint-pink", ink: "--ux-pink-ink", icon: "ShoppingBag", label: "To buy" },
  paper: { tint: "--ux-tint-green", ink: "--ux-green-ink", icon: "Stamp", label: "Paperwork" },
};

/* ── if something happens to me ──────────────────────────────────────────── */

export type Wish = {
  id: string;
  question: string;
  why: string;
  answer?: string;
  icon: string;
};

export const WISHES: Wish[] = [
  { id: "w1", question: "Who should be told first?", why: "So it is not left to whoever happens to be in the house", answer: "My sister, Sunita", icon: "PhoneCall" },
  { id: "w2", question: "Where are the papers?", why: "Aadhaar, bank book, the children's certificates", answer: "Steel almirah, top shelf, blue folder", icon: "FolderCheck" },
  { id: "w3", question: "Who continues the shop?", why: "So the machine and the customers do not simply stop", icon: "Store" },
  { id: "w4", question: "Who takes your place in the pot?", why: "The circle needs to know, or your months are lost", answer: "Sunita, and she knows", icon: "Coins" },
  { id: "w5", question: "Who looks after the children?", why: "Named, so nobody argues about it later", icon: "Baby" },
  { id: "w6", question: "What is in your name?", why: "Land, an account, a policy — most women never write this down", icon: "Landmark" },
];

/* ── circle swap ─────────────────────────────────────────────────────────── */

export type SwapItem = {
  id: string;
  what: string;
  from: string;
  size?: string;
  condition: "as new" | "good" | "worn but fine";
  /** Free, or swapped for something. Never a price. */
  wants: string;
  km: number;
  icon: string;
  tint: string;
  ink: string;
  taken: boolean;
};

export const SWAPS: SwapItem[] = [
  { id: "s1", what: "School uniform, girls", from: "Kavita Rao", size: "Class 3–4", condition: "good", wants: "Free — my daughter outgrew it", km: 0.6, icon: "Shirt", tint: "--ux-tint-blue", ink: "--ux-blue-ink", taken: false },
  { id: "s2", what: "Maternity kurtas ×3", from: "Meera Joshi", size: "M–L", condition: "as new", wants: "Anything for a 2-year-old", km: 1.1, icon: "Baby", tint: "--ux-tint-pink", ink: "--ux-pink-ink", taken: false },
  { id: "s3", what: "Steel tiffin boxes ×4", from: "Sunita Devi", condition: "good", wants: "Free", km: 0.3, icon: "UtensilsCrossed", tint: "--ux-tint-green", ink: "--ux-green-ink", taken: false },
  { id: "s4", what: "Festival lehenga", from: "Ananya Sharma", size: "Free size", condition: "as new", wants: "Borrow and return after Diwali", km: 1.8, icon: "Sparkles", tint: "--ux-tint-orange", ink: "--ux-orange-ink", taken: false },
  { id: "s5", what: "School shoes, black", from: "Radha Devi", size: "Size 4", condition: "worn but fine", wants: "Free", km: 0.9, icon: "Footprints", tint: "--ux-tint-violet", ink: "--ux-violet", taken: true },
];

/* ── derived ─────────────────────────────────────────────────────────────── */

export const schoolDue = (rows: SchoolTask[]) =>
  rows.filter((t) => !t.done).reduce((n, t) => n + (t.costMinor ?? 0), 0);
export const schoolSoon = (rows: SchoolTask[]) => rows.filter((t) => !t.done && t.dueIn <= 7).length;
export const wishesDone = (rows: Wish[]) => rows.filter((w) => w.answer).length;
