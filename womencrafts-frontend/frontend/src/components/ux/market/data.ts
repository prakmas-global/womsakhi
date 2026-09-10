/**
 * The market — the buyer side, and the half that was missing.
 *
 * ── Why this had to exist ───────────────────────────────────────────────────
 * Everything else in the shop batch is seller-side: listing, pricing,
 * pre-orders, subscriptions. But a marketplace where everyone is a seller and
 * nobody is a buyer dies. Her items have to be *bought*, by someone, and the
 * research is blunt about who that someone is: a nationwide randomised
 * evaluation of rural e-commerce found "little evidence for income gains to
 * rural producers", and J-PAL's review of fifteen trials found limited benefit
 * to small firms on a platform, because a crowded market of strangers made it
 * impossible to stand out.
 *
 * What *did* work was matching a producer to a specific committed buyer.
 *
 * ── So this is not an Amazon clone ──────────────────────────────────────────
 * The ordering is the product. **Her circle first, then women she has bought
 * from before, then near her, then everyone else** — because the only advantage
 * this market has over a listings page is that the buyer and seller already
 * know each other, or know someone who does. Strip that out and it is a worse
 * Meesho.
 *
 * ── Two rules the research imposes ──────────────────────────────────────────
 * **No stars.** Most micro-sellers have too few ratings for stars to mean
 * anything and displayed ratings are biased upward. Rank on what buyers do NOT
 * do — repeat purchase, absence of complaint.
 *
 * **Payout day matters.** No product anywhere connects a savings pot to a
 * marketplace of the same members, and payout day is the highest-intent
 * purchase moment there is. It is surfaced — opt-in, never a nudge, because
 * steering her to spend her pot would destroy the pot.
 *
 * Mock data.
 */

export type Seller = {
  id: string;
  name: string;
  trade: string;
  /** How close she is to the buyer socially — this drives the ordering. */
  tie: "circle" | "bought-before" | "near" | "wider";
  km: number;
  /** The quiet signals, in place of stars. */
  repeatBuyers: number;
  complaints: number;
  ordersDone: number;
  /** Whether she is open right now — closing costs her nothing. */
  open: boolean;
};

export const SELLERS: Seller[] = [
  { id: "v1", name: "Sunita Devi", trade: "Tailoring", tie: "circle", km: 0.4, repeatBuyers: 9, complaints: 0, ordersDone: 64, open: true },
  { id: "v2", name: "Farida", trade: "Pickles and papad", tie: "circle", km: 1.6, repeatBuyers: 12, complaints: 0, ordersDone: 88, open: true },
  { id: "v3", name: "Kavita Rao", trade: "Embroidery", tie: "bought-before", km: 0.9, repeatBuyers: 6, complaints: 0, ordersDone: 41, open: true },
  { id: "v4", name: "Rekha", trade: "Vegetables", tie: "circle", km: 0.4, repeatBuyers: 21, complaints: 1, ordersDone: 210, open: true },
  { id: "v5", name: "Nasreen", trade: "Tuition, class 5–8", tie: "near", km: 0.9, repeatBuyers: 4, complaints: 0, ordersDone: 18, open: true },
  { id: "v6", name: "Anjali", trade: "Bags and pouches", tie: "near", km: 2.4, repeatBuyers: 2, complaints: 0, ordersDone: 11, open: false },
  { id: "v7", name: "Meena Kumari", trade: "Terracotta", tie: "wider", km: 14, repeatBuyers: 7, complaints: 0, ordersDone: 52, open: true },
];

export type Item = {
  id: string;
  sellerId: string;
  title: string;
  detail: string;
  minor: number;
  /** A service is booked, a product is bought, a food item is subscribed. */
  kind: "product" | "service" | "food";
  /** She makes it after you order — no stock held, buyer funds the materials. */
  madeToOrder: boolean;
  /** Only meaningful for products she keeps in hand. */
  stock: number | null;
  photo: string;
  icon: string;
  tint: string;
  ink: string;
  /** Bought by women you know — the strongest signal in a trust market. */
  boughtByCircle: number;
};

const A = (n: string) => `/ux/art/${n}.webp`;

export const ITEMS: Item[] = [
  { id: "i1", sellerId: "v1", title: "Blouse, stitched to measure", detail: "Cotton or silk, your cloth or hers", minor: 42000, kind: "service", madeToOrder: true, stock: null, photo: A("tailor"), icon: "Scissors", tint: "--ux-tint-pink", ink: "--ux-pink-ink", boughtByCircle: 6 },
  { id: "i2", sellerId: "v2", title: "Mango pickle, 500g", detail: "Her mother's recipe. Made this month", minor: 18000, kind: "food", madeToOrder: false, stock: 14, photo: A("pickle"), icon: "UtensilsCrossed", tint: "--ux-tint-orange", ink: "--ux-orange-ink", boughtByCircle: 9 },
  { id: "i3", sellerId: "v3", title: "Embroidered cushion covers, pair", detail: "Hand-worked, takes four days", minor: 99500, kind: "product", madeToOrder: true, stock: null, photo: A("cushion"), icon: "Sparkles", tint: "--ux-tint-violet", ink: "--ux-violet", boughtByCircle: 3 },
  { id: "i4", sellerId: "v4", title: "Vegetables, weekly basket", detail: "Whatever is good that week, delivered Tuesday", minor: 32000, kind: "food", madeToOrder: false, stock: null, photo: A("veg"), icon: "Carrot", tint: "--ux-tint-green", ink: "--ux-green-ink", boughtByCircle: 11 },
  { id: "i5", sellerId: "v5", title: "Maths tuition, one month", detail: "Four evenings a week, at her house", minor: 60000, kind: "service", madeToOrder: false, stock: null, photo: A("tuition"), icon: "BookOpen", tint: "--ux-tint-blue", ink: "--ux-blue-ink", boughtByCircle: 2 },
  { id: "i6", sellerId: "v6", title: "Cotton shoulder bag", detail: "Block printed, holds a laptop", minor: 45000, kind: "product", madeToOrder: false, stock: 3, photo: A("bag"), icon: "ShoppingBag", tint: "--ux-tint-amber", ink: "--ux-amber-ink", boughtByCircle: 0 },
  { id: "i7", sellerId: "v7", title: "Terracotta water pot", detail: "Keeps water cold without electricity", minor: 38000, kind: "product", madeToOrder: false, stock: 6, photo: A("pot"), icon: "Package", tint: "--ux-surface-2", ink: "--ux-muted", boughtByCircle: 1 },
  { id: "i8", sellerId: "v1", title: "Saree fall and pico", detail: "Same day if you bring it before noon", minor: 8000, kind: "service", madeToOrder: false, stock: null, photo: A("tailor"), icon: "Scissors", tint: "--ux-tint-pink", ink: "--ux-pink-ink", boughtByCircle: 8 },
];

/* ── ordering ────────────────────────────────────────────────────────────── */

const TIE_WEIGHT: Record<Seller["tie"], number> = {
  circle: 400, "bought-before": 300, near: 150, wider: 0,
};

export const TIE_LABEL: Record<Seller["tie"], string> = {
  circle: "In your circle",
  "bought-before": "You have bought from her",
  near: "Near you",
  wider: "Further away",
};

/**
 * Rank on silence, not stars.
 *
 * Repeat buyers and the absence of complaint are richer signals than a rating
 * and are available from the very first order. Social tie dominates everything
 * else, because that is the only thing this market has that a listings page
 * does not.
 */
export const rank = (item: Item, seller: Seller) =>
  TIE_WEIGHT[seller.tie]
  + seller.repeatBuyers * 6
  + item.boughtByCircle * 10
  + Math.min(seller.ordersDone, 100)
  - seller.complaints * 60
  - Math.min(seller.km * 4, 40)
  - (seller.open ? 0 : 200);

export const sellerOf = (item: Item) => SELLERS.find((s) => s.id === item.sellerId)!;

export const sortedItems = () =>
  [...ITEMS].sort((a, b) => rank(b, sellerOf(b)) - rank(a, sellerOf(a)));

/** The pot payout, if one is due. Surfaced, never pushed. */
export const POT_PAYOUT = { due: true, whenText: "in 6 days", minor: 400000 };
