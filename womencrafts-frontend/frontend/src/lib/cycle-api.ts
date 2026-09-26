import { apiClient } from "./api";

/**
 * The cycle tracker. One read returns everything the tracker draws; every
 * write returns the same shape, so a screen replaces its state with the
 * answer instead of guessing what changed and re-fetching.
 *
 * Every call sends her phone's time zone. "Today" is her date, not the
 * server's — see `routes/cycle.py`.
 */

export type Mood = "happy" | "calm" | "tired" | "irritable" | "sad";
export type Feeling =
  | "energetic" | "calm" | "anxious" | "irritable" | "emotional" | "low" | "confident" | "tired";
export type Symptom =
  | "cramps" | "headache" | "bloating" | "back-pain" | "acne" | "mood-swings" | "fatigue"
  | "breast-tenderness" | "food-cravings" | "trouble-sleeping" | "nausea" | "none";
export type Phase = "menstrual" | "follicular" | "ovulation" | "luteal";
export type Mark = "period" | "predicted" | "fertile" | "ovulation";
export type Flow = "spotting" | "light" | "medium" | "heavy";
export type SleepQuality = "poor" | "fair" | "good" | "restful";
export type CervicalMucus = "dry" | "sticky" | "creamy" | "watery" | "egg-white";
export type OvulationTest = "not-taken" | "negative" | "high" | "peak" | "positive";
export type PregnancyTest = "not-taken" | "negative" | "positive" | "unclear";
export type Intimacy = "none" | "protected" | "unprotected";
export type TrackingGoal = "understand-cycle" | "trying-to-conceive" | "symptom-care" | "perimenopause";
export type CycleCondition = "pcos" | "endometriosis" | "fibroids" | "thyroid" | "pmdd" | "anaemia" | "none";

export interface CycleCell {
  date: string;
  marks: Mark[];
  logged: boolean;
  period: boolean | null;
}

export interface CycleLog {
  date: string;
  period: boolean | null;
  mood: Mood | null;
  feelings: Feeling[];
  symptoms: Symptom[];
  symptom_severity: Partial<Record<Exclude<Symptom, "none">, 1 | 2 | 3>>;
  flow: Flow | null;
  pain: number | null;
  energy: number | null;
  sleep_hours: number | null;
  sleep_quality: SleepQuality | null;
  basal_temp_c: number | null;
  weight_kg: number | null;
  water_glasses: number | null;
  exercise_minutes: number | null;
  cervical_mucus: CervicalMucus | null;
  ovulation_test: OvulationTest | null;
  pregnancy_test: PregnancyTest | null;
  intimacy: Intimacy | null;
  medications_taken: string[];
  note: string;
}

export interface CycleMedicine {
  id: string;
  name: string;
  dose: string;
  times: string[];
  instructions: string;
  active: boolean;
}

export interface CycleReminders {
  smart: boolean;
  checkin: boolean;
  checkin_time: string;
  upcoming: boolean;
  ovulation: boolean;
  pill: boolean;
  pill_time: string;
  long_period: boolean;
}

export interface CycleInsight {
  icon: string;
  tone: "pink" | "violet" | "green" | "orange" | "amber";
  text: string;
  strong: string;
}

export interface CycleStatus {
  has_history: boolean;
  on_period: boolean;
  period_day: number | null;
  avg_cycle: number;
  avg_period: number;
  measured_cycles: number;
  cycle_day: number | null;
  phase: Phase | null;
  phase_label: string;
  last_start: string | null;
  next_start: string | null;
  days_until: number | null;
  ovulation: string | null;
  fertile_start: string | null;
  fertile_end: string | null;
  long_level: "long" | "doctor" | null;
  long_threshold: number;
  checked_in: boolean;
  prediction_confidence: "starting" | "learning" | "low" | "medium" | "high";
  cycle_variation: number | null;
}

export interface CycleState {
  setup: true;
  today: string;
  tz: string;
  profile: {
    typical_cycle: number;
    typical_period: number;
    discreet: boolean;
    tracking_goal: TrackingGoal;
    conditions: CycleCondition[];
    predictions: { period: boolean; fertility: boolean; phase: boolean };
    care_sharing: { phase: boolean; mood: boolean; support_tips: boolean };
    medicines: CycleMedicine[];
    reminders: CycleReminders;
  };
  log: CycleLog | null;
  status: CycleStatus;
  phases: { key: Phase; label: string; from: number; to: number }[];
  calendar: { month: string; days: CycleCell[] };
  week: CycleCell[];
  insights: CycleInsight[];
  history: { start: string; label: string; cycle_days: number | null; period_days: number }[];
  moods: { date: string; mood: Mood | null; feelings: Feeling[] }[];
  symptom_counts: Partial<Record<Symptom, number>>;
  notes: { date: string; note: string }[];
  health_metrics: {
    days_logged: number;
    average_pain: number | null;
    average_sleep: number | null;
    average_energy: number | null;
    flow_counts: Partial<Record<Flow, number>>;
    bbt: { date: string; value: number }[];
    body_signs: { date: string; cervical_mucus: CervicalMucus | null; ovulation_test: OvulationTest | null; pregnancy_test: PregnancyTest | null }[];
  };
}

export type CycleRead = CycleState | { setup: false; today: string };

/** Her phone's zone, or India's when the browser will not say. */
export function phoneZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kolkata";
  } catch {
    return "Asia/Kolkata";
  }
}

export const apiCycle = (signal?: AbortSignal, month?: string) =>
  apiClient
    .get<CycleRead>("/me/cycle", { signal, params: { tz: phoneZone(), ...(month ? { month } : {}) } })
    .then((r) => r.data);

export const apiCycleSetup = (body: {
  adult: boolean;
  last_start?: string | null;
  typical_cycle?: number;
  typical_period?: number;
}) => apiClient.put<CycleState>("/me/cycle/setup", { ...body, tz: phoneZone() }).then((r) => r.data);

export const apiCycleLog = (
  date: string,
  body: Partial<Omit<CycleLog, "date">>,
) => apiClient.put<CycleState>(`/me/cycle/days/${date}`, { ...body, tz: phoneZone() }).then((r) => r.data);

export const apiCycleDay = (date: string, signal?: AbortSignal) =>
  apiClient.get<CycleLog>(`/me/cycle/days/${date}`, { signal }).then((r) => r.data);

export const apiCycleReminders = (body: Partial<CycleReminders>) =>
  apiClient.put<CycleState>("/me/cycle/reminders", body).then((r) => r.data);

export const apiCycleSettings = (body: {
  discreet?: boolean;
  typical_cycle?: number;
  typical_period?: number;
  tracking_goal?: TrackingGoal;
  conditions?: CycleCondition[];
  period_predictions?: boolean;
  fertility_predictions?: boolean;
  phase_predictions?: boolean;
  share_phase?: boolean;
  share_mood?: boolean;
  share_support_tips?: boolean;
}) =>
  apiClient.put<CycleState>("/me/cycle/settings", body).then((r) => r.data);

export const apiCycleAddMedicine = (body: { name: string; dose?: string; times?: string[]; instructions?: string }) =>
  apiClient.post<CycleState>("/me/cycle/medicines", body).then((r) => r.data);

export const apiCycleUpdateMedicine = (id: string, body: Partial<Omit<CycleMedicine, "id">>) =>
  apiClient.patch<CycleState>(`/me/cycle/medicines/${id}`, body).then((r) => r.data);

export const apiCycleErase = () => apiClient.delete<{ message: string }>("/me/cycle").then((r) => r.data);

export const apiCycleExport = () =>
  apiClient.get<Record<string, unknown>>("/me/cycle/export").then((r) => r.data);
