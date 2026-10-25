"use client";

import { useState } from "react";

import { Btn } from "@/components/ux/kit";
import { Stepper, Text } from "@/components/ux/kit/form";
import { addDays, today, type KindData, type MealType } from "@/lib/health-api";
import { ACTIVITIES, INTENSITIES } from "./fitness-data";
import { Chips, type Hue } from "./kit";

/**
 * The small logging forms the Health home and Fitness share. Every field is a
 * tap first — chips and presets — and typing is only ever the fallback.
 * Each form hands back (data, date) and leaves saving to the screen.
 */

type Save<K extends keyof KindData> = (data: KindData[K], date: string) => Promise<unknown>;

const DAY_CHOICES = [{ value: "today", label: "Today" }, { value: "yesterday", label: "Yesterday" }] as const;
const dayOf = (v: "today" | "yesterday") => (v === "today" ? today() : addDays(today(), -1));

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <span className="text-[13.5px] font-bold" style={{ color: "var(--ux-ink)" }}>{label}</span>
      {children}
    </div>
  );
}

export function WorkoutForm({ onSave, hue = "orange", initial }: { onSave: Save<"workout">; hue?: Hue; initial?: Partial<KindData["workout"]> }) {
  const [activity, setActivity] = useState<string>(initial?.activity || "Walking");
  const [minutes, setMinutes] = useState(String(initial?.minutes || 20));
  const [steps, setSteps] = useState(String(initial?.steps || ""));
  const [intensity, setIntensity] = useState<string>(initial?.intensity || "Moderate");
  const [day, setDay] = useState<"today" | "yesterday">("today");
  const [busy, setBusy] = useState(false);
  const mins = Number(minutes) || 0;
  const save = async () => {
    setBusy(true);
    await onSave({ activity, minutes: mins, steps: Number(steps) || 0, intensity }, dayOf(day));
    setBusy(false);
  };
  return (
    <div className="flex flex-col gap-4" data-form="workout">
      <Field label="Activity"><Chips options={ACTIVITIES} value={activity} onChange={setActivity} label="Activity" hue={hue} /></Field>
      <Field label="How many minutes?"><Stepper value={minutes} onChange={setMinutes} label="Minutes" min={1} presets={[10, 20, 30, 45, 60]} /></Field>
      <Field label="Steps (optional)"><Stepper value={steps} onChange={setSteps} label="Steps" presets={[2000, 4000, 6000, 8000]} /></Field>
      <Field label="How hard was it?"><Chips options={INTENSITIES} value={intensity} onChange={setIntensity} label="Intensity" hue={hue} /></Field>
      <Field label="When?"><Chips options={DAY_CHOICES} value={day} onChange={(v) => setDay(v as "today" | "yesterday")} label="Day" hue={hue} /></Field>
      <Btn icon="Check" disabled={mins < 1 || mins > 600} loading={busy} onClick={save}>Save workout</Btn>
    </div>
  );
}

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

export function MealForm({ onSave, hue = "green" }: { onSave: Save<"meal">; hue?: Hue }) {
  const [mealType, setMealType] = useState<MealType>(mealByTime());
  const [food, setFood] = useState("");
  const [kcal, setKcal] = useState("");
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    await onSave({ mealType, food: food.trim(), kcal: Number(kcal) || 0 }, today());
    setBusy(false);
    setFood(""); setKcal("");
  };
  return (
    <div className="flex flex-col gap-4" data-form="meal">
      <Field label="Which meal?"><Chips options={MEAL_TYPES} value={mealType} onChange={setMealType} label="Meal" hue={hue} /></Field>
      <Field label="What did you eat?">
        <Chips options={FOODS[mealType]} value={food} onChange={setFood} label="Common dishes" hue={hue} />
        <Text label="Or write it" value={food} onChange={setFood} max={120} placeholder="Or write it here" />
      </Field>
      <Field label="Calories (optional)"><Stepper value={kcal} onChange={setKcal} label="Calories" presets={[150, 250, 350, 450]} /></Field>
      <Btn icon="Check" disabled={!food.trim()} loading={busy} onClick={save}>Save meal</Btn>
    </div>
  );
}

const BEDS = ["21:30", "22:00", "22:30", "23:00", "23:30", "00:00"];
const WAKES = ["05:30", "06:00", "06:30", "07:00", "07:30", "08:00"];
const QUALITY = ["Poor", "Fair", "Good", "Great"] as const;
export const fmtTime = (t: string) => {
  if (!t) return "";
  const h = Number(t.slice(0, 2)), m = t.slice(3, 5);
  return `${((h + 11) % 12) + 1}:${m} ${h < 12 ? "am" : "pm"}`;
};

export function SleepForm({ onSave, hue = "violet" }: { onSave: Save<"sleep">; hue?: Hue }) {
  const [bed, setBed] = useState("22:30");
  const [wake, setWake] = useState("06:30");
  const [quality, setQuality] = useState<(typeof QUALITY)[number]>("Good");
  const [busy, setBusy] = useState(false);
  const save = async () => { setBusy(true); await onSave({ bed, wake, quality }, today()); setBusy(false); };
  return (
    <div className="flex flex-col gap-4" data-form="sleep">
      <Field label="Went to bed at"><Chips options={BEDS.map((t) => ({ value: t, label: fmtTime(t) }))} value={bed} onChange={setBed} label="Bedtime" hue={hue} /></Field>
      <Field label="Woke up at"><Chips options={WAKES.map((t) => ({ value: t, label: fmtTime(t) }))} value={wake} onChange={setWake} label="Wake time" hue={hue} /></Field>
      <Field label="How did you sleep?"><Chips options={QUALITY} value={quality} onChange={setQuality} label="Sleep quality" hue={hue} /></Field>
      <Btn icon="Check" loading={busy} onClick={save}>Save sleep</Btn>
    </div>
  );
}

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
