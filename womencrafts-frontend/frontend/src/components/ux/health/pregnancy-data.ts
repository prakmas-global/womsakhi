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

/**
 * Weeks and the due date, the standard way: 280 days (40 weeks) from the first
 * day of the last period (Naegele's rule). When a scan or her doctor confirmed
 * a due date (`edd`), that date wins and the weeks are counted back from it —
 * a clinician's dating always overrides the calculation.
 */
export function pregInfo(p: { basis: "lmp" | "due"; date: string; edd?: string } | null | undefined): PregInfo | null {
  if (!p?.date) return null;
  const lmp = p.edd ? addDays(p.edd, -280) : p.basis === "due" ? addDays(p.date, -280) : p.date;
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

/* ── baby, week by week ───────────────────────────────────────────────── */

export interface BabyWeek {
  week: number;
  /** What baby is about the size of, with its article ("a mango"). */
  size: string;
  /** Approximate length in cm: crown to rump until week 19, head to heel from week 20. */
  cm: number;
  /** Approximate weight in grams. */
  g: number;
  dev: string;
}

/**
 * Every week from 4 to 40. Sizes and weights are rounded averages from common
 * growth charts; every baby is different and the screen says so.
 */
export const GROWTH: BabyWeek[] = [
  { week: 4, size: "a poppy seed", cm: 0.1, g: 0, dev: "The tiny embryo has settled in the womb. Many women don't know yet." },
  { week: 5, size: "a sesame seed", cm: 0.2, g: 0, dev: "The heart and the spine are starting to form." },
  { week: 6, size: "a lentil", cm: 0.6, g: 0, dev: "A tiny heartbeat may be seen on a scan." },
  { week: 7, size: "a blueberry", cm: 1.3, g: 0, dev: "Little buds that will become arms and legs appear. The brain grows fast." },
  { week: 8, size: "a kidney bean", cm: 1.6, g: 1, dev: "Fingers and toes begin to form. Baby moves, but too little to feel." },
  { week: 9, size: "a grape", cm: 2.3, g: 2, dev: "Tiny muscles are forming, and the face is taking shape." },
  { week: 10, size: "a strawberry", cm: 3.1, g: 4, dev: "All the major organs are in place and starting to work." },
  { week: 11, size: "a chestnut", cm: 4.1, g: 7, dev: "Baby can open and close tiny hands." },
  { week: 12, size: "a kiwi", cm: 5.4, g: 14, dev: "Reflexes begin. The first trimester is almost over." },
  { week: 13, size: "a lemon", cm: 7.4, g: 23, dev: "Fingerprints are forming on the tiny fingertips." },
  { week: 14, size: "a peach", cm: 8.7, g: 43, dev: "Baby can frown and squint, and fine hair is growing." },
  { week: 15, size: "an apple", cm: 10.1, g: 70, dev: "Bones are getting harder. Baby may sense light." },
  { week: 16, size: "an avocado", cm: 11.6, g: 100, dev: "The heart pumps about 25 litres of blood a day." },
  { week: 17, size: "an onion", cm: 13, g: 140, dev: "Fat starts to build up under the skin." },
  { week: 18, size: "a sweet potato", cm: 14.2, g: 190, dev: "Baby can hear sounds. The anomaly scan is around now." },
  { week: 19, size: "a mango", cm: 15.3, g: 240, dev: "A creamy coating (vernix) covers and protects the skin." },
  { week: 20, size: "a banana", cm: 25.6, g: 300, dev: "Halfway there. Many women feel the first kicks." },
  { week: 21, size: "a carrot", cm: 26.7, g: 360, dev: "Baby swallows a little fluid and has times of sleep and waking." },
  { week: 22, size: "a coconut", cm: 27.8, g: 430, dev: "Eyebrows and eyelids are formed." },
  { week: 23, size: "a large orange", cm: 28.9, g: 500, dev: "Baby can feel you move and hears your voice." },
  { week: 24, size: "an ear of corn", cm: 30, g: 600, dev: "The lungs are developing, and baby is gaining weight steadily." },
  { week: 25, size: "a head of broccoli", cm: 34.6, g: 660, dev: "Baby responds to your voice and your touch." },
  { week: 26, size: "a bunch of spinach", cm: 35.6, g: 760, dev: "The eyes begin to open." },
  { week: 27, size: "a cucumber", cm: 36.6, g: 875, dev: "Baby sleeps and wakes regularly, and may get hiccups." },
  { week: 28, size: "a brinjal", cm: 37.6, g: 1000, dev: "The third trimester begins. Baby can blink." },
  { week: 29, size: "a pineapple", cm: 38.6, g: 1150, dev: "Muscles and lungs keep maturing. Kicks get stronger." },
  { week: 30, size: "a cabbage", cm: 39.9, g: 1300, dev: "Baby's brain is growing quickly." },
  { week: 31, size: "a coconut in its husk", cm: 41.1, g: 1500, dev: "Baby can turn the head from side to side." },
  { week: 32, size: "a bunch of bananas", cm: 42.4, g: 1700, dev: "Nails have grown, and baby practises breathing." },
  { week: 33, size: "a melon", cm: 43.7, g: 1900, dev: "Bones are hardening, but the skull stays soft for birth." },
  { week: 34, size: "a bag of potatoes", cm: 45, g: 2100, dev: "The nervous system and lungs are maturing." },
  { week: 35, size: "a honeydew melon", cm: 46.2, g: 2400, dev: "Most babies settle head-down around now." },
  { week: 36, size: "a papaya", cm: 47.4, g: 2600, dev: "Baby is getting ready for birth and may move lower." },
  { week: 37, size: "a small pumpkin", cm: 48.6, g: 2900, dev: "Full term. Baby's organs are ready for life outside." },
  { week: 38, size: "a small jackfruit", cm: 49.8, g: 3100, dev: "Baby has a firm grip and keeps putting on fat." },
  { week: 39, size: "a small watermelon", cm: 50.7, g: 3300, dev: "Baby is ready. Labour could start any day." },
  { week: 40, size: "a watermelon", cm: 51.2, g: 3400, dev: "Your estimated due date. Many babies arrive a little before or after." },
];

/** The growth row for a week, held to weeks 4–40. */
export const growthFor = (week: number) => GROWTH[Math.min(40, Math.max(4, Math.round(week))) - 4];

/** [week, size, what is happening] — the short form the overview uses. */
export const babyFor = (week: number): [number, string, string] => {
  const r = growthFor(week);
  return [r.week, r.size, r.dev];
};

export const MILESTONES: [number, string][] = [
  [12, "End of 1st trimester"], [20, "Halfway"], [28, "3rd trimester"], [37, "Full term"], [40, "Due date"],
];

/** What her own body may be going through, in the same week bands as BABY. General, not advice. */
export const BODY: [number, string][] = [
  [4, "Your period is late. You may feel tired, or have tender breasts."],
  [8, "Morning sickness and tiredness are common. Rest when you can."],
  [12, "Sickness often starts to ease. Your bump may not show yet."],
  [16, "Many women feel more energy now, and the bump begins to show."],
  [20, "You may feel the first flutters. A little back ache can start."],
  [24, "Your bump is growing fast. Leg cramps and itchy skin are common."],
  [28, "Tiredness can return, and some breathlessness. Watch for sudden swelling."],
  [32, "Practice tightenings are common. Sleeping on your left side helps."],
  [36, "Baby may move lower. You may pass urine more often."],
  [40, "Your body is getting ready for birth. Know the signs of labour."],
];

export const bodyFor = (week: number) => ([...BODY].reverse().find((b) => b[0] <= Math.max(4, week)) ?? BODY[0])[1];

/**
 * The road ahead, in weeks from her last period: scans, tests and moments to
 * plan for. `to` is the end of the window; a single moment has no `to`.
 * Guides from routine antenatal care, not a schedule — her doctor sets hers.
 */
export const JOURNEY: { from: number; to?: number; title: string; note: string; icon: string; href?: string }[] = [
  { from: 11, to: 14, title: "Dating scan", note: "Confirms your due date and checks early growth.", icon: "ScanLine", href: "/app/health/pregnancy?tab=care&part=tests" },
  { from: 12, title: "First trimester ends", note: "The risk of early loss falls a lot from here.", icon: "Flower2" },
  { from: 18, to: 20, title: "Anomaly scan", note: "A detailed look at how baby is growing.", icon: "ScanLine", href: "/app/health/pregnancy?tab=care&part=tests" },
  { from: 20, title: "Halfway", note: "Many women feel baby move for the first time.", icon: "Sparkles" },
  { from: 24, to: 28, title: "Sugar test", note: "Checks for diabetes in pregnancy, if your doctor advises.", icon: "FlaskConical", href: "/app/health/pregnancy?tab=care&part=tests" },
  { from: 28, title: "Third trimester · count kicks", note: "Start counting baby's movements every day.", icon: "Footprints", href: "/app/health/pregnancy?tab=tools" },
  { from: 34, to: 36, title: "Pack your hospital bag", note: "Papers, clothes, baby things — ready by the door.", icon: "Briefcase", href: "/app/health/pregnancy?tab=tools#bag" },
  { from: 37, title: "Full term", note: "Baby is ready to be born any day from now.", icon: "Baby" },
  { from: 40, title: "Due date", note: "Only a few babies arrive exactly on it.", icon: "CalendarHeart" },
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

/** Weeks and days of pregnancy on a given day, from the (possibly confirmed) last-period date; null before it. */
export function weeksOn(lmp: string, day: string): { w: number; d: number } | null {
  const ga = daysBetween(day, lmp);
  return ga < 0 ? null : { w: Math.floor(ga / 7), d: ga % 7 };
}
export const fmtWeeks = (x: { w: number; d: number } | null) => (x ? `${x.w}w ${x.d}d` : "—");

/* ── pregnancy care: the choices her forms offer ──────────────────────── */

export const CONFIRM_METHODS = ["Home test", "Blood test", "Ultrasound", "Doctor's exam"] as const;
export const PLURALITY = ["Single", "Twins", "Triplets or more"] as const;
export const PAST_OUTCOMES = ["Live birth", "Miscarriage", "Stillbirth", "Termination", "Ectopic", "Other"] as const;
export const DELIVERY_MODES = ["Vaginal", "Assisted vaginal", "Caesarean"] as const;

/**
 * Common antenatal tests and scans, as names to tap. No ranges are kept here:
 * a result is compared only with the range printed on her own report.
 */
export const TEST_PRESETS: { name: string; group: "Blood test" | "Urine test" | "Sugar test" | "Scan" | "Other"; unit?: string }[] = [
  { name: "Haemoglobin", group: "Blood test", unit: "g/dL" },
  { name: "Blood group and Rh", group: "Blood test" },
  { name: "Complete blood count", group: "Blood test" },
  { name: "Thyroid (TSH)", group: "Blood test", unit: "mIU/L" },
  { name: "HIV", group: "Blood test" },
  { name: "Syphilis (VDRL)", group: "Blood test" },
  { name: "Hepatitis B", group: "Blood test" },
  { name: "Fasting blood sugar", group: "Sugar test", unit: "mg/dL" },
  { name: "Glucose tolerance test (OGTT)", group: "Sugar test", unit: "mg/dL" },
  { name: "Urine routine", group: "Urine test" },
  { name: "Urine protein", group: "Urine test" },
  { name: "Dating scan", group: "Scan" },
  { name: "Anomaly scan", group: "Scan" },
  { name: "Growth scan", group: "Scan" },
];
export const TEST_STEPS = ["Ordered", "Sample given", "Processing", "Result ready", "Reviewed"] as const;

/** Things doctors commonly watch in pregnancy — names to tap. She records the level her doctor gave. */
export const RISK_PRESETS = [
  "High blood pressure", "Sugar in pregnancy", "Anaemia", "Thyroid", "Twins or more", "Previous caesarean",
  "Bleeding", "Low-lying placenta", "Baby growing slowly", "Under 18 or over 35", "Rh negative", "Other",
] as const;

export const ANC_SYMPTOMS = ["Headache", "Swelling", "Bleeding", "Less movement", "Back pain", "Tiredness", "Nausea", "None"] as const;

export const POSTNATAL_CHECKS = {
  Mother: ["Day 1 check", "Day 3 check", "1-week check", "6-week check", "Stitches / wound check", "Mood check"],
  Baby: ["Birth check", "Day 3 check", "1-week check", "6-week check", "Vaccination visit", "Weight check"],
} as const;

/** A result outside the range printed on her report, or null when either side is missing. */
export function outsideRange(result?: string, low?: string, high?: string): "low" | "high" | null {
  const v = Number(result);
  if (!result || Number.isNaN(v)) return null;
  if (low && !Number.isNaN(Number(low)) && v < Number(low)) return "low";
  if (high && !Number.isNaN(Number(high)) && v > Number(high)) return "high";
  return null;
}

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
