/**
 * The product's information architecture — one tree, one name per thing.
 *
 * ── Why this was rewritten ──────────────────────────────────────────────────
 * The app had SEVEN surfaces that listed destinations: top-bar mode tabs,
 * top-bar icon buttons, the account menu, the rail's Quick Access, the rail's
 * section list, the phone's bottom bar and its chip scroller — plus a Quick
 * Actions block on Home and a Settings hub. Ten hrefs appeared in two of them
 * at once, and every one of the seven sections repeated its own destination as
 * the first item of its own list. `Shell.tsx` carried a comment saying
 * "Nothing appears in both", which was false ten times over.
 *
 * Nielsen Norman's finding on exactly this: users do not know two lists are
 * duplicates, so they read both — doubling the work for nothing. Their
 * instruction is one sentence: decide on ONE way to present the navigation.
 *
 * ── What replaced it ────────────────────────────────────────────────────────
 * One tree. Five sections a woman moves between — Home, Learn, Work, Earn,
 * Circle — plus Help and You, which are reached from the header because they
 * are not places she works, they are places she goes when something is wrong
 * or when she wants to change a setting.
 *
 * Five is not a preference. It is the ceiling every serious guideline gives a
 * bottom bar: NN/g says a bar cannot hold more than five, Material 3 caps a
 * rail at seven and prefers fewer, Apple says avoid overflow tabs. Flipkart —
 * the same market as ours — replaced a hidden menu with one bottom bar and saw
 * usage of it rise eight to ten times.
 *
 * ── Each section has a hub, and the hub IS the navigation ───────────────────
 * A section holds around seventeen screens. Above fifteen, NN/g stops
 * recommending a persistent sub-menu and starts recommending a landing page
 * that serves as the navigation for that branch. So `/app/learn`, `/app/work`,
 * `/app/earn`, `/app/circle`, `/app/helpdesk` and `/app/you` exist, and they
 * list their children as large labelled cards. On a phone that is the whole
 * map — which the app did not have at all before: below the `lg` breakpoint
 * there was no rail, no drawer, and the "More sheet that holds the entire map"
 * described in `MobileNav`'s own comment had never been written.
 *
 * ── Every route has a parent ────────────────────────────────────────────────
 * 123 routes on disk; the old model named 69 and left 26 orphaned with no
 * section, no highlight and, on a phone, no way in. Every route now sits
 * somewhere in this tree, which is what lets `parentFor` put a real name on
 * every Back control: "Back to Learn", never a bare arrow.
 *
 * ── One name per thing ──────────────────────────────────────────────────────
 * A destination appears exactly once here. `checks/nav.mjs` asserts it: no two
 * nodes share an href, and every route on disk resolves to a node.
 */

/** A place in the app. The tree is nodes all the way down. */
export interface NavNode {
  id: string;
  label: string;
  /**
   * Message key BASE for `label` and, with `.note` appended, for `note`.
   * Absent means the English here is the only copy, which is fine and is the
   * fallback for every language that has not had native review.
   */
  k?: string;
  icon: string;
  href: string;
  /** One line saying what it is for. Shown in the rail and on the hub card. */
  note?: string;
  /**
   * Owns a subtree but is never listed anywhere.
   *
   * Checkout is the case: a woman arrives at it from a basket, never from a
   * menu, and there is no `/app/checkout` page to land on. The node exists so
   * that `/app/checkout/<order>` still knows which section it is in and whose
   * name its Back should carry.
   */
  unlisted?: boolean;
  children?: NavNode[];
}

/** A top-level branch. Only the five with `tab` reach the bottom bar. */
export interface Section extends NavNode {
  tab: boolean;
}

export const SECTIONS: Section[] = [
    { tab: true, id: "home", label: "Home", k: "ch.mode.home", icon: "Home", href: "/app", note: "What needs you today",
      children: [
        { id: "discover", label: "Chosen for you", k: "ch.discover", icon: "Sparkles", href: "/app/discover", note: "Because of something you did",
          children: [
            { id: "explore", label: "Everything there is", k: "ch.explore", icon: "Telescope", href: "/app/explore", note: "All of it, grouped by what it is for", },
            { id: "stories", label: "Women like you", k: "ch.stories", icon: "MapPin", href: "/app/stories", note: "Who did it, and how", },
            { id: "search", label: "Search", k: "ch.search", icon: "Search", href: "/app/search", note: "When you know what you want", },
          ],
        },
        { id: "journey", label: "My journey", k: "ch.journey", icon: "Route", href: "/app/journey", note: "From skill to income, step by step", },
        { id: "goals", label: "My goals", k: "ch.goals", icon: "Target", href: "/app/goals", note: "What you are working towards",
          children: [
            { id: "progress", label: "What has changed", k: "ch.progress", icon: "TrendingUp", href: "/app/progress", note: "Month by month", },
          ],
        },
        { id: "schedule", label: "Your calendar", k: "ch.schedule", icon: "CalendarDays", href: "/app/schedule", note: "Sessions, classes and events",
          children: [
            { id: "bookings", label: "Times you have booked", k: "ch.bookings", icon: "CalendarCheck", href: "/app/bookings", note: "Classes and sessions", },
          ],
        },
        { id: "saved", label: "Saved", k: "ch.saved", icon: "Bookmark", href: "/app/saved", note: "Things you kept", },
        { id: "notifications", label: "What is new", k: "ch.notifications", icon: "Bell", href: "/app/notifications", note: "Everything you were told", },
        { id: "reminders", label: "Your reminders", k: "ch.reminders", icon: "Bell", href: "/app/reminders", note: "Set one without typing", },
        { id: "sakhi", label: "Ask Sakhi", k: "ch.sakhi", icon: "Sparkles", href: "/app/sakhi", note: "Anything, in your own words", },
      ],
    },
    { tab: true, id: "learn", label: "Learn", k: "ch.mode.learn", icon: "GraduationCap", href: "/app/learn", note: "Get better at what you do",
      children: [
        { id: "programs", label: "Courses", k: "ch.programs", icon: "BookOpen", href: "/app/programs", note: "Started and suggested", },
        { id: "mentors", label: "Mentors", k: "ch.mentors", icon: "Users", href: "/app/mentors", note: "Women who have done it", },
        { id: "certificates", label: "Certificates", k: "ch.certificates", icon: "Award", href: "/app/certificates", note: "Proof you can show", },
        { id: "library", label: "Teach and learn", k: "ch.library", icon: "Handshake", href: "/app/library", note: "Swap what you know for what you need", },
        { id: "assess", label: "Prove your skills", k: "ch.assess", icon: "BadgeCheck", href: "/app/assess", note: "A short test, then a certificate", },
        { id: "digital", label: "Using a phone", k: "ch.digital", icon: "Smartphone", href: "/app/digital", note: "From the very beginning", },
      ],
    },
    { tab: true, id: "work", label: "Work", k: "ch.mode.work", icon: "Briefcase", href: "/app/work", note: "Find it, win it, prove it",
      children: [
        { id: "opportunities", label: "Find work", k: "ch.opportunities", icon: "Search", href: "/app/opportunities", note: "Jobs, orders and freelance", },
        { id: "verified", label: "Did they pay her?", k: "ch.verified", icon: "BadgeCheck", href: "/app/verified", note: "Before you take the work", },
        { id: "applications", label: "Your applications", k: "ch.applications", icon: "ClipboardList", href: "/app/applications", note: "Where each one stands",
          children: [
            { id: "intake", label: "Tell us what you can do", k: "ch.intake", icon: "FileText", href: "/app/intake", note: "So the right work finds you", },
          ],
        },
        { id: "contracts", label: "Big orders", k: "ch.contracts", icon: "Boxes", href: "/app/contracts", note: "Too big for one woman alone",
          children: [
            { id: "contracts-together", label: "Who signs the contract", k: "ch.contracts.together", icon: "FileSignature", href: "/app/contracts/together", note: "Three ways to bid as a group", },
          ],
        },
        { id: "trust", label: "Proof you keep your word", k: "ch.trust", icon: "FileText", href: "/app/trust", note: "Nine months, written down", },
      ],
    },
    { tab: true, id: "earn", label: "Earn", k: "ch.mode.earn", icon: "BadgeIndianRupee", href: "/app/earn", note: "Sell it, and get paid",
      children: [
        { id: "documents", label: "Your shop", k: "ch.documents", icon: "Store", href: "/app/documents", note: "What you sell, and your orders",
          children: [
            { id: "documents-listings", label: "Everything you sell", k: "ch.documents-listings", icon: "LayoutGrid", href: "/app/documents/listings", note: "One row per thing", },
            { id: "documents-new", label: "Add something to sell", k: "ch.documents-new", icon: "Plus", href: "/app/documents/new", note: "Four steps", },
            { id: "documents-vault", label: "Your shop papers", k: "ch.documents-vault", icon: "FileText", href: "/app/documents/vault", note: "Licences and proof", },
          ],
        },
        /*
          Ways to sell: two children, not nine.

          Seven of these hints were promises the screens could not keep —
          "Speak, and it becomes a listing" pointed at a microphone that never
          recorded anything, "Customers pick an hour themselves" at a diary
          nobody can book. Those screens still exist and now say so, but the
          sidebar is not the place to advertise them: a menu of nine features
          of which seven are unbuilt is itself the false claim. They are
          reachable from `/app/shop`, under a heading that says what they are.

          The `note` is dropped from the two that stay rather than reworded,
          because `k` makes the hint come from the message catalogue in nine
          languages — and "What women near you ask" is exactly the thing the
          pricing screen now says it cannot do. No hint is better than a
          translated one that lies.
        */
        { id: "shop", label: "Ways to sell", k: "ch.shop", icon: "Sparkles", href: "/app/shop",
          children: [
            { id: "shop-pricing", label: "What should you charge", k: "ch.shop.pricing", icon: "Tag", href: "/app/shop/pricing", },
            { id: "shop-buyers", label: "Who buys from you", k: "ch.shop-buyers", icon: "Users", href: "/app/shop/buyers", note: "Folded out of the orders you write down", },
          ],
        },
        { id: "collect", label: "Your link, and getting paid", k: "ch.collect", icon: "QrCode", href: "/app/collect", note: "Sell to people not on WomSakhi", },
        { id: "market", label: "The market", k: "ch.market", icon: "ShoppingBasket", href: "/app/market", note: "Buy from women you know",
          children: [
            { id: "group-buy", label: "Buy together", k: "ch.group-buy", icon: "Boxes", href: "/app/group-buy", note: "Cheaper by the dozen", },
        { id: "checkout", label: "Paying for an order", k: "ch.checkout", icon: "CreditCard", href: "/app/checkout", note: "What you are buying, and how you pay", unlisted: true, },
          ],
        },
        { id: "kitchen", label: "Selling food from home", k: "ch.kitchen", icon: "ChefHat", href: "/app/kitchen", note: "The licence is Rs 100 a year", },
        { id: "books", label: "Who owes you money", k: "ch.books", icon: "BookOpen", href: "/app/books", note: "And proof of what you earn",
          children: [
            { id: "books-proof", label: "Proof you earn", k: "ch.books.proof", icon: "Receipt", href: "/app/books/proof", note: "A statement a landlord will take", },
            { id: "books-season", label: "Your busy months", k: "ch.books-season", icon: "TrendingUp", href: "/app/books/season", note: "When the money comes", },
          ],
        },
        { id: "money", label: "Your money", k: "ch.money", icon: "PiggyBank", href: "/app/money", note: "Is there enough for what cannot wait",
          children: [
            { id: "payments", label: "What you paid", k: "ch.payments", icon: "Receipt", href: "/app/payments", note: "Every rupee out", },
            { id: "cover", label: "If something goes wrong", k: "ch.cover", icon: "ShieldCheck", href: "/app/cover", note: "Cover that costs little", },
            { id: "support-fund", label: "Help from other women", k: "ch.support-fund", icon: "HeartHandshake", href: "/app/support-fund", note: "When you are short", },
          ],
        },
        { id: "wallet", label: "Your wallet", k: "ch.wallet", icon: "Wallet", href: "/app/wallet", note: "Your balance, and taking it out",
          children: [
            { id: "wallet-statement", label: "Your statement", k: "ch.wallet-statement", icon: "FileText", href: "/app/wallet/statement", note: "Every entry, printable", },
            { id: "wallet-withdraw", label: "Take money out", k: "ch.wallet-withdraw", icon: "Landmark", href: "/app/wallet/withdraw", note: "To your bank", },
          ],
        },
        { id: "vault", label: "Your locker", k: "ch.vault", icon: "Lock", href: "/app/vault", note: "Money kept aside, and quiet",
          children: [
            { id: "vault-rules", label: "Save without thinking", k: "ch.vault.rules", icon: "Repeat", href: "/app/vault/rules", note: "Money moved for you, every week", },
            { id: "vault-history", label: "What you put aside", k: "ch.vault-history", icon: "History", href: "/app/vault/history", note: "And when", },
            { id: "vault-privacy", label: "Who can see it", k: "ch.vault-privacy", icon: "EyeOff", href: "/app/vault/privacy", note: "Nobody, unless you say", },
            { id: "vault-showing", label: "Showing someone your phone", k: "ch.vault.showing", icon: "Smartphone", href: "/app/vault/showing", note: "What they see when you hand it over", },
          ],
        },
        { id: "haq", label: "What you are owed", k: "ch.haq", icon: "Landmark", href: "/app/haq", note: "Government money in your name",
          children: [
            { id: "haq-papers", label: "Your papers", k: "ch.haq.papers", icon: "FileText", href: "/app/haq/papers", note: "Held once, reused everywhere", },
            { id: "haq-recover", label: "What you can recover", k: "ch.haq.recover", icon: "Undo2", href: "/app/haq/recover", note: "Money you were wrongly removed from", },
          ],
        },
      ],
    },
    { tab: true, id: "circle", label: "Circle", k: "ch.mode.circle", icon: "UsersRound", href: "/app/circle", note: "The women around you",
      children: [
        { id: "circles", label: "Circles", k: "ch.circles", icon: "UsersRound", href: "/app/circles", note: "Save and grow together",
          children: [
            { id: "circles-create", label: "Start a circle", k: "ch.circles-create", icon: "Plus", href: "/app/circles/create", note: "Bring women together", },
            { id: "circles-new", label: "Start a savings circle", k: "ch.circles-new", icon: "Coins", href: "/app/circles/new", note: "Everyone pays in monthly", },
          ],
        },
        { id: "messages", label: "Messages", k: "ch.messages", icon: "MessageCircle", href: "/app/messages", note: "Buyers, mentors, circles", },
        { id: "events", label: "Events", k: "ch.events", icon: "Ticket", href: "/app/events", note: "Melas, workshops and meets", },
        { id: "together", label: "Helping each other", k: "ch.together", icon: "Handshake", href: "/app/together", note: "Teach, learn, and move house",
          children: [
            { id: "together-assist", label: "Doing it for her", k: "ch.together-assist", icon: "HeartHandshake", href: "/app/together/assist", note: "With her permission, on her screen", },
            { id: "together-move", label: "Moving house", k: "ch.together-move", icon: "Truck", href: "/app/together/move", note: "Hands, and a vehicle", },
            { id: "together-learn", label: "Learn from each other", k: "ch.together-learn", icon: "BookOpen", href: "/app/together/learn", note: "What one knows, another needs", },
          ],
        },
        { id: "swap", label: "Pass it on", k: "ch.swap", icon: "Gift", href: "/app/swap", note: "Things other women no longer need", },
      ],
    },
    /* Her body, day to day — the cycle tracker and what it leads to. Not a
       tab: five is the bottom bar's ceiling. On a phone she reaches it from
       the cycle card on Home and from the sheet; on a laptop it is here. */
    { tab: false, id: "wellness", label: "Health & Wellness", icon: "Heart", href: "/app/wellness", note: "Your cycle, your body, your mind",
      children: [
        { id: "cycle", label: "Cycle Tracker", icon: "Heart", href: "/app/health/cycle", note: "One tap a day",
          children: [
            { id: "cycle-log", label: "Log today", k: "ch.cycle-log", icon: "CalendarCheck", href: "/app/health/cycle/log", note: "Are you on your period today?", unlisted: true },
            { id: "cycle-period", label: "Your period", k: "ch.cycle-period", icon: "Droplet", href: "/app/health/cycle/period", note: "Today's care", unlisted: true },
            { id: "cycle-symptoms", label: "Symptoms", k: "ch.cycle-symptoms", icon: "Activity", href: "/app/health/cycle/symptoms", note: "What you are feeling", unlisted: true },
            { id: "cycle-mood", label: "Mood", k: "ch.cycle-mood", icon: "Smile", href: "/app/health/cycle/mood", note: "How you are today", unlisted: true },
            { id: "cycle-today", label: "For you today", k: "ch.cycle-today", icon: "Sparkles", href: "/app/health/cycle/today", note: "Food, rest and mind", unlisted: true },
            { id: "cycle-reminders", label: "Reminders", k: "ch.cycle-reminders", icon: "Bell", href: "/app/health/cycle/reminders", note: "When we remind you", unlisted: true },
            { id: "cycle-check", label: "Period check", k: "ch.cycle-check", icon: "AlertCircle", href: "/app/health/cycle/check", note: "When it runs long", unlisted: true },
            { id: "cycle-start", label: "Start tracking", k: "ch.cycle-start", icon: "Sparkles", href: "/app/health/cycle/start", note: "Your cycle, your power", unlisted: true },
            { id: "cycle-learn", label: "Guides", k: "ch.cycle-learn", icon: "BookOpen", href: "/app/health/cycle/learn", note: "Written with doctors' sources", unlisted: true },
          ],
        },
        { id: "cycle-insights", label: "Health Insights", k: "ch.cycle-insights", icon: "FileText", href: "/app/health/cycle/insights", note: "Your patterns, in plain words", },
        { id: "nutrition", label: "Nutrition", k: "ch.nutrition", icon: "Salad", href: "/app/health/nutrition", note: "What to eat this week", },
        { id: "mind", label: "Mental Wellness", k: "ch.mind", icon: "Flower2", href: "/app/health/mind", note: "For the harder days", },
        { id: "workouts", label: "Workouts", k: "ch.workouts", icon: "PersonStanding", href: "/app/health/workouts", note: "Gentle, at home", },
        { id: "health-mentors", label: "Consult a Mentor", k: "ch.health-mentors", icon: "UserRound", href: "/app/health/mentors", note: "Doctors and coaches", },
        { id: "health-today", label: "How are you today?", k: "ch.health-today", icon: "HeartPulse", href: "/app/health/today", note: "One tap, if you want to", },
      ],
    },
    { tab: false, id: "help", label: "Help", k: "ch.mode.help", icon: "LifeBuoy", href: "/app/helpdesk", note: "When something is wrong",
      children: [
        { id: "helphome", label: "What has gone wrong", k: "ch.help", icon: "LifeBuoy", href: "/app/help", note: "Answers, or a person", },
        { id: "safety", label: "Get help now", k: "ch.safety", icon: "ShieldAlert", href: "/app/safety", note: "Alert your people, or call", },
        { id: "safemoney", label: "Money traps", k: "ch.safemoney", icon: "ShieldCheck", href: "/app/safe-money", note: "The tricks aimed at women like you", },
        { id: "bringing", label: "When home is not sure", k: "ch.bringing", icon: "MessageCircle", href: "/app/bringing", note: "Something to show them", },
        { id: "school", label: "The school year", k: "ch.school", icon: "GraduationCap", href: "/app/school", note: "Fees, forms and dates, per child", },
        { id: "incase", label: "If something happens to me", k: "ch.incase", icon: "ShieldCheck", href: "/app/incase", note: "Written down while you can", },
        { id: "rights", label: "Your rights", k: "ch.rights", icon: "Scale", href: "/app/rights", note: "And a free lawyer", },
        { id: "health", label: "Health", k: "ch.health", icon: "HeartPulse", href: "/app/health", note: "What is free, and what is due",
          children: [
            { id: "health-strength", label: "Staying strong", k: "ch.health.strength", icon: "HeartPulse", href: "/app/health/strength", note: "What is free at a government centre", },
            { id: "health-cover", label: "Health cover", k: "ch.health-cover", icon: "ShieldCheck", href: "/app/health/cover", note: "What you are entitled to", },
            { id: "health-change", label: "Menopause", k: "ch.health.change", icon: "Sun", href: "/app/health/change", note: "And working through it", },
          ],
        },
        { id: "family", label: "Family and childcare", k: "ch.family", icon: "Baby", href: "/app/family", note: "Near you, and what it costs", },
        { id: "travel", label: "Travel", k: "ch.travel", icon: "Bus", href: "/app/travel", note: "Routes, cost, and after dark", },
        { id: "travel-journey", label: "On your way", k: "ch.travel-journey", icon: "MapPin", href: "/app/travel/journey", note: "Tell someone, and check in", },
        { id: "voice", label: "Reading it out to you", k: "ch.voice", icon: "Volume2", href: "/app/voice", note: "Any screen read aloud, in your language", },
      ],
    },
    { tab: false, id: "account", label: "You", icon: "UserRound", href: "/app/you", note: "Your account and how the app behaves",
      children: [
        { id: "profile", label: "Your profile", icon: "UserRound", href: "/app/profile", note: "What others see",
          children: [
            { id: "profile-preview", label: "How you look to others", k: "ch.profile-preview", icon: "Eye", href: "/app/profile/preview", note: "Exactly what a buyer sees", },
          ],
        },
        { id: "verify", label: "Getting verified", k: "ch.verify", icon: "BadgeCheck", href: "/app/verify", note: "So people know it is you", },
        { id: "settings", label: "Settings", icon: "Settings", href: "/app/settings", note: "How the app behaves",
          children: [
            { id: "settings-account", label: "Your account", k: "ch.settings-account", icon: "UserRound", href: "/app/settings/account", note: "Name, number, password", },
            { id: "settings-language", label: "Language", k: "ch.settings-language", icon: "Languages", href: "/app/settings/language", note: "What you read in", },
            { id: "settings-notifications", label: "What we tell you", k: "ch.settings-notifications", icon: "Bell", href: "/app/settings/notifications", note: "And how", },
            { id: "settings-quiet-hours", label: "Quiet hours", k: "ch.settings-quiet-hours", icon: "Moon", href: "/app/settings/quiet-hours", note: "When not to disturb you", },
            { id: "settings-delivery", label: "How messages reach you", k: "ch.settings-delivery", icon: "Send", href: "/app/settings/delivery", note: "Which ways, and how often", },
            { id: "settings-appearance", label: "How it looks", k: "ch.settings-appearance", icon: "Palette", href: "/app/settings/appearance", note: "Light, dark, bigger text", },
            { id: "settings-voice", label: "Reading aloud", k: "ch.settings-voice", icon: "Volume2", href: "/app/settings/voice", note: "Speed and voice", },
            { id: "settings-payments", label: "How you get paid", k: "ch.settings-payments", icon: "Wallet", href: "/app/settings/payments", note: "Bank and UPI", },
            { id: "settings-security", label: "Keeping it safe", k: "ch.settings-security", icon: "Lock", href: "/app/settings/security", note: "PIN and sign-in", },
            { id: "settings-offline", label: "When there is no signal", k: "ch.settings-offline", icon: "WifiOff", href: "/app/settings/offline", note: "What still works", },
          ],
        },
        { id: "refer", label: "Bring a friend", k: "ch.refer", icon: "Gift", href: "/app/refer", note: "And you both gain", },
        { id: "feedback", label: "Tell us", k: "ch.feedback", icon: "MessageCircle", href: "/app/feedback", note: "What is wrong, what is missing", },
        { id: "welcome", label: "Getting started", k: "ch.welcome", icon: "Sparkles", href: "/app/welcome", note: "The first five minutes", },
      ],
    },
];

/** The five that a woman moves between. Help and You are header controls. */
export const TABS: Section[] = SECTIONS.filter((s) => s.tab);

/* ── Walking the tree ─────────────────────────────────────────────────────── */

/** Every node, depth-first — for search, for checks, for the hub pages. */
export function allNodes(roots: NavNode[] = SECTIONS): NavNode[] {
  const out: NavNode[] = [];
  const walk = (ns: NavNode[]) => ns.forEach((n) => { out.push(n); if (n.children) walk(n.children); });
  walk(roots);
  return out;
}

/**
 * The chain from section down to the page, for a path.
 *
 * Longest-prefix at every level, so `/app/shop/pricing` returns
 * [Earn, Ways to sell, What should you charge] and a detail route like
 * `/app/circles/abc123` returns [Circle, Circles] — the deepest node that
 * genuinely owns it, never a guess.
 */
export function trailFor(path: string): NavNode[] {
  const clean = (path.split("?")[0].replace(/\/+$/, "")) || "/app";
  const owns = (href: string) =>
    href === clean || (href !== "/app" && clean.startsWith(href + "/"));

  /**
   * Descend ALWAYS; only use `owns` to decide who joins the chain.
   *
   * The first version skipped any node that did not own the path — which was
   * fine while a section's href was a prefix of its children's. It stopped
   * being true the moment sections got hubs of their own: `/app/earn` is not a
   * prefix of `/app/shop/pricing`, so the walk never went inside Earn, no
   * section opened and nothing was marked current on 60-odd screens.
   *
   * A section owns its subtree by construction, not by string prefix.
   */
  const find = (ns: NavNode[]): NavNode[] | null => {
    let best: NavNode[] | null = null;
    for (const n of ns) {
      const deeper = n.children ? find(n.children) : null;
      const cand = deeper ? [n, ...deeper] : owns(n.href) ? [n] : null;
      if (!cand) continue;
      const mine = cand[cand.length - 1].href.length;
      if (!best || mine > best[best.length - 1].href.length) best = cand;
    }
    return best;
  };

  return find(SECTIONS) ?? [];
}

/** Which section a path lives in. Null only for a path outside the tree. */
export function sectionFor(path: string): Section | null {
  const t = trailFor(path);
  return (t[0] as Section) ?? null;
}

/** The exact node for a path, or the nearest ancestor that owns it. */
export function nodeFor(path: string): NavNode | null {
  const t = trailFor(path);
  return t[t.length - 1] ?? null;
}

/**
 * What a Back control should point at.
 *
 * The STRUCTURAL parent, which is not the same thing as the previous page —
 * `Back` prefers where she actually came from and falls back to this. For a
 * detail route under a list (`/app/circles/abc`), the owning node IS the
 * parent, because the deepest node that owns the path is the list itself.
 */
export function parentFor(path: string): NavNode | null {
  const t = trailFor(path);
  if (t.length === 0) return null;
  const last = t[t.length - 1];
  // A detail page under a list: the list is the parent, not its parent.
  const clean = (path.split("?")[0].replace(/\/+$/, "")) || "/app";
  if (last.href !== clean) return last;
  return t[t.length - 2] ?? null;
}

/** Is this path the landing page of its own section? */
export function isSectionHub(path: string): boolean {
  const clean = (path.split("?")[0].replace(/\/+$/, "")) || "/app";
  return SECTIONS.some((s) => s.href === clean);
}

/**
 * Is this path one of the five the bottom bar lands on?
 *
 * The question a Back control has to ask before it draws itself. `isSectionHub`
 * above is the wrong test for it: that is true of Help and You as well, and
 * those two are NOT tabs — a woman reaches `/app/you` from the header, from
 * anywhere, so it needs a way back exactly as much as any other screen does.
 * The five here are the only paths in the app with nowhere above them.
 */
export function isTabRoot(path: string): boolean {
  const clean = (path.split("?")[0].replace(/\/+$/, "")) || "/app";
  return TABS.some((s) => s.href === clean);
}
