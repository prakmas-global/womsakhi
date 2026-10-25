"use client";

import { useState } from "react";

import { Btn } from "@/components/ux/kit";
import { Text } from "@/components/ux/kit/form";
import { addDays, fmtDay, today, type KindData, type MealType } from "@/lib/health-api";
import { ACTIVITIES, INTENSITIES } from "./fitness-data";
import { Chips, type Hue } from "./kit";
import { Dial, PicChoice, Review, StepSheet, type FlowStep } from "./StepFlow";

/**
 * The quick logs the Health home, Fitness and Nutrition share — each a short
 * step flow (StepFlow.tsx) that asks one thing at a time with pictures to
 * tap. Each hands back (data, date) and leaves saving to the screen; a flow
 * closes itself only when the save worked.
 */

type Save<K extends keyof KindData> = (data: KindData[K], date: string) => Promise<unknown>;
type FlowProps<K extends keyof KindData> = { open: boolean; onClose: () => void; onSave: Save<K>; hue?: Hue };

const DAY_CHOICES = [{ value: "today", label: "Today" }, { value: "yesterday", label: "Yesterday" }] as const;
const dayOf = (v: string) => (v === "yesterday" ? addDays(today(), -1) : today());

/* ── workout ─────────────────────────────────────────────────────────────── */

const INTENSITY_ART: Record<string, { art: string; sub: string }> = {
  Easy: { art: "Stretching", sub: "Could chat easily" },
  Moderate: { art: "Walking", sub: "A little out of breath" },
  Hard: { art: "Fire", sub: "Hard to talk" },
};

export function WorkoutFlow({ open, onClose, onSave, hue = "orange", initial }: FlowProps<"workout"> & { initial?: Partial<KindData["workout"]> }) {
  const [step, setStep] = useState(0);
  const [activity, setActivity] = useState<string>(initial?.activity || "");
  const [minutes, setMinutes] = useState(initial?.minutes || 20);
  const [intensity, setIntensity] = useState<string>(initial?.intensity || "Moderate");
  const [steps, setSteps] = useState(initial?.steps || 0);
  const [day, setDay] = useState("today");
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    const ok = await onSave({ activity: activity || "Other", minutes, steps, intensity }, dayOf(day));
    setBusy(false);
    if (ok) { setStep(0); setActivity(""); onClose(); }
  };
  const flow: FlowStep[] = [
    { id: "what", title: "What did you do?", valid: !!activity,
      body: <PicChoice label="Activity" hue={hue} options={ACTIVITIES} value={activity} onChange={setActivity} onPicked={() => setStep(1)} /> },
    { id: "long", title: "For how long?", valid: minutes >= 1 && minutes <= 600,
      body: <Dial label="minutes" unit="min" hue={hue} value={minutes} onChange={setMinutes} min={1} max={600} step={5} presets={[10, 20, 30, 45, 60]} /> },
    { id: "hard", title: "How hard did it feel?",
      body: <PicChoice label="Intensity" hue={hue} value={intensity} onChange={setIntensity} onPicked={() => setStep(3)}
                       options={INTENSITIES.map((v) => ({ value: v, label: v, ...INTENSITY_ART[v] }))} /> },
    { id: "check", title: "Anything else?", hint: "Steps are optional. Check, then save.",
      body: <>
        <Chips label="When" hue={hue} options={DAY_CHOICES} value={day} onChange={setDay} />
        <Dial label="steps" unit="steps" hue={hue} value={steps} onChange={setSteps} max={60000} step={500} presets={[2000, 4000, 6000, 8000]} />
        <Review rows={[["Activity", activity], ["Time", `${minutes} min`], ["Felt", intensity], ["Steps", steps ? steps.toLocaleString("en-IN") : ""], ["Day", day === "today" ? "Today" : "Yesterday"]]} />
      </> },
  ];
  return <StepSheet open={open} onClose={onClose} icon="Dumbbell" title="Log a workout" hue={hue} steps={flow} step={step} setStep={setStep}
                    onSubmit={save} busy={busy} submitLabel="Save workout" />;
}

/* ── meal ────────────────────────────────────────────────────────────────── */

export const mealByTime = (): MealType => {
  const h = new Date().getHours();
  return h < 11 ? "Breakfast" : h < 16 ? "Lunch" : h < 19 ? "Evening snack" : "Dinner";
};
const MEAL_TYPES = ["Breakfast", "Lunch", "Evening snack", "Dinner"] as const;
const FOODS: Record<MealType, string[]> = {
  Breakfast: ["Poha", "Idli sambar", "Upma", "Paratha with curd", "Moong dal chilla", "Ragi porridge"],
  Lunch: ["Dal, rice and sabzi", "Roti and sabzi", "Rajma chawal", "Curd rice", "Khichdi"],
  "Evening snack": ["Fruit", "Roasted chana", "Sprouts chaat", "Tea and biscuits", "Buttermilk"],
  Dinner: ["Roti and dal", "Vegetable khichdi", "Paneer bhurji with roti", "Egg curry with roti", "Soup and salad"],
};

export function MealFlow({ open, onClose, onSave, hue = "green", initialType }: FlowProps<"meal"> & { initialType?: MealType }) {
  const [step, setStep] = useState(0);
  const [mealType, setMealType] = useState<MealType>(initialType ?? mealByTime());
  const [food, setFood] = useState("");
  const [kcal, setKcal] = useState(0);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    const ok = await onSave({ mealType, food: food.trim(), kcal }, today());
    setBusy(false);
    if (ok) { setStep(0); setFood(""); setKcal(0); onClose(); }
  };
  const flow: FlowStep[] = [
    { id: "which", title: "Which meal?",
      body: <PicChoice label="Meal" hue={hue} options={MEAL_TYPES} value={mealType} onChange={(v) => setMealType(v as MealType)} onPicked={() => setStep(1)} columns={4} /> },
    { id: "food", title: "What did you eat?", hint: "Tap a dish, or write your own.", valid: !!food.trim(),
      body: <>
        <Chips label="Common dishes" hue={hue} options={FOODS[mealType]} value={food} onChange={setFood} />
        <Text label="Or write it" value={food} onChange={setFood} max={120} placeholder="Or write it here" />
      </> },
    { id: "kcal", title: "Calories, if you know them", hint: "Optional. Skip if you are not sure.",
      body: <>
        <Dial label="calories" unit="kcal" hue={hue} value={kcal} onChange={setKcal} max={3000} step={10} presets={[150, 250, 350, 450, 600]} />
        <Review rows={[["Meal", mealType], ["Food", food], ["Calories", kcal ? `${kcal} kcal` : ""], ["Day", "Today"]]} />
      </> },
  ];
  return <StepSheet open={open} onClose={onClose} icon="Apple" title="Log a meal" hue={hue} steps={flow} step={step} setStep={setStep}
                    onSubmit={save} busy={busy} submitLabel="Save meal" />;
}

/* ── sleep ───────────────────────────────────────────────────────────────── */

const BEDS = ["21:30", "22:00", "22:30", "23:00", "23:30", "00:00", "00:30"];
const WAKES = ["05:00", "05:30", "06:00", "06:30", "07:00", "07:30", "08:00"];
const QUALITY = [
  { value: "Poor", label: "Poor", art: "Restless" }, { value: "Fair", label: "Fair", art: "Okay" },
  { value: "Good", label: "Good", art: "Good" }, { value: "Great", label: "Great", art: "Restful" },
] as const;
export const fmtTime = (t: string) => {
  if (!t) return "";
  const h = Number(t.slice(0, 2)), m = t.slice(3, 5);
  return `${((h + 11) % 12) + 1}:${m} ${h < 12 ? "am" : "pm"}`;
};
const minsBetween = (bed: string, wake: string) => {
  const a = Number(bed.slice(0, 2)) * 60 + Number(bed.slice(3, 5)), b = Number(wake.slice(0, 2)) * 60 + Number(wake.slice(3, 5));
  return (b - a + 1440) % 1440;
};

function TimeChips({ value, onChange, options, hue, label }: { value: string; onChange: (v: string) => void; options: string[]; hue: Hue; label: string }) {
  return (
    <div className="flex flex-col gap-2">
      <Chips label={label} hue={hue} options={options.map((t) => ({ value: t, label: fmtTime(t) }))} value={value} onChange={onChange} />
      <input type="time" value={value} onChange={(e) => e.target.value && onChange(e.target.value)} aria-label={`${label}, exact time`}
             className="min-h-[44px] w-fit rounded-[12px] border-[1.5px] px-3 text-sm font-bold"
             style={{ borderColor: "var(--ux-line-strong)", background: "var(--ux-surface)", color: "var(--ux-ink)" }} />
    </div>
  );
}

export function SleepFlow({ open, onClose, onSave, hue = "violet", initial, date: fixedDate }: FlowProps<"sleep"> & {
  initial?: Partial<KindData["sleep"]>; date?: string;
}) {
  const [step, setStep] = useState(0);
  const [date, setDate] = useState(fixedDate ?? today());
  const [bed, setBed] = useState(initial?.bed ?? "22:30");
  const [wake, setWake] = useState(initial?.wake ?? "06:30");
  const [quality, setQuality] = useState<KindData["sleep"]["quality"]>(initial?.quality ?? "Good");
  const [busy, setBusy] = useState(false);
  const m = minsBetween(bed, wake);
  const bad = m < 60 || m > 960;
  const save = async () => {
    setBusy(true);
    const ok = await onSave({ ...initial, bed, wake, quality }, date);
    setBusy(false);
    if (ok) { setStep(0); onClose(); }
  };
  const flow: FlowStep[] = [
    { id: "bed", title: "When did you go to bed?",
      body: <>
        <Chips label="Which night" hue={hue} value={date} onChange={setDate}
               options={[{ value: today(), label: "Last night" }, { value: addDays(today(), -1), label: "The night before" }]} />
        <TimeChips label="Bedtime" hue={hue} options={BEDS} value={bed} onChange={setBed} />
      </> },
    { id: "wake", title: "When did you wake up?", valid: !bad,
      body: <>
        <TimeChips label="Wake-up time" hue={hue} options={WAKES} value={wake} onChange={setWake} />
        <p className="rounded-[12px] px-3 py-2 text-sm font-bold"
           style={bad ? { background: "var(--ux-danger-tint)", color: "var(--ux-danger-ink)" } : { background: "var(--ux-tint-violet)", color: "var(--ux-violet-ink)" }}>
          {bad ? "Sleep should be between 1 and 16 hours. Check both times." : `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m of sleep`}
        </p>
      </> },
    { id: "how", title: "How did you sleep?",
      body: <>
        <PicChoice label="Sleep quality" hue={hue} options={QUALITY} value={quality} onChange={(v) => setQuality(v as KindData["sleep"]["quality"])} columns={4} />
        <Review rows={[["Night", date === today() ? "Last night" : fmtDay(date)], ["Bed", fmtTime(bed)], ["Woke", fmtTime(wake)], ["Sleep", `${Math.floor(m / 60)}h ${m % 60}m`], ["Felt", quality]]} />
      </> },
  ];
  return <StepSheet open={open} onClose={onClose} icon="Moon" title="Log your sleep" hue={hue} steps={flow} step={step} setStep={setStep}
                    onSubmit={save} busy={busy} submitLabel="Save sleep" />;
}

/* ── water: one tap, no flow ─────────────────────────────────────────────── */

/** One-tap water: three glass sizes, and the day's total against her goal. */
export function WaterButtons({ totalMl, goalMl, onAdd }: {
  totalMl: number; goalMl: number; onAdd: (ml: number) => Promise<unknown>;
}) {
  const [busy, setBusy] = useState(0);
  const add = async (ml: number) => { setBusy(ml); await onAdd(ml); setBusy(0); };
  return (
    <div className="flex flex-col gap-3" data-form="water">
      <p className="text-sm" style={{ color: "var(--ux-ink-2)" }}>
        <b className="tabular-nums" style={{ color: "var(--ux-ink)" }}>{(totalMl / 1000).toFixed(2).replace(/0$/, "")} L</b> of {(goalMl / 1000).toFixed(1)} L today
      </p>
      <div className="flex flex-wrap gap-2">
        {[150, 250, 500].map((ml) => (
          <Btn key={ml} variant="soft" icon="Plus" size="sm" loading={busy === ml} onClick={() => add(ml)}>{ml} ml</Btn>
        ))}
      </div>
    </div>
  );
}
