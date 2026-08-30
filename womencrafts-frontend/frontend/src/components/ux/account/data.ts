/**
 * Certificates, bookings and referrals.
 *
 * Small modules that share a shape: a list of things she has earned, booked or
 * shared. Grouped so they share one data file rather than three near-identical
 * ones.
 */

const A = (n: string) => `/ux/art/${n}.webp`;

export type Certificate = {
  id: string;
  title: string;
  issued: string;
  code: string;
  hours: number;
  /** The subject area — for the card's tint and filter, never a grade. */
  skill: string;
  /** Distinction / Merit / Pass, when the issuer awarded one. */
  grade?: string;
  tint: string;
  ink: string;
  verified: boolean;
};

export const CERTIFICATES: Certificate[] = [
  { id: "cf1", title: "Financial Literacy Essentials", issued: "12 May 2025", code: "WS-FL-1042",
    hours: 4, skill: "Money", tint: "--ux-tint-green", ink: "--ux-green", verified: true },
  { id: "cf2", title: "Communication Skills for Women", issued: "28 Aug 2025", code: "WS-CS-1877",
    hours: 5, skill: "Personal", tint: "--ux-tint-blue", ink: "--ux-blue", verified: true },
  { id: "cf3", title: "Sell your handmade work online", issued: "04 Feb 2026", code: "WS-HW-2291",
    hours: 6, skill: "Business", tint: "--ux-tint-orange", ink: "--ux-orange", verified: true },
  { id: "cf4", title: "Beauty & Salon Skills", issued: "12 Mar 2026", code: "WS-BS-2440",
    hours: 8, skill: "Trade", tint: "--ux-tint-pink", ink: "--ux-pink", verified: true },
];

export type BookingKind = "Mentor" | "Event" | "Workshop";
export type BookingState = "Confirmed" | "Waitlisted" | "Finished" | "Cancelled";

export type Booking = {
  id: string;
  what: string;
  kind: BookingKind;
  when: string;
  where: string;
  state: BookingState;
  ref: string;
  art: string;
  cost: string;
};

export const BOOKINGS: Booking[] = [
  { id: "bk1", what: "Mentor session — Neha Verma", kind: "Mentor" as const, when: "Mon 26 May, 11:00 AM",
    where: "Video call", state: "Confirmed" as const, ref: "WS-B-4471", art: A("avatar-woman-blazer"),
    cost: "Free first session" },
  { id: "bk2", what: "Craft Mela — Jaipur", kind: "Event" as const, when: "Sat 24 May, 10:00 AM",
    where: "Community Hall, Sector 12", state: "Confirmed" as const, ref: "WS-B-4402",
    art: A("course-handmade-market-stall"), cost: "₹300 stall fee · paid" },
  { id: "bk3", what: "Pricing your work properly", kind: "Workshop" as const, when: "Thu 29 May, 4:00 PM",
    where: "WomSakhi Centre, Jaipur", state: "Waitlisted" as const, ref: "WS-B-4488",
    art: A("course-counting-coins-calculator"), cost: "Free" },
  { id: "bk4", what: "Mentor session — Kavita Shah", kind: "Mentor" as const, when: "12 May, 4:00 PM",
    where: "Video call", state: "Finished" as const, ref: "WS-B-4210",
    art: A("avatar-woman-pink-glasses"), cost: "Free first session" },
];

export const REFERRALS = [
  { id: "r1", name: "Meera Joshi", joined: "18 May 2026", state: "Earning" as const,
    avatar: A("avatar-woman-blue-saree"), reward_minor: 25000, note: "She has made ₹8,400 so far" },
  { id: "r2", name: "Sunita Devi", joined: "2 Apr 2026", state: "Earning" as const,
    avatar: A("avatar-woman-elder-saree"), reward_minor: 25000, note: "Her first mela was last week" },
  { id: "r3", name: "Farah Khan", joined: "14 Mar 2026", state: "Joined" as const,
    avatar: A("avatar-woman-teal-shirt"), reward_minor: 0, note: "Still finding her feet" },
];

export const REFER = {
  code: "PRIYA2026",
  link: "womsakhi.in/join/PRIYA2026",
  reward_minor: 25000,
  condition: "when she finishes her first course",
  earned_minor: 50000,
};

export const ACCOUNT_ART = {
  certificate: A("course-holding-certificate"),
  refer: A("scene-two-women-support"),
  empty: A("empty-gift-box-ribbons"),
  safe: A("icon-padlock"),
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
