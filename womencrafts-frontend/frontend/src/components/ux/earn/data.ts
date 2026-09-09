/**
 * The Earn module's seller surfaces — her shop, seen from behind the counter.
 *
 * ── Mock, and saying so ─────────────────────────────────────────────────────
 * The API carries listings, orders and a shop summary; it does NOT carry a
 * SKU, a per-listing order count, a draft state, a highlight list, a category
 * tree, or anything at all about custom quotes. Those are the fields these
 * screens are drawn around, so they live here until the backend has them, and
 * every screen that uses them shows `SourceNote` so she is never told a made-up
 * number is hers.
 *
 * When the endpoints land, the shape below is what to return — it is written to
 * be the contract, not a placeholder.
 */

const A = (n: string) => `/ux/art/${n}.webp`;

/* ── What she sells ───────────────────────────────────────────────────────── */

export type ListingKind = "product" | "service";
export type ListingStatus = "active" | "paused" | "draft";

/** How a price is expressed. Three genuinely different sales conversations. */
export type PriceMode = "fixed" | "range" | "quote";

export interface SellerListing {
  id: string;
  kind: ListingKind;
  title: string;
  /** Her own code for it, printed on the order slip. */
  sku: string;
  addedOn: string;
  status: ListingStatus;
  priceMode: PriceMode;
  /** Whole rupees. Zero when the price is by quote. */
  price: number;
  /** What it used to cost, struck through beside the price. */
  wasPrice?: number;
  rangeLow?: number;
  rangeHigh?: number;
  /** Null for a service — a tailor has no stock, and 0 would read "sold out". */
  stock: number | null;
  views: number;
  orders: number;
  photo: string;
}

export const LISTINGS: SellerListing[] = [
  {
    id: "l1", kind: "product", title: "Handmade cotton kurta", sku: "WK-CK-001",
    addedOn: "13 Aug 2026", status: "active", priceMode: "fixed",
    price: 1400, wasPrice: 2000, stock: 50, views: 245, orders: 18,
    photo: A("course-photographing-handmade-product"),
  },
  {
    id: "l2", kind: "product", title: "Handloom saree", sku: "WK-HS-002",
    addedOn: "10 Aug 2026", status: "active", priceMode: "fixed",
    price: 2800, stock: 12, views: 189, orders: 7,
    photo: A("course-handmade-market-stall"),
  },
  {
    id: "l3", kind: "product", title: "Embroidered cushion covers (pair)", sku: "WK-CC-003",
    addedOn: "05 Aug 2026", status: "active", priceMode: "fixed",
    price: 800, stock: 30, views: 96, orders: 4,
    photo: A("scene-woman-packing-orders"),
  },
  {
    id: "l4", kind: "service", title: "Custom embroidery consultation", sku: "WK-SV-001",
    addedOn: "01 Aug 2026", status: "paused", priceMode: "quote",
    price: 0, stock: null, views: 42, orders: 0,
    photo: A("scene-woman-writing-notes"),
  },
];

/** Rupees off, as a whole number — only where there is something to be off. */
export const discountPct = (l: SellerListing) =>
  l.wasPrice && l.wasPrice > l.price ? Math.round((1 - l.price / l.wasPrice) * 100) : 0;

/* ── The wizard's vocabulary ──────────────────────────────────────────────── */

export const CATEGORIES: { id: string; label: string; subs: string[] }[] = [
  { id: "clothing",  label: "Clothing and stitching", subs: ["Kurtas and suits", "Sarees", "Blouses", "Children's clothes", "Alterations"] },
  { id: "home",      label: "Home and décor",         subs: ["Cushion covers", "Bed linen", "Curtains", "Wall hangings"] },
  { id: "food",      label: "Food from home",         subs: ["Pickles and papad", "Snacks", "Tiffin service", "Baking"] },
  { id: "beauty",    label: "Beauty and mehendi",     subs: ["Mehendi", "Threading and facial", "Bridal packages"] },
  { id: "teaching",  label: "Teaching and classes",   subs: ["Tuition", "Craft classes", "Music and dance"] },
  { id: "care",      label: "Care and help",          subs: ["Childcare", "Elder care", "House help"] },
];

/** Two-word claims a buyer can check. Not adjectives about her. */
export const HIGHLIGHTS = [
  "Handmade", "Eco-friendly", "Customisable", "Premium quality",
  "Fast delivery", "Unique design", "Made to order", "Natural material",
];

/**
 * Price bands, with what each one is FOR.
 *
 * The band is a starting point, not a rule — the wireframe's "Most popular"
 * badge is on the band most women here actually sell in, which is the useful
 * thing to know when you have never priced your own work.
 */
export const PRICE_BANDS = [
  { id: "b1", label: "Below ₹500",       note: "Small items, first sales",   low: 0,     high: 500,   icon: "Tag" },
  { id: "b2", label: "₹500 – ₹1,000",    note: "Good place to begin",        low: 500,   high: 1000,  icon: "Coins" },
  { id: "b3", label: "₹1,000 – ₹2,500",  note: "Where most women here sell", low: 1000,  high: 2500,  icon: "TrendingUp", popular: true },
  { id: "b4", label: "₹2,500 – ₹5,000",  note: "Detailed or bespoke work",   low: 2500,  high: 5000,  icon: "Crown" },
  { id: "b5", label: "₹5,000 – ₹10,000", note: "High value, fewer orders",   low: 5000,  high: 10000, icon: "Gem" },
  { id: "b6", label: "Above ₹10,000",    note: "Bridal and large contracts", low: 10000, high: 0,     icon: "Star" },
];

export const PROCESSING_TIMES = ["Same day", "1–2 days", "3–5 days", "About a week", "Two weeks or more"];
export const PRICE_TYPES = ["Per piece", "Per set", "Per hour", "Per day", "Per month"];
export const RESPONSE_TIMES = ["Within a few hours", "Within 24 hours", "Within 2 days", "Within a week"];

/** What she can ask a buyer for before quoting. Each one is a real question. */
export const QUOTE_FIELDS = [
  { id: "needs",  label: "What exactly they need",   on: true },
  { id: "budget", label: "What they can spend",       on: true },
  { id: "when",   label: "When they need it by",      on: true },
  { id: "where",  label: "Where it has to reach",     on: false },
  { id: "refs",   label: "Pictures of what they want", on: true },
];

/* ── The buyer's side of a quote ──────────────────────────────────────────── */

/**
 * The four extras a buyer ticks, in the buyer's words.
 *
 * Deliberately not the same list as `QUOTE_FIELDS`: those are things the
 * SELLER demands, these are things the BUYER volunteers. Merging them would
 * make a seller who wants a delivery address also demand to know whether the
 * order is wholesale.
 */
export const QUOTE_ASK = [
  "I have a specific design, colour or size in mind",
  "I want it customised — a name or a logo on it",
  "This is a bulk or wholesale order",
  "I would like a sample before the full order",
];

/** What the quote drawer hands the confirmation screen. Nothing is stored. */
export interface QuoteDraft {
  title: string;
  photo?: string;
  seller: string;
  needs: string;
  quantity: string;
  budgetLow: string;
  budgetHigh: string;
  by: string;
  place: string;
  extras: string[];
  name: string;
  email: string;
  phone: string;
}


export interface QuoteRequest {
  id: string;
  /** Whose shop it went to. A screen that says "By the seller" is unfinished. */
  seller: string;
  listingId: string;
  quantity: number;
  budgetLow?: number;
  budgetHigh?: number;
  by?: string;
  place: string;
  notes: string[];
  sentOn: string;
}

export const SENT_QUOTE: QuoteRequest = {
  id: "WSQ-2026-00124",
  seller: "Priya Sharma",
  listingId: "l1",
  quantity: 20,
  budgetLow: 1000,
  budgetHigh: 2500,
  by: "15 Sep 2026",
  place: "Hyderabad, Telangana",
  notes: ["Custom embroidery design, pastel colours", "Sample needed before the full order"],
  sentOn: "9 Sep 2026",
};

export const EARN_ART = {
  hero: A("scene-woman-shop-owner"),
  thanks: A("scene-women-celebrating"),
  grow: A("scene-woman-planning-board"),
  empty: A("empty-magnifying-glass-blank-page"),
};
