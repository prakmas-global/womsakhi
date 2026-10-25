import axios from "axios";

import { apiClient } from "./api";
import { apiBase } from "./api-base";

/**
 * Health & Wellness — backend: routes/health_hub.py.
 *
 * One store for everything she logs (`/me/health/entries`, validated per kind)
 * and one settings document (`/me/health/settings`). Periods live in the cycle
 * API (`/me/cycle`), mood check-ins in `/engines/mood`, mentors in growth-api,
 * doctors in doctors-api.
 */

export type HealthKind =
  | "workout" | "meal" | "plan" | "water" | "sleep" | "journal" | "activity"
  | "symptom" | "pregsym" | "kick" | "contraction" | "measure" | "allergy"
  | "medication" | "history" | "document" | "reminder" | "game" | "vwatch";

export type MealType = "Breakfast" | "Lunch" | "Evening snack" | "Dinner";

/** The `data` each kind carries — the same fields the server validates. */
export interface KindData {
  workout: { activity: string; minutes: number; steps?: number; kcal?: number; intensity?: string; routine?: string; note?: string };
  meal: { mealType: MealType; time?: string; food: string; kcal?: number; protein?: number; recipe?: string };
  plan: { mealType: MealType; food: string; recipe?: string; eaten?: boolean };
  water: { ml: number };
  sleep: { bed: string; wake: string; quality: "Poor" | "Fair" | "Good" | "Great"; factors?: string[]; note?: string };
  journal: { type: "Reflection" | "Gratitude" | "Affirmation"; text: string };
  activity: { type: string; minutes: number };
  symptom: { symptoms: string[]; severity?: string; note?: string };
  pregsym: { symptoms: string[]; severity?: string; note?: string };
  kick: { count: number; seconds: number };
  contraction: { lengths: number[]; gaps: number[] };
  measure: { type: string; value: string; note?: string };
  allergy: { name: string; reaction?: string; severity: "Mild" | "Moderate" | "Severe" };
  medication: { name: string; dose?: string; schedule?: string; status?: "Taking now" | "Stopped"; reason?: string; taken?: string[] };
  history: { cat: "Previous condition" | "Surgery" | "Vaccination" | "Family history" | "Other"; condition: string; since?: string; note?: string };
  document: { title: string; type: string; provider?: string; file?: string | null; file_url?: string; note?: string; shareable?: boolean; file_id?: string; file_name?: string };
  reminder: { title: string; category: string; time?: string; repeat: "Once" | "Every day" | "Every week" | "Every month"; where?: string; note?: string; done?: string[]; cancelled?: boolean; snooze?: string };
  game: { game: string; seconds: number; score?: number; scoreLabel?: string; mood?: string };
  vwatch: { video_id: string; favorite?: boolean; completed?: boolean; seconds?: number };
}

export interface Entry<K extends HealthKind = HealthKind> {
  id: string;
  kind: K;
  /** YYYY-MM-DD; "" for undated kinds (allergy, medication, history, vwatch). */
  date: string;
  data: KindData[K];
  created_at: string;
  updated_at: string;
}

export interface Pregnancy { basis: "lmp" | "due"; date: string; doctor?: string; hospital?: string }

export interface HealthSettings {
  name: string;
  waterGoal: number;
  stepsGoal: number;
  activeGoal: number;
  sleepGoal: number;
  bedtime: string;
  kcalGoal: number;
  proteinGoal: number;
  diet: "Vegetarian" | "Eggetarian" | "Non-vegetarian" | "Vegan";
  healthGoal: string;
  heightCm: number;
  bloodGroup: string;
  emergencyContact: string;
  dashHidden: string[];
  favoriteGames: string[];
  fitnessPlan: string;
  challenges: string[];
  privateMode: boolean;
  reminderLead: number;
  pregnancy: Pregnancy | null;
  /** Ticked items per checklist ("preconception", "preg-care", "bag", …). */
  checks?: Record<string, string[]>;
  /** Her bedtime routine steps (Sleep → Bedtime); tonight's ticks live in checks.bedtime. */
  sleepRoutine?: string[];
  /** Show Fertility / Pregnancy in her menu and on the Health home. */
  trackCycle: boolean;
  trackPreg: boolean;
  /** The four-step first visit is done or skipped. */
  onboarded: boolean;
  dob: string;
  goals: string[];
  exercise: string[];
  restrictions: string[];
}

export const DEFAULT_SETTINGS: HealthSettings = {
  name: "", waterGoal: 8, stepsGoal: 6000, activeGoal: 30, sleepGoal: 8, bedtime: "22:30", kcalGoal: 1800,
  proteinGoal: 55, diet: "Vegetarian", healthGoal: "", heightCm: 0, bloodGroup: "", emergencyContact: "",
  dashHidden: [], favoriteGames: [], fitnessPlan: "", challenges: [], privateMode: false, reminderLead: 30, pregnancy: null,
  trackCycle: true, trackPreg: true, onboarded: false, dob: "", goals: [], exercise: [], restrictions: [],
};

/** Everything Health & Wellness keeps about her, as one JSON document. */
export const apiHealthExport = () => apiClient.get<Record<string, unknown>>("/me/health/export").then((r) => r.data);
/** Every entry, her settings and her kept papers. Cannot be undone. */
export const apiHealthDeleteAll = () => apiClient.delete("/me/health").then(() => undefined);

export interface DaySummary {
  date: string; water_ml: number; active_minutes: number; steps: number; kcal: number;
  sleep_hours: number; workouts: number; meals: number; calm_minutes: number;
}

export const apiEntries = <K extends HealthKind>(kinds: K | K[], range: { from?: string; to?: string } = {}, signal?: AbortSignal) =>
  apiClient.get<Entry<K>[]>("/me/health/entries", {
    signal, params: { kind: Array.isArray(kinds) ? kinds.join(",") : kinds, from: range.from || undefined, to: range.to || undefined },
  }).then((r) => r.data);

export const apiAddEntry = <K extends HealthKind>(kind: K, data: KindData[K], date = "") =>
  apiClient.post<Entry<K>>("/me/health/entries", { kind, data, date }).then((r) => r.data);

export const apiEditEntry = <K extends HealthKind>(id: string, patch: { data?: Partial<KindData[K]>; date?: string }) =>
  apiClient.patch<Entry<K>>(`/me/health/entries/${id}`, patch).then((r) => r.data);

export const apiDeleteEntry = (id: string) => apiClient.delete(`/me/health/entries/${id}`).then(() => undefined);

export const apiHealthSettings = (signal?: AbortSignal) =>
  apiClient.get<HealthSettings>("/me/health/settings", { signal }).then((r) => r.data);

export const apiSaveHealthSettings = (patch: Partial<HealthSettings>) =>
  apiClient.put<HealthSettings>("/me/health/settings", patch).then((r) => r.data);

export const apiHealthSummary = (days = 7, signal?: AbortSignal) =>
  apiClient.get<DaySummary[]>("/me/health/summary", { signal, params: { days } }).then((r) => r.data);

/* ── dates, in her (Indian) day ─────────────────────────────────────────── */

const pad = (n: number) => String(n).padStart(2, "0");
export const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const today = () => ymd(new Date());
export const addDays = (day: string, n: number) => { const d = new Date(`${day}T00:00:00`); d.setDate(d.getDate() + n); return ymd(d); };
export const daysBetween = (a: string, b: string) =>
  Math.round((new Date(`${a}T00:00:00`).getTime() - new Date(`${b}T00:00:00`).getTime()) / 86_400_000);
export const fmtDay = (day: string, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" }) =>
  day ? new Date(`${day}T00:00:00`).toLocaleDateString("en-IN", opts) : "";
export const nowHHMM = () => { const d = new Date(); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
export const sleepHours = (bed: string, wake: string) => {
  const m = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
  return Math.round(((((m(wake) - m(bed)) % 1440) + 1440) % 1440) / 6) / 10;
};

/* ── her private health papers (backend: routes/health_files.py) ─────────── */

const fileClient = axios.create({ baseURL: apiBase(), withCredentials: true });

export interface HealthFile { id: string; name: string; content_type: string; size: number; created_at: string }

/** Photo or PDF, ≤10 MB, kept privately: only she can open it. */
export async function apiUploadHealthFile(file: File) {
  const body = new FormData();
  body.append("file", file);
  // Not `apiClient`: its JSON content type would stop the browser adding the
  // multipart boundary. The session rides in the httpOnly cookie.
  const { data } = await fileClient.post<HealthFile>("/me/health/files", body);
  return data;
}

/** Opens the paper in a new tab from an in-memory copy — no shareable URL exists. */
export async function apiOpenHealthFile(id: string) {
  const win = window.open("", "_blank");
  const { data, headers } = await apiClient.get<Blob>(`/me/health/files/${id}`, { responseType: "blob" });
  const url = URL.createObjectURL(new Blob([data], { type: String(headers["content-type"] || data.type) }));
  if (win) win.location.href = url; else window.location.href = url;
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export const apiDeleteHealthFile = (id: string) => apiClient.delete(`/me/health/files/${id}`).then(() => undefined);
