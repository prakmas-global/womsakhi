/**
 * The product's information architecture.
 *
 * ── Five places, not seven ──────────────────────────────────────────────────
 * It was seven sections and THIRTY destinations, all offered as equal choices.
 * A woman who came here to earn money had to learn a taxonomy before she could
 * do anything — and the two halves of the only thing she came for were in
 * different sections: "Work" held the job, "Money" held what the job paid.
 *
 * So:
 *
 *   **Home**       what needs her today, and her calendar.
 *   **Earn**       Work and Money merged. Finding work and getting paid for it
 *                  are one job to her, and they were two clicks apart.
 *   **Learn**      courses, mentors, certificates.
 *   **Community**  circles, messages, events, women near her.
 *   **Help**       when something is wrong. Rights, health, family, travel —
 *                  and SAFETY, which was not in the navigation at all. The
 *                  panic button and trusted contacts were reachable only from
 *                  the account menu, on an app built because women are not safe
 *                  by default. It is now the first item of the section.
 *
 * "Discover" is gone. Its "Everything" screen was a search, and search is in
 * the top bar on every screen; its Events moved to Community, where an event
 * belongs, and "Ask for help" to Help.
 *
 * Nineteen destinations instead of thirty, and five of them fit a phone's
 * bottom bar exactly — no "More" needed to reach a whole section.
 *
 * ── Nothing was deleted ─────────────────────────────────────────────────────
 * Every screen still exists and every one is still reachable. What changed is
 * that eleven of them stopped competing for attention in a rail and are now
 * reached from the screen they belong to: "Buy together" from Your shop,
 * "Test your skills" from Courses, "What you paid" from Your wallet. That is
 * what `also` is for — the route belongs to the section, and highlights it,
 * without taking a slot.
 *
 * ── One name per thing ──────────────────────────────────────────────────────
 * This list is the ONLY place a destination is named. `/app/programs` was once
 * called four different things depending on where you looked: "Learn" in the
 * top bar, "Courses" in the rail, "Learning" on the home tile and "Learning" in
 * its own heading. `HOME_TILES` in `home/data.ts` reads from here, and every
 * page heading says what its link says.
 */
export interface NavItem {
  label: string;
  icon: string;
  href: string;
  /**
   * Message key for `label` and, with `.note` appended, for `note`.
   *
   * The English above stays the source of truth and the fallback — a language
   * that has not been through native review simply shows it, rather than a
   * machine-made word in her own script.
   */
  k?: string;
  /** One line under the label in the rail — there is room, so use it. */
  note?: string;
  badge?: string;
}

export interface Mode {
  id: string;
  label: string;
  icon: string;
  /** Message key for `label`. See NavItem.k. */
  k?: string;
  /** Where the tab itself goes — always the first child. */
  href: string;
  items: NavItem[];
  /** Routes that belong to this mode but are not rail items of their own. */
  also?: string[];
  /**
   * Routes that deserve a name in search but not a slot in the rail.
   *
   * `also` carries bare hrefs, which is all the active-state logic needs and
   * not enough to show someone a search result. These are the child screens
   * worth finding by typing — "showing someone", "reading it out to you" —
   * without lengthening a rail that is already long.
   */
  findable?: NavItem[];
}

export const MODES: Mode[] = [
  {
    id: "home", label: "Home", k: "ch.mode.home", icon: "Home", href: "/app",
    items: [
      { label: "Today", icon: "Sun", href: "/app", k: "ch.today", note: "What needs you now" },
      { label: "My journey", icon: "Route", href: "/app/journey", k: "ch.journey", note: "From skill to income, step by step" },
      { label: "My goals", icon: "Target", href: "/app/goals", k: "ch.goals", note: "What you are working towards" },
      { label: "Your calendar", icon: "CalendarDays", href: "/app/schedule", k: "ch.schedule", note: "Sessions, classes and events" },
    ],
    // Personal admin. Reached from the account menu and the topbar, not by
    // taking up a slot in the daily navigation.
    also: ["/app/notifications", "/app/saved", "/app/profile", "/app/sakhi"],
  },
  {
    // Promoted out of Home. Search answers a question she already has; this is
    // for the much more common case where she has a situation rather than a
    // question, which is why it earns a tab and search stays a header control.
    id: "discover", label: "For you", k: "ch.mode.discover", icon: "Compass", href: "/app/discover",
    items: [
      { label: "Chosen for you", icon: "Sparkles", href: "/app/discover", k: "ch.discover", note: "Because of something you did" },
      { label: "Near you", icon: "MapPin", href: "/app/stories", k: "ch.stories", note: "Women and help in your city" },
      { label: "Everything there is", icon: "Telescope", href: "/app/explore", k: "ch.explore", note: "All of it, grouped by what it is for" },
      { label: "Search", icon: "Search", href: "/app/search", k: "ch.search", note: "When you know what you want" },
    ],
  },
  {
    id: "learn", label: "Learn", k: "ch.mode.learn", icon: "GraduationCap", href: "/app/programs",
    items: [
      { label: "Courses", icon: "BookOpen", href: "/app/programs", k: "ch.programs", note: "Started and suggested" },
      { label: "Mentors", icon: "Users", href: "/app/mentors", k: "ch.mentors", note: "Women who have done it" },
      { label: "Certificates", icon: "Award", href: "/app/certificates", k: "ch.certificates", note: "Proof you can show" },
    ],
    also: ["/app/library", "/app/assess", "/app/digital"],
    findable: [
      { label: "Teach and learn", icon: "Handshake", href: "/app/library", k: "ch.library", note: "Swap what you know for what you need" },
      { label: "Prove your skills", icon: "BadgeCheck", href: "/app/assess", k: "ch.assess", note: "A short test, then a certificate" },
      { label: "Using a phone", icon: "Smartphone", href: "/app/digital", k: "ch.digital", note: "From the very beginning" },
    ],
  },
  {
    // Split out of Earn, which had grown to thirteen items. "Find me work" and
    // "run my business" are different intents on different days, and a woman
    // looking for a job should not have to scroll past her savings vault.
    id: "work", label: "Work", k: "ch.mode.work", icon: "Briefcase", href: "/app/opportunities",
    items: [
      { label: "Find work", icon: "Search", href: "/app/opportunities", k: "ch.opportunities", note: "Jobs, orders and freelance" },
      { label: "Did they pay her?", icon: "BadgeCheck", href: "/app/verified", k: "ch.verified", note: "Before you take the work" },
      { label: "Your applications", icon: "ClipboardList", href: "/app/applications", k: "ch.applications", note: "Where each one stands" },
      { label: "Big orders", icon: "Boxes", href: "/app/contracts", k: "ch.contracts", note: "Too big for one woman alone" },
      { label: "Proof you keep your word", icon: "FileText", href: "/app/trust", k: "ch.trust", note: "Nine months, written down" },
    ],
    also: ["/app/bookings", "/app/contracts/together", "/app/intake"],
    findable: [
      { label: "Who signs the contract", icon: "FileSignature", href: "/app/contracts/together", k: "ch.contracts.together", note: "Three ways to bid as a group" },
      { label: "Times you have booked", icon: "CalendarCheck", href: "/app/bookings", k: "ch.bookings", note: "Classes and sessions" },
    ],
  },
  {
    // What is left is one intent: money coming in, and where it goes after.
    id: "earn", label: "Earn", k: "ch.mode.earn", icon: "BadgeIndianRupee", href: "/app/documents",
    items: [
      { label: "Your shop", icon: "Store", href: "/app/documents", k: "ch.documents", note: "What you sell, and your orders" },
      { label: "Your link, and getting paid", icon: "QrCode", href: "/app/collect", k: "ch.collect", note: "Sell to people not on WomSakhi" },
      { label: "Ways to sell", icon: "Sparkles", href: "/app/shop", k: "ch.shop", note: "Pre-orders, regulars, big orders" },
      { label: "The market", icon: "ShoppingBasket", href: "/app/market", k: "ch.market", note: "Buy from women you know" },
      { label: "Who owes you money", icon: "BookOpen", href: "/app/books", k: "ch.books", note: "And proof of what you earn" },
      { label: "Your money", icon: "PiggyBank", href: "/app/money", k: "ch.money", note: "Is there enough for what cannot wait" },
      { label: "Your wallet", icon: "Wallet", href: "/app/wallet", k: "ch.wallet", note: "Your balance, and taking it out" },
      { label: "Your locker", icon: "Lock", href: "/app/vault", k: "ch.vault", note: "Money kept aside, and quiet" },
      // Renamed to what it actually is. This slot pointed at the SUPPORT FUND —
      // WomSakhi's own grant for women who cannot afford a course fee — under a
      // label promising "government schemes and grants", which is a different
      // pot of money entirely.
      { label: "What you are owed", icon: "Landmark", href: "/app/haq", k: "ch.haq", note: "Government money in your name" },
    ],
    also: ["/app/group-buy", "/app/payments", "/app/cover", "/app/checkout",
           "/app/support-fund", "/app/haq/papers", "/app/haq/recover",
           "/app/vault/rules", "/app/vault/history", "/app/vault/privacy",
           "/app/shop/pricing", "/app/shop/preorders", "/app/shop/subscriptions",
           "/app/shop/buyers", "/app/shop/live", "/app/shop/wholesale",
           "/app/books/proof", "/app/books/season",
           "/app/shop/voice", "/app/shop/slots", "/app/shop/disputes",
           "/app/vault/showing", "/app/kitchen"],
    findable: [
      { label: "Showing someone your phone", icon: "Smartphone", href: "/app/vault/showing", k: "ch.vault.showing", note: "What they see when you hand it over" },
      { label: "Selling food from home", icon: "ChefHat", href: "/app/kitchen", k: "ch.kitchen", note: "The licence is ₹100 a year" },
      { label: "Say it instead of typing", icon: "Mic", href: "/app/shop/voice", k: "ch.shop.voice", note: "Speak, and it becomes a listing" },
      { label: "Sell your time", icon: "CalendarDays", href: "/app/shop/slots", k: "ch.shop.slots", note: "Customers pick an hour themselves" },
      { label: "When something goes wrong", icon: "Scale", href: "/app/shop/disputes", k: "ch.shop.disputes", note: "Sorted by a woman you both know" },
      { label: "What should you charge", icon: "Tag", href: "/app/shop/pricing", k: "ch.shop.pricing", note: "What women near you ask" },
      { label: "Proof you earn", icon: "Receipt", href: "/app/books/proof", k: "ch.books.proof", note: "A statement a landlord will take" },
      { label: "Save without thinking", icon: "Repeat", href: "/app/vault/rules", k: "ch.vault.rules", note: "Money moved for you, every week" },
      { label: "What you can recover", icon: "Undo2", href: "/app/haq/recover", k: "ch.haq.recover", note: "Money you were wrongly removed from" },
      { label: "Your papers", icon: "FileText", href: "/app/haq/papers", k: "ch.haq.papers", note: "Held once, reused everywhere" },
    ],
  },
  {
    // "Community" was the app's word. "Circle" is hers — it is what the savings
    // group, the mentor and the woman next door are all already called
    // everywhere else in the product.
    id: "circle", label: "Circle", k: "ch.mode.circle", icon: "UsersRound", href: "/app/circles",
    items: [
      { label: "Circles", icon: "UsersRound", href: "/app/circles", k: "ch.circles", note: "Save and grow together" },
      { label: "Messages", icon: "MessageCircle", href: "/app/messages", k: "ch.messages", note: "Buyers, mentors, circles" },
      { label: "Events", icon: "Ticket", href: "/app/events", k: "ch.events", note: "Melas, workshops and meets" },
      { label: "Helping each other", icon: "Handshake", href: "/app/together", k: "ch.together", note: "Teach, learn, and move house" },
      { label: "Pass it on", icon: "Gift", href: "/app/swap", k: "ch.swap", note: "Things other women no longer need" },
    ],
    also: ["/app/together/assist", "/app/together/move"],
  },
  {
    // NOT in the master prompt's list of six. Kept anyway, and the reason is
    // the prompt's own §65: safety must always be easy to reach. Dropping this
    // tab to hit a suggested count would bury ten routes a woman needs on her
    // worst day behind an account menu.
    id: "help", label: "Help", k: "ch.mode.help", icon: "LifeBuoy", href: "/app/help",
    items: [
      { label: "Get help now", icon: "ShieldAlert", href: "/app/safety", k: "ch.safety", note: "Alert your people, or call" },
      { label: "What has gone wrong", icon: "LifeBuoy", href: "/app/help", k: "ch.help", note: "Answers, or a person" },
      { label: "Money traps", icon: "ShieldCheck", href: "/app/safe-money", k: "ch.safemoney", note: "The tricks aimed at women like you" },
      { label: "When home is not sure", icon: "MessageCircle", href: "/app/bringing", k: "ch.bringing", note: "Something to show them" },
      { label: "The school year", icon: "GraduationCap", href: "/app/school", k: "ch.school", note: "Fees, forms and dates, per child" },
      { label: "If something happens to me", icon: "ShieldCheck", href: "/app/incase", k: "ch.incase", note: "Written down while you can" },
      { label: "Your rights", icon: "Scale", href: "/app/rights", k: "ch.rights", note: "And a free lawyer" },
      { label: "Health", icon: "HeartPulse", href: "/app/health", k: "ch.health", note: "What is free, and what is due" },
      { label: "Family & childcare", icon: "Baby", href: "/app/family", k: "ch.family", note: "Near you, and what it costs" },
      { label: "Travel", icon: "Bus", href: "/app/travel", k: "ch.travel", note: "Routes, cost, and after dark" },
    ],
    also: ["/app/health/strength", "/app/health/cover", "/app/health/change", "/app/voice"],
    findable: [
      { label: "Reading it out to you", icon: "Volume2", href: "/app/voice", k: "ch.voice", note: "Any screen read aloud, in your language" },
      { label: "Staying strong", icon: "HeartPulse", href: "/app/health/strength", k: "ch.health.strength", note: "What is free at a government centre" },
      { label: "Menopause", icon: "Sun", href: "/app/health/change", k: "ch.health.change", note: "And working through it" },
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

