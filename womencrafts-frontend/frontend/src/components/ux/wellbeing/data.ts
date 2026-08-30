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

export const HEALTH_TOPICS = [
  { id: "t1", title: "Working while you are pregnant", body: "What you are entitled to, and what is safe to keep doing.",
    mins: 6, icon: "Baby", tint: "--ux-tint-pink", ink: "--ux-pink" },
  { id: "t2", title: "Back and eye strain from close work", body: "Tailoring, embroidery and screen work — what actually helps.",
    mins: 5, icon: "Activity", tint: "--ux-tint-orange", ink: "--ux-orange" },
  { id: "t3", title: "Periods, pain and working through it", body: "When pain is normal and when it is worth seeing someone.",
    mins: 7, icon: "CalendarHeart", tint: "--ux-tint-violet", ink: "--ux-violet" },
  { id: "t4", title: "Feeling low, and what helps", body: "It is common, it is not weakness, and it is treatable.",
    mins: 8, icon: "Brain", tint: "--ux-tint-blue", ink: "--ux-blue" },
];

export const HEALTH_HELP = [
  { id: "hh1", label: "Women's health helpline", num: "1097", note: "Free, 24 hours, every language" },
  { id: "hh2", label: "Mental health helpline (Tele-MANAS)", num: "14416", note: "Free, 24 hours, confidential" },
  { id: "hh3", label: "Ambulance", num: "108", note: "Free" },
];

/* ── Legal Aid & Rights ───────────────────────────────────────────────── */

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

export const LEGAL_HELP = [
  { id: "l1", label: "National Legal Services Authority", num: "15100", note: "Free lawyer, any woman, any income" },
  { id: "l2", label: "Women's helpline", num: "181", note: "Free, 24 hours, every state" },
  { id: "l3", label: "District Legal Services, Jaipur", num: "0141-2227481", note: "Mon–Sat, walk in" },
];

export const LEGAL_STEPS = [
  { id: "s1", label: "Write down what happened", note: "Dates, names, amounts. Do it while you remember." },
  { id: "s2", label: "Keep anything in writing", note: "Messages, receipts, a photograph of a document." },
  { id: "s3", label: "Call 15100 — it is free", note: "They assign a lawyer. You pay nothing, whatever you earn." },
  { id: "s4", label: "Take someone with you", note: "Anyone. You do not have to go alone." },
];

/* ── Family & Childcare ───────────────────────────────────────────────── */

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

export const FAMILY_HELP = [
  { id: "f1", title: "Anganwadi — what you are entitled to",
    body: "Free childcare, a hot meal, and immunisation for under-sixes. Every ward has one.",
    icon: "Baby", tint: "--ux-tint-pink", ink: "--ux-pink" },
  { id: "f2", title: "Working with a baby at home",
    body: "What other members actually do, from women who have done it.",
    icon: "Heart", tint: "--ux-tint-violet", ink: "--ux-violet" },
  { id: "f3", title: "Girls' school scholarships",
    body: "State and central schemes that pay fees, books and a monthly amount.",
    icon: "GraduationCap", tint: "--ux-tint-blue", ink: "--ux-blue" },
  { id: "f4", title: "Sharing childcare with other members",
    body: "Three women, three days each. Cheaper than any creche and safer than none.",
    icon: "UsersRound", tint: "--ux-tint-green", ink: "--ux-green" },
];

/* ── Transport & Safe Travel ──────────────────────────────────────────── */

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

export const TRAVEL_RULES = [
  "Tell one person where you are going and when you expect to be back.",
  "Sit near the driver or near other women on a bus.",
  "Note the vehicle number before you get in, and send it to someone.",
  "If something feels wrong, get out at the next stop. You owe nobody an explanation.",
];

export const TRAVEL_HELP = [
  { id: "tr1", label: "Police", num: "112", note: "Emergency, all services" },
  { id: "tr2", label: "Women's helpline", num: "181", note: "Free, 24 hours" },
  { id: "tr3", label: "Railway helpline", num: "139", note: "For trains and stations" },
];

export const WELLBEING_ART = {
  health: A("scene-woman-meditating"),
  legal: A("scene-woman-reading-document"),
  family: A("scene-mother-baby-laptop"),
  travel: A("scene-woman-walking-with-bag"),
  empty: A("empty-open-notebook-pen"),
};
