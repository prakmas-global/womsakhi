/**
 * Money & Wallet — mock data.
 *
 * Shaped to `WalletResponse`/`WalletTxn` in `lib/wallet-api` and `Order` in
 * `lib/member-api`, so connecting this up is a change of source, not a rewrite.
 *
 * Every amount is held in MINOR units (paise) and formatted at the edge. This
 * is not pedantry: ₹1,250.50 as a float is 125050 paise exactly, and as a
 * float it is 1250.4999999999998. Money that is one paisa out on a screen a
 * woman uses to run her business is a bug that destroys trust in everything
 * else on the page.
 */

const A = (n: string) => `/ux/art/${n}.webp`;

export type TxnKind = "credit" | "debit";
export type TxnStatus = "settled" | "pending" | "failed";

export type Txn = {
  id: string;
  kind: TxnKind;
  label: string;
  source: string;
  amount_minor: number;
  when: string;
  day: string;
  status: TxnStatus;
  icon: string;
  tint: string;
  ink: string;
  category: "Work" | "Course" | "Circle" | "Withdrawal" | "Refund";
};

export const BALANCE_MINOR = 2435000;      // ₹24,350
export const PENDING_MINOR = 420000;       // ₹4,200 on its way

/**
 * Not a fixture any more — a shape.
 *
 * `/app/payments` and `/app/wallet/withdraw` both read her real payout methods
 * from `usePayoutMethods()`. This stays because `PayoutMethod` in `parts.tsx`
 * derives its prop type from it — `(typeof import("./data"))["PAYOUT_METHODS"]
 * [number]` — so deleting it as an unused constant breaks a component that is
 * very much in use. If you are giving these a real interface, put it in
 * `lib/wallet-api.ts` beside the call that returns them and point both here.
 */
export const PAYOUT_METHODS = [
  { id: "m1", kind: "Bank", label: "HDFC Bank", detail: "•••• 4821", icon: "Landmark",
    tint: "--ux-tint-blue", ink: "--ux-blue", primary: true, verified: true },
  { id: "m2", kind: "UPI", label: "priya@okhdfcbank", detail: "UPI ID", icon: "Smartphone",
    tint: "--ux-tint-violet", ink: "--ux-violet", primary: false, verified: true },
];
export const TXNS: Txn[] = [
  { id: "t1", kind: "credit", label: "BrandStory — October work", source: "Client payment",
    amount_minor: 420000, when: "Today, 9:12 AM", day: "Today", status: "pending",
    icon: "Briefcase", tint: "--ux-tint-green", ink: "--ux-green", category: "Work" },
  { id: "t2", kind: "credit", label: "Rangoli Boutique — 12 pieces", source: "Order payment",
    amount_minor: 960000, when: "Yesterday, 6:40 PM", day: "Yesterday", status: "settled",
    icon: "Scissors", tint: "--ux-tint-orange", ink: "--ux-orange", category: "Work" },
  { id: "t3", kind: "debit", label: "Withdrawn to HDFC ••4821", source: "Bank transfer",
    amount_minor: 500000, when: "Yesterday, 11:02 AM", day: "Yesterday", status: "settled",
    icon: "Landmark", tint: "--ux-tint-blue", ink: "--ux-blue", category: "Withdrawal" },
  { id: "t4", kind: "credit", label: "Referral bonus — Meera joined", source: "WomSakhi",
    amount_minor: 25000, when: "18 May", day: "This week", status: "settled",
    icon: "Gift", tint: "--ux-tint-violet", ink: "--ux-violet", category: "Circle" },
  { id: "t5", kind: "debit", label: "Digital Marketing Mastery", source: "Course fee",
    amount_minor: 99900, when: "16 May", day: "This week", status: "settled",
    icon: "BookOpen", tint: "--ux-tint-violet", ink: "--ux-violet", category: "Course" },
  { id: "t6", kind: "credit", label: "Savings circle payout", source: "Jaipur Circle",
    amount_minor: 1200000, when: "12 May", day: "Earlier", status: "settled",
    icon: "UsersRound", tint: "--ux-tint-pink", ink: "--ux-pink", category: "Circle" },
  { id: "t7", kind: "debit", label: "Withdrawn to HDFC ••4821", source: "Bank transfer",
    amount_minor: 800000, when: "8 May", day: "Earlier", status: "settled",
    icon: "Landmark", tint: "--ux-tint-blue", ink: "--ux-blue", category: "Withdrawal" },
  { id: "t8", kind: "credit", label: "TechNova — retainer", source: "Client payment",
    amount_minor: 300000, when: "2 May", day: "Earlier", status: "failed",
    icon: "Briefcase", tint: "--ux-tint-green", ink: "--ux-green", category: "Work" },
];

export const MONEY_ART = {
  empty: A("empty-desk-closed-laptop-plant"),
  withdraw: A("scene-woman-vendor-handing-parcel"),
  grow: A("scene-woman-planting-sapling"),
  counting: A("course-counting-coins-calculator"),
};

/* ── formatting, in one place ─────────────────────────────────────────── */

/** Whole rupees: ₹24,350. Minor units in, a label out — never the other way. */
/**
 * Formatting money lives in `kit/money`, not here.
 *
 * There were seven copies of this function across seven data files, and they
 * had already drifted: one of them returned "Free" for zero and the others
 * returned "₹0". Re-exported rather than deleted so nothing has to change its
 * imports, but there is one implementation now.
 */
export { formatMoney as rupees } from "../kit/money";

import { formatMoney } from "../kit/money";

/** With paise, for a single transaction where the exact figure matters. */
export const rupeesExact = (minor: number) =>
  `₹${(minor / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const signed = (t: Txn) => `${t.kind === "credit" ? "+" : "−"}${formatMoney(t.amount_minor)}`;

export const TXN_FILTERS = ["All", "Money in", "Money out", "Pending"] as const;
