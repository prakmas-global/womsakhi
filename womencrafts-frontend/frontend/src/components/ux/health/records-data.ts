import { addDays, type Entry, type KindData } from "@/lib/health-api";

/**
 * Health Records and Appointments & Reminders — the vocabulary and the
 * occurrence rules both screens share.
 *
 * Measurement types, units and the plain-words ranges come from the approved
 * Health & Wellness design. Ranges are general adult guidance, said as such:
 * the screen never tells her a number is "bad", only what is commonly
 * expected and to ask her doctor what hers means.
 */

export interface MeasType {
  type: string;
  unit: string;
  min?: number;
  max?: number;
  bp?: boolean;
  /** Plain words, never a diagnosis. */
  range: string;
  /** Typical-range bounds used only to word the note; never colours a value red. */
  low?: number;
  high?: number;
}

export const MEAS: MeasType[] = [
  { type: "Weight", unit: "kg", min: 20, max: 250, range: "Watch the trend over weeks rather than one day's number." },
  { type: "Blood pressure", unit: "mmHg", bp: true, range: "Around 120/80 or lower is commonly expected for adults. 140/90 or above on repeat readings is worth showing a doctor.", low: 90, high: 140 },
  { type: "Blood sugar", unit: "mg/dL", min: 40, max: 600, range: "Fasting, about 70–100 is commonly expected. Note whether you had eaten.", low: 70, high: 140 },
  { type: "Haemoglobin", unit: "g/dL", min: 3, max: 25, range: "For women, about 12 or more is commonly expected. Below that is anaemia — very common, and treatable.", low: 12, high: 16 },
  { type: "Pulse", unit: "bpm", min: 30, max: 220, range: "At rest, about 60–100 beats a minute is commonly expected.", low: 60, high: 100 },
  { type: "Temperature (°C)", unit: "°C", min: 34, max: 43, range: "About 36.1–37.2 °C is commonly expected. 38 °C or more is a fever.", low: 36.1, high: 37.5 },
  { type: "Temperature (°F)", unit: "°F", min: 93, max: 110, range: "About 97–99 °F is commonly expected. 100.4 °F or more is a fever.", low: 97, high: 99.5 },
  { type: "Height", unit: "cm", min: 50, max: 250, range: "Kept so a doctor can work out your BMI." },
];
export const measOf = (type: string) => MEAS.find((m) => m.type === type);
export const unitOf = (type: string) => measOf(type)?.unit ?? "";

/** Check a reading the way the server does, with her words for what is wrong. */
export function readingProblem(type: string, value: string): string {
  const m = measOf(type);
  const v = value.trim();
  if (!v) return "Write the reading.";
  if (m?.bp) {
    const hit = /^(\d{2,3})\/(\d{2,3})$/.exec(v);
    if (!hit) return "Write blood pressure as two numbers, like 120/80.";
    const [s, d] = [Number(hit[1]), Number(hit[2])];
    if (s < 60 || s > 260 || d < 30 || d > 160 || d >= s) return "Those numbers look mistyped. Check the machine's screen.";
    return "";
  }
  if (!/^\d{1,4}(\.\d{1,2})?$/.test(v)) return "Write the reading as a number.";
  const n = Number(v);
  if (m?.min != null && (n < m.min || n > (m.max ?? Infinity))) return `That is outside ${m.min}–${m.max} ${m.unit}. Check it again.`;
  return "";
}

/** A number to chart: systolic for blood pressure. */
export const primary = (value: string) => Number(String(value).split("/")[0]) || 0;
export const secondary = (value: string) => Number(String(value).split("/")[1]) || 0;

export const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

export const ALLERGY_PRESETS = ["Peanuts", "Dust", "Pollen", "Milk", "Penicillin", "Sulfa drugs", "Shellfish", "Latex"];
export const SEVERITIES = ["Mild", "Moderate", "Severe"] as const;

export const HISTORY_CATS = ["Previous condition", "Surgery", "Vaccination", "Family history", "Other"] as const;
export const HISTORY_PRESETS: Record<(typeof HISTORY_CATS)[number], string[]> = {
  "Previous condition": ["Thyroid", "Diabetes", "High blood pressure", "PCOS", "Anaemia", "Asthma"],
  Surgery: ["C-section", "Appendix", "Gall bladder", "Hysterectomy"],
  Vaccination: ["COVID-19", "Tetanus (TT)", "HPV", "Hepatitis B"],
  "Family history": ["Mother: diabetes", "Father: heart disease", "Mother: breast cancer", "Parent: high BP"],
  Other: [],
};

export const DOC_TYPES = ["Lab report", "Prescription", "Scan report", "Vaccination", "Discharge summary", "Other"] as const;

export const MED_PRESETS = ["Iron", "Folic acid", "Calcium", "Vitamin D", "Thyroxine", "Metformin"];
export const DOSE_PRESETS = ["1 tablet", "2 tablets", "½ tablet", "5 ml", "10 ml"];
export const SCHEDULES = ["Empty stomach, morning", "After breakfast", "After lunch", "After dinner", "Before bed"];
/** The time a "remind me" for a medicine is set at, from when she takes it. */
export const SCHEDULE_TIME: Record<string, string> = {
  "Empty stomach, morning": "07:00", "After breakfast": "09:00", "After lunch": "14:00", "After dinner": "21:00", "Before bed": "22:00",
};

/** Reminder types, as the design names them. */
export const REM_CATS = ["Doctor appointment", "Mentor session", "Medicine", "Workout", "Sleep", "Hydration",
  "Wellness activity", "Prenatal checkup", "Period & fertility", "Custom"] as const;
export const REM_ICON: Record<string, string> = {
  "Doctor appointment": "Stethoscope", "Mentor session": "Users", Medicine: "Pill", Workout: "Dumbbell", Sleep: "Moon",
  Hydration: "Droplet", "Wellness activity": "Flower2", "Prenatal checkup": "Baby", "Period & fertility": "Flower2", Custom: "Bell",
};
export const TIME_PRESETS = ["08:00", "09:00", "13:00", "18:00", "21:00", "22:00"];
export const REPEATS = ["Once", "Every day", "Every week", "Every month"] as const;
export const LEADS = [
  { value: 0, label: "On time" }, { value: 10, label: "10 min before" }, { value: 30, label: "30 min before" },
  { value: 60, label: "1 hour before" }, { value: 1440, label: "A day before" },
];

/** Quick reminders she can add with one tap. */
export const QUICK_REMINDERS: { label: string; data: KindData["reminder"] }[] = [
  { label: "Medicine at 9 PM, daily", data: { title: "Take my medicine", category: "Medicine", time: "21:00", repeat: "Every day" } },
  { label: "Drink water at 11 AM, daily", data: { title: "Drink a glass of water", category: "Hydration", time: "11:00", repeat: "Every day" } },
  { label: "Evening walk, daily", data: { title: "Evening walk", category: "Workout", time: "18:00", repeat: "Every day" } },
  { label: "Wind down at 10 PM", data: { title: "Phone away, wind down", category: "Sleep", time: "22:00", repeat: "Every day" } },
];

/* ── occurrences ──────────────────────────────────────────────────────── */

type Rem = Entry<"reminder">;

const dim = (y: number, m: number) => new Date(y, m + 1, 0).getDate();

/** Does this reminder fall on `day`? */
export function occursOn(r: Rem, day: string): boolean {
  const start = r.date;
  if (!start || day < start || r.data.cancelled) return false;
  const d = new Date(`${day}T00:00:00`), s = new Date(`${start}T00:00:00`);
  switch (r.data.repeat) {
    case "Every day": return true;
    case "Every week": return d.getDay() === s.getDay();
    case "Every month": return d.getDate() === Math.min(s.getDate(), dim(d.getFullYear(), d.getMonth()));
    default: return day === start;
  }
}

/** The occurrence she is dealing with now: today if it falls today, else the next one (or a missed one-off). */
export function occDay(r: Rem, today: string): string {
  if ((r.data.repeat || "Once") === "Once") return r.date;
  if (r.date > today) return r.date;
  for (let i = 0; i < 400; i++) {
    const d = addDays(today, i);
    if (occursOn(r, d)) return d;
  }
  return today;
}

export const isDoneOn = (r: Rem, day: string) => (r.data.done || []).includes(day);

/** Her time for that occurrence, after a snooze. */
export function timeOn(r: Rem, day: string): string {
  const sn = r.data.snooze || "";
  return sn.slice(0, 10) === day ? sn.slice(11, 16) : (r.data.time || "09:00");
}

export type RemStatus = "done" | "overdue" | "today" | "upcoming" | "cancelled";

export function statusOf(r: Rem, today: string, now: string): RemStatus {
  if (r.data.cancelled) return "cancelled";
  const d = occDay(r, today);
  if (isDoneOn(r, d)) return "done";
  if (d < today) return "overdue";
  if (d === today) return timeOn(r, d) < now ? "overdue" : "today";
  return "upcoming";
}

export const STATUS_LABEL: Record<RemStatus, string> = {
  done: "Done", overdue: "Overdue", today: "Due today", upcoming: "Upcoming", cancelled: "Cancelled",
};

export const repeatText = (r: Rem) => (r.data.repeat && r.data.repeat !== "Once" ? r.data.repeat : "");

export const fmtTime = (t: string) => {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  const ap = h >= 12 ? "PM" : "AM";
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${ap}`;
};
