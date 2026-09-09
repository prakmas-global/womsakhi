/**
 * Discover, and her goals.
 *
 * ── Discover is not a search page ───────────────────────────────────────────
 * Search answers a question she already has. Discover is for the much more
 * common case where she does not know what to ask — which is most women, most
 * of the time, on a platform with this many capabilities.
 *
 * It is also NOT a social feed. An infinite scroll of other women's wins is a
 * comparison machine, and the research on this user base is unambiguous that
 * comparison is not the lever: exposure to *someone like her doing a specific
 * thing* is. So everything here is anchored to a named woman, a real distance,
 * or a stated reason — never "trending".
 *
 * ── Why every card carries a `because` ──────────────────────────────────────
 * "Recommended for you" with no reason is indistinguishable from an
 * advertisement. Each row says what about HER produced it. If a reason cannot
 * be written, the row should not exist.
 */

export type DiscoverKind = "skill" | "woman" | "circle" | "opportunity" | "course" | "event";

export interface DiscoverItem {
  id: string;
  kind: DiscoverKind;
  title: string;
  detail: string;
  /** Why this reached her. Required — see the note above. */
  because: string;
  meta: string;
  href: string;
  icon: string;
  tint: string;
  ink: string;
  /**
   * A photograph, where the row is about a person or a trade.
   *
   * A face is the whole mechanism here: the evidence for this user base is that
   * seeing *a named woman like her doing one specific thing* moves people, and
   * an icon in a tinted square is not that. Icons stay as the fallback for rows
   * that are about a thing rather than a person.
   */
  photo?: string;
  /** A two-word reason the row is worth her time — "Higher income". */
  badge?: string;
  /** How far, said on its own line so it can be scanned down a column. */
  away?: string;
}

/** Women a step or two ahead, in her trade — the exposure effect, not a leaderboard. */
export const NEARBY_WOMEN: DiscoverItem[] = [
  { id: "w1", kind: "woman", title: "Sunita Devi", detail: "Tailoring · 11 years", away: "2 km away",
    because: "She does what you do, in your area, and has taken bulk orders",
    meta: "Has helped 9 women", href: "/app/mentors", icon: "UserRoundCheck",
    photo: "/ux/art/avatar-woman-elder-saree.webp",
    tint: "--ux-tint-pink", ink: "--ux-pink-ink" },
  { id: "w2", kind: "woman", title: "Radha Menon", detail: "Tuition · 5 years", away: "4 km away",
    because: "She started after a career break, like you are considering",
    meta: "Teaches 14 children", href: "/app/mentors", icon: "GraduationCap",
    photo: "/ux/art/avatar-woman-blue-saree.webp",
    tint: "--ux-tint-blue", ink: "--ux-blue-ink" },
  { id: "w3", kind: "woman", title: "Lakshmi Bai", detail: "Pickles and papad · 7 years", away: "6 km away",
    because: "She sells food from home with the ₹100 licence you were reading about",
    meta: "42 regular customers", href: "/app/kitchen", icon: "ChefHat",
    photo: "/ux/art/avatar-woman-purple-kurta.webp",
    tint: "--ux-tint-amber", ink: "--ux-amber-ink" },
  { id: "w4", kind: "woman", title: "Ayesha Khan", detail: "Beautician · 6 years", away: "3 km away",
    because: "She moved from a small town and now has a steady client base",
    meta: "60 regulars", href: "/app/mentors", icon: "Sparkles",
    photo: "/ux/art/avatar-woman-hijab.webp",
    tint: "--ux-tint-violet", ink: "--ux-violet-ink" },
];

/** Trades women near her moved INTO and earned more. Exposure, not advice. */
export const CROSSINGS: DiscoverItem[] = [
  { id: "c1", kind: "skill", title: "Bridal mehendi services", detail: "Women who added this earn about 2× more",
    because: "You already do simple mehendi — this is the same skill, priced differently",
    meta: "3 women in your circle do it", href: "/app/programs", icon: "Sparkles",
    photo: "/ux/art/course-handmade-market-stall.webp", badge: "Higher income",
    tint: "--ux-tint-violet", ink: "--ux-violet" },
  { id: "c2", kind: "skill", title: "School uniforms", detail: "Regular orders every June and December",
    because: "You stitch blouses. Uniforms are the same machine, bigger orders",
    meta: "One school near you orders 120 sets", href: "/app/contracts", icon: "Shirt",
    photo: "/ux/art/course-presenting-to-group.webp", badge: "Steady demand",
    tint: "--ux-tint-blue", ink: "--ux-blue-ink" },
  { id: "c3", kind: "course", title: "Pricing your work", detail: "4 lessons · 40 minutes",
    because: "You charge ₹280 for blouses. Women near you charge up to ₹600",
    meta: "You can charge up to ₹600", href: "/app/shop/pricing", icon: "Tag",
    photo: "/ux/art/course-reviewing-tablet-charts.webp", badge: "Work from home",
    tint: "--ux-tint-amber", ink: "--ux-amber-ink" },
];

export const FOR_YOU: DiscoverItem[] = [
  { id: "f1", kind: "opportunity", title: "120 uniform shirts", detail: "Sunrise Hostel · pays in 60 days",
    because: "You have finished 87 orders and this needs someone who delivers",
    meta: "8 women bidding together", href: "/app/contracts", icon: "Briefcase",
    tint: "--ux-tint-green", ink: "--ux-green-ink" },
  { id: "f2", kind: "course", title: "Pricing your work", detail: "4 lessons · 40 minutes",
    because: "You charge ₹280 for blouses. Women near you charge up to ₹600",
    meta: "Free", href: "/app/shop/pricing", icon: "Tag",
    tint: "--ux-tint-amber", ink: "--ux-amber-ink" },
  { id: "f3", kind: "circle", title: "Tailoring & Stitching Sisters", detail: "107 women · meets Thursdays",
    because: "Six women you have sold to are already in it",
    meta: "2 km away", href: "/app/circles", icon: "UsersRound",
    tint: "--ux-tint-pink", ink: "--ux-pink-ink" },
  { id: "f4", kind: "event", title: "Stitching workshop", detail: "16 Sept · 4pm · community hall",
    because: "It is on a Thursday, which your calendar says is usually free",
    meta: "Free · 12 going", href: "/app/events", icon: "Ticket",
    tint: "--ux-tint-violet", ink: "--ux-violet" },
];

/* ── Goals ────────────────────────────────────────────────────────────────── */

/**
 * Goals in her words, not the app's categories.
 *
 * The failure mode here is a goal-setting feature that produces guilt: a list
 * of things she said she would do and did not. So a goal is never overdue and
 * never turns red. It shows what moved and what would move it next — and it
 * can be put down without ceremony.
 */
export interface Goal {
  id: string;
  title: string;
  why: string;
  /** Paise where the goal is monetary, otherwise null. */
  targetMinor: number | null;
  haveMinor: number;
  by: string;
  /** The one action that most advances it. */
  nextHref: string;
  nextLabel: string;
  icon: string;
  tint: string;
  ink: string;
  state: "on" | "paused" | "done";
}

export const GOALS: Goal[] = [
  { id: "g1", title: "Buy my own machine", why: "So I stop paying rent on someone else's",
    targetMinor: 1800000, haveMinor: 1250000, by: "Before Diwali",
    nextHref: "/app/circles", nextLabel: "See your pot", icon: "Wrench",
    tint: "--ux-tint-violet", ink: "--ux-violet", state: "on" },
  { id: "g2", title: "Earn ₹8,000 in a month", why: "That covers the school fees without asking anyone",
    targetMinor: 800000, haveMinor: 615000, by: "This month",
    nextHref: "/app/collect", nextLabel: "Ask to be paid", icon: "Wallet",
    tint: "--ux-tint-green", ink: "--ux-green-ink", state: "on" },
  { id: "g3", title: "Learn to price my work", why: "I know I charge too little",
    targetMinor: null, haveMinor: 0, by: "No rush",
    nextHref: "/app/shop/pricing", nextLabel: "See what others charge", icon: "Tag",
    tint: "--ux-tint-amber", ink: "--ux-amber-ink", state: "on" },
];

export const goalPct = (g: Goal) =>
  g.targetMinor ? Math.min(100, Math.round((g.haveMinor / g.targetMinor) * 100)) : 0;
