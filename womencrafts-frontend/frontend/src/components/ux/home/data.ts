import { allNodes } from "../nav-tree";
/**
 * What is LEFT of the Home module's mock content.
 *
 * **Home itself no longer reads any of it.** `Dashboard` and `HomeRail` draw
 * from `GET /me/home`, and the eleven constants they used to render — her
 * activities, her money, her streak, the mentor suggested to her, the one
 * opening posted today, the first-run checklist — were deleted with them
 * rather than left behind. A fixture nothing renders is worse than no fixture:
 * it reads as a source, and the next screen that needs a number finds one here
 * that looks plausible and belongs to nobody.
 *
 * What remains is here because something live still needs it, and each for a
 * different reason:
 *
 *   `QUICK_ACTIONS` is navigation, not data — the phone's shortcut grid, with
 *   its labels looked up from `nav-tree` so they cannot drift from the routes.
 *
 *   `ME` and `NOTIFICATIONS` are FALLBACKS. `useMe` and `useNotifications` hold
 *   them while the real request is in flight and when it fails, so a screen
 *   renders a plausible person rather than "undefined".
 *
 *   `SEARCH_*` is the hand-written content index behind the search field, which
 *   has no catalogue endpoint yet.
 *
 *   `JOURNEY`, `SKILLS`, `CIRCLES`, `EARNINGS`, `RECOMMENDED`, `OPPORTUNITIES`
 *   and `SEARCH_RECENT` are GONE. Every one of them had lost its last reader:
 *   Home reads `/me/home`, and `services/me.repository` — which assembled the
 *   seven-stage journey out of the first four — reads the server now. The
 *   stage they produced was a claim about a woman's life made out of somebody
 *   else's placeholder, and a fixture with no reader is worse than dead code:
 *   it is a plausible-looking answer waiting for the next person who needs one.
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

export const SEARCH_KINDS = ["All", "Course", "Opportunity", "Mentor", "Circle", "Scheme", "Page"] as const;
