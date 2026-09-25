/**
 * My Business — her shop, her orders, her paperwork.
 *
 * Money in minor units, same as the Money module: this screen and the wallet
 * describe the same rupees, and two formatters would eventually disagree.
 */

const A = (n: string) => `/ux/art/${n}.webp`;

export type OrderState = "New" | "Making" | "Ready" | "Sent" | "Done" | "Cancelled";

export type ShopOrder = {
  id: string;
  ref: string;
  buyer: string;
  item: string;
  qty: number;
  amount_minor: number;
  state: OrderState;
  when: string;
  due: string;
  channel: "Shop" | "WhatsApp" | "Mela" | "Repeat";
  art: string;
};

export const ORDERS: ShopOrder[] = [
  { id: "s1", ref: "#1042", buyer: "Anjali Mehta", item: "Blue cotton kurta, size M", qty: 2,
    amount_minor: 240000, state: "New", when: "20 min ago", due: "Due in 6 days",
    channel: "Shop", art: A("course-sewing-machine") },
  { id: "s2", ref: "#1041", buyer: "Rekha Nair", item: "Embroidered cushion covers", qty: 6,
    amount_minor: 420000, state: "Making", when: "Yesterday", due: "Due in 3 days",
    channel: "WhatsApp", art: A("course-handmade-market-stall") },
  { id: "s3", ref: "#1040", buyer: "Sunita Devi", item: "Festive blouse, custom fit", qty: 1,
    amount_minor: 95000, state: "Ready", when: "2 days ago", due: "Pick up today",
    channel: "Repeat", art: A("course-photographing-handmade-product") },
  { id: "s4", ref: "#1038", buyer: "Priyanka Roy", item: "Cotton tote bags", qty: 12,
    amount_minor: 360000, state: "Sent", when: "4 days ago", due: "Delivered 18 May",
    channel: "Mela", art: A("course-cooking-packing-orders") },
  { id: "s5", ref: "#1035", buyer: "Farah Khan", item: "Table runner set", qty: 3,
    amount_minor: 180000, state: "Done", when: "1 week ago", due: "Paid in full",
    channel: "Shop", art: A("course-handmade-market-stall") },
  { id: "s6", ref: "#1031", buyer: "Divya Menon", item: "Kids frock, size 4", qty: 1,
    amount_minor: 70000, state: "Cancelled", when: "2 weeks ago", due: "Buyer changed her mind",
    channel: "Shop", art: A("course-sewing-machine") },
];

export const PRODUCTS = [
  { id: "p1", name: "Cotton kurta", price_minor: 120000, stock: 8, sold: 34,
    art: A("course-sewing-machine"), live: true },
  { id: "p2", name: "Embroidered cushion cover", price_minor: 70000, stock: 22, sold: 61,
    art: A("course-handmade-market-stall"), live: true },
  { id: "p3", name: "Cotton tote bag", price_minor: 30000, stock: 0, sold: 88,
    art: A("course-photographing-handmade-product"), live: true },
  { id: "p4", name: "Table runner", price_minor: 60000, stock: 5, sold: 12,
    art: A("course-cooking-packing-orders"), live: false },
];

/**
 * Services she offers — her time and skill, rather than a thing in a box.
 *
 * Kept separate from PRODUCTS because the questions differ. A product has stock
 * and a price; a service has a rate, a place it happens, and how far she will
 * travel. Forcing both into one shape would ask a tailor how many haircuts she
 * has in stock.
 *
 * This is how most women on WomSakhi actually earn — beauty, tuition, tailoring
 * to measure, cooking, childcare — and until now there was no way to list any
 * of it.
 */
export type RateKind = "per hour" | "per visit" | "per piece" | "per month";

export type Service = {
  id: string;
  name: string;
  category: string;
  rate_minor: number;
  rateKind: RateKind;
  where: "At her place" | "At your place" | "Either" | "Online";
  travelKm: number;
  mins: number;
  about: string;
  art: string;
  live: boolean;
  booked: number;
  rating: string;
};

export const SERVICES: Service[] = [
  { id: "sv1", name: "Blouse stitched to measure", category: "Tailoring",
    rate_minor: 45000, rateKind: "per piece", where: "At her place", travelKm: 0, mins: 45,
    about: "Measured, cut and finished. Bring your own cloth or I can source it.",
    art: A("course-sewing-machine"), live: true, booked: 62, rating: "4.9" },
  { id: "sv2", name: "Mehendi for weddings", category: "Beauty",
    rate_minor: 150000, rateKind: "per visit", where: "At your place", travelKm: 12, mins: 180,
    about: "Bridal and guest designs. I bring everything.",
    art: A("scene-woman-vendor-handing-parcel"), live: true, booked: 24, rating: "5.0" },
  { id: "sv3", name: "Home tuition, classes 4 to 8", category: "Teaching",
    rate_minor: 60000, rateKind: "per month", where: "Either", travelKm: 5, mins: 60,
    about: "Maths and science, three evenings a week. Hindi or English.",
    art: A("scene-woman-teaching-children"), live: false, booked: 8, rating: "4.8" },
];

export const SERVICE_CATEGORIES = [
  "Tailoring", "Beauty", "Teaching", "Cooking", "Childcare", "Cleaning", "Repairs", "Other",
];

export const RATE_KINDS: RateKind[] = ["per hour", "per visit", "per piece", "per month"];

export const REVIEWS = [
  { id: "rv1", who: "Anjali Mehta", avatar: A("avatar-woman-pink-glasses"), stars: 5,
    when: "3 days ago", what: "Blouse stitched to measure",
    text: "The fit was perfect first time, and she finished a day early." },
  { id: "rv2", who: "Rekha Nair", avatar: A("avatar-woman-blue-saree"), stars: 5,
    when: "2 weeks ago", what: "Embroidered cushion covers",
    text: "Beautiful work. She sent photos before finishing so I could choose the thread." },
  { id: "rv3", who: "Farah Khan", avatar: A("avatar-woman-teal-shirt"), stars: 4,
    when: "1 month ago", what: "Cotton tote bags",
    text: "Good quality and a fair price. Delivery took two days longer than she said." },
];

/** The paperwork a small business is asked for, and where each one stands. */
export const DOCUMENTS = [
  { id: "d1", name: "Aadhaar", status: "verified" as const, when: "Verified 14 Mar 2026",
    icon: "IdCard", tint: "--ux-tint-green", ink: "--ux-green" },
  { id: "d2", name: "PAN card", status: "verified" as const, when: "Verified 14 Mar 2026",
    icon: "CreditCard", tint: "--ux-tint-green", ink: "--ux-green" },
  { id: "d3", name: "Bank passbook", status: "verified" as const, when: "Verified 2 Apr 2026",
    icon: "Landmark", tint: "--ux-tint-green", ink: "--ux-green" },
  { id: "d4", name: "Udyam registration", status: "missing" as const, when: "Not added yet",
    icon: "Building2", tint: "--ux-tint-orange", ink: "--ux-orange" },
  { id: "d5", name: "GST certificate", status: "optional" as const, when: "Only if you cross ₹40 lakh a year",
    icon: "FileText", tint: "--ux-surface-2", ink: "--ux-muted" },
];

export const SHOP = {
  name: "Priya's Handloom",
  handle: "womsakhi.com/priyas-handloom",
  rating: "4.9",
  reviews: 47,
  followers: 312,
  views30: 1840,
  since: "March 2025",
  art: A("scene-woman-shop-owner"),
};

export const WEEK_DAYS = ["M", "T", "W", "T", "F", "S", "S"];

export const ORDER_STATES: OrderState[] = ["New", "Making", "Ready", "Sent", "Done", "Cancelled"];

export const STATE_TONE: Record<OrderState, { pill: "brand" | "orange" | "green" | "blue" | "neutral"; next?: string }> = {
  New:       { pill: "brand",   next: "Start making" },
  Making:    { pill: "orange",  next: "Mark ready" },
  Ready:     { pill: "green",   next: "Mark sent" },
  Sent:      { pill: "blue",    next: "Mark done" },
  Done:      { pill: "neutral" },
  Cancelled: { pill: "neutral" },
};

export const SHOP_ART = {
  empty: A("empty-gift-box-ribbons"),
  packing: A("scene-woman-packing-orders"),
  notify: A("scene-woman-order-notification"),
  stall: A("course-handmade-market-stall"),
};

/**
 * Formatting money lives in `kit/money`, not here.
 *
 * There were seven copies of this function across seven data files, and they
 * had already drifted: one of them returned "Free" for zero and the others
 * returned "₹0". Re-exported rather than deleted so nothing has to change its
 * imports, but there is one implementation now.
 */
export { formatMoney as rupees } from "../kit/money";
