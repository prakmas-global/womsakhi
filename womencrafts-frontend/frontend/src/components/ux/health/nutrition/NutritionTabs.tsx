"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

import { Btn, Sheet } from "@/components/ux/kit";
import { Text } from "@/components/ux/kit/form";
import {
  BarChart, Chips, Cols, Disclaimer, Empty, HUE, I, Metric, MetricGrid, Panel, lastDays, type useEntries, type useHealthSettings,
} from "@/components/ux/health/kit";
import { artOf } from "@/components/ux/health/art";
import { Dial, FormLauncher, PicChoice, Review, StepSheet, type FlowStep } from "@/components/ux/health/StepFlow";
import { WaterDrops } from "@/components/ux/health/QuickForms";
import { addDays, fmtDay, nowHHMM, today, type Entry, type HealthKind, type HealthSettings, type KindData, type MealType } from "@/lib/health-api";
import { DIETS, DIET_GUIDE, DIET_TILES, FOODS, GOAL_ART, MEAL_ICON, MEAL_TYPES, RECIPES, mealByTime, recipeArt, recipeFor, type Recipe } from "./data";
import { Field, FlowNote } from "./parts";

/**
 * Nutrition & Diet — Today, Meal Plan, Recipes, Goals, Insights.
 *
 * Everything she logs is a `meal`, `plan` or `water` entry in the Health store
 * (routes/health_hub.py). Calories and protein are her own numbers, or the
 * recipe's per-serving estimate when she logs a recipe — and the screens say
 * which. Nothing here is a diet for a condition; a nutritionist is one tap away.
 */

export type Store = ReturnType<typeof useEntries<"meal" | "plan" | "water">>;
type Settings = ReturnType<typeof useHealthSettings>;

const NUTRITIONIST = "/app/health/doctors?speciality=Nutritionist";
const GLASS = 250;

/**
 * "Showing food for": her diet, one tap to change. Saved to her settings, so
 * ideas, recipes, foods to tap and the plan all follow it at once.
 */
function DietBar({ s }: { s: Settings }) {
  const on = s.settings.diet;
  return (
    <section aria-label="Your diet" className="ux-card flex flex-wrap items-center gap-2.5 p-3" data-diet-bar>
      <span className="ps-1 text-sm font-bold" style={{ color: "var(--ux-ink-2)" }}>Showing food for</span>
      <div role="group" aria-label="Diet" className="flex flex-wrap gap-2">
        {DIET_TILES.map((d) => {
          const sel = on === d.value;
          return (
            <button key={d.value} type="button" aria-pressed={sel} title={d.sub}
                    onClick={() => { if (!sel) void s.save({ diet: d.value }, `Showing ${d.label.toLowerCase()} food`); }}
                    className="ux-press inline-flex min-h-[44px] items-center gap-2 rounded-full border-[1.5px] py-1 pe-3.5 ps-1.5 text-[13.5px] font-bold transition-colors"
                    style={sel ? { borderColor: HUE.green.ink, background: HUE.green.tint, color: "var(--ux-ink)" }
                               : { borderColor: "var(--ux-line)", background: "var(--ux-surface)", color: "var(--ux-ink-2)" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={artOf(d.art)} alt="" className="h-8 w-8" />{d.label}
            </button>
          );
        })}
      </div>
    </section>
  );
}

/** Up to three recipes for this meal and her diet, as picture cards. */
function MealIdeas({ diet, meal, onOpen }: { diet: HealthSettings["diet"]; meal: MealType; onOpen: (r: Recipe) => void }) {
  const picks = RECIPES.filter((r) => r.meal === meal && r.suits.includes(diet))
    // Dishes made for her diet first (egg dishes for eggetarian, meat and fish for non-vegetarian).
    .sort((a, b) => a.suits.length - b.suits.length).slice(0, 3);
  return (
    <Panel title={`Ideas for your ${meal.toLowerCase()}`} sub={`${diet} dishes · tap one for the recipe`}>
      {picks.length ? (
        <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))" }} data-meal-ideas>
          {picks.map((r) => (
            <button key={r.id} type="button" onClick={() => onOpen(r)} className="ux-card ux-hov ux-press overflow-hidden text-start" style={{ padding: 0 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={recipeArt(r)} alt="" className="aspect-[16/10] w-full object-cover" />
              <span className="flex flex-col gap-0.5 p-3">
                <b className="text-sm" style={{ color: "var(--ux-ink)" }}>{r.name}</b>
                <span className="text-xs" style={{ color: "var(--ux-muted)" }}>{r.mins} min · ≈ {r.kcal} kcal · {r.protein} g protein</span>
              </span>
            </button>
          ))}
        </div>
      ) : <p className="text-sm" style={{ color: "var(--ux-muted)" }}>No {meal.toLowerCase()} ideas for this diet yet. See all recipes.</p>}
    </Panel>
  );
}

/** What eating this way means: protein, iron, one thing to watch, and an easy day. */
function DietGuide({ diet }: { diet: HealthSettings["diet"] }) {
  // A diet no longer offered (Jain, saved before) reads as vegetarian, as the server now maps it.
  const g = DIET_GUIDE[diet] ?? DIET_GUIDE.Vegetarian;
  const tile = DIET_TILES.find((d) => d.value === diet);
  return (
    <Panel title={`Eating ${diet.toLowerCase()}`} hue="green" tint>
      <div className="flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={artOf(tile?.art ?? diet)} alt="" className="h-11 w-11 shrink-0" />
        <p className="text-sm font-semibold" style={{ color: "var(--ux-ink)" }}>{g.line}</p>
      </div>
      {([["Protein from", g.protein], ["Iron from", g.iron]] as const).map(([label, xs]) => (
        <div key={label}>
          <p className="mb-1.5 text-2xs font-extrabold uppercase tracking-[0.1em]" style={{ color: "var(--ux-muted)" }}>{label}</p>
          <div className="flex flex-wrap gap-1.5">
            {xs.map((x) => <span key={x} className="rounded-full px-2.5 py-1 text-xs font-bold" style={{ background: "var(--ux-surface)", color: "var(--ux-ink-2)" }}>{x}</span>)}
          </div>
        </div>
      ))}
      <div>
        <p className="mb-1.5 text-2xs font-extrabold uppercase tracking-[0.1em]" style={{ color: "var(--ux-muted)" }}>An easy day</p>
        <ul className="flex flex-col gap-1.5">
          {MEAL_TYPES.map((m) => (
            <li key={m} className="flex items-center gap-2 text-sm">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={artOf(m)} alt="" className="h-6 w-6 shrink-0" />
              <span style={{ color: "var(--ux-muted)" }}>{m}:</span>
              <b className="min-w-0" style={{ color: "var(--ux-ink)" }}>{g.day[m]}</b>
            </li>
          ))}
        </ul>
      </div>
      <p className="text-xs" style={{ color: "var(--ux-ink-2)" }}>{g.watch}</p>
    </Panel>
  );
}

export function only<K extends HealthKind>(rows: Entry[], k: K) {
  return rows.filter((r) => r.kind === k) as Entry<K>[];
}

const dayName = (d: string) => (d === today() ? "Today" : d === addDays(today(), 1) ? "Tomorrow" : d === addDays(today(), -1) ? "Yesterday"
  : fmtDay(d, { weekday: "short", day: "numeric", month: "short" }));

/** Foods to tap: her recent ones first, then the everyday list for this meal and diet. */
function foodChoices(meals: Entry<"meal">[], mealType: MealType, diet: HealthSettings["diet"]) {
  const recent: { food: string; kcal: number; protein: number }[] = [];
  for (const m of meals) {
    if (!recent.some((r) => r.food.toLowerCase() === m.data.food.toLowerCase())) {
      recent.push({ food: m.data.food, kcal: m.data.kcal || 0, protein: m.data.protein || 0 });
    }
    if (recent.length === 4) break;
  }
  const common = FOODS.filter((f) => f.meal.includes(mealType) && (!f.suits || f.suits.includes(diet))
    && !recent.some((r) => r.food.toLowerCase() === f.food.toLowerCase()));
  const recipes = RECIPES.filter((r) => r.meal === mealType && r.suits.includes(diet))
    .map((r) => ({ food: r.name, kcal: r.kcal, protein: r.protein, recipe: r.id }));
  return { recent, common: [...recipes, ...common].slice(0, 10) };
}

/* ── Today ─────────────────────────────────────────────────────────── */

export function TodayTab({ store, s }: { store: Store; s: Settings }) {
  const t = today();
  const meals = only(store.rows, "meal");
  const todays = meals.filter((m) => m.date === t);
  const waterMl = only(store.rows, "water").filter((w) => w.date === t).reduce((a, w) => a + w.data.ml, 0);
  const kcal = todays.reduce((a, m) => a + (m.data.kcal || 0), 0);
  const protein = todays.reduce((a, m) => a + (m.data.protein || 0), 0);
  const goal = s.settings;
  // The meal for this hour, read once when the tab opens (not on every render).
  const [nowMeal] = useState<MealType>(() => mealByTime());
  // The open "Log a meal" flow: a new meal (from the card, or a meal's Add) or one being changed.
  const [logging, setLogging] = useState<{ editing: Entry<"meal"> | null; mealType: MealType; at: number } | null>(null);

  const openLog = (mt: MealType) => setLogging({ editing: null, mealType: mt, at: 1 });
  const openEdit = (m: Entry<"meal">) => setLogging({ editing: m, mealType: m.data.mealType, at: 0 });
  const [recipe, setRecipe] = useState<Recipe | null>(null);

  return (
    <>
      <DietBar s={s} />
      <MetricGrid>
        <Metric hue="green" icon="Flame" label="Calories today" value={kcal} unit="kcal" sub={`Goal ${goal.kcalGoal} kcal`} pct={(kcal / goal.kcalGoal) * 100} />
        <Metric hue="orange" icon="Dumbbell" label="Protein" value={protein} unit="g" sub={`Goal ${goal.proteinGoal} g`} pct={(protein / goal.proteinGoal) * 100} />
        <Metric hue="blue" icon="Droplet" label="Water" value={Math.round((waterMl / GLASS) * 10) / 10} unit="glasses"
                sub={`Goal ${goal.waterGoal} glasses`} pct={(waterMl / (goal.waterGoal * GLASS)) * 100} />
        <Metric hue="amber" icon="Utensils" label="Meals logged" value={todays.length} sub={MEAL_TYPES.filter((mt) => !todays.some((m) => m.data.mealType === mt)).length
          ? `Still to log: ${MEAL_TYPES.filter((mt) => !todays.some((m) => m.data.mealType === mt)).join(", ").toLowerCase()}` : "All four logged"} />
      </MetricGrid>

      <Cols
        main={
          <>
            <Panel title="Meal diary" sub={fmtDay(t, { weekday: "long", day: "numeric", month: "long" })}>
              <ul className="flex flex-col" data-meal-diary>
                {MEAL_TYPES.map((mt) => {
                  const xs = todays.filter((m) => m.data.mealType === mt);
                  return (
                    <li key={mt} className="flex items-start gap-3 border-t py-3 first:border-t-0" style={{ borderColor: "var(--ux-line)" }}>
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[11px]" style={{ background: HUE.green.tint, color: HUE.green.ink }}>
                        <I name={MEAL_ICON[mt]} className="h-[18px] w-[18px]" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <b className="text-sm" style={{ color: "var(--ux-ink)" }}>{mt}</b>
                        {xs.length === 0 && <p className="text-xs" style={{ color: "var(--ux-muted)" }}>Nothing logged yet</p>}
                        {xs.map((m) => (
                          <div key={m.id} className="mt-1 flex items-center gap-2 text-[13px]" style={{ color: "var(--ux-ink-2)" }}>
                            <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">
                              {m.data.food}
                              <span style={{ color: "var(--ux-muted)" }}>
                                {m.data.kcal ? ` · ${m.data.recipe ? "≈ " : ""}${m.data.kcal} kcal` : ""}{m.data.protein ? ` · ${m.data.protein} g protein` : ""}
                              </span>
                            </span>
                            <button type="button" aria-label={`Edit ${m.data.food}`} onClick={() => openEdit(m)}
                                    className="ux-press grid h-8 w-8 place-items-center rounded-[9px]" style={{ background: "var(--ux-surface-2)" }}>
                              <I name="Pencil" className="h-3.5 w-3.5" />
                            </button>
                            <button type="button" aria-label={`Delete ${m.data.food}`} onClick={() => store.remove(m.id, "Meal deleted")}
                                    className="ux-press grid h-8 w-8 place-items-center rounded-[9px]" style={{ background: "var(--ux-danger-tint)", color: "var(--ux-danger-ink)" }}>
                              <I name="Trash2" className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                      <Btn size="sm" variant="soft" icon="Plus" onClick={() => openLog(mt)} ariaLabel={`Add ${mt}`}>Add</Btn>
                    </li>
                  );
                })}
              </ul>
              <p className="text-xs" style={{ color: "var(--ux-muted)" }}>Values marked ≈ are recipe estimates. Calories count only the meals where you entered them.</p>
            </Panel>
            <MealIdeas diet={s.settings.diet} meal={nowMeal} onOpen={setRecipe} />
            <Disclaimer>
              This is general guidance, not a diet for a health condition. For that,{" "}
              <Link href={NUTRITIONIST} className="font-bold underline" style={{ color: "var(--ux-amber-ink)" }}>talk to a nutritionist</Link>.
            </Disclaimer>
          </>
        }
        side={
          <>
            <FormLauncher id="nt-log" art={nowMeal} hue="green" steps={MEAL_STEPS} title="Log a meal"
                          sub={`${MEAL_STEPS} quick steps · tap a dish, type only if you want`} onStart={() => setLogging({ editing: null, mealType: nowMeal, at: 0 })} />
            <WaterPanel store={store} s={s} />
            <DietGuide diet={s.settings.diet} />
          </>
        }
      />
      {recipe && <RecipeSheet r={recipe} store={store} onClose={() => setRecipe(null)} />}
      {logging && (
        <MealLogFlow key={logging.editing?.id ?? `new-${logging.mealType}`} store={store} s={s} meals={meals}
                     editing={logging.editing} initialMeal={logging.mealType} startAt={logging.at} onClose={() => setLogging(null)} />
      )}
    </>
  );
}

const MEAL_STEPS = 5;

/**
 * "Log a meal" and "Change this meal", one question at a time: which meal,
 * what she ate, calories, protein, then what will be saved. Editing opens
 * with everything filled in. The saved meal is the same shape as before.
 */
function MealLogFlow({ store, s, meals, editing, initialMeal, startAt, onClose }: {
  store: Store; s: Settings; meals: Entry<"meal">[]; editing: Entry<"meal"> | null; initialMeal: MealType; startAt: number; onClose: () => void;
}) {
  const hue = "green" as const;
  const [step, setStep] = useState(startAt);
  const [mealType, setMealType] = useState<MealType>(editing?.data.mealType ?? initialMeal);
  const [food, setFood] = useState(editing?.data.food ?? "");
  const [kcal, setKcal] = useState(editing?.data.kcal ?? 0);
  const [protein, setProtein] = useState(editing?.data.protein ?? 0);
  const [recipe, setRecipe] = useState(editing?.data.recipe ?? "");
  const [busy, setBusy] = useState(false);
  const { recent, common } = foodChoices(meals, mealType, s.settings.diet);

  const pick = (f: { food: string; kcal: number; protein: number; recipe?: string }) => {
    setFood(f.food); setKcal(f.kcal); setProtein(f.protein); setRecipe(f.recipe ?? "");
  };
  const save = async () => {
    setBusy(true);
    const data: KindData["meal"] = { mealType, food: food.trim(), kcal, protein, recipe, time: editing?.data.time || nowHHMM() };
    const ok = editing ? await store.edit(editing.id, { data }, "Meal updated") : await store.add("meal", data, today(), "Meal saved");
    setBusy(false);
    if (ok) onClose();
  };
  const est = recipe ? "≈ " : "";

  const flow: FlowStep[] = [
    { id: "which", title: editing ? "Which meal was it?" : "Which meal is this?",
      body: <PicChoice label="Meal" hue={hue} options={MEAL_TYPES} value={mealType} columns={4}
                       onChange={(v) => setMealType(v as MealType)} onPicked={() => setStep(1)} /> },
    { id: "food", title: "What did you eat?", hint: "Tap a dish, or write your own.", valid: !!food.trim(),
      body: <div className="flex flex-col gap-4">
        {recent.length > 0 && (
          <Field label="You had recently">
            <Chips label="Recent foods" hue={hue} options={recent.map((r) => r.food)} value={food}
                   onChange={(f) => pick(recent.find((r) => r.food === f)!)} />
          </Field>
        )}
        <Field label={`Common for ${mealType.toLowerCase()}`}>
          <Chips label="Common foods" hue={hue} options={common.map((r) => r.food)} value={food}
                 onChange={(f) => pick(common.find((r) => r.food === f)!)} />
        </Field>
        <Field label="Or write it">
          <Text label="What did you eat?" value={food} max={120} placeholder="For example: 2 roti with dal"
                onChange={(v) => { setFood(v); setRecipe(""); }} />
        </Field>
      </div> },
    { id: "kcal", title: "About how many calories?", optional: true, valid: kcal > 0,
      hint: recipe ? "This is the recipe's estimate — change it if you know better." : "Optional. Skip if you are not sure.",
      body: <Dial label="calories" unit="kcal" hue={hue} value={kcal} onChange={setKcal} max={5000} step={10} presets={[100, 200, 300, 400, 500, 600]} /> },
    { id: "protein", title: "And protein?", optional: true, valid: protein > 0,
      hint: recipe ? "The recipe's estimate is filled in." : "Optional. Dal, curd, paneer and eggs all add some.",
      body: <Dial label="protein" unit="g" hue={hue} value={protein} onChange={setProtein} max={300} step={1} presets={[5, 10, 15, 20, 30]} /> },
    { id: "check", title: editing ? "Save these changes?" : "Save this meal?", hint: "Check it, then save. Go back to change anything.", valid: !!food.trim(),
      body: <Review rows={[
        ["Meal", mealType], ["Food", food.trim()],
        ["Calories", kcal ? `${est}${kcal} kcal` : "Not entered"], ["Protein", protein ? `${est}${protein} g` : "Not entered"],
        ["Day", editing ? fmtDay(editing.date) : "Today"],
      ]} /> },
  ];
  return <StepSheet open onClose={onClose} icon="Apple" title={editing ? "Change this meal" : "Log a meal"} hue={hue} steps={flow} step={step} setStep={setStep}
                    onSubmit={save} busy={busy} submitLabel={editing ? "Save changes" : "Save meal"} />;
}

function WaterPanel({ store, s }: { store: Store; s: Settings }) {
  const t = today();
  const water = only(store.rows, "water");
  const todays = water.filter((w) => w.date === t);
  const ml = todays.reduce((a, w) => a + w.data.ml, 0);
  const goalMl = s.settings.waterGoal * GLASS;
  const glasses = Math.floor(ml / GLASS);
  const days = lastDays(7);
  return (
    <Panel title="Water" sub={`${(ml / 1000).toFixed(2).replace(/0$/, "")} L of ${(goalMl / 1000).toFixed(1)} L today`} hue="blue">
      <div className="flex flex-wrap gap-1.5" aria-label={`${glasses} of ${s.settings.waterGoal} glasses`} role="img" data-water-glasses>
        {Array.from({ length: s.settings.waterGoal }, (_, i) => (
          <span key={i} className="grid h-9 w-8 place-items-center rounded-[9px]"
                style={{ background: i < glasses ? HUE.blue.ink : HUE.blue.tint, color: i < glasses ? "var(--ux-surface)" : HUE.blue.ink }}>
            <I name="Droplet" className="h-4 w-4" />
          </span>
        ))}
      </div>
      <WaterDrops onAdd={(n) => void store.add("water", { ml: n }, t, `+${n >= 1000 ? `${n / 1000} L` : `${n} ml`} of water`)} />
      {todays.length > 0 && (
        <Btn size="sm" variant="ghost" icon="Undo2" className="self-start" onClick={() => store.remove(todays[0].id, "Removed the last one")}>Undo</Btn>
      )}
      {water.length > 0 && (
        <BarChart hue="blue" unit=" ml" goal={goalMl}
                  data={days.map((d) => ({ label: d.label, value: water.filter((w) => w.date === d.day).reduce((a, w) => a + w.data.ml, 0) }))} />
      )}
    </Panel>
  );
}

/* ── Meal plan ─────────────────────────────────────────────────────── */

export function PlanTab({ store, s }: { store: Store; s: Settings }) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(today(), i));
  const plans = only(store.rows, "plan");
  const meals = only(store.rows, "meal");
  // The open "Plan a meal" flow — from the card (starts at the day) or a slot's + (starts at the dish).
  const [adding, setAdding] = useState<{ date: string; mealType: MealType; at: number } | null>(null);
  const [nowMeal] = useState<MealType>(() => mealByTime());

  const eat = async (p: Entry<"plan">) => {
    const r = p.data.recipe ? recipeFor(p.data.recipe) : undefined;
    const ok = await store.edit(p.id, { data: { eaten: true } });
    if (ok) await store.add("meal", { mealType: p.data.mealType, food: p.data.food, kcal: r?.kcal ?? 0, protein: r?.protein ?? 0, recipe: p.data.recipe ?? "", time: nowHHMM() },
                           p.date > today() ? today() : p.date, `${p.data.food} added to your diary`);
  };

  const planned = plans.filter((p) => p.date >= today()).length;
  return (
    <>
      <DietBar s={s} />
      <FormLauncher art="Calendar" hue="green" steps={PLAN_STEPS} title="Plan a meal"
                    sub={`${PLAN_STEPS} quick steps · pick a day, a meal and a dish`}
                    onStart={() => setAdding({ date: today(), mealType: nowMeal, at: 0 })} />
      <Panel title="This week's meal plan" sub={planned ? `${planned} meal${planned === 1 ? "" : "s"} planned for the next 7 days` : "Plan a few meals — it makes shopping and cooking easier"}
             action={<Btn size="sm" variant="soft" icon="ChefHat" href="?tab=recipes">Browse recipes</Btn>}>
        <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))" }} data-plan-grid>
          {days.map((d) => (
            <div key={d} className="flex flex-col gap-2 rounded-[14px] p-3" style={{ background: "var(--ux-surface-2)" }}>
              <b className="text-sm" style={{ color: d === today() ? HUE.green.ink : "var(--ux-ink)" }}>{dayName(d)}
                <span className="ms-1.5 text-xs font-semibold" style={{ color: "var(--ux-muted)" }}>{d === today() || d === addDays(today(), 1) ? fmtDay(d) : ""}</span>
              </b>
              {MEAL_TYPES.map((mt) => {
                const xs = plans.filter((p) => p.date === d && p.data.mealType === mt);
                return (
                  <div key={mt} className="rounded-[10px] p-2" style={{ background: "var(--ux-surface)" }}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-2xs font-extrabold uppercase tracking-[0.06em]" style={{ color: "var(--ux-muted)" }}>{mt}</span>
                      <button type="button" aria-label={`Plan ${mt} for ${dayName(d)}`} onClick={() => setAdding({ date: d, mealType: mt, at: 2 })}
                              className="ux-press grid h-7 w-7 place-items-center rounded-[8px]" style={{ background: HUE.green.tint, color: HUE.green.ink }}>
                        <I name="Plus" className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    {xs.map((p) => (
                      <div key={p.id} className="mt-1.5 flex items-center gap-1.5 text-[13px] font-semibold"
                           style={{ color: "var(--ux-ink)", opacity: p.data.eaten ? 0.6 : 1 }}>
                        <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">{p.data.food}</span>
                        {p.data.eaten ? (
                          <span className="rounded-full px-2 py-0.5 text-2xs font-bold" style={{ background: "var(--ux-tint-green)", color: "var(--ux-green-ink)" }}>Eaten</span>
                        ) : d <= today() ? (
                          <button type="button" onClick={() => eat(p)} aria-label={`Mark ${p.data.food} eaten`}
                                  className="ux-press rounded-[7px] px-1.5 py-1 text-2xs font-extrabold" style={{ background: HUE.green.tint, color: HUE.green.ink }}>
                            ✓ Eaten
                          </button>
                        ) : null}
                        <button type="button" onClick={() => store.remove(p.id, "Removed from your plan")} aria-label={`Remove ${p.data.food}`}
                                className="ux-press grid h-6 w-6 place-items-center rounded-[7px]" style={{ background: "var(--ux-surface-2)", color: "var(--ux-muted)" }}>
                          <I name="X" className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
        <p className="text-xs" style={{ color: "var(--ux-muted)" }}>Tap “✓ Eaten” to add a planned meal to your diary.</p>
      </Panel>
      {adding && (
        <PlanFlow key={`${adding.date}${adding.mealType}${adding.at}`} at={adding} diet={s.settings.diet} meals={meals}
                  onClose={() => setAdding(null)}
                  onSave={(f, date, mealType) => store.add("plan", { mealType, food: f.food, recipe: f.recipe ?? "", eaten: false }, date, `Planned for ${dayName(date).toLowerCase()}`)} />
      )}
    </>
  );
}

const PLAN_STEPS = 4;

/** "Plan a meal": the day, the meal, the dish, then what will go in the plan. */
function PlanFlow({ at, diet, meals, onClose, onSave }: {
  at: { date: string; mealType: MealType; at: number }; diet: HealthSettings["diet"]; meals: Entry<"meal">[];
  onClose: () => void; onSave: (f: { food: string; recipe?: string }, date: string, mealType: MealType) => Promise<unknown>;
}) {
  const hue = "green" as const;
  const [step, setStep] = useState(at.at);
  const [date, setDate] = useState(at.date);
  const [mealType, setMealType] = useState<MealType>(at.mealType);
  const [food, setFood] = useState("");
  const [recipe, setRecipe] = useState("");
  const [busy, setBusy] = useState(false);
  const days = Array.from({ length: 7 }, (_, i) => addDays(today(), i));
  const { recent, common } = foodChoices(meals, mealType, diet);
  const all = [...common, ...recent.filter((r) => !common.some((c) => c.food === r.food))];
  const dayLabel = (d: string) => (d === today() || d === addDays(today(), 1) ? `${dayName(d)} · ${fmtDay(d)}` : dayName(d));

  const save = async () => {
    setBusy(true);
    const ok = await onSave({ food: food.trim(), recipe: recipe || undefined }, date, mealType);
    setBusy(false);
    if (ok) onClose();
  };

  const flow: FlowStep[] = [
    { id: "day", title: "Which day?", hint: "Plan up to a week ahead.",
      body: <Chips label="Day" hue={hue} options={days.map((d) => ({ value: d, label: dayLabel(d) }))} value={date} onChange={setDate} /> },
    { id: "meal", title: "Which meal?",
      body: <PicChoice label="Meal" hue={hue} options={MEAL_TYPES} value={mealType} columns={4}
                       onChange={(v) => setMealType(v as MealType)} onPicked={() => setStep(2)} /> },
    { id: "dish", title: `What will you have for ${mealType.toLowerCase()}?`, hint: "Tap a dish, or write your own.", valid: !!food.trim(),
      body: <div className="flex flex-col gap-4">
        <Chips label="Dishes" hue={hue} options={all.map((f) => f.food)} value={food}
               onChange={(f) => { const x = all.find((a) => a.food === f)!; setFood(x.food); setRecipe("recipe" in x ? (x as { recipe?: string }).recipe ?? "" : ""); }} />
        <Field label="Or write your own">
          <Text label="Dish" value={food} onChange={(v) => { setFood(v); setRecipe(""); }} max={120} placeholder="For example: Aloo sabzi with roti" />
        </Field>
      </div> },
    { id: "check", title: "Add this to your plan?", hint: "You can tick it as eaten on the day.", valid: !!food.trim(),
      body: <Review rows={[["Day", dayLabel(date)], ["Meal", mealType], ["Dish", food.trim()], ["Recipe", recipe ? "Yes, from Recipes" : ""]]} /> },
  ];
  return <StepSheet open onClose={onClose} icon="CalendarDays" title="Plan a meal" hue={hue} steps={flow} step={step} setStep={setStep}
                    onSubmit={save} busy={busy} submitLabel="Add to plan" />;
}

/* ── Recipes ───────────────────────────────────────────────────────── */

export function RecipesTab({ store, s }: { store: Store; s: Settings }) {
  const [diet, setDiet] = useState<string>("");
  const [meal, setMeal] = useState<string>("All");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<Recipe | null>(null);
  const useDiet = diet || s.settings.diet;
  const list = RECIPES.filter((r) => (useDiet === "All" || r.suits.includes(useDiet as HealthSettings["diet"]))
    && (meal === "All" || r.meal === meal)
    && (!q.trim() || `${r.name} ${r.tags.join(" ")} ${r.meal}`.toLowerCase().includes(q.trim().toLowerCase())));

  return (
    <>
      <Panel title="Recipes" sub="Simple Indian dishes, with an estimate of calories and protein per serving">
        <div className="flex flex-col gap-3">
          <div className="max-w-[360px]"><Text label="Search recipes" value={q} onChange={setQ} placeholder="Search: dal, protein, quick…" /></div>
          <Chips label="Diet" hue="green" options={["All", ...DIETS]} value={useDiet} onChange={setDiet} />
          <Chips label="Meal" hue="green" options={["All", ...MEAL_TYPES]} value={meal} onChange={setMeal} />
        </div>
        {list.length === 0 ? (
          <Empty icon="Search" title="No recipes match" body="Try another diet type, meal or search word." />
        ) : (
          <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))" }} data-recipes>
            {list.map((r) => (
              <button key={r.id} type="button" onClick={() => setOpen(r)} data-recipe={r.id}
                      className="ux-card ux-hov ux-press flex flex-col overflow-hidden text-start" style={{ padding: 0 }}>
                <span className="relative block aspect-[16/10] w-full overflow-hidden" style={{ background: "var(--ux-surface-2)" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={recipeArt(r)} alt="" loading="lazy" className="h-full w-full object-cover" />
                  <span className="absolute start-2.5 top-2.5 rounded-full px-2.5 py-1 text-2xs font-extrabold"
                        style={{ background: "var(--ux-surface)", color: HUE.green.ink }}>{r.meal}</span>
                  <span className="absolute bottom-2.5 end-2.5 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-2xs font-bold"
                        style={{ background: "var(--ux-surface)", color: "var(--ux-ink-2)" }}>
                    <I name="Clock" className="h-3 w-3" /> {r.mins} min
                  </span>
                </span>
                <span className="flex flex-1 flex-col gap-1.5 p-4">
                  <b className="text-[15px] leading-snug" style={{ color: "var(--ux-ink)" }}>{r.name}</b>
                  <span className="text-xs" style={{ color: "var(--ux-muted)" }}>≈ {r.kcal} kcal · {r.protein} g protein</span>
                  <span className="mt-auto flex flex-wrap gap-1.5 pt-1">
                    {r.tags.map((t) => (
                      <span key={t} className="rounded-full px-2 py-0.5 text-2xs font-bold" style={{ background: HUE.green.tint, color: HUE.green.ink }}>{t}</span>
                    ))}
                  </span>
                </span>
              </button>
            ))}
          </div>
        )}
      </Panel>
      {open && <RecipeSheet r={open} store={store} onClose={() => setOpen(null)} />}
    </>
  );
}

function RecipeSheet({ r, store, onClose }: { r: Recipe; store: Store; onClose: () => void }) {
  const [day, setDay] = useState(today());
  const days = Array.from({ length: 7 }, (_, i) => addDays(today(), i));
  return (
    <Sheet open onClose={onClose} icon="ChefHat" title={r.name} width={520}
           description={`${r.meal} · ${r.mins} min · ≈ ${r.kcal} kcal and ${r.protein} g protein per serving (estimate)`}
           footer={
             <div className="flex flex-wrap gap-2">
               <Btn icon="Check" onClick={async () => {
                 const ok = await store.add("meal", { mealType: r.meal, food: r.name, kcal: r.kcal, protein: r.protein, recipe: r.id, time: nowHHMM() }, today(), `${r.name} added to today's diary`);
                 if (ok) onClose();
               }}>I ate this today</Btn>
               <Btn variant="outline" icon="CalendarDays" onClick={async () => {
                 const ok = await store.add("plan", { mealType: r.meal, food: r.name, recipe: r.id, eaten: false }, day, `Planned for ${dayName(day).toLowerCase()}`);
                 if (ok) onClose();
               }}>Add to plan · {dayName(day)}</Btn>
             </div>
           }>
      <div className="flex flex-col gap-4" data-recipe-detail>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={recipeArt(r)} alt="" className="aspect-[16/9] w-full rounded-[14px] object-cover" />
        <div>
          <h3 className="mb-1.5 text-sm font-extrabold" style={{ color: "var(--ux-ink)" }}>Ingredients</h3>
          <ul className="list-disc space-y-1 ps-5 text-[13.5px]" style={{ color: "var(--ux-ink-2)" }}>{r.ing.map((i) => <li key={i}>{i}</li>)}</ul>
        </div>
        <div>
          <h3 className="mb-1.5 text-sm font-extrabold" style={{ color: "var(--ux-ink)" }}>Steps</h3>
          <ol className="list-decimal space-y-1.5 ps-5 text-[13.5px]" style={{ color: "var(--ux-ink-2)" }}>{r.steps.map((i) => <li key={i}>{i}</li>)}</ol>
        </div>
        <Field label="Plan it for">
          <Chips label="Day" hue="green" options={days.map((d) => ({ value: d, label: dayName(d) }))} value={day} onChange={setDay} />
        </Field>
      </div>
    </Sheet>
  );
}

/* ── Goals ─────────────────────────────────────────────────────────── */

const HEALTH_GOALS = ["Eat on time", "More protein", "More iron", "Lose weight gently", "Gain strength", "Manage sugar", "Eat more vegetables"];

export function GoalsTab({ s }: { s: Settings }) {
  const st = s.settings;
  // Which step the goals flow opens at: the card starts at the beginning, a tile at its own question.
  const [editAt, setEditAt] = useState<number | null>(null);
  const tiles: { art: string; label: string; value: string; at: number }[] = [
    { art: st.diet, label: "I eat", value: st.diet, at: 0 },
    { art: GOAL_ART[st.healthGoal] ?? "Sparkles", label: "Working on", value: st.healthGoal || "Not set", at: 1 },
    { art: "Fire", label: "Calories a day", value: `${st.kcalGoal} kcal`, at: 2 },
    { art: "More protein", label: "Protein a day", value: `${st.proteinGoal} g`, at: 3 },
    { art: "Water", label: "Water a day", value: `${st.waterGoal} glasses · ${(st.waterGoal * GLASS / 1000).toFixed(1)} L`, at: 4 },
  ];

  return (
    <>
      <Cols
        main={
          <>
            <FormLauncher art="Balanced meals" hue="green" steps={GOAL_STEPS} title="Change my nutrition goals" cta="Change"
                          sub={`${GOAL_STEPS} quick steps · diet, goal, then your daily targets`} onStart={() => setEditAt(0)} />
            <Panel title="Your nutrition goals" sub="Tap any one to change just that">
              <div className="grid gap-2.5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))" }} data-goal-tiles>
                {tiles.map((t) => (
                  <button key={t.label} type="button" onClick={() => setEditAt(t.at)} aria-label={`Change ${t.label.toLowerCase()}: ${t.value}`}
                          className="ux-press relative flex min-h-[104px] flex-col items-start gap-1.5 rounded-[18px] border-[1.5px] p-3 text-start transition-[transform,border-color] duration-200 hover:-translate-y-0.5"
                          style={{ borderColor: "var(--ux-line)", background: `linear-gradient(160deg, ${HUE.green.tint}, var(--ux-surface) 75%)` }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={artOf(t.art)} alt="" className="h-9 w-9 drop-shadow-sm" />
                    <span className="text-2xs font-extrabold uppercase tracking-[0.06em]" style={{ color: "var(--ux-muted)" }}>{t.label}</span>
                    <b className="text-sm leading-tight [overflow-wrap:anywhere]" style={{ color: "var(--ux-ink)" }}>{t.value}</b>
                    <span className="absolute end-2.5 top-2.5 grid h-7 w-7 place-items-center rounded-full" style={{ background: "var(--ux-surface)", color: HUE.green.ink }}>
                      <I name="Pencil" className="h-3.5 w-3.5" />
                    </span>
                  </button>
                ))}
              </div>
              <p className="text-xs" style={{ color: "var(--ux-muted)" }}>
                Many women need about 1,800–2,200 kcal and 50–60 g of protein a day; it changes with age, work, pregnancy and health. These are your own targets, not a prescription.
              </p>
            </Panel>
          </>
        }
        side={
          <>
            {/* "Your plan" now lives in the tiles on the left, where each one is also its own edit button. */}
            <Panel title="Need a plan for a health condition?" sub="Thyroid, diabetes, pregnancy, anaemia">
              <div className="flex flex-wrap gap-2">
                <Btn size="sm" icon="Stethoscope" href={NUTRITIONIST}>Talk to a nutritionist</Btn>
                <Btn size="sm" variant="outline" icon="Users" href="/app/health/mentors?topic=Nutrition">Ask a mentor</Btn>
              </div>
            </Panel>
          </>
        }
      />
      {/* Mounted only while open, so each time it opens its draft starts from the saved goals. */}
      {editAt !== null && <GoalsFlow s={s} at={editAt} onClose={() => setEditAt(null)} />}
    </>
  );
}

const GOAL_STEPS = 6;

/**
 * Her nutrition goals, one question at a time: diet type, what she is
 * working on, then calories, protein and water. Only what she changed is
 * saved (the same merge-save as before); "Undo changes" on the last step
 * puts everything back, and closing the sheet keeps the old goals.
 */
function GoalsFlow({ s, at, onClose }: { s: Settings; at: number; onClose: () => void }) {
  const hue = "green" as const;
  const st = s.settings;
  const [step, setStep] = useState(at);
  const [draft, setDraft] = useState<Partial<HealthSettings>>({});
  const [busy, setBusy] = useState(false);
  const v = { ...st, ...draft };
  const changed = (k: keyof HealthSettings) => k in draft && draft[k] !== st[k];
  const dirty = Object.keys(draft).some((k) => changed(k as keyof HealthSettings));
  const put = (p: Partial<HealthSettings>) => setDraft((d) => ({ ...d, ...p }));
  const kcalOk = v.kcalGoal >= 800 && v.kcalGoal <= 5000;
  const proteinOk = v.proteinGoal >= 10 && v.proteinGoal <= 300;
  const waterOk = v.waterGoal >= 1 && v.waterGoal <= 20;
  const litres = (v.waterGoal * GLASS / 1000).toFixed(1);
  const mark = (k: keyof HealthSettings, text: string) => (changed(k)
    ? <>{text} <span className="ms-1 rounded-full px-2 py-0.5 text-2xs font-extrabold" style={{ background: HUE.green.tint, color: HUE.green.ink }}>changed</span></>
    : text);

  const save = async () => {
    setBusy(true);
    const ok = await s.save(draft, "Goals saved");
    setBusy(false);
    if (ok) { setDraft({}); onClose(); }
  };

  const flow: FlowStep[] = [
    { id: "diet", title: "What do you eat?", hint: "Recipes and food ideas follow this.",
      body: <PicChoice label="Diet type" hue={hue} options={DIET_TILES} value={v.diet}
                       onChange={(d) => put({ diet: d as HealthSettings["diet"] })} onPicked={() => setStep(1)} /> },
    { id: "goal", title: "What are you working on?", hint: "Optional. Tap it again to clear it.", optional: true, valid: !!v.healthGoal,
      body: <PicChoice label="Health goal" hue={hue} value={v.healthGoal}
                       options={HEALTH_GOALS.map((g) => ({ value: g, label: g, art: GOAL_ART[g] }))}
                       onChange={(g) => {
                         const next = v.healthGoal === g ? "" : g;
                         put({ healthGoal: next });
                         // A choice moves on by itself; clearing one stays here.
                         if (next) window.setTimeout(() => setStep(2), 180);
                       }} /> },
    { id: "kcal", title: "How many calories a day?", hint: "Many women need about 1,800–2,200 kcal a day.", valid: kcalOk,
      body: <>
        <Dial label="calories a day" unit="kcal a day" hue={hue} value={v.kcalGoal} onChange={(n) => put({ kcalGoal: n })}
              min={800} max={5000} step={50} presets={[1500, 1800, 2000, 2200, 2500]} />
        {!kcalOk && <FlowNote tone="error">Choose between 800 and 5,000 kcal.</FlowNote>}
      </> },
    { id: "protein", title: "How much protein a day?", hint: "About 50–60 g a day is common for women.", valid: proteinOk,
      body: <>
        <Dial label="protein a day" unit="g a day" hue={hue} value={v.proteinGoal} onChange={(n) => put({ proteinGoal: n })}
              min={10} max={300} step={5} presets={[40, 50, 55, 60, 75]} />
        {!proteinOk && <FlowNote tone="error">Choose between 10 and 300 g.</FlowNote>}
      </> },
    { id: "water", title: "How many glasses of water a day?", hint: `One glass is ${GLASS} ml.`, valid: waterOk,
      body: <>
        <Dial label="glasses of water a day" unit="glasses" hue={hue} value={v.waterGoal} onChange={(n) => put({ waterGoal: n })}
              min={1} max={20} step={1} presets={[6, 8, 10, 12]} />
        <FlowNote hue="blue" icon="Droplet" tone={waterOk ? "info" : "error"}>
          {waterOk ? `That is ${litres} L a day.` : "Choose between 1 and 20 glasses."}
        </FlowNote>
      </> },
    { id: "check", title: dirty ? "Save your new goals?" : "Nothing changed yet", valid: dirty,
      hint: dirty ? "Check them, then save. These are your own targets, not a prescription." : "Go back and tap what you would like to change.",
      body: <>
        <Review rows={[
          ["Diet", mark("diet", v.diet)], ["Goal", mark("healthGoal", v.healthGoal || "Not set")],
          ["Calories", mark("kcalGoal", `${v.kcalGoal} kcal a day`)], ["Protein", mark("proteinGoal", `${v.proteinGoal} g a day`)],
          ["Water", mark("waterGoal", `${v.waterGoal} glasses (${litres} L)`)],
        ]} />
        {dirty && <div><Btn size="sm" variant="ghost" icon="Undo2" onClick={() => setDraft({})}>Undo changes</Btn></div>}
      </> },
  ];
  return <StepSheet open onClose={onClose} icon="Target" title="Your nutrition goals" hue={hue} steps={flow} step={step} setStep={setStep}
                    onSubmit={save} busy={busy} submitLabel="Save goals" />;
}

/* ── Insights ──────────────────────────────────────────────────────── */

export function InsightsTab({ store, s }: { store: Store; s: Settings }) {
  const [n, setN] = useState<7 | 30>(7);
  const days = useMemo(() => lastDays(n), [n]);
  const meals = only(store.rows, "meal");
  const water = only(store.rows, "water");
  const goal = s.settings;
  const per = days.map((d) => {
    const ms = meals.filter((m) => m.date === d.day);
    return {
      ...d,
      kcal: ms.reduce((a, m) => a + (m.data.kcal || 0), 0),
      protein: ms.reduce((a, m) => a + (m.data.protein || 0), 0),
      meals: ms.length,
      breakfast: ms.some((m) => m.data.mealType === "Breakfast"),
      water: water.filter((w) => w.date === d.day).reduce((a, w) => a + w.data.ml, 0),
    };
  });
  const logged = per.filter((p) => p.meals > 0);
  const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : 0);
  const avgK = avg(logged.filter((p) => p.kcal).map((p) => p.kcal));
  const avgP = avg(logged.filter((p) => p.protein).map((p) => p.protein));
  const waterMet = per.filter((p) => p.water >= goal.waterGoal * GLASS).length;
  const breakfasts = per.filter((p) => p.breakfast).length;
  const label = (d: { day: string; label: string }) => (n === 7 ? d.label : String(Number(d.day.slice(8))));

  const notes: string[] = [];
  if (logged.length === 0) notes.push("Log a few meals to see your patterns here.");
  else {
    if (avgP && avgP < goal.proteinGoal * 0.8) notes.push(`You're averaging ${avgP} g of protein, below your ${goal.proteinGoal} g goal. Dal, chana, curd, paneer and eggs are easy ways to add more.`);
    if (breakfasts < Math.ceil(n * 0.6)) notes.push(`You logged breakfast on ${breakfasts} of ${n} days. A regular breakfast helps steady energy through the morning.`);
    if (waterMet < Math.ceil(n * 0.5)) notes.push(`You met your water goal on ${waterMet} of ${n} days. Keep a bottle where you work.`);
    if (avgK && avgK > goal.kcalGoal * 1.15) notes.push(`Your logged calories average ${avgK} kcal, above your ${goal.kcalGoal} kcal goal.`);
    if (!notes.length) notes.push("You're eating steadily and close to your goals. Keep going.");
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Chips label="Period" hue="green" options={[{ value: "7", label: "Last 7 days" }, { value: "30", label: "Last 30 days" }]}
               value={String(n)} onChange={(v) => setN(Number(v) as 7 | 30)} />
      </div>
      <MetricGrid>
        <Metric hue="green" icon="Flame" label="Average calories" value={avgK || "–"} unit={avgK ? "kcal" : undefined} sub={`${logged.length} day${logged.length === 1 ? "" : "s"} logged`} />
        <Metric hue="orange" icon="Dumbbell" label="Average protein" value={avgP || "–"} unit={avgP ? "g" : undefined} sub={`Goal ${goal.proteinGoal} g`} />
        <Metric hue="blue" icon="Droplet" label="Water goal met" value={`${waterMet} of ${n}`} sub="days" />
        <Metric hue="amber" icon="Sun" label="Breakfast" value={`${breakfasts} of ${n}`} sub="days with breakfast" />
      </MetricGrid>
      <Cols
        main={
          <>
            <Panel title="Calories per day" sub="Only meals where calories were entered"><BarChart hue="green" data={per.map((p) => ({ label: label(p), value: p.kcal }))} goal={goal.kcalGoal} /></Panel>
            <Panel title="Protein per day"><BarChart hue="orange" unit=" g" data={per.map((p) => ({ label: label(p), value: p.protein }))} goal={goal.proteinGoal} /></Panel>
            <Panel title="Water per day"><BarChart hue="blue" unit=" ml" data={per.map((p) => ({ label: label(p), value: p.water }))} goal={goal.waterGoal * GLASS} /></Panel>
          </>
        }
        side={
          <>
            <Panel title="What this tells you" hue="green" tint>
              <ul className="flex flex-col gap-3" data-insight-notes>
                {notes.map((t) => (
                  <li key={t} className="flex gap-2.5 text-sm" style={{ color: "var(--ux-ink)" }}>
                    <I name="Lightbulb" className="mt-0.5 h-4 w-4 shrink-0" style={{ color: HUE.green.ink }} />{t}
                  </li>
                ))}
              </ul>
            </Panel>
            <Panel title="Meal regularity" sub="Meals logged each day">
              <div className="grid grid-cols-7 gap-1.5">
                {per.slice(-14).map((p) => (
                  <span key={p.day} title={`${fmtDay(p.day)}: ${p.meals} meals`}
                        className="grid aspect-square place-items-center rounded-[8px] text-2xs font-bold tabular-nums"
                        style={{ background: p.meals >= 3 ? HUE.green.ink : p.meals ? HUE.green.tint : "var(--ux-surface-2)",
                                 color: p.meals >= 3 ? "var(--ux-surface)" : "var(--ux-ink-2)" }}>
                    {p.meals || ""}
                  </span>
                ))}
              </div>
              <p className="text-xs" style={{ color: "var(--ux-muted)" }}>Darker squares are days with three or more meals logged.</p>
            </Panel>
            <Disclaimer>These are patterns from what you logged, not a medical assessment.</Disclaimer>
          </>
        }
      />
    </>
  );
}
