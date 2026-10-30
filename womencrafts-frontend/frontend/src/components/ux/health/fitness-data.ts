import type { Entry } from "@/lib/health-api";
import { addDays } from "@/lib/health-api";

/**
 * Fitness content — the guided routines, the four-week plans and the 7-day
 * challenges, as approved in the Health & Wellness design. Steps are
 * [instruction, seconds]; the player walks through them in order.
 */

export type Step = [string, number];

export interface Routine {
  id: string;
  name: string;
  cat: string;
  level: string;
  /** The activity it logs as (the same chips the manual log uses). */
  activity: string;
  desc: string;
  image: string;
  steps: Step[];
}

const rep = (steps: Step[], n: number): Step[] => Array.from({ length: n }, () => steps).flat();

export const ROUTINES: Routine[] = [
  { id: "yoga", name: "Morning Yoga Flow", cat: "Yoga", level: "Beginner", activity: "Yoga",
    desc: "A gentle full-body stretch to start the day.", image: "/ux/wellness/morning-yoga-v2.webp",
    steps: [["Easy seated breathing", 60], ["Cat–cow", 60], ["Child's pose", 60], ["Downward dog", 60], ["Low lunge, each side", 120],
      ["Mountain pose", 60], ["Tree pose, each side", 120], ["Seated forward fold", 90], ["Bridge pose", 90], ["Lying twist", 120], ["Rest", 60]] },
  { id: "strength", name: "Strength Basics", cat: "Strength", level: "Beginner", activity: "Strength training",
    desc: "Three easy rounds using your body weight.", image: "/ux/art/scene-woman-climbing-steps.webp",
    steps: [["Warm-up: march on the spot", 120],
      ...rep([["Squats to a chair", 45], ["Rest", 30], ["Wall push-ups", 45], ["Rest", 30], ["Glute bridges", 45], ["Rest", 30], ["Bird-dog, alternate sides", 45], ["Rest", 30]], 3),
      ["Cool-down stretch", 180]] },
  { id: "desk", name: "Desk Stretch Break", cat: "Stretching", level: "Easy", activity: "Stretching",
    desc: "Loosen your neck, back and legs without leaving your chair.", image: "/ux/art/scene-woman-at-laptop-thinking.webp",
    steps: [["Neck rolls", 60], ["Shoulder rolls", 60], ["Chest opener", 60], ["Seated twist, each side", 120], ["Wrist and finger stretch", 60],
      ["Seated forward fold", 60], ["Hamstring stretch, each leg", 120], ["Slow deep breaths", 60]] },
  { id: "walk", name: "Brisk Walk", cat: "Cardio", level: "Easy", activity: "Walking",
    desc: "Warm up, walk briskly, then cool down.", image: "/ux/art/scene-woman-walking-with-bag.webp",
    steps: [["Warm-up at an easy pace", 300], ["Brisk walk: you can talk but not sing", 1200], ["Cool-down at an easy pace", 300]] },
  { id: "dance", name: "Dance Cardio", cat: "Dance", level: "Beginner", activity: "Dance",
    desc: "Simple steps to music you love.", image: "/ux/art/scene-women-celebrating.webp",
    steps: [["Warm-up: sway and step", 180], ["Side steps with arm swings", 240], ["Grapevine", 240], ["Knee lifts", 180], ["Free dance", 180], ["Cool-down", 180]] },
  { id: "pilates", name: "Pilates Core", cat: "Pilates", level: "Intermediate", activity: "Pilates",
    desc: "Steady core work done lying down.", image: "/ux/art/course-meditation.webp",
    steps: [["Breathing set-up", 60], ["Pelvic tilts", 90], ["Dead bug", 90], ["Rest", 30], ["Side-lying leg lifts, each side", 120], ["Plank on knees", 60],
      ["Rest", 30], ["Swimming", 90], ["Rest", 30], ["Single-leg stretch", 90], ["Child's pose", 210]] },
];

export const routineMinutes = (r: Routine) => Math.round(r.steps.reduce((a, s) => a + s[1], 0) / 60);

export const ACTIVITIES = ["Walking", "Yoga", "Running", "Strength training", "Pilates", "Cycling", "Dance", "Stretching", "Other"] as const;
export const INTENSITIES = ["Easy", "Moderate", "Hard"] as const;

/** Four-week plans: which routine on which weekday (0 = Monday). */
export interface Plan { id: string; name: string; desc: string; level: string; days: Record<number, string> }

export const PLANS: Plan[] = [
  { id: "gentle", name: "Gentle start", level: "Beginner", desc: "Three short sessions a week to build the habit.",
    days: { 0: "walk", 2: "desk", 4: "yoga" } },
  { id: "strong", name: "Stronger every week", level: "Beginner", desc: "Strength twice a week, with yoga to recover.",
    days: { 0: "strength", 2: "yoga", 3: "walk", 5: "strength" } },
  { id: "cardio", name: "Heart and energy", level: "Moderate", desc: "Walks and dance to lift your heart rate.",
    days: { 0: "walk", 1: "dance", 3: "walk", 4: "dance", 6: "walk" } },
  { id: "flex", name: "Stay flexible", level: "Easy", desc: "Daily stretching and core for an easy back.",
    days: { 0: "yoga", 1: "desk", 2: "pilates", 3: "yoga", 4: "desk", 5: "pilates" } },
];

type W = Entry<"workout">;
const onDay = (rows: W[], d: string) => rows.filter((r) => r.date === d);
const minutes = (rows: W[]) => rows.reduce((a, r) => a + (r.data.minutes || 0), 0);

export interface Challenge {
  id: string; name: string; goal: number; desc: string; unit: "days" | "min";
  /** Whether a day counts (for "days" challenges). */
  day?: (rows: W[], d: string, stepsGoal: number) => boolean;
  /** How much a day adds (for "min" challenges). */
  sum?: (rows: W[], d: string) => number;
}

export const CHALLENGES: Challenge[] = [
  { id: "walk5", name: "Walk 30 minutes on 5 days", goal: 5, unit: "days", desc: "Any walk counts. Finish within 7 days.",
    day: (rows, d) => minutes(onDay(rows, d).filter((w) => /walk/i.test(w.data.activity))) >= 30 },
  { id: "steps", name: "Hit your steps goal every day", goal: 7, unit: "days", desc: "Reach your daily steps goal for 7 days.",
    day: (rows, d, goal) => onDay(rows, d).reduce((a, w) => a + (w.data.steps || 0), 0) >= goal },
  { id: "yoga", name: "7-day yoga streak", goal: 7, unit: "days", desc: "10 minutes of yoga a day for a week.",
    day: (rows, d) => minutes(onDay(rows, d).filter((w) => w.data.activity === "Yoga")) >= 10 },
  { id: "stretch", name: "Stretch on 5 days", goal: 5, unit: "days", desc: "Yoga or stretching, any length.",
    day: (rows, d) => onDay(rows, d).some((w) => /Yoga|Stretch|Pilates/.test(w.data.activity)) },
  { id: "move150", name: "150 active minutes in a week", goal: 150, unit: "min", desc: "Add up all your workouts over 7 days.",
    sum: (rows, d) => minutes(onDay(rows, d)) },
];

/** A joined challenge is kept in settings.challenges as "id:YYYY-MM-DD" (the day she joined). */
export const joinedOn = (list: string[], id: string) => (list.find((x) => x.startsWith(`${id}:`)) || "").split(":")[1] || "";

export function challengeState(c: Challenge, start: string, rows: W[], stepsGoal: number, today: string) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i)).filter((d) => d <= today);
  const v = c.sum ? days.reduce((a, d) => a + c.sum!(rows, d), 0) : days.filter((d) => c.day!(rows, d, stepsGoal)).length;
  const elapsed = Math.round((new Date(`${today}T00:00:00`).getTime() - new Date(`${start}T00:00:00`).getTime()) / 86_400_000);
  return { v, done: v >= c.goal, ended: elapsed > 6, left: Math.max(0, 6 - elapsed) };
}

/** Days in a row, ending today or yesterday, with any workout. */
export function streak(rows: W[], today: string) {
  const days = new Set(rows.map((r) => r.date));
  let d = days.has(today) ? today : addDays(today, -1), n = 0;
  while (days.has(d)) { n++; d = addDays(d, -1); }
  return n;
}

export const TIPS = [
  "Keep a water bottle within reach. Small sips through the day add up.",
  "A 10-minute walk after meals is an easy way to move more.",
  "Add a fistful of vegetables to lunch and dinner.",
  "Try going to bed at the same time each night, even on weekends.",
  "Stretch your neck and shoulders every hour if you sit for long.",
  "Write down three things that went well today.",
  "Have some protein at breakfast, like dal, eggs, curd or sprouts.",
  "Step outside for a few minutes of daylight in the morning.",
  "Put your phone away 30 minutes before bed.",
  "Take five slow breaths before a stressful task.",
  "Pair iron-rich foods like greens and dates with lemon or amla to help your body absorb iron.",
  "Call a friend today. A short chat can lift your mood.",
  "Take the stairs for one or two floors when you can.",
  "Keep your check-ups on the calendar so they don't slip.",
];

/** Big pictures for the section grid on the Health home. */
export const SECTION_ART: Record<string, string> = {
  home: "/ux/wellness/wellness-hero-v2.webp",
  fitness: "/ux/wellness/morning-yoga-v2.webp",
  nutrition: "/ux/cycle/food-bowl.webp",
  sleep: "/ux/art/scene-woman-meditating.webp",
  mental: "/ux/art/course-meditation.webp",
  games: "/ux/art/learn-dashboard-mindfulness.webp",
  videos: "/ux/art/course-working-laptop-smiling.webp",
  fertility: "/ux/art/scene-woman-planting-sapling.webp",
  pregnancy: "/ux/art/scene-mother-baby-laptop.webp",
  records: "/ux/art/scene-woman-reading-document.webp",
  reminders: "/ux/art/scene-woman-planning-board.webp",
  mentor: "/ux/art/scene-elder-woman-mentoring.webp",
  doctor: "/ux/art/course-video-call-mentor.webp",
};
