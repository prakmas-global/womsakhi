"use client";

import { useState } from "react";

import { Btn } from "@/components/ux/kit";
import { toast } from "@/components/ux/mobile/Toast";
import { apiErrorMessage } from "@/lib/api";
import { apiAddEntry, today, type HealthSettings, type KindData } from "@/lib/health-api";
import { Chips, HUE } from "./kit";

/**
 * The first visit to Health & Wellness, after the approved design: four short
 * steps — about you, your goals, food and sleep, reminders and tracking. Most
 * answers are taps. Finishing saves her settings, keeps her height and weight
 * as readings, and sets the daily reminders she ticked. "Skip for now" saves
 * nothing but that she has seen it; "Run setup again" (Health settings)
 * brings it back.
 */

const STEPS = ["About you", "Your goals", "Food and sleep", "Reminders and tracking"] as const;
const GOALS = ["Move more", "Eat better", "Sleep better", "Feel calmer", "Know my cycle", "A healthy pregnancy", "Manage my weight"];
const EXERCISE = ["Walking", "Yoga", "Dance", "Strength", "Stretching", "Cycling"];
const DIETS: HealthSettings["diet"][] = ["Vegetarian", "Eggetarian", "Non-vegetarian", "Vegan"];
const RESTRICTIONS = ["No onion or garlic", "Lactose-free", "Gluten-free", "Nut-free", "Low sugar", "Low salt"];

type Rem = KindData["reminder"];
const REMINDERS: { id: string; label: string; sub: string; make: Rem[] }[] = [
  { id: "water", label: "Drink water", sub: "4 a day: 10 am, 1 pm, 4 pm, 7 pm",
    make: ["10:00", "13:00", "16:00", "19:00"].map((time) => ({ title: "Drink a glass of water", category: "Hydration", time, repeat: "Every day" })) },
  { id: "move", label: "Move every evening", sub: "6:30 pm, every day", make: [{ title: "Time to move", category: "Workout", time: "18:30", repeat: "Every day" }] },
  { id: "bed", label: "Bedtime at 10 pm", sub: "A nudge to start winding down", make: [{ title: "Time for bed", category: "Sleep", time: "22:00", repeat: "Every day" }] },
];

const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

export function HealthOnboarding({ settings, first, save, onDone }: {
  settings: HealthSettings;
  first: string;
  save: (patch: Partial<HealthSettings>, msg?: string) => Promise<HealthSettings | null>;
  onDone: () => void;
}) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState(settings.name || first);
  const [dob, setDob] = useState(settings.dob);
  const [height, setHeight] = useState(settings.heightCm ? String(settings.heightCm) : "");
  const [weight, setWeight] = useState("");
  const [goals, setGoals] = useState<string[]>(settings.goals);
  const [exercise, setExercise] = useState<string[]>(settings.exercise);
  const [diet, setDiet] = useState<HealthSettings["diet"]>(settings.diet);
  const [restrictions, setRestrictions] = useState<string[]>(settings.restrictions);
  const [sleepGoal, setSleepGoal] = useState(String(settings.sleepGoal));
  const [waterGoal, setWaterGoal] = useState(String(settings.waterGoal));
  const [rems, setRems] = useState<string[]>(["water", "bed"]);
  const [trackCycle, setTrackCycle] = useState(settings.trackCycle);
  const [trackPreg, setTrackPreg] = useState(settings.trackPreg);
  const [busy, setBusy] = useState(false);

  const h = Number(height) || 0, w = Number(weight) || 0;
  const bad = (height && (h < 50 || h > 250)) ? "Height should be between 50 and 250 cm." : (weight && (w < 20 || w > 250)) ? "Weight should be between 20 and 250 kg." : "";

  const skip = async () => {
    setBusy(true);
    await save({ onboarded: true });
    setBusy(false);
    onDone();
  };
  const finish = async () => {
    setBusy(true);
    const ok = await save({
      onboarded: true, name: name.trim().slice(0, 40), dob, heightCm: h, goals, exercise, diet, restrictions,
      sleepGoal: Number(sleepGoal), waterGoal: Number(waterGoal), trackCycle, trackPreg,
    });
    if (!ok) { setBusy(false); return; }
    try {
      const t = today();
      const adds: Promise<unknown>[] = [];
      if (w) adds.push(apiAddEntry("measure", { type: "Weight", value: String(w) }, t));
      if (h) adds.push(apiAddEntry("measure", { type: "Height", value: String(h) }, t));
      for (const r of REMINDERS.filter((x) => rems.includes(x.id))) for (const m of r.make) adds.push(apiAddEntry("reminder", { ...m, done: [], snooze: "" }, t));
      await Promise.all(adds);
      toast("You're all set", { tone: "success" });
    } catch (e) {
      toast(`Saved your answers, but not everything else: ${apiErrorMessage(e)}`, { tone: "error" });
    }
    setBusy(false);
    onDone();
  };

  const field = { borderColor: "var(--ux-line-strong)", background: "var(--ux-surface)", color: "var(--ux-ink)" };
  const label = "flex flex-col gap-1 text-xs font-bold";
  const can = [!bad, true, true, true][step];

  return (
    <section className="ux-card mx-auto flex w-full max-w-[720px] flex-col gap-5 p-5 sm:p-7" aria-labelledby="ob-h" data-health-onboarding>
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <p className="text-2xs font-extrabold uppercase tracking-[0.12em]" style={{ color: HUE.magenta.ink }}>
            Health &amp; Wellness setup · Step {step + 1} of {STEPS.length}
          </p>
          <Btn size="sm" variant="ghost" disabled={busy} onClick={skip}>Skip for now</Btn>
        </div>
        <div className="flex gap-1.5" aria-hidden>
          {STEPS.map((s, i) => <span key={s} className="h-1.5 flex-1 rounded-full" style={{ background: i <= step ? HUE.magenta.ink : "var(--ux-surface-2)" }} />)}
        </div>
        <h2 id="ob-h" className="text-[26px] font-extrabold leading-tight" style={{ color: "var(--ux-ink)" }}>{STEPS[step]}</h2>
      </div>

      {step === 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className={label} style={{ color: "var(--ux-ink-2)" }}>Your name
            <input id="ob-name" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} className="min-h-[44px] rounded-[12px] border px-3 text-sm font-semibold" style={field} />
          </label>
          <label className={label} style={{ color: "var(--ux-ink-2)" }}>Date of birth <span className="font-normal" style={{ color: "var(--ux-muted)" }}>(optional)</span>
            <input id="ob-dob" type="date" value={dob} max={today()} onChange={(e) => setDob(e.target.value)} className="min-h-[44px] rounded-[12px] border px-3 text-sm font-semibold" style={field} />
          </label>
          <label className={label} style={{ color: "var(--ux-ink-2)" }}>Height in cm <span className="font-normal" style={{ color: "var(--ux-muted)" }}>(optional)</span>
            <input id="ob-height" inputMode="numeric" value={height} placeholder="155" onChange={(e) => setHeight(e.target.value.replace(/\D/g, "").slice(0, 3))} className="min-h-[44px] rounded-[12px] border px-3 text-sm font-semibold tabular-nums" style={field} />
          </label>
          <label className={label} style={{ color: "var(--ux-ink-2)" }}>Weight in kg <span className="font-normal" style={{ color: "var(--ux-muted)" }}>(optional)</span>
            <input id="ob-weight" inputMode="decimal" value={weight} placeholder="55" onChange={(e) => setWeight(e.target.value.replace(/[^0-9.]/g, "").slice(0, 5))} className="min-h-[44px] rounded-[12px] border px-3 text-sm font-semibold tabular-nums" style={field} />
          </label>
          {bad && <p role="alert" className="text-xs font-semibold sm:col-span-2" style={{ color: "var(--ux-danger-ink)" }}>{bad}</p>}
          <p className="text-xs sm:col-span-2" style={{ color: "var(--ux-muted)" }}>Kept private to you. Height and weight become your first readings.</p>
        </div>
      )}

      {step === 1 && (
        <div className="flex flex-col gap-4">
          <div><p className="mb-2 text-sm font-bold" style={{ color: "var(--ux-ink)" }}>What would you like from Health &amp; Wellness?</p>
            <Chips label="Wellness goals" hue="magenta" options={GOALS} value={goals} onChange={(v) => setGoals((g) => toggle(g, v))} /></div>
          <div><p className="mb-2 text-sm font-bold" style={{ color: "var(--ux-ink)" }}>Movement you enjoy</p>
            <Chips label="Exercise you enjoy" hue="orange" options={EXERCISE} value={exercise} onChange={(v) => setExercise((x) => toggle(x, v))} /></div>
        </div>
      )}

      {step === 2 && (
        <div className="flex flex-col gap-4">
          <div><p className="mb-2 text-sm font-bold" style={{ color: "var(--ux-ink)" }}>How do you eat?</p>
            <Chips label="Diet" hue="green" options={DIETS} value={diet} onChange={(v) => setDiet(v as HealthSettings["diet"])} /></div>
          <div><p className="mb-2 text-sm font-bold" style={{ color: "var(--ux-ink)" }}>Anything you avoid? <span className="font-normal" style={{ color: "var(--ux-muted)" }}>(optional)</span></p>
            <Chips label="Restrictions" hue="green" options={RESTRICTIONS} value={restrictions} onChange={(v) => setRestrictions((x) => toggle(x, v))} /></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><p className="mb-2 text-sm font-bold" style={{ color: "var(--ux-ink)" }}>Sleep goal</p>
              <Chips label="Sleep goal" hue="violet" options={["6", "7", "8", "9"].map((v) => ({ value: v, label: `${v} hours` }))} value={sleepGoal} onChange={setSleepGoal} /></div>
            <div><p className="mb-2 text-sm font-bold" style={{ color: "var(--ux-ink)" }}>Water goal</p>
              <Chips label="Water goal" hue="blue" options={["6", "8", "10", "12"].map((v) => ({ value: v, label: `${(Number(v) * 0.25).toString()} L` }))} value={waterGoal} onChange={setWaterGoal} /></div>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <p className="text-sm font-bold" style={{ color: "var(--ux-ink)" }}>Set up daily reminders</p>
            {REMINDERS.map((r) => (
              <label key={r.id} className="flex cursor-pointer items-start gap-3 rounded-[14px] border p-3" style={{ borderColor: "var(--ux-line)" }}>
                <input type="checkbox" checked={rems.includes(r.id)} onChange={() => setRems((x) => toggle(x, r.id))} className="mt-0.5 h-5 w-5 shrink-0" style={{ accentColor: HUE.magenta.ink }} />
                <span><b className="block text-sm" style={{ color: "var(--ux-ink)" }}>{r.label}</b><span className="text-xs" style={{ color: "var(--ux-muted)" }}>{r.sub}</span></span>
              </label>
            ))}
          </div>
          <div className="flex flex-col gap-2">
            <p className="text-sm font-bold" style={{ color: "var(--ux-ink)" }}>What to show</p>
            {([["Show period and fertility tracking", trackCycle, setTrackCycle], ["Show pregnancy tracking", trackPreg, setTrackPreg]] as const).map(([l, v, set]) => (
              <label key={l} className="flex cursor-pointer items-center gap-3 rounded-[14px] border p-3 text-sm font-semibold" style={{ borderColor: "var(--ux-line)", color: "var(--ux-ink)" }}>
                <input type="checkbox" role="switch" checked={v} onChange={(e) => set(e.target.checked)} className="h-5 w-5 shrink-0" style={{ accentColor: HUE.magenta.ink }} />{l}
              </label>
            ))}
            <p className="text-xs" style={{ color: "var(--ux-muted)" }}>You can change any of this later in Health settings.</p>
          </div>
        </div>
      )}

      <div className="flex flex-wrap justify-between gap-2">
        {step > 0 ? <Btn variant="outline" icon="ChevronLeft" disabled={busy} onClick={() => setStep(step - 1)}>Back</Btn> : <span />}
        {step < STEPS.length - 1
          ? <Btn iconEnd="ArrowRight" disabled={!can} onClick={() => setStep(step + 1)}>Continue</Btn>
          : <Btn icon="Check" loading={busy} onClick={finish}>Finish</Btn>}
      </div>
    </section>
  );
}
