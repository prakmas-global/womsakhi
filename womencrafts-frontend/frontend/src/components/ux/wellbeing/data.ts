/**
 * Wellbeing — health, rights, family and getting about.
 *
 * These four are not about earning. They are about what STOPS a woman earning:
 * an untreated illness, a husband's brother who says the land is his, a child
 * with nowhere to go, a bus route that is not safe after dark. Every other
 * module in this app assumes those are handled. For most members they are not.
 *
 * Nothing here gives medical or legal advice. It points at people who can, says
 * what things cost, and says what is free — because the reason women do not use
 * these services is almost never that they do not exist.
 */

const A = (n: string) => `/ux/art/${n}.webp`;

/* ── Health ───────────────────────────────────────────────────────────── */

export const HEALTH_CHECKS = [
  { id: "h1", label: "Blood pressure", every: "Every 6 months", last: "4 months ago", due: false,
    free: true, where: "Any government clinic", icon: "HeartPulse", tint: "--ux-tint-pink", ink: "--ux-pink" },
  { id: "h2", label: "Haemoglobin (anaemia)", every: "Every year", last: "14 months ago", due: true,
    free: true, where: "Any government clinic", icon: "Droplet", tint: "--ux-tint-orange", ink: "--ux-orange" },
  { id: "h3", label: "Breast examination", every: "Every year", last: "Never", due: true,
    free: true, where: "Women's health centre, Sector 9", icon: "Stethoscope", tint: "--ux-tint-violet", ink: "--ux-violet" },
  { id: "h4", label: "Eye test", every: "Every 2 years", last: "8 months ago", due: false,
    free: false, where: "₹200 at most opticians", icon: "Eye", tint: "--ux-tint-blue", ink: "--ux-blue" },
];

export const RIGHTS = [
  { id: "r1", title: "Your wages are yours", body: "Nobody — husband, father, employer — may take your earnings or hold your bank card.",
    law: "Under the law your account is yours alone.", icon: "BadgeIndianRupee", tint: "--ux-tint-green", ink: "--ux-green" },
  { id: "r2", title: "You can own and inherit property", body: "Daughters inherit equally with sons, including farmland.",
    law: "Hindu Succession (Amendment) Act, 2005.", icon: "Home", tint: "--ux-tint-blue", ink: "--ux-blue" },
  { id: "r3", title: "Equal pay for the same work", body: "An employer may not pay you less than a man for the same job.",
    law: "Code on Wages, 2019.", icon: "Scale", tint: "--ux-tint-violet", ink: "--ux-violet" },
  { id: "r4", title: "Paid maternity leave", body: "26 weeks paid, for establishments with 10 or more workers.",
    law: "Maternity Benefit (Amendment) Act, 2017.", icon: "Baby", tint: "--ux-tint-pink", ink: "--ux-pink" },
  { id: "r5", title: "Protection from harassment at work", body: "Every workplace with 10 or more people must have a complaints committee.",
    law: "POSH Act, 2013.", icon: "ShieldCheck", tint: "--ux-tint-orange", ink: "--ux-orange" },
  { id: "r6", title: "Free legal aid, if you cannot pay", body: "Every woman in India is entitled to a free lawyer, whatever she earns.",
    law: "Legal Services Authorities Act, 1987.", icon: "Gavel", tint: "--ux-tint-green", ink: "--ux-green" },
];

export const CRECHES = [
  { id: "c1", name: "Anganwadi Centre, Sector 12", kind: "Government", ages: "6 months – 6 years",
    hours: "9 AM – 4 PM", fee: "Free", distance: "0.8 km", meals: true,
    art: A("scene-woman-teaching-children") },
  { id: "c2", name: "Little Steps Creche", kind: "Private", ages: "1 – 5 years",
    hours: "8 AM – 6 PM", fee: "₹1,800 a month", distance: "2.1 km", meals: true,
    art: A("scene-mother-baby-laptop") },
  { id: "c3", name: "Sakhi Care Co-op", kind: "Run by members", ages: "2 – 8 years",
    hours: "10 AM – 5 PM", fee: "₹600 a month", distance: "1.4 km", meals: false,
    art: A("scene-two-women-support") },
];

/**
 * A route she takes, and whether it is safe to come back on after dark.
 *
 * `safeAfterDark` is **three-valued on purpose**. True and false are claims
 * somebody has actually made; `null` means nobody has. Collapsing null into
 * true is the one fabrication in this app that could get a woman hurt, so the
 * type does not allow it and the screen says "nobody has told us" instead.
 */
export type Route = {
  id: string;
  name: string;
  how: string;
  mins: number | null;
  cost: string;
  safeAfterDark: boolean | null;
  note: string;
};

export const ROUTES: Route[] = [
  { id: "t1", name: "Home → Community Hall, Sector 12", how: "Bus 12, then 400 m walk",
    mins: 25, cost: "₹15", safeAfterDark: true, note: "Well lit, busy until 9 PM" },
  { id: "t2", name: "Home → Bagru handloom market", how: "Bus 34 to Bagru stand, then shared auto",
    mins: 55, cost: "₹40", safeAfterDark: false, note: "Last safe bus back is 6:30 PM" },
  { id: "t3", name: "Home → SBI Sector 9 (for Mudra)", how: "Walk, 18 minutes",
    mins: 18, cost: "Free", safeAfterDark: true, note: "Main road the whole way" },
];

export const WELLBEING_ART = {
  health: A("scene-woman-meditating"),
  legal: A("scene-woman-reading-document"),
  family: A("scene-mother-baby-laptop"),
  travel: A("scene-woman-walking-with-bag"),
  empty: A("empty-open-notebook-pen"),
};
