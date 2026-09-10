import { allNodes } from "../nav-tree";
/**
 * The Home module's content — mock for now.
 *
 * Deliberately shaped like what `/me/summary`, `/me/bookings`, `/catalog/*` and
 * `/growth/opportunities` already return, so wiring it to the backend later is
 * a change of source, not a rewrite of any screen. Frontend first was the
 * explicit ask: see it working, then connect it.
 */

const A = (n: string) => `/ux/art/${n}.webp`;

export const PROFILE_STEPS = [
  { id: "p1", label: "Add a photo", done: true, mins: 1 },
  { id: "p2", label: "Tell us what you want to focus on", done: true, mins: 2 },
  { id: "p3", label: "Add your skills", done: true, mins: 3 },
  { id: "p4", label: "Add your work experience", done: false, mins: 5 },
  { id: "p5", label: "Verify your phone number", done: false, mins: 1 },
];

/**
 * One number, computed once.
 *
 * The rail counted these steps and got 60% while `ME.profilePct` was hand-set
 * to 80, so the same profile was described two ways on the same screen.
 */
export const PROFILE_PCT = Math.round(
  (PROFILE_STEPS.filter((s) => s.done).length / PROFILE_STEPS.length) * 100,
);

export const ME = {
  first: "Ananya",
  name: "Ananya Sharma",
  tagline: "Dream • Learn • Achieve",
  avatar: A("avatar-woman-purple-kurta") ,
  verified: true,
  profilePct: PROFILE_PCT,
  unread: 8,
};

/**
 * The shortcut grid on the front page.
 *
 * **The labels are looked up from the navigation, not typed here.** They used
 * to be their own list, and it drifted: this grid said "Learning", the rail
 * said "Courses", the top bar said "Learn" and the page itself said
 * "Learning" — four names for `/app/programs` on one screen. It said "Earn"
 * for `/app/wallet`, so a woman looking for work followed it to her bank
 * balance.
 *
 * Only the tint is decided here. Everything a person reads comes from `nav.ts`,
 * which means a rename there reaches this grid with nothing to remember.
 */
const TINTS: Record<string, { icon: string; tint: string; ink: string }> = {
  "/app/programs":      { icon: "BookOpen",   tint: "--ux-tint-violet", ink: "--ux-violet" },
  "/app/mentors":       { icon: "Users",      tint: "--ux-tint-orange", ink: "--ux-orange" },
  "/app/opportunities": { icon: "Briefcase",  tint: "--ux-tint-blue",   ink: "--ux-blue" },
  "/app/wallet":        { icon: "Wallet",     tint: "--ux-tint-green",  ink: "--ux-green" },
  "/app/circles":       { icon: "UsersRound", tint: "--ux-tint-pink",   ink: "--ux-pink" },
  "/app/sakhi":         { icon: "Sparkles",   tint: "--ux-tint-lilac",  ink: "--ux-violet" },
};

export const QUICK_ACTIONS = Object.entries(TINTS).map(([href, look]) => {
  const item = allNodes().find((i) => i.href === href);
  return {
    href,
    label: item?.label ?? href,
    // The rail's own one-liner, so the tile and the rail say the same thing
    // about the same destination.
    sub: item?.note ?? "",
    ...look,
  };
});

export const JOURNEY = {
  title: "Digital Marketing Mastery",
  next: "Social Media Strategy",
  pct: 65,
  done: 8,
  total: 12,
  leftMins: 96,
  art: A("course-working-laptop-smiling"),
  upNext: [
    { id: "l9",  n: 9,  title: "Social Media Strategy", mins: 14, kind: "Video" },
    { id: "l10", n: 10, title: "Writing posts that sell", mins: 11, kind: "Video" },
    { id: "l11", n: 11, title: "Practice: plan one week", mins: 20, kind: "Task" },
  ],
};

export const RECOMMENDED = [
  { id: "ux", title: "UX Design Fundamentals", meta: "Course • Beginner", rating: "4.8", count: "1.2k", art: A("course-reviewing-tablet-charts") },
  { id: "cw", title: "Content Writing for Brands", meta: "Course • Beginner", rating: "4.7", count: "982", art: A("course-writing-notebook") },
  { id: "sp", title: "Speak with Confidence", meta: "Course • All levels", rating: "4.9", count: "2.1k", art: A("course-confident-microphone") },
];

/** One mentor surfaced in the rail — matched to what she is currently learning. */
export const SUGGESTED_MENTOR = {
  name: "Neha Verma",
  role: "Digital Marketing • 8 years",
  art: A("avatar-woman-blazer"),
  rating: "4.9",
  sessions: "230 sessions",
  langs: "Hindi, English",
  free: "Free first session",
};

export const SKILLS = [
  { name: "Digital Marketing", pct: 65, tone: "--ux-brand-600" },
  { name: "Communication", pct: 42, tone: "--ux-blue" },
  { name: "Financial Literacy", pct: 80, tone: "--ux-green" },
];

export const OPPORTUNITIES = [
  { id: "o1", title: "Digital Marketing Specialist", org: "TechNova Solutions", place: "Remote",
    tags: ["Full-time", "₹6 – 9 LPA"], ago: "2h ago", icon: "Briefcase", tint: "--ux-tint-pink", ink: "--ux-pink" },
  { id: "o2", title: "Content Creator (Freelance)", org: "BrandStory", place: "Work from Anywhere",
    tags: ["Freelance", "₹25k – 40k /month"], ago: "5h ago", icon: "PenLine", tint: "--ux-tint-green", ink: "--ux-green" },
  { id: "o3", title: "Social Media Manager", org: "HerConnect", place: "Bangalore",
    tags: ["Full-time", "₹4 – 6 LPA"], ago: "1d ago", icon: "Monitor", tint: "--ux-tint-blue", ink: "--ux-blue" },
];

export const CIRCLES = [
  { id: "c1", name: "Women Entrepreneurs India", members: "12.5k Members", extra: "+320",
    art: A("scene-women-group-circle"), tint: "--ux-tint-pink" },
  { id: "c2", name: "Freelancers & Creators Hub", members: "8.3k Members", extra: "+180",
    art: A("scene-women-celebrating"), tint: "--ux-tint-orange" },
  { id: "c3", name: "Tech Women Community", members: "15.7k Members", extra: "+410",
    art: A("scene-women-business-handshake"), tint: "--ux-tint-violet" },
];

export const ACTIVITIES = [
  { id: "a1", d: "18", m: "MAY", title: "Mentor Session with Neha", time: "11:00 AM – 12:00 PM", cta: "Join" },
  { id: "a2", d: "19", m: "MAY", title: "Digital Marketing Live Class", time: "04:00 PM – 05:30 PM", cta: "Join" },
  { id: "a3", d: "21", m: "MAY", title: "Women in Tech Webinar", time: "07:00 PM – 08:30 PM", cta: "View" },
];

export const EARNINGS = {
  total: 24350, delta: "+18.6%", period: "This Month",
  series: [12, 20, 14, 26, 18, 30, 24, 38, 32, 44, 40, 58],
};

export const SUGGESTIONS = [
  "How to start freelancing?",
  "Best skills to learn in 2024?",
  "How to find a mentor?",
];

export const MEMBER_FACES = [
  A("avatar-woman-blazer"), A("avatar-woman-hijab"),
  A("avatar-woman-teal-shirt"), A("avatar-woman-blue-saree"),
];

export const NOTIFICATIONS = [
  { id: "n1", kind: "mentor", title: "Neha accepted your mentor request", body: "You can now book a session with her.", when: "12 min ago", unread: true, icon: "Users", tint: "--ux-tint-orange", ink: "--ux-orange" },
  { id: "n2", kind: "course", title: "New lesson unlocked", body: "Social Media Strategy is ready in Digital Marketing Mastery.", when: "1 hour ago", unread: true, icon: "BookOpen", tint: "--ux-tint-violet", ink: "--ux-violet" },
  { id: "n3", kind: "work", title: "3 new opportunities match you", body: "Based on your skills in digital marketing.", when: "3 hours ago", unread: true, icon: "Briefcase", tint: "--ux-tint-blue", ink: "--ux-blue" },
  { id: "n4", kind: "money", title: "₹4,200 received", body: "Payment from BrandStory for October work.", when: "Yesterday", unread: false, icon: "BadgeIndianRupee", tint: "--ux-tint-green", ink: "--ux-green" },
  { id: "n5", kind: "circle", title: "Priya replied in Women Entrepreneurs India", body: "“This pricing guide changed how I quote.”", when: "Yesterday", unread: false, icon: "UsersRound", tint: "--ux-tint-pink", ink: "--ux-pink" },
  { id: "n6", kind: "event", title: "Women in Tech Webinar starts tomorrow", body: "07:00 PM. You are registered.", when: "2 days ago", unread: false, icon: "CalendarDays", tint: "--ux-tint-violet", ink: "--ux-violet" },
];


/**
 * One flat searchable index behind the topbar field.
 *
 * Flat rather than grouped because search filters across kinds and then groups
 * the survivors — grouping first means filtering four lists and re-merging.
 */
export type SearchHit = {
  id: string;
  title: string;
  sub: string;
  kind: "Course" | "Opportunity" | "Mentor" | "Circle" | "Scheme" | "Page";
  icon: string;
  tint: string;
  ink: string;
  href: string;
  img?: string;
};

/** Hand-written content — courses, jobs, mentors, circles, schemes. */
const CONTENT_HITS: SearchHit[] = [
  { id: "s1", title: "Digital Marketing Mastery", sub: "12 lessons · 4.8 out of 5 · Beginner friendly", kind: "Course",
    icon: "BookOpen", tint: "--ux-tint-violet", ink: "--ux-violet", href: "/app/programs",
    img: "/ux/art/course-working-laptop-smiling.webp" },
  { id: "s2", title: "Communication Skills for Women", sub: "8 lessons · 4.9 out of 5 · Hindi & English", kind: "Course",
    icon: "BookOpen", tint: "--ux-tint-violet", ink: "--ux-violet", href: "/app/programs",
    img: "/ux/art/course-confident-microphone.webp" },
  { id: "s3", title: "Financial Literacy Essentials", sub: "10 lessons · 4.7 out of 5 · Free", kind: "Course",
    icon: "BookOpen", tint: "--ux-tint-violet", ink: "--ux-violet", href: "/app/programs",
    img: "/ux/art/course-counting-coins-calculator.webp" },
  { id: "s4", title: "Sell your handmade work online", sub: "9 lessons · 4.8 out of 5 · With templates", kind: "Course",
    icon: "BookOpen", tint: "--ux-tint-violet", ink: "--ux-violet", href: "/app/programs",
    img: "/ux/art/course-photographing-handmade-product.webp" },

  { id: "s5", title: "Digital Marketing Specialist", sub: "Remote · ₹25,000–35,000 / month · Full time", kind: "Opportunity",
    icon: "Briefcase", tint: "--ux-tint-blue", ink: "--ux-blue", href: "/app/opportunities" },
  { id: "s6", title: "Social Media Manager", sub: "Hybrid, Jaipur · ₹18,000–24,000 / month", kind: "Opportunity",
    icon: "Briefcase", tint: "--ux-tint-blue", ink: "--ux-blue", href: "/app/opportunities" },
  { id: "s7", title: "Tailoring orders — bulk, festive season", sub: "Near you · Paid per piece", kind: "Opportunity",
    icon: "Briefcase", tint: "--ux-tint-blue", ink: "--ux-blue", href: "/app/opportunities" },

  { id: "s8", title: "Neha Verma", sub: "Digital marketing · 8 years · Hindi, English", kind: "Mentor",
    icon: "Users", tint: "--ux-tint-orange", ink: "--ux-orange", href: "/app/mentors",
    img: "/ux/art/avatar-woman-blazer.webp" },
  { id: "s9", title: "Kavita Shah", sub: "Finance & savings · 12 years · Gujarati, Hindi", kind: "Mentor",
    icon: "Users", tint: "--ux-tint-orange", ink: "--ux-orange", href: "/app/mentors",
    img: "/ux/art/avatar-woman-pink-glasses.webp" },
  { id: "s10", title: "Razia Sultana", sub: "Small business setup · 6 years · Urdu, Hindi", kind: "Mentor",
    icon: "Users", tint: "--ux-tint-orange", ink: "--ux-orange", href: "/app/mentors",
    img: "/ux/art/avatar-woman-hijab.webp" },

  { id: "s11", title: "Women Entrepreneurs India", sub: "2,340 members · Very active", kind: "Circle",
    icon: "UsersRound", tint: "--ux-tint-pink", ink: "--ux-pink", href: "/app/circles" },
  { id: "s12", title: "Tech Women Community", sub: "1,180 members · Weekly meet", kind: "Circle",
    icon: "UsersRound", tint: "--ux-tint-pink", ink: "--ux-pink", href: "/app/circles" },
  { id: "s13", title: "Jaipur Savings Circle", sub: "42 members · ₹500 / month", kind: "Circle",
    icon: "UsersRound", tint: "--ux-tint-pink", ink: "--ux-pink", href: "/app/circles" },

  { id: "s14", title: "Mudra Loan for small business", sub: "Government scheme · Up to ₹10 lakh", kind: "Scheme",
    icon: "Landmark", tint: "--ux-tint-green", ink: "--ux-green", href: "/app/support-fund" },
  { id: "s15", title: "Mahila Samman Savings Certificate", sub: "Government scheme · 7.5% interest", kind: "Scheme",
    icon: "Landmark", tint: "--ux-tint-green", ink: "--ux-green", href: "/app/support-fund" },

];

/**
 * The hand-written content hits.
 *
 * Page results are NOT here: they are derived from the navigation in
 * `nav-search.ts`, which is what the palette actually reads. Keeping a second
 * page index in this file would be the same duplication that let forty routes
 * go missing from search in the first place.
 */
export const SEARCH_INDEX: SearchHit[] = CONTENT_HITS;

/** Shown before she types anything — the four things people look for most. */
export const SEARCH_SUGGESTED = [
  "Digital marketing",
  "Work from home",
  "Savings circle near me",
  "Free certificate courses",
];

export const SEARCH_RECENT = ["Tailoring orders", "Neha Verma", "Mudra loan"];

export const SEARCH_KINDS = ["All", "Course", "Opportunity", "Mentor", "Circle", "Scheme", "Page"] as const;


/* ── What today actually is ────────────────────────────────────────────────
   A dashboard that lists modules makes her do the deciding. These three
   shapes answer the three questions she opens the app with: did money come
   in, is there work for me today, and what is the one thing to do next. */

/** Money, with the only context that makes a number mean anything: her goal. */
/** ₹25,000 rather than ₹25000 — the separator is what makes it readable. */
/**
 * WHOLE rupees, not paise — pay is stored as `25000` meaning ₹25,000.
 * See `kit/money.formatWholeRupees` for why this is a separate name.
 */
export { formatWholeRupees as money } from "../kit/money";

export const MONEY = {
  earnedThisMonth: 24350,
  goal: 30000,
  lastMonth: 20530,
  pending: 4200,
  pendingFrom: "BrandStory",
  pendingDue: "Friday",
  /** Her rank inside her own circle — comparison she can actually act on. */
  betterThanPct: 68,
};

/** The single best-matched opening posted today. One, not a list. */
export const TODAYS_WORK = {
  id: "w1",
  title: "Digital Marketing Specialist",
  org: "TechNova Solutions",
  pay: "₹25,000 – ₹35,000",
  place: "Remote",
  match: 92,
  closesIn: "4 days",
  applicants: 34,
};

/**
 * The one next step, and why it is the one.
 *
 * `because` is the important field. "Finish this lesson" is an instruction;
 * "one lesson left before your certificate" is a reason, and she can disagree
 * with a reason.
 */
export const NEXT_STEP = {
  title: "Finish Social Media Strategy",
  because: "It is the last lesson before your certificate.",
  mins: 14,
  href: "/app/programs",
  icon: "PlayCircle",
  cta: "Continue",
};

/** Momentum. Seven days, most recent last. */
export const STREAK = {
  days: 5,
  week: [true, true, false, true, true, true, false],
  best: 12,
};

/** What Sakhi noticed, unprompted. */
export const SAKHI_NUDGE = {
  text: "Three new tailoring orders opened near Jaipur this week — your stitching skill matches all three.",
  action: "Show me",
  href: "/app/opportunities",
};

/**
 * The first-run version of everything above.
 *
 * A new member has no earnings, no streak and no applications, and showing her
 * six cards of zeroes is the worst first impression an app can make. The home
 * screen switches to a guided start instead.
 */
export const FIRST_RUN_STEPS = [
  { id: "f1", label: "Tell us what you are good at", mins: 2, icon: "Sparkles", href: "/app/profile", done: false },
  { id: "f2", label: "Add a photo so employers see you", mins: 1, icon: "Camera", href: "/app/profile", done: false },
  { id: "f3", label: "Pick one skill to build", mins: 3, icon: "BookOpen", href: "/app/programs", done: false },
  { id: "f4", label: "Apply for your first opening", mins: 5, icon: "Briefcase", href: "/app/opportunities", done: false },
];
