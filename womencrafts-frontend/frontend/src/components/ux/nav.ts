/**
 * The product's information architecture.
 *
 * ── Why this is two levels ──────────────────────────────────────────────────
 * It used to be one rail of eighteen items. Eighteen flat destinations is not
 * an architecture, it is a list — nobody holds it in mind, so people stop
 * scanning it and use whatever is in the top five. Worse, several screens
 * (notifications, certificates, messages) were not in it at all and could only
 * be reached by accident.
 *
 * So: six MODES across the top — the things she switches between during a day —
 * and the rail shows only what is inside the mode she is in. Six is the ceiling
 * for a top bar people read rather than parse, and three to four children is
 * small enough to take in at a glance.
 *
 * The cost is honest: something four levels down is now two clicks rather than
 * one. That is the right trade when the alternative is eighteen equal-weight
 * items, none of which look more important than any other.
 *
 * Settings, Help, Safety and Refer are deliberately NOT modes. They are things
 * she visits occasionally, so they live in the account menu, which is where
 * every other product puts them and where people look first.
 */

export interface NavItem {
  label: string;
  icon: string;
  href: string;
  /** One line under the label in the rail — there is room, so use it. */
  note?: string;
  badge?: string;
}

export interface Mode {
  id: string;
  label: string;
  icon: string;
  /** Where the tab itself goes — always the first child. */
  href: string;
  items: NavItem[];
  /** Routes that belong to this mode but are not rail items of their own. */
  also?: string[];
}

export const MODES: Mode[] = [
  {
    id: "home", label: "Home", icon: "Home", href: "/app",
    items: [
      { label: "Today", icon: "Sun", href: "/app", note: "What needs you now" },
      { label: "Your journey", icon: "Route", href: "/app/progress", note: "How far you have come" },
      { label: "Your diary", icon: "CalendarDays", href: "/app/schedule", note: "Sessions, classes, events" },
      { label: "Notifications", icon: "Bell", href: "/app/notifications", note: "What you may have missed" },
      // Every bookmark in the app pointed nowhere until this existed.
      { label: "Saved", icon: "Bookmark", href: "/app/saved", note: "Things you kept for later" },
      { label: "Ask Sakhi", icon: "Sparkles", href: "/app/sakhi", note: "Answers in your own words" },
    ],
    also: ["/app/profile", "/app/search"],
  },
  {
    id: "discover", label: "Discover", icon: "Compass", href: "/app/explore",
    items: [
      { label: "Explore", icon: "Compass", href: "/app/explore", note: "Everything, in one place" },
      { label: "Events", icon: "Ticket", href: "/app/events", note: "Melas, workshops and meets" },
      { label: "What you need", icon: "MessageCircleQuestion", href: "/app/intake", note: "Tell us, get answers" },
    ],
  },
  {
    id: "learn", label: "Learn", icon: "GraduationCap", href: "/app/programs",
    items: [
      { label: "Courses", icon: "BookOpen", href: "/app/programs", note: "Started and suggested" },
      { label: "Mentors", icon: "Users", href: "/app/mentors", note: "Women who have done it" },
      { label: "Skill exchange", icon: "RefreshCw", href: "/app/library", note: "Teach one, learn one" },
      { label: "Prove your skills", icon: "BadgeCheck", href: "/app/assess", note: "Twenty minutes, on your phone" },
      { label: "Using a phone", icon: "Smartphone", href: "/app/digital", note: "Six steps, from the start" },
      { label: "Certificates", icon: "Award", href: "/app/certificates", note: "Proof you can share" },
    ],
  },
  {
    id: "work", label: "Work", icon: "Briefcase", href: "/app/opportunities",
    items: [
      { label: "Find work", icon: "Search", href: "/app/opportunities", note: "Jobs, orders and freelance" },
      { label: "Your applications", icon: "ClipboardList", href: "/app/applications", note: "Where each one stands" },
      { label: "Your business", icon: "Store", href: "/app/documents", note: "Orders, products, paperwork" },
      { label: "Buying together", icon: "ShoppingBasket", href: "/app/group-buy", note: "Wholesale prices, shared" },
    ],
  },
  {
    id: "money", label: "Money", icon: "Wallet", href: "/app/wallet",
    items: [
      { label: "Earn", icon: "BadgeIndianRupee", href: "/app/wallet", note: "Balance and withdrawals" },
      { label: "Payments", icon: "Receipt", href: "/app/payments", note: "What you have paid for" },
      { label: "Schemes", icon: "Landmark", href: "/app/support-fund", note: "Money you may be owed" },
      { label: "Insurance & pension", icon: "ShieldCheck", href: "/app/cover", note: "From ₹20 a year" },
    ],
    also: ["/app/bookings", "/app/checkout"],
  },
  {
    id: "wellbeing", label: "Wellbeing", icon: "HeartPulse", href: "/app/health",
    items: [
      { label: "Health", icon: "HeartPulse", href: "/app/health", note: "What is free, and what is due" },
      { label: "Your rights", icon: "Scale", href: "/app/rights", note: "And a free lawyer" },
      { label: "Family & childcare", icon: "Baby", href: "/app/family", note: "Near you, and what it costs" },
      { label: "Getting about", icon: "Bus", href: "/app/travel", note: "Routes, cost, and after dark" },
    ],
  },
  {
    id: "community", label: "Community", icon: "UsersRound", href: "/app/circles",
    items: [
      { label: "Circles", icon: "UsersRound", href: "/app/circles", note: "Savings and community" },
      { label: "Sakhi Local", icon: "MapPin", href: "/app/stories", note: "Women near you" },
      { label: "Messages", icon: "MessageCircle", href: "/app/messages", note: "Buyers, mentors, circles" },
    ],
  },
];

/**
 * Which mode a path belongs to.
 *
 * Longest-prefix wins, so `/app/opportunities/w1` resolves to Work rather than
 * to Home via the bare `/app`. Anything unmatched — settings, help, safety —
 * highlights no mode at all, which is truthful: those are not modes.
 */
export function modeForPath(path: string): Mode | null {
  let best: { mode: Mode; len: number } | null = null;
  for (const m of MODES) {
    for (const href of [...m.items.map((i) => i.href), ...(m.also ?? [])]) {
      const exact = href === path;
      const under = href !== "/app" && path.startsWith(href + "/");
      if (!exact && !under) continue;
      if (!best || href.length > best.len) best = { mode: m, len: href.length };
    }
  }
  return best?.mode ?? null;
}

/** Which rail item is current, by the same longest-prefix rule. */
export function itemForPath(mode: Mode, path: string): string | null {
  let best: { href: string; len: number } | null = null;
  for (const i of mode.items) {
    const exact = i.href === path;
    const under = i.href !== "/app" && path.startsWith(i.href + "/");
    if (!exact && !under) continue;
    if (!best || i.href.length > best.len) best = { href: i.href, len: i.href.length };
  }
  return best?.href ?? null;
}

/**
 * The rail `LearningShell` renders.
 *
 * Every entry here used to point into `/ux/*`, a preview route tree that was
 * deleted on 2026-08-26. Six of those destinations had never existed at all —
 * `/ux/continue`, `/ux/recommended`, `/ux/skills`, `/ux/mentor-connect`,
 * `/ux/careers` and `/ux/webinars` all answered 404 from the day this list was
 * written, so half a learner's sidebar was a dead end.
 *
 * Each label below now points at the screen in `/app` that actually does the
 * thing it names. "Continue Learning", "Recommended for You" and "Explore
 * Courses" were three links to what is one screen in the real product, so they
 * are one entry: duplicating a destination under three names teaches people
 * the rail is decorative.
 */
export const LEARN_NAV: NavItem[] = [
  { label: "Home", icon: "Home", href: "/app" },
  { label: "Courses", icon: "BookOpen", href: "/app/programs" },
  { label: "Prove your skills", icon: "BadgeCheck", href: "/app/assess" },
  { label: "Mentors", icon: "Users", href: "/app/mentors" },
  { label: "Career Opportunities", icon: "Briefcase", href: "/app/opportunities" },
  { label: "Events & Webinars", icon: "CalendarDays", href: "/app/events" },
  { label: "Community", icon: "UsersRound", href: "/app/circles" },
  { label: "Saved", icon: "Bookmark", href: "/app/saved" },
  { label: "Certificates", icon: "Award", href: "/app/certificates" },
  { label: "Settings", icon: "Settings", href: "/app/settings" },
];
