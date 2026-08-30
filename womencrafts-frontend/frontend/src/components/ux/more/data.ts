/**
 * The six modules that belong inside existing sections.
 *
 * Skill Assessment and Digital Literacy are Learn. Insurance is Money. Group
 * Buying is Work. Voice Mode and Offline Mode are settings — they change how
 * the app behaves rather than what is in it.
 */

const A = (n: string) => `/ux/art/${n}.webp`;

/* ── Skill Assessment ─────────────────────────────────────────────────── */

export const ASSESSMENTS = [
  { id: "a1", skill: "Tailoring", level: "Experienced", pct: 82, taken: "12 Mar 2026",
    mins: 20, questions: 24, badge: true, icon: "Scissors", tint: "--ux-tint-orange", ink: "--ux-orange",
    note: "Employers see this on your profile" },
  { id: "a2", skill: "Spoken English", level: "Beginner", pct: 41, taken: "2 Feb 2026",
    mins: 15, questions: 20, badge: false, icon: "Languages", tint: "--ux-tint-blue", ink: "--ux-blue",
    note: "Take it again any time — only your best counts" },
  { id: "a3", skill: "Digital marketing", level: null, pct: 0, taken: null,
    mins: 18, questions: 22, badge: false, icon: "Megaphone", tint: "--ux-tint-violet", ink: "--ux-violet",
    note: "You have finished 8 of 12 lessons — worth a try" },
  { id: "a4", skill: "Money and bookkeeping", level: null, pct: 0, taken: null,
    mins: 15, questions: 18, badge: false, icon: "Calculator", tint: "--ux-tint-green", ink: "--ux-green",
    note: "Most tested skill by employers on WomSakhi" },
];

/* ── Digital Literacy ─────────────────────────────────────────────────── */

export const DIGITAL_STEPS = [
  { id: "d1", label: "Using a smartphone", mins: 20, done: true,
    note: "Settings, storage, and keeping it working when it is full" },
  { id: "d2", label: "WhatsApp for business", mins: 25, done: true,
    note: "Broadcast lists, catalogues, and replying without losing your evening" },
  { id: "d3", label: "Taking and sending photos", mins: 15, done: true,
    note: "Light, framing, and making a photo small enough to send" },
  { id: "d4", label: "UPI and paying safely", mins: 20, done: false, current: true,
    note: "How UPI actually works, and every way people are cheated on it" },
  { id: "d5", label: "Spotting a scam message", mins: 15, done: false,
    note: "The five kinds that reach members most, with real examples" },
  { id: "d6", label: "Keeping your account safe", mins: 15, done: false,
    note: "Passwords, OTPs, and what to do if you think somebody is in" },
];

/* ── Insurance & Pension ──────────────────────────────────────────────── */

/* ── Group Buying ─────────────────────────────────────────────────────── */

export const GROUP_BUYS = [
  { id: "g1", what: "Cotton fabric, wholesale roll", unit: "per metre",
    alone_minor: 12000, together_minor: 7500, need: 20, joined: 14,
    closes: "in 3 days", by: "Tailors of Sector 12", art: A("course-sewing-machine") },
  { id: "g2", what: "Packing boxes and tape", unit: "per 50",
    alone_minor: 45000, together_minor: 29000, need: 10, joined: 10,
    closes: "closed — ordering now", by: "Home Bakers Collective", art: A("course-cooking-packing-orders") },
  { id: "g3", what: "Embroidery thread, 100 shades", unit: "per box",
    alone_minor: 180000, together_minor: 115000, need: 8, joined: 3,
    closes: "in 9 days", by: "Women Entrepreneurs India", art: A("course-handmade-market-stall") },
];

/* ── Voice Mode ───────────────────────────────────────────────────────── */

export const VOICE_LANGS = [
  { code: "hi", name: "हिन्दी", en: "Hindi", ready: true },
  { code: "en", name: "English", en: "English", ready: true },
  { code: "te", name: "తెలుగు", en: "Telugu", ready: true },
  { code: "ta", name: "தமிழ்", en: "Tamil", ready: true },
  { code: "ur", name: "اردو", en: "Urdu", ready: true },
  { code: "bn", name: "বাংলা", en: "Bengali", ready: false },
];

export const VOICE_CAN = [
  { id: "v1", say: "“How much did I earn this month?”", does: "Reads your balance out", icon: "Wallet" },
  { id: "v2", say: "“Find me tailoring work near Jaipur”", does: "Searches and reads the first three", icon: "Briefcase" },
  { id: "v3", say: "“Mark order 1042 as ready”", does: "Moves the order on", icon: "Package" },
  { id: "v4", say: "“What do I owe my circle?”", does: "Tells you the amount and the date", icon: "PiggyBank" },
];

/* ── Offline Mode ─────────────────────────────────────────────────────── */

export const OFFLINE_ITEMS = [
  { id: "o1", label: "Your wallet balance and last 30 payments", size: "0.2 MB", on: true, always: true },
  { id: "o2", label: "Your orders and buyer messages", size: "0.4 MB", on: true, always: true },
  { id: "o3", label: "Courses you have started", size: "48 MB", on: true, always: false },
  { id: "o4", label: "Your certificates", size: "1.1 MB", on: true, always: false },
  { id: "o5", label: "Helplines and safety numbers", size: "0.1 MB", on: true, always: true },
  { id: "o6", label: "Schemes you may qualify for", size: "0.6 MB", on: false, always: false },
];

export const MORE_ART = {
  assess: A("course-holding-certificate"),
  digital: A("course-working-laptop-smiling"),
  cover: A("icon-padlock"),
  group: A("scene-women-group-circle"),
  voice: A("mascot-robot-waving"),
  offline: A("scene-woman-walking-with-bag"),
};

/**
 * Formatting money lives in `kit/money`, not here.
 *
 * There were seven copies of this function across seven data files, and they
 * had already drifted: one of them returned "Free" for zero and the others
 * returned "₹0". Re-exported rather than deleted so nothing has to change its
 * imports, but there is one implementation now.
 */
export { formatMoney as rupees } from "../kit/money";
