/**
 * Pregnancy and fertility — the words and lists these two sections show.
 *
 * General information in plain language, drawn from the approved Health &
 * Wellness design and India's antenatal-care guidance (MoHFW: at least four
 * antenatal check-ups, Td vaccine, iron-folic acid and calcium, the free PMSMA
 * check-up on the 9th of every month). None of it is a diagnosis; every screen
 * that shows it says so and points to a doctor.
 */

import { addDays, daysBetween, today } from "@/lib/health-api";

/* ── pregnancy maths ─────────────────────────────────────────────────── */

export interface PregInfo {
  lmp: string;
  due: string;
  /** Days since the first day of the last period. */
  ga: number;
  week: number;
  day: number;
  trimester: 1 | 2 | 3;
  daysLeft: number;
  overdue: boolean;
}

export function pregInfo(p: { basis: "lmp" | "due"; date: string } | null | undefined): PregInfo | null {
  if (!p?.date) return null;
  const lmp = p.basis === "due" ? addDays(p.date, -280) : p.date;
  const due = addDays(lmp, 280);
  const ga = Math.max(0, daysBetween(today(), lmp));
  const week = Math.floor(ga / 7);
  return {
    lmp, due, ga, week, day: ga % 7,
    trimester: week < 14 ? 1 : week < 28 ? 2 : 3,
    daysLeft: daysBetween(due, today()),
    overdue: ga > 294,
  };
}

/* ── baby, week by week (the design's list) ──────────────────────────── */

export const BABY: [number, string, string][] = [
  [4, "a poppy seed", "The pregnancy is just beginning. Many women don't know yet."],
  [8, "a raspberry", "Tiny arms, legs and facial features are forming."],
  [12, "a lime", "Most major organs have formed. The first trimester ends soon."],
  [16, "an avocado", "Baby can make small movements you may not feel yet."],
  [20, "a banana", "You're about halfway. Many women start to feel movements."],
  [24, "an ear of corn", "Baby is growing steadily and gaining weight."],
  [28, "a brinjal", "The third trimester begins. Eyes can open and close."],
  [32, "a squash", "Baby is putting on fat and getting stronger."],
  [36, "a papaya", "Baby is getting ready for birth and may move lower."],
  [40, "a small watermelon", "Your estimated due date. Many babies arrive a little before or after."],
];

export const babyFor = (week: number) => [...BABY].reverse().find((b) => b[0] <= Math.max(4, week)) ?? BABY[0];

export const MILESTONES: [number, string][] = [
  [12, "End of 1st trimester"], [20, "Halfway"], [28, "3rd trimester"], [37, "Full term"], [40, "Due date"],
];

/** A short, practical tip for each trimester. */
export const TRIMESTER_TIPS: Record<1 | 2 | 3, string[]> = {
  1: ["Take folic acid every day, as your doctor advises.", "Eat small meals often if you feel sick.", "Register your pregnancy at your nearest health centre."],
  2: ["Start iron and calcium tablets if your doctor gives them.", "Gentle walks help your back and sleep.", "Ask about the mid-pregnancy (18–20 week) scan."],
  3: ["Count baby's movements every day.", "Pack your hospital bag by week 36.", "Plan how you will reach the hospital, day or night."],
};

/* ── symptoms and warning signs ──────────────────────────────────────── */

export const PREG_SYMPTOMS = [
  "Nausea", "Tiredness", "Back pain", "Swelling", "Heartburn", "Headache",
  "Cramps", "Trouble sleeping", "Constipation", "Mood changes",
] as const;

export const SEVERITY = ["Mild", "Moderate", "Strong"] as const;

/** Go to hospital or call 108 now — the signs every antenatal card lists. */
export const DANGER_SIGNS = [
  "Bleeding from the vagina",
  "Severe headache or blurred vision",
  "Sudden swelling of face, hands or feet",
  "Fits or fainting",
  "High fever",
  "Severe pain in the belly",
  "Water leaking before labour",
  "Baby moving less than usual",
];

/* ── care plan ───────────────────────────────────────────────────────── */

/** At least four antenatal check-ups (MoHFW). Weeks are guides, not rules. */
export const ANC_VISITS: { id: string; when: string; from: number; to: number; title: string; items: string[] }[] = [
  { id: "anc1", when: "By 12 weeks", from: 0, to: 12, title: "First check-up and registration",
    items: ["Register your pregnancy and get your Mother & Child Protection card", "Blood tests: haemoglobin, blood group, sugar, HIV, syphilis", "Urine test, blood pressure and weight", "Start folic acid / iron as advised"] },
  { id: "anc2", when: "14–26 weeks", from: 14, to: 26, title: "Second check-up",
    items: ["Mid-pregnancy (anomaly) scan around 18–20 weeks", "First Td injection (two doses, a month apart)", "Iron and calcium tablets every day", "Blood pressure, weight and baby's growth"] },
  { id: "anc3", when: "28–34 weeks", from: 28, to: 34, title: "Third check-up",
    items: ["Haemoglobin test again", "Baby's position and heartbeat", "Sugar test if your doctor advises", "Talk about where you will give birth"] },
  { id: "anc4", when: "36 weeks to birth", from: 36, to: 42, title: "Fourth check-up",
    items: ["Baby's position checked", "Plan for the birth and transport", "Signs of labour explained", "Keep your records and ID ready"] },
];

/** Checklist by trimester — the design's list. Keys are stable ids. */
export const CARE_CHECKS: Record<1 | 2 | 3, { id: string; text: string }[]> = {
  1: [
    { id: "t1-book", text: "Book your first antenatal check-up" },
    { id: "t1-supp", text: "Ask your doctor about supplements" },
    { id: "t1-tests", text: "Ask which first-trimester tests you need" },
    { id: "t1-card", text: "Get your Mother & Child Protection card" },
  ],
  2: [
    { id: "t2-scan", text: "Ask about the mid-pregnancy scan" },
    { id: "t2-td", text: "Take your Td injections" },
    { id: "t2-exercise", text: "Ask which exercise is safe for you" },
    { id: "t2-where", text: "Decide where you plan to give birth" },
  ],
  3: [
    { id: "t3-labour", text: "Learn the signs of labour" },
    { id: "t3-bag", text: "Pack your hospital bag" },
    { id: "t3-transport", text: "Plan transport to the hospital (108 / 102)" },
    { id: "t3-papers", text: "Keep your records and ID ready" },
  ],
};

export const BAG = [
  "ID and Aadhaar card", "Antenatal records and MCP card", "Comfortable clothes", "Front-opening nightwear",
  "Toiletries and sanitary pads", "Phone and charger", "Baby clothes and cap", "Nappies / soft cloth",
  "Soft blanket", "Snacks and water bottle",
];

export const APPT_TITLES = ["Antenatal check-up", "Ultrasound scan", "Blood test", "Td injection", "PMSMA check-up"];

/** The 9th of this month, or of next month if it has passed — PMSMA day. */
export function nextPmsma(): string {
  const t = today();
  const [y, m] = t.split("-").map(Number);
  const here = `${y}-${String(m).padStart(2, "0")}-09`;
  if (here >= t) return here;
  const nm = m === 12 ? 1 : m + 1, ny = m === 12 ? y + 1 : y;
  return `${ny}-${String(nm).padStart(2, "0")}-09`;
}

export const PREG_QUESTIONS = [
  { id: "q-due", text: "Is my due date right, from the scan?" },
  { id: "q-tests", text: "Which tests do I need this month?" },
  { id: "q-meds", text: "Which tablets should I take, and when?" },
  { id: "q-food", text: "What should I eat more of, or avoid?" },
  { id: "q-work", text: "Is my work or travel safe?" },
  { id: "q-birth", text: "Where will I give birth, and who do I call when labour starts?" },
];

/* ── fertility ──────────────────────────────────────────────────────── */

export const PRECONCEPTION = [
  { id: "pc-folic", text: "Start folic acid 3 months before trying (ask your doctor)" },
  { id: "pc-checkup", text: "Get a general check-up and haemoglobin test" },
  { id: "pc-thyroid", text: "Ask about thyroid and sugar tests" },
  { id: "pc-vaccines", text: "Check your vaccines (rubella, hepatitis B)" },
  { id: "pc-weight", text: "Eat well and stay active — a healthy weight helps" },
  { id: "pc-stop", text: "Stop tobacco and alcohol" },
  { id: "pc-track", text: "Log your periods for at least 3 cycles" },
];

export const FERT_QUESTIONS = [
  { id: "fq-regular", text: "Are my cycles regular for my age?" },
  { id: "fq-pain", text: "Is my period pain or bleeding normal?" },
  { id: "fq-time", text: "How long should we try before tests?" },
  { id: "fq-pcos", text: "Could I have PCOS or a thyroid problem?" },
  { id: "fq-meds", text: "Is any medicine I take a problem for pregnancy?" },
];

export const GOAL_LABEL: Record<string, { label: string; note: string }> = {
  "understand-cycle": { label: "Just tracking", note: "Know when your period is coming and how you feel through the month." },
  "trying-to-conceive": { label: "Trying to conceive", note: "See your estimated fertile window and get ready with a preconception checklist." },
  "symptom-care": { label: "Managing symptoms", note: "Track pain, mood and flow so you can talk to a doctor with facts." },
  "perimenopause": { label: "Perimenopause", note: "Follow changes in your cycle in your 40s." },
};
