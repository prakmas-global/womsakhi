/**
 * Discover — one place that reaches across every other module.
 *
 * Everything here already lives somewhere else in the app: a course belongs to
 * Learning, an opening to Work, a circle to Circle. Discover is a lens, not a
 * store — so each item carries the route it really belongs to, and opening one
 * takes her to the module that owns it rather than to a copy of it here.
 */

const A = (n: string) => `/ux/art/${n}.webp`;

export type Kind = "Course" | "Work" | "Mentor" | "Circle" | "Event" | "Scheme";

export type Find = {
  id: string;
  kind: Kind;
  title: string;
  sub: string;
  meta: string;
  art?: string;
  icon: string;
  tint: string;
  ink: string;
  href: string;
  isNew?: boolean;
  near?: boolean;
};

export const KINDS: Kind[] = ["Course", "Work", "Mentor", "Circle", "Event", "Scheme"];

export const FINDS: Find[] = [
  { id: "f1", kind: "Work", title: "Digital Marketing Specialist", sub: "TechNova Solutions · Remote",
    meta: "₹25,000 – ₹35,000 / month", icon: "Briefcase", tint: "--ux-tint-blue", ink: "--ux-blue",
    href: "/app/opportunities/w1", isNew: true },
  { id: "f2", kind: "Course", title: "Digital Marketing Mastery", sub: "12 lessons · Beginner",
    meta: "4.8 ★ · 1.2k learners", art: A("course-reviewing-tablet-charts"), icon: "BookOpen",
    tint: "--ux-tint-violet", ink: "--ux-violet", href: "/app/programs" },
  { id: "f3", kind: "Scheme", title: "Mudra Loan for small business", sub: "Government of India",
    meta: "Up to ₹10 lakh · No collateral", icon: "Landmark", tint: "--ux-tint-green", ink: "--ux-green",
    href: "/app/support-fund" },
  { id: "f4", kind: "Circle", title: "Pink City Savings — Batch 4", sub: "Jaipur · 8 members",
    meta: "₹1,000 a month · 4 places left", icon: "PiggyBank", tint: "--ux-tint-green", ink: "--ux-green",
    href: "/app/circles/d2", near: true },
  { id: "f5", kind: "Mentor", title: "Sushila Devi", sub: "Tailoring as a trade · 30 years",
    meta: "5.0 ★ · First session free", art: A("avatar-woman-elder-saree"), icon: "Users",
    tint: "--ux-tint-orange", ink: "--ux-orange", href: "/app/mentors/m6" },
  { id: "f6", kind: "Event", title: "Craft Mela — Jaipur", sub: "24 May · Community Hall, Sector 12",
    meta: "Stalls from ₹300 · 12 left", icon: "Store", tint: "--ux-tint-pink", ink: "--ux-pink",
    href: "/app/events", near: true, isNew: true },
  { id: "f7", kind: "Course", title: "Sell your handmade work online", sub: "9 lessons · With templates",
    meta: "4.8 ★ · Free", art: A("course-photographing-handmade-product"), icon: "BookOpen",
    tint: "--ux-tint-violet", ink: "--ux-violet", href: "/app/programs" },
  { id: "f8", kind: "Work", title: "Tailoring orders — festive season", sub: "Rangoli Boutique · Jaipur",
    meta: "Paid per piece · Material supplied", icon: "Scissors", tint: "--ux-tint-orange", ink: "--ux-orange",
    href: "/app/opportunities/w3", near: true },
  { id: "f9", kind: "Scheme", title: "Mahila Samman Savings Certificate", sub: "Post Office scheme",
    meta: "7.5% interest · 2-year term", icon: "Landmark", tint: "--ux-tint-green", ink: "--ux-green",
    href: "/app/support-fund" },
  { id: "f10", kind: "Circle", title: "Home Bakers Collective", sub: "Jaipur · 64 members",
    meta: "Shared festive orders", icon: "CakeSlice", tint: "--ux-tint-orange", ink: "--ux-amber",
    href: "/app/circles/d3", near: true },
  { id: "f11", kind: "Mentor", title: "Lakshmi Iyer", sub: "Selling handmade work online · 7 years",
    meta: "4.8 ★ · First session free", art: A("avatar-woman-blue-saree"), icon: "Users",
    tint: "--ux-tint-pink", ink: "--ux-pink", href: "/app/mentors/m5" },
  { id: "f12", kind: "Event", title: "Women in Tech Webinar", sub: "21 May · Online",
    meta: "Free · 340 registered", icon: "Ticket", tint: "--ux-tint-blue", ink: "--ux-blue",
    href: "/app/events" },
];

export const DISCOVER_ART = {
  empty: A("empty-magnifying-glass-blank-page"),
  hero: A("scene-woman-planning-board"),
};
