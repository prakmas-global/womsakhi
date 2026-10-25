"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

import { Btn, Sheet } from "@/components/ux/kit";
import { Text } from "@/components/ux/kit/form";
import {
  BarChart, Chips, Cols, Disclaimer, Empty, HUE, I, Metric, MetricGrid, Panel, lastDays, type useEntries, type useHealthSettings,
} from "@/components/ux/health/kit";
import { addDays, fmtDay, nowHHMM, today, type Entry, type HealthKind, type HealthSettings, type KindData, type MealType } from "@/lib/health-api";
import { DIETS, FOODS, MEAL_ICON, MEAL_TYPES, RECIPES, mealByTime, recipeArt, recipeFor, type Recipe } from "./data";
import { Field, StepNum } from "./parts";

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
  const [editing, setEditing] = useState<Entry<"meal"> | null>(null);
  const [mealFor, setMealFor] = useState<MealType>(mealByTime());

  const openLog = (mt: MealType) => {
    setEditing(null);
    setMealFor(mt);
    document.getElementById("nt-log")?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  return (
    <>
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
                            <button type="button" aria-label={`Edit ${m.data.food}`} onClick={() => { setEditing(m); setMealFor(m.data.mealType); document.getElementById("nt-log")?.scrollIntoView({ behavior: "smooth", block: "center" }); }}
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
            <Disclaimer>
              This is general guidance, not a diet for a health condition. For that,{" "}
              <Link href={NUTRITIONIST} className="font-bold underline" style={{ color: "var(--ux-amber-ink)" }}>talk to a nutritionist</Link>.
            </Disclaimer>
          </>
        }
        side={
          <>
            <QuickLog key={editing?.id ?? mealFor} store={store} s={s} meals={meals} editing={editing} initialMeal={mealFor}
                      onDone={() => setEditing(null)} />
            <WaterPanel store={store} s={s} />
          </>
        }
      />
    </>
  );
}

function QuickLog({ store, s, meals, editing, initialMeal, onDone }: {
  store: Store; s: Settings; meals: Entry<"meal">[]; editing: Entry<"meal"> | null; initialMeal: MealType; onDone: () => void;
}) {
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
    if (ok) { setFood(""); setKcal(0); setProtein(0); setRecipe(""); onDone(); }
  };

  return (
    <Panel id="nt-log" title={editing ? "Change this meal" : "Log a meal"} sub={editing ? fmtDay(editing.date) : "Tap a food, or write your own"} hue="green">
      <Chips label="Meal" hue="green" options={MEAL_TYPES} value={mealType} onChange={setMealType} />
      {recent.length > 0 && (
        <Field label="You had recently">
          <Chips label="Recent foods" hue="green" options={recent.map((r) => r.food)} value={food}
                 onChange={(f) => pick(recent.find((r) => r.food === f)!)} />
        </Field>
      )}
      <Field label={`Common for ${mealType.toLowerCase()}`}>
        <Chips label="Common foods" hue="green" options={common.map((r) => r.food)} value={food}
               onChange={(f) => pick(common.find((r) => r.food === f)!)} />
      </Field>
      <Field label="What did you eat?">
        <Text label="What did you eat?" value={food} max={120} placeholder="For example: 2 roti with dal"
              onChange={(v) => { setFood(v); setRecipe(""); }} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
        <Field label="Calories (optional)" hint={recipe ? "Recipe estimate — change it if you know better." : undefined}>
          <StepNum label="Calories" value={kcal} onChange={setKcal} step={10} max={5000} unit="kcal" />
        </Field>
        <Field label="Protein (optional)">
          <StepNum label="Protein" value={protein} onChange={setProtein} step={1} max={300} unit="g" />
        </Field>
      </div>
      <div className="flex flex-wrap gap-2">
        <Btn icon="Check" disabled={!food.trim()} loading={busy} onClick={save}>{editing ? "Save changes" : "Save meal"}</Btn>
        {editing && <Btn variant="ghost" onClick={onDone}>Cancel</Btn>}
      </div>
    </Panel>
  );
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
      <div className="flex flex-wrap gap-2">
        {[150, 250, 500].map((n) => (
          <Btn key={n} size="sm" variant={n === 250 ? "primary" : "outline"} icon="Plus" onClick={() => store.add("water", { ml: n }, t, `+${n} ml of water`)}>
            {n} ml
          </Btn>
        ))}
        {todays.length > 0 && (
          <Btn size="sm" variant="ghost" icon="Undo2" onClick={() => store.remove(todays[0].id, "Removed the last glass")}>Undo</Btn>
        )}
      </div>
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
  const [adding, setAdding] = useState<{ date: string; mealType: MealType } | null>(null);

  const eat = async (p: Entry<"plan">) => {
    const r = p.data.recipe ? recipeFor(p.data.recipe) : undefined;
    const ok = await store.edit(p.id, { data: { eaten: true } });
    if (ok) await store.add("meal", { mealType: p.data.mealType, food: p.data.food, kcal: r?.kcal ?? 0, protein: r?.protein ?? 0, recipe: p.data.recipe ?? "", time: nowHHMM() },
                           p.date > today() ? today() : p.date, `${p.data.food} added to your diary`);
  };

  const planned = plans.filter((p) => p.date >= today()).length;
  return (
    <>
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
                      <button type="button" aria-label={`Plan ${mt} for ${dayName(d)}`} onClick={() => setAdding({ date: d, mealType: mt })}
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
        <PlanPicker key={`${adding.date}${adding.mealType}`} at={adding} diet={s.settings.diet} meals={meals}
                    onClose={() => setAdding(null)}
                    onPick={async (f) => { await store.add("plan", { mealType: adding.mealType, food: f.food, recipe: f.recipe ?? "", eaten: false }, adding.date, `Planned for ${dayName(adding.date).toLowerCase()}`); setAdding(null); }} />
      )}
    </>
  );
}

function PlanPicker({ at, diet, meals, onClose, onPick }: {
  at: { date: string; mealType: MealType }; diet: HealthSettings["diet"]; meals: Entry<"meal">[];
  onClose: () => void; onPick: (f: { food: string; recipe?: string }) => void;
}) {
  const [own, setOwn] = useState("");
  const { recent, common } = foodChoices(meals, at.mealType, diet);
  const all = [...common, ...recent.filter((r) => !common.some((c) => c.food === r.food))];
  return (
    <Sheet open onClose={onClose} icon="CalendarDays" title={`${at.mealType}, ${dayName(at.date).toLowerCase()}`}
           description="Tap a dish to add it to your plan."
           footer={<Btn full icon="Plus" disabled={!own.trim()} onClick={() => onPick({ food: own.trim() })}>Add “{own.trim() || "your dish"}”</Btn>}>
      <div className="flex flex-col gap-4">
        <Chips label="Dishes" hue="green" options={all.map((f) => f.food)} value=""
               onChange={(f) => { const x = all.find((a) => a.food === f)!; onPick({ food: x.food, recipe: "recipe" in x ? (x as { recipe?: string }).recipe : undefined }); }} />
        <Field label="Or write your own">
          <Text label="Dish" value={own} onChange={setOwn} max={120} placeholder="For example: Aloo sabzi with roti" />
        </Field>
      </div>
    </Sheet>
  );
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
  const [draft, setDraft] = useState<Partial<HealthSettings>>({});
  const v = { ...st, ...draft };
  const dirty = Object.keys(draft).some((k) => draft[k as keyof HealthSettings] !== st[k as keyof HealthSettings]);
  const [busy, setBusy] = useState(false);
  const put = (p: Partial<HealthSettings>) => setDraft((d) => ({ ...d, ...p }));

  return (
    <Cols
      main={
        <Panel title="Your nutrition goals" sub="Tap to change — nothing to type">
          <Field label="I eat">
            <Chips label="Diet type" hue="green" options={DIETS} value={v.diet} onChange={(d) => put({ diet: d })} />
          </Field>
          <Field label="What I'm working on">
            <Chips label="Health goal" hue="green" options={HEALTH_GOALS} value={v.healthGoal}
                   onChange={(g) => put({ healthGoal: v.healthGoal === g ? "" : g })} />
          </Field>
          <div className="grid gap-5 sm:grid-cols-3">
            <Field label="Calories a day"><StepNum label="Calories a day" value={v.kcalGoal} onChange={(n) => put({ kcalGoal: n })} step={50} min={800} max={5000} unit="kcal" /></Field>
            <Field label="Protein a day"><StepNum label="Protein a day" value={v.proteinGoal} onChange={(n) => put({ proteinGoal: n })} step={5} min={10} max={300} unit="g" /></Field>
            <Field label="Water a day"><StepNum label="Glasses of water a day" value={v.waterGoal} onChange={(n) => put({ waterGoal: n })} step={1} min={1} max={20} unit="glasses" /></Field>
          </div>
          <div className="flex flex-wrap gap-2">
            <Btn icon="Check" disabled={!dirty} loading={busy} onClick={async () => { setBusy(true); const ok = await s.save(draft, "Goals saved"); setBusy(false); if (ok) setDraft({}); }}>Save goals</Btn>
            {dirty && <Btn variant="ghost" onClick={() => setDraft({})}>Undo</Btn>}
          </div>
          <p className="text-xs" style={{ color: "var(--ux-muted)" }}>
            Many women need about 1,800–2,200 kcal and 50–60 g of protein a day; it changes with age, work, pregnancy and health. These are your own targets, not a prescription.
          </p>
        </Panel>
      }
      side={
        <>
          <Panel title="Your plan" hue="green" tint>
            <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
              {[["Diet", st.diet], ["Goal", st.healthGoal || "Not set"], ["Calories", `${st.kcalGoal} kcal a day`],
                ["Protein", `${st.proteinGoal} g a day`], ["Water", `${st.waterGoal} glasses (${(st.waterGoal * GLASS / 1000).toFixed(1)} L)`]].map(([k, val]) => (
                <div key={k} className="contents">
                  <dt className="font-bold" style={{ color: "var(--ux-muted)" }}>{k}</dt>
                  <dd className="font-semibold" style={{ color: "var(--ux-ink)" }}>{val}</dd>
                </div>
              ))}
            </dl>
          </Panel>
          <Panel title="Need a plan for a health condition?" sub="Thyroid, diabetes, pregnancy, anaemia">
            <div className="flex flex-wrap gap-2">
              <Btn size="sm" icon="Stethoscope" href={NUTRITIONIST}>Talk to a nutritionist</Btn>
              <Btn size="sm" variant="outline" icon="Users" href="/app/health/mentors?topic=Nutrition">Ask a mentor</Btn>
            </div>
          </Panel>
        </>
      }
    />
  );
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
