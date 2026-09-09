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
export type GoalKind = "Financial" | "Learning" | "Career" | "Personal";

/**
 * On track, needs attention, done — or not begun.
 *
 * "Needs attention" is amber and never red, and it is never the word
 * "overdue". It means the date has arrived or nothing has moved, which are
 * facts; it does not mean she has failed at anything.
 */
export type GoalStatus = "on-track" | "needs-attention" | "completed" | "not-started";

export interface Goal {
  id: string;
  title: string;
  why: string;
  kind: GoalKind;
  /** Paise where the goal is monetary, otherwise null. */
  targetMinor: number | null;
  haveMinor: number;
  /**
   * Counted goals — lessons, steps, visits. Null where the goal is money.
   * `unit` is plural and lowercase, because it is read as "24 of 30 lessons".
   */
  count: number | null;
  countTarget: number | null;
  unit: string | null;
  /** In her words: "Before Diwali". */
  by: string;
  /** The date the card prints, and what "needs attention" is measured against. */
  targetOn: string;
  /** A picture of the thing itself, which is what makes a goal feel real. */
  art: string;
  /** The one action that most advances it. */
  nextHref: string;
  nextLabel: string;
  icon: string;
  tint: string;
  ink: string;
  state: "on" | "paused" | "done";
}

export const GOALS: Goal[] = [
  { id: "g1", title: "Buy my own machine", why: "So I stop paying rent on someone else's and work on my own terms.",
    kind: "Financial", targetMinor: 1800000, haveMinor: 1250000,
    count: null, countTarget: null, unit: null,
    by: "Before Diwali", targetOn: "31 Dec 2026", art: "/ux/art/course-sewing-machine.webp",
    nextHref: "/app/circles", nextLabel: "See your pot", icon: "Wrench",
    tint: "--ux-tint-violet", ink: "--ux-violet-ink", state: "on" },

  { id: "g2", title: "Finish the tailoring course", why: "To get better at what I already do, and have the certificate to show it.",
    kind: "Learning", targetMinor: null, haveMinor: 0,
    count: 24, countTarget: 30, unit: "lessons",
    by: "This term", targetOn: "30 Sep 2026", art: "/ux/art/course-sewing-machine.webp",
    nextHref: "/app/programs", nextLabel: "Continue learning", icon: "GraduationCap",
    tint: "--ux-tint-blue", ink: "--ux-blue-ink", state: "on" },

  { id: "g3", title: "Take the family to my mother's", why: "We have not all been together at her house in three years.",
    kind: "Personal", targetMinor: 5000000, haveMinor: 1000000,
    count: null, countTarget: null, unit: null,
    by: "Next summer", targetOn: "31 Mar 2027", art: "/ux/art/scene-women-celebrating.webp",
    nextHref: "/app/wallet", nextLabel: "Put some aside", icon: "Heart",
    tint: "--ux-tint-pink", ink: "--ux-pink-ink", state: "on" },

  { id: "g4", title: "Sell to shops, not just neighbours", why: "Turn what I make into a business that does not depend on who walks past.",
    kind: "Career", targetMinor: null, haveMinor: 0,
    count: 0, countTarget: 5, unit: "steps",
    by: "No rush", targetOn: "31 Dec 2026", art: "/ux/art/scene-woman-planting-sapling.webp",
    nextHref: "/app/shop/wholesale", nextLabel: "See how it works", icon: "Store",
    tint: "--ux-tint-green", ink: "--ux-green-ink", state: "on" },

  { id: "g5", title: "Earn ₹8,000 in a month", why: "That covers the school fees without asking anyone.",
    kind: "Financial", targetMinor: 800000, haveMinor: 800000,
    count: null, countTarget: null, unit: null,
    by: "Done in August", targetOn: "31 Aug 2026", art: "/ux/art/course-counting-coins-calculator.webp",
    nextHref: "/app/wallet", nextLabel: "See what came in", icon: "Wallet",
    tint: "--ux-tint-amber", ink: "--ux-amber-ink", state: "done" },
];

export const GOAL_KINDS: GoalKind[] = ["Financial", "Learning", "Career", "Personal"];

export const goalPct = (g: Goal) =>
  g.targetMinor ? Math.min(100, Math.round((g.haveMinor / g.targetMinor) * 100))
  : g.countTarget ? Math.min(100, Math.round(((g.count ?? 0) / g.countTarget) * 100))
  : 0;

/**
 * Where it stands, from what is actually on it.
 *
 * The legend in the rail counts these, so the ring and the list cannot
 * disagree about how many are on track — they are the same function read
 * twice.
 */
export function goalStatus(g: Goal, today = new Date()): GoalStatus {
  if (g.state === "done" || goalPct(g) >= 100) return "completed";
  // Put down on purpose. The only status she chooses rather than earns, and
  // the only one that is never a nudge.
  if (g.state === "paused") return "not-started";
  const due = Date.parse(g.targetOn);
  // Nothing has moved, or the date has arrived. Both are facts about the goal;
  // neither is a claim about her, which is why this is amber and never red.
  if (goalPct(g) === 0) return "needs-attention";
  if (!Number.isNaN(due) && due < today.getTime()) return "needs-attention";
  return "on-track";
}

/** "₹12,500 of ₹18,000", or "24 of 30 lessons". */
export function goalProgressLine(g: Goal, money: (minor: number) => string) {
  if (g.targetMinor) return { have: money(g.haveMinor), of: `of ${money(g.targetMinor)}` };
  if (g.countTarget) return { have: String(g.count ?? 0), of: `of ${g.countTarget} ${g.unit ?? ""}`.trim() };
  return { have: "", of: "" };
}
