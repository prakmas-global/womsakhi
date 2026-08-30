/**
 * Circle — savings circles and community groups.
 *
 * Two different things share this word in the product, and keeping them apart
 * matters: a SAVINGS circle is money (a rotating fund — everyone pays in each
 * month, one member takes the pot), a COMMUNITY circle is people. Confusing
 * them would be confusing a chat group with a financial commitment.
 */

const A = (n: string) => `/ux/art/${n}.webp`;

export type CircleKind = "Savings" | "Community" | "Trade";

export type Circle = {
  id: string;
  name: string;
  kind: CircleKind;
  members: number;
  place: string;
  art: string;
  tint: string;
  ink: string;
  icon: string;
  blurb: string;
  activity: string;
  joined: boolean;
  /* savings circles only */
  monthly_minor?: number;
  pot_minor?: number;
  myTurn?: number;      // which month is hers
  currentMonth?: number;
  totalMonths?: number;
};

export const MY_CIRCLES: Circle[] = [
  {
    id: "c1", name: "Jaipur Savings Circle", kind: "Savings", members: 12, place: "Jaipur, Rajasthan",
    art: A("scene-women-group-circle"), tint: "--ux-tint-green", ink: "--ux-green", icon: "PiggyBank",
    blurb: "Twelve women, ₹500 a month each. One of us takes the pot every month.",
    activity: "Next collection on 1 June",
    joined: true, monthly_minor: 50000, pot_minor: 600000,
    myTurn: 9, currentMonth: 5, totalMonths: 12,
  },
  {
    id: "c2", name: "Women Entrepreneurs India", kind: "Community", members: 12500, place: "Online",
    art: A("scene-women-celebrating"), tint: "--ux-tint-pink", ink: "--ux-pink", icon: "UsersRound",
    blurb: "Ask anything about running a business. Someone has usually been there.",
    activity: "34 messages today", joined: true,
  },
  {
    id: "c3", name: "Tailors of Sector 12", kind: "Trade", members: 28, place: "Jaipur, Sector 12",
    art: A("course-sewing-machine"), tint: "--ux-tint-orange", ink: "--ux-orange", icon: "Scissors",
    blurb: "We share bulk orders none of us could take alone.",
    activity: "2 orders looking for hands", joined: true,
  },
];

export const CIRCLE_POSTS = [
  { id: "m1", who: "Meera Joshi", avatar: A("avatar-woman-blue-saree"), when: "2 hours ago",
    text: "The June collection date moved to the 1st. Please keep it ready by then.", pinned: true, replies: 4 },
  { id: "m2", who: "Sunita Devi", avatar: A("avatar-woman-elder-saree"), when: "Yesterday",
    text: "My turn was such a relief — the pot paid for my daughter's fees in one go.", pinned: false, replies: 11 },
  { id: "m3", who: "Kavita Shah", avatar: A("avatar-woman-pink-glasses"), when: "3 days ago",
    text: "Sharing the receipt format I use, in case it helps anyone with their books.", pinned: false, replies: 6 },
];

export const CIRCLE_KINDS: CircleKind[] = ["Savings", "Community", "Trade"];

export const CIRCLE_ART = {
  empty: A("empty-gift-box-ribbons"),
  invite: A("scene-two-women-support"),
  savings: A("scene-woman-planting-sapling"),
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

/** "12.5k members" reads better than "12500 members" at a glance. */
export const memberCount = (n: number) =>
  n >= 1000 ? `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k` : `${n}`;
