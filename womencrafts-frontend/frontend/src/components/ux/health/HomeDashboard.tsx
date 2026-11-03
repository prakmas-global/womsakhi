"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { GAMES } from "@/components/ux/games/catalog";
import { Btn } from "@/components/ux/kit";
import { useAuth } from "@/context/AuthContext";
import type { Mood } from "@/lib/engines-api";
import {
  addDays, daysBetween, fmtDay, sleepHours, today, type Entry, type HealthKind, type KindData,
} from "@/lib/health-api";
import { useAppointments } from "./appointments";
import { TIPS } from "./fitness-data";
import {
  Chips, Empty, HUE, HealthFrame, I, Panel, SectionQuote, lastDays, sumOn, useEntries, useHealthSettings, type Hue,
} from "./kit";
import { HealthOnboarding } from "./HealthOnboarding";
import { HealthSettingsTab } from "./HealthSettingsTab";
import { useMoodHistory } from "./mind/parts";
import { pregInfo } from "./pregnancy-data";
import { MealFlow, SleepFlow, WaterButtons, WorkoutFlow, fmtTime } from "./QuickForms";
import { ReminderSheet } from "./ReminderSheet";
import { WatchListen } from "./WatchListen";
import css from "./home.module.css";
import { artSrc, illSrc } from "@/components/ux/health/art";

/**
 * The Health home — her day at a glance, after the approved Health & Wellness
 * design: a gradient stage (greeting, one-tap dock, rings for water, movement
 * and sleep with her mood in the middle), "Explore your wellness" as picture
 * cards that each open a section or log in one step, then today's journey,
 * her week, what is coming up, recent activity and suggestions.
 *
 * Every number is read from what she logged (the Health store, her mood
 * check-ins, her bookings); nothing here is invented. Widgets she hides are
 * kept in her health settings (`dashHidden`), so the choice follows her.
 */

const TABS = [{ id: "main", label: "Overview" }, { id: "activity", label: "Activity history" }, { id: "settings", label: "Your settings" }];

const WIDGETS = [
  ["overview", "Rings"], ["quick", "Log in one tap"], ["banner", "Explore your wellness"], ["tips", "Tip of the day"],
  ["journey", "Today's journey"], ["watch", "Watch & listen"], ["weekly", "Your week"], ["upcoming", "Upcoming"],
  ["recent", "Recent activities"], ["recs", "Suggestions for you"],
] as const;

const GLASS = 250;

/** 3D emoji from the design, kept in public/ux/health/emoji. */
const EMOJI = {
  water: "1f4a7", meal: "1f37d-fe0f", workout: "1f3c3-1f3fd-200d-2640-fe0f", mood: "1f60a", sleep: "1f634", reminder: "23f0",
  fire: "1f525", sparkles: "2728", nutrition: "1f957", mental: "1fab7", games: "1f3ae", fertility: "1f338",
  pregnancy: "1f930-1f3fd", mentor: "1f91d", doctor: "1fa7a", calm: "1fab7",
} as const;
const MOOD_EMOJI: Record<string, string> = {
  good: "1f642", happy: "1f604", calm: "1f60c", tired: "1f62a", low: "1f622", sad: "1f622", anxious: "1f61f", angry: "1f616", unwell: "1f915",
};
const MOOD_CHOICES: { id: Mood; label: string }[] = [
  { id: "good", label: "Good" }, { id: "tired", label: "Tired" }, { id: "low", label: "Low" },
  { id: "anxious", label: "Anxious" }, { id: "angry", label: "Upset" }, { id: "unwell", label: "Unwell" },
];
const art = artSrc;

/** Kinds the history tab and "Recent activities" read. */
const LOGGED: HealthKind[] = ["water", "workout", "meal", "sleep", "journal", "activity", "symptom", "pregsym", "kick", "measure", "game", "reminder", "document",
  "anc", "pregtest", "pregrisk", "delivery", "postnatal"];

const KIND_INFO: Record<string, { label: string; icon: string; hue: Hue; href: string }> = {
  water: { label: "Water", icon: "Droplets", hue: "blue", href: "/app/health/nutrition" },
  workout: { label: "Workout", icon: "Dumbbell", hue: "orange", href: "/app/health/fitness?tab=progress" },
  meal: { label: "Meal", icon: "Apple", hue: "green", href: "/app/health/nutrition" },
  sleep: { label: "Sleep", icon: "Moon", hue: "violet", href: "/app/health/sleep" },
  journal: { label: "Journal", icon: "NotebookPen", hue: "blue", href: "/app/health/mind?tab=journal" },
  activity: { label: "Calm break", icon: "Flower2", hue: "blue", href: "/app/health/mind?tab=activities" },
  symptom: { label: "Symptoms", icon: "Activity", hue: "pink", href: "/app/health/fertility" },
  pregsym: { label: "Pregnancy symptoms", icon: "Baby", hue: "lilac", href: "/app/health/pregnancy?tab=symptoms" },
  kick: { label: "Kick count", icon: "Baby", hue: "lilac", href: "/app/health/pregnancy?tab=tools" },
  measure: { label: "Reading", icon: "Activity", hue: "blue", href: "/app/health/records?tab=reports" },
  game: { label: "Calm game", icon: "Gamepad2", hue: "amber", href: "/app/health/games" },
  reminder: { label: "Reminder", icon: "CalendarClock", hue: "magenta", href: "/app/health/reminders" },
  document: { label: "Document", icon: "FileText", hue: "blue", href: "/app/health/records?tab=records" },
  anc: { label: "Antenatal check-up", icon: "Stethoscope", hue: "lilac", href: "/app/health/pregnancy?tab=consultation" },
  pregtest: { label: "Pregnancy test or scan", icon: "FlaskConical", hue: "lilac", href: "/app/health/pregnancy?tab=care&part=tests" },
  pregrisk: { label: "Doctor is watching", icon: "ShieldAlert", hue: "lilac", href: "/app/health/pregnancy?tab=care&part=risks" },
  delivery: { label: "The birth", icon: "Baby", hue: "lilac", href: "/app/health/pregnancy?tab=care&part=birth" },
  postnatal: { label: "Check after the birth", icon: "HeartPulse", hue: "lilac", href: "/app/health/pregnancy?tab=care&part=birth" },
};

function describe(e: Entry): string {
  const d = e.data as Record<string, unknown>;
  switch (e.kind) {
    case "water": return `${d.ml} ml of water`;
    case "workout": return `${d.activity}, ${d.minutes} min`;
    case "meal": return `${d.mealType}: ${d.food}`;
    case "sleep": return `${sleepHours(String(d.bed), String(d.wake))} h, ${String(d.quality).toLowerCase()}`;
    case "journal": return String(d.type);
    case "activity": return `${d.type}, ${d.minutes} min`;
    case "symptom": case "pregsym": return (d.symptoms as string[]).join(", ");
    case "kick": return `${d.count} kicks`;
    case "measure": return `${d.type}: ${d.value}`;
    case "game": return GAMES.find((g) => g.id === d.game)?.name ?? String(d.game);
    case "reminder": return String(d.title);
    case "document": return String(d.title);
    case "anc": return d.status === "Missed" ? "Missed" : [d.bp && `BP ${d.bp}`, d.weight && `${d.weight} kg`].filter(Boolean).join(", ") || "Recorded";
    case "pregtest": return `${d.name} · ${String(d.status).toLowerCase()}`;
    case "pregrisk": return String(d.factor);
    case "delivery": return `${d.mode} · ${(d.babies as unknown[]).length} ${(d.babies as unknown[]).length === 1 ? "baby" : "babies"}`;
    case "postnatal": return String(d.check);
    default: return e.kind;
  }
}

/** The next day a reminder falls on, from today; "" when it is past or done. */
export function nextOccurrence(r: Entry<"reminder">, from = today()): string {
  const d = r.data;
  if (d.cancelled || !r.date) return "";
  if (d.repeat === "Once") return r.date >= from && !(d.done || []).includes(r.date) ? r.date : "";
  if (r.date >= from) return r.date;
  if (d.repeat === "Every day") return from;
  if (d.repeat === "Every week") { const k = ((daysBetween(from, r.date) % 7) + 7) % 7; return k === 0 ? from : addDays(from, 7 - k); }
  const day = Number(r.date.slice(8, 10));
  const cand = (ym: string) => `${ym}-${String(Math.min(day, 28)).padStart(2, "0")}`;
  const thisMonth = cand(from.slice(0, 7));
  if (thisMonth >= from) return thisMonth;
  const n = new Date(`${from.slice(0, 7)}-01T00:00:00`); n.setMonth(n.getMonth() + 1);
  return cand(`${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}`);
}

const greet = () => { const h = new Date().getHours(); return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening"; };
const NEVER = () => () => {};
/** False on the server and during hydration: the greeting and today's date
 *  depend on her clock (the server's is UTC), so they render in the browser only. */
const useOnClient = () => useSyncExternalStore(NEVER, () => true, () => false);

const hm = (hours: number) => { const m = Math.round(hours * 60); return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m`; };
const litres = (ml: number) => `${(ml / 1000).toFixed(ml % 1000 ? 2 : 0).replace(/\.?0+$/, "")} L`;
const pct = (a: number, b: number) => (b > 0 ? Math.min(100, (a / b) * 100) : 0);

/** Days in a row, ending today or yesterday, with anything logged. */
function streak(dates: Set<string>, t: string) {
  let d = dates.has(t) ? t : addDays(t, -1);
  let n = 0;
  while (dates.has(d)) { n++; d = addDays(d, -1); }
  return n;
}

type Quick = "water" | "meal" | "workout" | "sleep" | "mood";

export function HomeDashboard() {
  const { user } = useAuth();
  const onClient = useOnClient();
  const { settings, save, ready } = useHealthSettings();
  const router = useRouter();
  const [setupAgain, setSetupAgain] = useState(false);
  const t = today();
  const first = (settings.name || user?.full_name || "").split(" ")[0];
  const day = useEntries(["water", "workout", "meal", "sleep", "activity", "game"], { from: addDays(t, -6) });
  const recent = useEntries(LOGGED, { from: addDays(t, -13) });
  const reminders = useEntries("reminder");
  const moods = useMoodHistory(14);
  const appts = useAppointments();
  const [quick, setQuick] = useState<Quick | "">("");
  const [remSheet, setRemSheet] = useState(false);
  const [flow, setFlow] = useState<"" | "meal" | "workout" | "sleep">("");
  const [customize, setCustomize] = useState(false);
  const [tipShift, setTipShift] = useState(0);

  const hidden = (k: string) => settings.dashHidden.includes(k);
  const toggleWidget = (k: string) =>
    save({ dashHidden: hidden(k) ? settings.dashHidden.filter((x) => x !== k) : [...settings.dashHidden, k] });

  /* ── today ── */
  const rows = day.rows;
  const waterMl = sumOn(rows, t, "ml");
  const goalMl = settings.waterGoal * GLASS;
  const minsOn = (d: string) => rows.filter((r) => r.kind === "workout" && r.date === d).reduce((a, r) => a + ((r.data as { minutes: number }).minutes || 0), 0);
  const workoutMins = minsOn(t);
  const sleepOn = (d: string) => { const s = rows.find((r) => r.kind === "sleep" && r.date === d) as Entry<"sleep"> | undefined; return s ? sleepHours(s.data.bed, s.data.wake) : 0; };
  const sleepH = sleepOn(t);
  const lastSleep = [...rows].filter((r) => r.kind === "sleep").sort((a, b) => b.date.localeCompare(a.date))[0] as Entry<"sleep"> | undefined;
  const mealsToday = rows.filter((r) => r.kind === "meal" && r.date === t).length;
  const calmOn = (d: string) => rows.filter((r) => r.date === d && (r.kind === "activity" || r.kind === "game"))
    .reduce((a, r) => a + (r.kind === "activity" ? (r.data as { minutes: number }).minutes || 0 : Math.round(((r.data as { seconds: number }).seconds || 0) / 60)), 0);
  const calmToday = rows.some((r) => (r.kind === "activity" || r.kind === "game") && r.date === t);
  const gamesToday = rows.filter((r) => r.kind === "game" && r.date === t).length;
  const moodBy = new Map(moods.rows.map((m) => [m.date, m.mood]));
  const moodToday = moodBy.get(t);

  const goalsDone = [waterMl >= goalMl, workoutMins >= settings.activeGoal, !!sleepH, !!moodToday, mealsToday > 0].filter(Boolean).length;
  const line = goalsDone === 0 ? "Your day is a fresh start. Tap anything below to log it in one step."
    : goalsDone === 5 ? "Every daily goal done. Beautiful work today!" : `${goalsDone} of 5 daily goals done. Keep going, you're doing great.`;
  const logged = new Set([...recent.rows.map((r) => r.date), ...moods.rows.map((m) => m.date)].filter(Boolean));
  const streakDays = streak(logged, t);

  const saveQuick = async <K extends "water" | "meal" | "workout" | "sleep">(kind: K, data: KindData[K], date: string, msg: string) => {
    const made = await day.add(kind, data, date, msg);
    if (made) { recent.reload(); if (kind !== "water") setQuick(""); }
    return made;
  };
  const checkIn = async (m: Mood) => { const ok = await moods.checkIn(m); if (ok) setQuick(""); };
  const openQuick = (q: Quick) => {
    // Meal, workout and sleep are short step flows in a sheet; water and mood stay one tap on the page.
    if (q === "meal" || q === "workout" || q === "sleep") { setFlow(q); return; }
    setQuick(quick === q ? "" : q);
    if (quick !== q) window.setTimeout(() => document.getElementById("quick-sheet")?.scrollIntoView({ block: "nearest", behavior: "smooth" }), 50);
  };

  /* ── reminders and bookings ── */
  const upcomingRem = reminders.rows
    .map((r) => ({ r, on: nextOccurrence(r) }))
    .filter((x) => x.on)
    .sort((a, b) => (a.on + (a.r.data.time || "")).localeCompare(b.on + (b.r.data.time || "")));
  const dueToday = upcomingRem.filter((x) => x.on === t);
  const overdue = reminders.rows.filter((r) => !r.data.cancelled && r.data.repeat === "Once" && r.date < t && !(r.data.done || []).includes(r.date));
  const liveAppts = appts.items.filter((a) => (a.status === "requested" || a.status === "confirmed") && (!a.day || a.day >= t));
  const activeRem = reminders.rows.filter((r) => !r.data.cancelled && (r.data.repeat !== "Once" || r.date >= t)).length;

  /* ── today's journey ── */
  const journey: { done: boolean; label: string; sub?: string; action: React.ReactNode; undoable?: boolean }[] = [
    { done: !!sleepH, label: "Log last night's sleep", action: <Btn size="sm" variant="soft" onClick={() => openQuick("sleep")}>Add</Btn> },
    { done: waterMl >= goalMl, label: `Drink water: ${(waterMl / 1000).toFixed(1)} of ${(goalMl / 1000).toFixed(1)} L`, action: <Btn size="sm" variant="soft" onClick={() => openQuick("water")}>Log</Btn> },
    { done: workoutMins >= settings.activeGoal, label: `Move for ${settings.activeGoal} minutes`, sub: workoutMins ? `${workoutMins} min so far` : "", action: <Btn size="sm" variant="soft" href="/app/health/fitness?tab=workouts">Start</Btn> },
    { done: !!moodToday, label: "Check in with your mood", action: <Btn size="sm" variant="soft" onClick={() => openQuick("mood")}>Check in</Btn> },
    { done: calmToday, label: "Take a calm break", action: <Btn size="sm" variant="soft" href="/app/health/games">Play</Btn> },
    ...dueToday.map(({ r }) => ({
      done: (r.data.done || []).includes(t), undoable: true, label: r.data.title, sub: [r.data.time ? fmtTime(r.data.time) : "", r.data.category].filter(Boolean).join(" · "),
      action: <Btn size="sm" variant="soft" onClick={() => reminders.edit(r.id, { data: { done: (r.data.done || []).includes(t) ? (r.data.done || []).filter((x) => x !== t) : [...(r.data.done || []), t] } }, "Updated")}>
        {(r.data.done || []).includes(t) ? "Undo" : "Done"}
      </Btn>,
    })),
  ];
  const doneCount = journey.filter((j) => j.done).length;

  /* ── suggestions ── */
  const recs: { icon: string; hue: Hue; text: string; action: React.ReactNode }[] = [];
  const h = onClient ? new Date().getHours() : 12;
  if (overdue.length) recs.push({ icon: "AlarmClock", hue: "magenta", text: `${overdue.length} ${overdue.length === 1 ? "reminder is" : "reminders are"} overdue.`, action: <Btn size="sm" variant="soft" href="/app/health/reminders">Review</Btn> });
  if (moodToday && ["low", "sad", "anxious", "angry"].includes(moodToday)) recs.push({ icon: "Wind", hue: "blue", text: "A 2-minute breathing break can help right now.", action: <Btn size="sm" variant="soft" href="/app/health/games/breathe">Breathe</Btn> });
  if (waterMl < goalMl && h >= 10) recs.push({ icon: "Droplets", hue: "blue", text: `${litres(goalMl - waterMl)} more to reach today's water goal.`, action: <Btn size="sm" variant="soft" onClick={() => openQuick("water")}>Log</Btn> });
  if (!workoutMins && h >= 9) recs.push({ icon: "Dumbbell", hue: "orange", text: "No movement logged yet. Try the 8-minute desk stretch.", action: <Btn size="sm" variant="soft" href="/app/health/fitness?tab=workouts">Start</Btn> });
  if (lastSleep && sleepOn(lastSleep.date) < settings.sleepGoal - 1) recs.push({ icon: "Moon", hue: "violet", text: "You're sleeping less than your goal. A bedtime reminder can help.", action: <Btn size="sm" variant="soft" href="/app/health/sleep?tab=bedtime">Set one</Btn> });
  if (!recs.length) recs.push({ icon: "Sparkles", hue: "magenta", text: "You're on track today. Keep going!", action: null });

  /* ── the week ── */
  const week = lastDays(7);
  const weekRows: { name: string; goal: string; emoji: string; hue: Hue; href: string; met: (d: string) => boolean; part: (d: string) => boolean }[] = [
    { name: "Water", goal: `Drink ${litres(goalMl)}`, emoji: EMOJI.water, hue: "green", href: "/app/health/nutrition", met: (d) => sumOn(rows, d, "ml") >= goalMl, part: (d) => sumOn(rows, d, "ml") > 0 },
    { name: "Movement", goal: `Move ${settings.activeGoal} min`, emoji: EMOJI.workout, hue: "orange", href: "/app/health/fitness?tab=progress", met: (d) => minsOn(d) >= settings.activeGoal, part: (d) => minsOn(d) > 0 },
    { name: "Sleep", goal: `Sleep ${settings.sleepGoal} h`, emoji: EMOJI.sleep, hue: "violet", href: "/app/health/sleep?tab=log", met: (d) => sleepOn(d) >= settings.sleepGoal - 0.25, part: (d) => sleepOn(d) > 0 },
    { name: "Mood", goal: "Check in once", emoji: EMOJI.mood, hue: "blue", href: "/app/health/mind?tab=mood", met: (d) => moodBy.has(d), part: () => false },
    { name: "Calm break", goal: "Relax for a few minutes", emoji: EMOJI.calm, hue: "amber", href: "/app/health/games", met: (d) => calmOn(d) > 0, part: () => false },
  ];
  const scored = weekRows.map((r) => ({ r, n: week.filter((w) => r.met(w.day)).length }));
  const best = [...scored].sort((a, b) => b.n - a.n)[0];
  const missing = scored.find((x) => x.n === 0);
  const nights = week.map((w) => sleepOn(w.day)).filter(Boolean);
  const totals: [string, string, string][] = [
    [EMOJI.water, litres(week.reduce((a, w) => a + sumOn(rows, w.day, "ml"), 0)), "in total"],
    [EMOJI.workout, `${week.reduce((a, w) => a + minsOn(w.day), 0)} min`, "active"],
    [EMOJI.sleep, nights.length ? hm(nights.reduce((a, b) => a + b, 0) / nights.length) : "–", "average night"],
    [EMOJI.mood, String(week.filter((w) => moodBy.has(w.day)).length), "check-ins"],
    [EMOJI.calm, `${week.reduce((a, w) => a + calmOn(w.day), 0)} min`, "calm time"],
  ];

  /* ── explore cards ── */
  const preg = pregInfo(settings.pregnancy);
  const mentorUp = liveAppts.filter((a) => a.kind === "mentor").length;
  const doctorUp = liveAppts.filter((a) => a.kind === "doctor").length;
  type Card = { id: string; label: string; href: string; hue: Hue; ill: string; stat: string; act: { label: string; quick?: Quick | "reminder"; href?: string; plus?: boolean } };
  const allCards: Card[] = [
    { id: "fitness", label: "Fitness", href: "/app/health/fitness", hue: "orange", ill: "hero-fitness",
      stat: workoutMins ? `${workoutMins} of ${settings.activeGoal} min today` : "Start moving today", act: { label: "Log workout", quick: "workout", plus: true } },
    { id: "nutrition", label: "Nutrition & Diet", href: "/app/health/nutrition", hue: "green", ill: "hero-nutrition",
      stat: `${mealsToday ? `${mealsToday} ${mealsToday === 1 ? "meal" : "meals"} · ` : ""}${waterMl ? litres(waterMl) : "0 ml"} water`, act: { label: "Log meal", quick: "meal", plus: true } },
    { id: "sleep", label: "Sleep", href: "/app/health/sleep", hue: "violet", ill: "hero-sleep",
      stat: lastSleep ? `${hm(sleepOn(lastSleep.date))} last logged` : "Track your rest", act: { label: "Log sleep", quick: "sleep", plus: true } },
    { id: "mental", label: "Mental Wellness", href: "/app/health/mind", hue: "blue", ill: "hero-mental",
      stat: moodToday ? `Feeling ${(MOOD_CHOICES.find((m) => m.id === moodToday)?.label ?? moodToday).toLowerCase()} today` : "How are you feeling?", act: { label: "Check in", quick: "mood", plus: true } },
    { id: "games", label: "Games & Stress Relief", href: "/app/health/games", hue: "amber", ill: "hero-games",
      stat: gamesToday ? `${gamesToday} played today` : `${GAMES.length} calming games`, act: { label: "Play", href: "/app/health/games" } },
    { id: "fertility", label: "Fertility", href: "/app/health/fertility", hue: "pink", ill: "hero-fertility",
      stat: "Know your cycle", act: { label: "Open", href: "/app/health/fertility" } },
    { id: "pregnancy", label: "Pregnancy", href: "/app/health/pregnancy", hue: "lilac", ill: "hero-pregnancy",
      stat: preg ? `Week ${preg.week} · ${["", "1st", "2nd", "3rd"][preg.trimester]} trimester` : "Start week-by-week tracking", act: { label: "Open", href: "/app/health/pregnancy" } },
    { id: "reminders", label: "Appointments & Reminders", href: "/app/health/reminders", hue: "magenta", ill: "hero-reminders",
      stat: activeRem ? `${activeRem} active` : "Never miss a thing", act: { label: "Add", quick: "reminder", plus: true } },
    { id: "mentor", label: "Mentor Connect", href: "/app/health/mentors", hue: "orange", ill: "mentor",
      stat: mentorUp ? `${mentorUp} upcoming` : "Grow with a guide", act: { label: "Find", href: "/app/health/mentors?tab=match" } },
    { id: "doctor", label: "Doctor Consultation", href: "/app/health/doctors", hue: "green", ill: "hero-doctor",
      stat: doctorUp ? `${doctorUp} upcoming` : "Online or in person", act: { label: "Book", href: "/app/health/doctors" } },
  ];
  const cards = allCards.filter((c) => !(c.id === "fertility" && !settings.trackCycle) && !(c.id === "pregnancy" && !settings.trackPreg));
  // "Hide health details": what she logged is blurred where someone could read it over her shoulder.
  const blur: React.CSSProperties | undefined = settings.privateMode ? { filter: "blur(6px)", userSelect: "none" } : undefined;
  // First visit (nothing logged, setup not seen), or "Run setup again" from her settings.
  const firstVisit = ready && !settings.onboarded && !recent.loading && !moods.loading && !recent.rows.length && !moods.rows.length;
  const showSetup = setupAgain || firstVisit;

  /* ── rings ── */
  const ring = [
    { q: "water" as Quick, name: "Water", colour: "var(--ux-violet)", icon: "Droplets", hue: "blue" as Hue, p: pct(waterMl, goalMl), value: waterMl ? litres(waterMl) : "0 ml", of: `of ${litres(goalMl)}` },
    { q: "workout" as Quick, name: "Move", colour: "var(--ux-brand)", icon: "Footprints", hue: "orange" as Hue, p: pct(workoutMins, settings.activeGoal), value: `${workoutMins} min`, of: `of ${settings.activeGoal} min` },
    { q: "sleep" as Quick, name: "Sleep", colour: "var(--ws-gold)", icon: "Moon", hue: "violet" as Hue, p: pct(sleepH, settings.sleepGoal), value: sleepH ? hm(sleepH) : "–", of: "last night" },
  ];
  const moodLabel = MOOD_CHOICES.find((m) => m.id === moodToday)?.label ?? moodToday;
  // A new tip each day (counted from her date, so render stays pure), and another on tap.
  const tip = TIPS[(Math.abs(daysBetween("2024-01-01", t)) + tipShift) % TIPS.length];

  const sheet = quick && (
    <Panel id="quick-sheet"
           title={{ water: "Add water", meal: "Log a meal", workout: "Log a workout", sleep: "Log last night's sleep", mood: "How are you feeling?" }[quick]}
           action={<Btn size="sm" variant="ghost" icon="X" onClick={() => setQuick("")}>Close</Btn>}>
      {quick === "water" && <WaterButtons totalMl={waterMl} goalMl={goalMl} onAdd={(ml) => saveQuick("water", { ml }, t, `${ml} ml added`)} />}
      {quick === "mood" && (
        <div className={css.moods} role="group" aria-label="Your mood today">
          {MOOD_CHOICES.map((m) => (
            <button key={m.id} type="button" className={css.moodBtn} aria-pressed={moodToday === m.id} onClick={() => void checkIn(m.id)}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={art(MOOD_EMOJI[m.id])} alt="" />{m.label}
            </button>
          ))}
        </div>
      )}
    </Panel>
  );

  return (
    <HealthFrame active="/app/wellness" hue="magenta" icon="Heart" eyebrow="WomSakhi wellness" tabs={TABS}
                 title="Health & Wellness" sub="Everything you have logged, and how your Health & Wellness is set up."
                 art={illSrc("journey")} bare={(tab) => tab === "main"}
                 actions={<Btn variant="outline" icon="ArrowLeft" href="/app/wellness">Back to your day</Btn>}>
      {(tab) => tab === "activity" ? <History /> : tab === "settings" ? (
        <HealthSettingsTab settings={settings} save={save}
                           onRestart={() => { setSetupAgain(true); router.replace("/app/wellness"); }} />
      ) : showSetup ? (
        <HealthOnboarding settings={settings} first={first} save={save} onDone={() => { setSetupAgain(false); day.reload(); recent.reload(); reminders.reload(); }} />
      ) : (
        // Two columns, as Work's dashboard: her day on the left, and the quote,
        // what is coming up and what she did last on a 320px column at the right.
        <div className={css.layout} data-health-layout>
          <div className={css.main}>
          {customize && (
            <Panel title="Customize your dashboard" sub="Choose what to show. Your choice is saved to your account." hue="magenta" tint
                   action={<Btn size="sm" onClick={() => setCustomize(false)}>Done</Btn>}>
              <div className="flex flex-wrap gap-2" data-customize>
                {WIDGETS.map(([k, l]) => (
                  <button key={k} type="button" aria-pressed={!hidden(k)} onClick={() => toggleWidget(k)}
                          className="ux-press inline-flex min-h-[40px] items-center gap-1.5 rounded-full border-[1.5px] px-3.5 text-[13.5px] font-bold"
                          style={!hidden(k) ? { borderColor: HUE.magenta.ink, background: "var(--ux-surface)", color: "var(--ux-ink)" } : { borderColor: "var(--ux-line-strong)", color: "var(--ux-muted)" }}>
                    <I name={hidden(k) ? "EyeOff" : "Eye"} className="h-4 w-4" />{l}
                  </button>
                ))}
              </div>
            </Panel>
          )}

          {/* ── the banner, as Earn's and Work's open: her day in one line, and one tap to log ── */}
          <section className={css.hero} aria-labelledby="health-greet" data-health-stage>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className={css.heroImg} src={illSrc("hero-mental")} alt="" aria-hidden />
            <div className={css.heroContent}>
              <p className={css.eyebrow}>Health <span>·</span> Wellness <span>·</span> Care</p>
              <h1 id="health-greet">{onClient ? greet() : "Welcome"}{first ? <>,<br /><em>{first}</em></> : null}</h1>
              <p className={css.heroSub}>{line}</p>
              {!hidden("quick") && (
                <div className={css.quick} role="group" aria-label="Log in one tap">
                  {([["water", "Water", EMOJI.water], ["meal", "Meal", EMOJI.meal], ["workout", "Workout", EMOJI.workout],
                     ["mood", "Mood", EMOJI.mood], ["sleep", "Sleep", EMOJI.sleep]] as const).map(([q, l, e]) => (
                    <button key={q} type="button" className={css.qf} aria-expanded={quick === q} aria-controls="quick-sheet" onClick={() => openQuick(q)}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={art(e)} alt="" />{l}
                    </button>
                  ))}
                  <button type="button" className={css.qf} onClick={() => setRemSheet(true)}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={art(EMOJI.reminder)} alt="" />Reminder
                  </button>
                </div>
              )}
              <div className={css.heroLinks}>
                <span>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={art(EMOJI.fire)} alt="" />{streakDays}-day streak
                </span>
                <Link href="/app/wellness?tab=activity"><I name="List" />Activity history</Link>
                <button type="button" aria-pressed={customize} onClick={() => setCustomize(!customize)}><I name="LayoutGrid" />Customize</button>
              </div>
            </div>
          </section>

          {/* ── today, as Work's four stat tiles: tap one to log it ── */}
          {!hidden("overview") && (
            <div className={css.tiles} data-health-tiles>
              {ring.map((x) => (
                <button key={x.name} type="button" className={css.tile} onClick={() => openQuick(x.q)}
                        style={{ "--tile-tint": HUE[x.hue].tint, "--tile-ink": HUE[x.hue].ink } as React.CSSProperties}
                        aria-label={`${x.name}: ${x.value} ${x.of}. Log ${x.name.toLowerCase()}`}>
                  <span><I name={x.icon} /></span>
                  <div>
                    <strong>{x.value}</strong>
                    <small>{x.name} · {x.of}</small>
                    <span className={css.bar} aria-hidden><i style={{ width: `${Math.round(x.p)}%` }} /></span>
                  </div>
                  <I name="ChevronRight" />
                </button>
              ))}
              <button type="button" className={css.tile} onClick={() => openQuick("mood")}
                      style={{ "--tile-tint": HUE.pink.tint, "--tile-ink": HUE.pink.ink } as React.CSSProperties}
                      aria-label={moodToday ? `Mood today: ${moodLabel}. Change it` : "Check in your mood"}>
                <span>
                  {moodToday
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={art(MOOD_EMOJI[moodToday] ?? EMOJI.mood)} alt="" className="h-7 w-7" />
                    : <I name="Smile" />}
                </span>
                <div>
                  <strong>{moodToday ? moodLabel : "Check in"}</strong>
                  <small>Mood today</small>
                </div>
                <I name="ChevronRight" />
              </button>
            </div>
          )}
          {sheet}
          <WorkoutFlow open={flow === "workout"} onClose={() => setFlow("")} onSave={(d, date) => saveQuick("workout", d, date, "Workout saved")} />
          <MealFlow open={flow === "meal"} onClose={() => setFlow("")} onSave={(d, date) => saveQuick("meal", d, date, "Meal saved")} />
          <SleepFlow open={flow === "sleep"} onClose={() => setFlow("")} onSave={(d, date) => saveQuick("sleep", d, date, "Sleep saved")} />
          {remSheet && (
            <ReminderSheet open onClose={() => setRemSheet(false)}
                           onSave={async (data, date) => { const ok = await reminders.add("reminder", data, date, "Reminder added"); if (ok) setRemSheet(false); }} />
          )}

          {/* ── explore ── */}
          {!hidden("banner") && (
            <section aria-labelledby="explore-h">
              <div className={css.secHead}>
                <h2 id="explore-h">Explore your wellness</h2>
                <span>Tap a card to open it, or use its button to log in one step.</span>
              </div>
              {/* Every card the same size: 5 across when that fills the rows evenly, else 4. */}
              <div className={css.bento} data-bento style={{ "--cols": cards.length % 5 === 0 ? 5 : 4 } as React.CSSProperties}>
                {cards.map((c) => (
                  <article key={c.id} className={css.card}
                           style={{ "--card-ink": HUE[c.hue].ink, "--card-tint": HUE[c.hue].tint } as React.CSSProperties}>
                    <Link href={c.href} className={css.cover} aria-label={`Open ${c.label}`} />
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img className={css.cardIll} src={illSrc(c.ill)} alt="" loading="lazy" />
                    <div className={css.shade} />
                    <div className={css.body}>
                      <h3>{c.label}</h3>
                      <p className={css.cardStat}>{c.stat}</p>
                      {c.act.href
                        ? <Link className={css.act} href={c.act.href}>{c.act.label}</Link>
                        : <button type="button" className={css.act}
                                  onClick={() => (c.act.quick === "reminder" ? setRemSheet(true) : openQuick(c.act.quick as Quick))}>
                            {c.act.plus && <I name="Plus" className="h-3.5 w-3.5" />}{c.act.label}
                          </button>}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}

              {!hidden("tips") && (
                <section className={css.tip} aria-label="Tip of the day">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={art(EMOJI.sparkles)} alt="" />
                  <div>
                    <p className={css.tipEyebrow}>Tip of the day</p>
                    <p>{tip}</p>
                  </div>
                  <Btn size="sm" variant="ghost" icon="RefreshCw" onClick={() => setTipShift((n) => n + 1)}>Another</Btn>
                </section>
              )}
              {!hidden("journey") && (
                <Panel title="Today's journey" sub={`${doneCount} of ${journey.length} done today. Small steps add up.`}>
                  <div className="h-[7px] overflow-hidden rounded-full" style={{ background: HUE.magenta.tint }}>
                    <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${(doneCount / journey.length) * 100}%`, background: HUE.magenta.ink }} />
                  </div>
                  <ul className="flex flex-col" data-journey>
                    {journey.map((j, k) => (
                      <li key={k} className="flex items-center gap-3 border-t py-2.5 first:border-t-0" style={{ borderColor: "var(--ux-line)" }}>
                        <span className="grid h-[26px] w-[26px] shrink-0 place-items-center rounded-full border-2"
                              style={j.done ? { background: "var(--ux-green-ink)", borderColor: "var(--ux-green-ink)", color: "var(--ux-surface)" } : { borderColor: "var(--ux-line-strong)" }}>
                          {j.done && <I name="Check" className="h-3.5 w-3.5" />}
                        </span>
                        <span className="min-w-0 flex-1 text-[14.5px] font-semibold" style={{ color: j.done ? "var(--ux-muted)" : "var(--ux-ink)", textDecoration: j.done ? "line-through" : "none" }}>
                          {j.label}{j.sub && <small className="block text-xs font-medium no-underline" style={{ color: "var(--ux-muted)" }}>{j.sub}</small>}
                        </span>
                        {!j.done || j.undoable ? j.action : null}
                      </li>
                    ))}
                  </ul>
                </Panel>
              )}
              {!hidden("watch") && <WatchListen section="home" hue="magenta" compact hideWhenEmpty sub="Narrated guides with calming music" />}
              {!hidden("weekly") && (
                <Panel title="Your week" sub={`${fmtDay(week[0].day, { day: "numeric", month: "short" })} – ${fmtDay(week[6].day, { day: "numeric", month: "short" })}`}>
                  <p className={css.wkHead}>
                    {best.n ? <>Your strongest habit this week: <b>{best.r.name.toLowerCase()}</b>, on {best.n} {best.n === 1 ? "day" : "days"}.
                      {missing && <> Try adding <b>{missing.r.name.toLowerCase()}</b> next.</>}</>
                      : "Nothing logged this week yet. Start with one small goal today."}
                  </p>
                  <div className={css.totals}>
                    {totals.map(([e, v, l]) => (
                      <div key={l} className={css.tot}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={art(e)} alt="" /><b>{v}</b><span>{l}</span>
                      </div>
                    ))}
                  </div>
                  <div className={css.rows} data-weekly>
                    {scored.map(({ r, n }) => (
                      <Link key={r.name} href={r.href} className={css.row} style={{ "--row-ink": HUE[r.hue].ink } as React.CSSProperties}>
                        <span className={css.goal}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={art(r.emoji)} alt="" />
                          <span><b>{r.name}</b><small>{r.goal}</small></span>
                        </span>
                        <span className={css.days}>
                          {week.map((w) => {
                            const met = r.met(w.day), part = !met && r.part(w.day);
                            const label = w.day === t ? "Today" : fmtDay(w.day, { weekday: "short" });
                            return (
                              <span key={w.day} className={`${css.day}${met ? ` ${css.on}` : part ? ` ${css.part}` : ""}${w.day === t ? ` ${css.today}` : ""}`}
                                    title={`${label}: ${met ? "goal met" : part ? "logged, goal not met" : "nothing logged"}`}>
                                <i>{met && <I name="Check" className="h-[15px] w-[15px]" />}</i>
                                <small>{label}</small>
                              </span>
                            );
                          })}
                        </span>
                        <span className={css.count}><b>{n}</b><small>of 7 days</small></span>
                      </Link>
                    ))}
                  </div>
                  <div className={css.key}>
                    <span><i className={`${css.k} ${css.on}`} />Goal met</span>
                    <span><i className={`${css.k} ${css.part}`} />Logged, goal not met</span>
                    <span><i className={css.k} />Nothing logged</span>
                  </div>
                </Panel>
              )}
          </div>
          <aside className={css.rail} aria-label="Coming up and recent">
              <SectionQuote path="/app/wellness" />
              {!hidden("overview") && (
                <Panel title="Today's goals" sub={`${goalsDone} of 5 done today`}>
                  <div className={css.goals} data-health-rings>
                    <div className={css.orbit}>
                      <svg viewBox="0 0 260 260" aria-hidden>
                        {ring.map((x, i) => {
                          const r = 116 - i * 26, c = 2 * Math.PI * r;
                          return (
                            <g key={x.name}>
                              <circle cx="130" cy="130" r={r} fill="none" stroke="var(--ux-surface-2)" strokeWidth="18" />
                              <circle className={css.arc} cx="130" cy="130" r={r} fill="none" stroke={x.colour} strokeWidth="18" strokeLinecap="round"
                                      strokeDasharray={c.toFixed(1)} strokeDashoffset={(c * (1 - x.p / 100)).toFixed(1)} transform="rotate(-90 130 130)" />
                            </g>
                          );
                        })}
                      </svg>
                      <button type="button" className={css.core} onClick={() => openQuick("mood")}
                              aria-label={moodToday ? `Mood today: ${moodLabel}. Change it` : "Check in your mood"}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        {moodToday ? <img className={css.mood} src={art(MOOD_EMOJI[moodToday] ?? EMOJI.mood)} alt="" /> : <img className={css.ill} src={illSrc("hero-home")} alt="" />}
                      </button>
                    </div>
                    <div className={css.legend}>
                      {ring.map((x) => (
                        <button key={x.name} type="button" className={css.ol} onClick={() => openQuick(x.q)} title={`${x.name} · ${x.of}`}
                                aria-label={`${x.name}: ${x.value} ${x.of}. Log ${x.name.toLowerCase()}`}>
                          <i style={{ background: x.colour }} />
                          <span><b>{x.value}</b><small>{x.name} · <em className={css.pct}>{Math.round(x.p)}%</em></small></span>
                        </button>
                      ))}
                    </div>
                  </div>
                </Panel>
              )}
              {!hidden("upcoming") && (
                <Panel title="Upcoming" action={<Btn size="sm" variant="ghost" iconEnd="ArrowRight" href="/app/health/reminders">View all</Btn>}>
                  {upcomingRem.length || liveAppts.length ? (
                    <ul className="flex flex-col gap-3" data-upcoming>
                      {liveAppts.slice(0, 2).map((a) => (
                        <li key={a.id} className="flex items-center gap-3">
                          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px]" style={{ background: HUE[a.kind === "doctor" ? "green" : "orange"].tint, color: HUE[a.kind === "doctor" ? "green" : "orange"].ink }}>
                            <I name={a.kind === "doctor" ? "Stethoscope" : "Users"} className="h-[18px] w-[18px]" />
                          </span>
                          <Link href={a.href} className="min-w-0 flex-1">
                            <b className="block truncate text-sm" style={{ color: "var(--ux-ink)" }}>{a.title}</b>
                            <span className="text-xs" style={{ color: "var(--ux-muted)" }}>{a.when || a.sub}</span>
                          </Link>
                          <span className="shrink-0 rounded-full px-2 py-0.5 text-2xs font-bold" style={{ background: "var(--ux-surface-2)", color: "var(--ux-ink-2)" }}>
                            {a.status === "confirmed" ? "Confirmed" : "Requested"}
                          </span>
                        </li>
                      ))}
                      {upcomingRem.slice(0, 5 - Math.min(2, liveAppts.length)).map(({ r, on }) => (
                        <li key={r.id} className="flex items-center gap-3">
                          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px]" style={{ background: HUE.magenta.tint, color: HUE.magenta.ink }}>
                            <I name="CalendarClock" className="h-[18px] w-[18px]" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <b className="block truncate text-sm" style={{ color: "var(--ux-ink)", ...blur }}>{r.data.title}</b>
                            <span className="text-xs" style={{ color: "var(--ux-muted)" }}>
                              {on === t ? "Today" : fmtDay(on, { weekday: "short", day: "numeric", month: "short" })}{r.data.time ? ` · ${fmtTime(r.data.time)}` : ""}
                            </span>
                          </span>
                          <span className="shrink-0 rounded-full px-2 py-0.5 text-2xs font-bold" style={{ background: "var(--ux-surface-2)", color: "var(--ux-ink-2)" }}>{r.data.category}</span>
                        </li>
                      ))}
                    </ul>
                  ) : <p className="text-sm" style={{ color: "var(--ux-muted)" }}>Nothing scheduled yet.</p>}
                  <div className="flex flex-wrap gap-2">
                    <Btn size="sm" icon="Plus" href="/app/health/doctors">Add appointment</Btn>
                    <Btn size="sm" variant="outline" icon="Plus" onClick={() => setRemSheet(true)}>Add reminder</Btn>
                  </div>
                </Panel>
              )}
              {!hidden("recent") && (
                <Panel title="Recent activities" action={<Btn size="sm" variant="ghost" iconEnd="ArrowRight" href="/app/wellness?tab=activity">View all</Btn>}>
                  {recent.rows.length ? (
                    <ul className="flex flex-col" data-recent>
                      {[...recent.rows].sort((a, b) => b.updated_at.localeCompare(a.updated_at)).slice(0, 5).map((e) => {
                        const k = KIND_INFO[e.kind];
                        return (
                          <li key={e.id} className="flex items-center gap-3 border-t py-2.5 first:border-t-0" style={{ borderColor: "var(--ux-line)" }}>
                            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px]" style={{ background: HUE[k.hue].tint, color: HUE[k.hue].ink }}>
                              <I name={k.icon} className="h-[18px] w-[18px]" />
                            </span>
                            <span className="min-w-0 flex-1">
                              <b className="block truncate text-sm" style={{ color: "var(--ux-ink)" }}>{k.label}</b>
                              <span className="block truncate text-xs" style={{ color: "var(--ux-muted)", ...blur }}>{describe(e)} · {e.date === t ? "Today" : fmtDay(e.date)}</span>
                            </span>
                            <Btn size="sm" variant="outline" href={k.href}>View</Btn>
                          </li>
                        );
                      })}
                    </ul>
                  ) : <p className="text-sm" style={{ color: "var(--ux-muted)" }}>Your latest entries show here. Try logging something above.</p>}
                </Panel>
              )}
              {!hidden("recs") && (
                <Panel title="Suggestions for you">
                  <ul className="flex flex-col gap-3">
                    {recs.slice(0, 4).map((r, k) => (
                      <li key={k} className="flex items-center gap-3">
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px]" style={{ background: HUE[r.hue].tint, color: HUE[r.hue].ink }}>
                          <I name={r.icon} className="h-[18px] w-[18px]" />
                        </span>
                        <span className="min-w-0 flex-1 text-sm font-semibold" style={{ color: "var(--ux-ink)" }}>{r.text}</span>
                        {r.action}
                      </li>
                    ))}
                  </ul>
                  <p className="text-xs" style={{ color: "var(--ux-muted)" }}>Based on what you&rsquo;ve logged. Not medical advice.</p>
                </Panel>
              )}
          </aside>
        </div>
      )}
    </HealthFrame>
  );
}

/* ── activity history ───────────────────────────────────────────────── */

const GROUPS: { id: string; label: string; kinds: HealthKind[] }[] = [
  { id: "all", label: "All", kinds: LOGGED },
  { id: "fitness", label: "Fitness", kinds: ["workout"] },
  { id: "food", label: "Food & water", kinds: ["meal", "water"] },
  { id: "sleep", label: "Sleep", kinds: ["sleep"] },
  { id: "mind", label: "Mind & calm", kinds: ["journal", "activity", "game"] },
  { id: "body", label: "Body & records", kinds: ["symptom", "pregsym", "kick", "measure", "document"] },
  { id: "pregnancy", label: "Pregnancy care", kinds: ["anc", "pregtest", "pregrisk", "delivery", "postnatal", "pregsym", "kick"] },
];

function History() {
  const t = today();
  const [group, setGroup] = useState("all");
  const [range, setRange] = useState("30");
  const g = GROUPS.find((x) => x.id === group)!;
  const { rows, loading, remove } = useEntries(g.kinds.filter((k) => k !== "reminder"), { from: addDays(t, -(Number(range) - 1)) });
  const dated = rows.filter((r) => r.date);
  const byDay = dated.reduce<Record<string, Entry[]>>((a, r) => { (a[r.date] ||= []).push(r); return a; }, {});
  return (
    <>
      <div className="flex flex-col gap-3">
        <Chips hue="magenta" label="What" value={group} onChange={setGroup} options={GROUPS.map((x) => ({ value: x.id, label: x.label }))} />
        <Chips hue="magenta" label="When" value={range} onChange={setRange}
               options={[{ value: "7", label: "7 days" }, { value: "30", label: "30 days" }, { value: "90", label: "90 days" }]} />
      </div>
      <Panel title="Activity history" sub={`${dated.length} ${dated.length === 1 ? "entry" : "entries"}`}>
        {loading ? <p className="text-sm" style={{ color: "var(--ux-muted)" }}>Loading…</p>
          : !dated.length ? <Empty icon="History" title="Nothing logged here yet" body="Use the quick actions on the Overview tab, or open a section to start." />
          : (
            <div className="flex flex-col gap-4" data-history>
              {Object.keys(byDay).sort().reverse().map((d) => (
                <section key={d}>
                  <h3 className="mb-1 text-2xs font-extrabold uppercase tracking-[0.1em]" style={{ color: "var(--ux-muted)" }}>
                    {d === t ? "Today" : fmtDay(d, { weekday: "long", day: "numeric", month: "short" })}
                  </h3>
                  <ul className="flex flex-col">
                    {byDay[d].map((e) => {
                      const k = KIND_INFO[e.kind];
                      return (
                        <li key={e.id} className="flex items-center gap-3 border-t py-2 first:border-t-0" style={{ borderColor: "var(--ux-line)" }}>
                          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px]" style={{ background: HUE[k.hue].tint, color: HUE[k.hue].ink }}>
                            <I name={k.icon} className="h-[18px] w-[18px]" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <b className="block truncate text-sm" style={{ color: "var(--ux-ink)" }}>{describe(e)}</b>
                            <span className="text-xs" style={{ color: "var(--ux-muted)" }}>{k.label}</span>
                          </span>
                          {/* Icons only on a phone, so the entry keeps the room to be read. */}
                          <Btn size="sm" variant="ghost" icon="Pencil" href={k.href} ariaLabel={`Edit in ${k.label}`}><span className="max-sm:sr-only">Edit</span></Btn>
                          <Btn size="sm" variant="ghost" icon="Trash2" ariaLabel={`Delete ${k.label}`} onClick={() => remove(e.id)}><span className="max-sm:sr-only">Delete</span></Btn>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))}
            </div>
          )}
      </Panel>
    </>
  );
}
