"use client";

import { useEffect, useMemo, useState } from "react";

import { Btn, Sheet } from "@/components/ux/kit";
import { I } from "@/components/ux/health/kit";
import { artOf } from "@/components/ux/health/art";
import { toast } from "@/components/ux/mobile/Toast";
import { addDays, fmtDay, today, type Entry, type HealthSettings, type MealType } from "@/lib/health-api";
import { DIET_GUIDE, FOODS, MEAL_TYPES, RECIPES, mealByTime, recipeFor } from "./data";
import css from "./meal-plan.module.css";

/**
 * The week's meal plan as a board: a ribbon of seven days (a ring on each
 * shows which meals are planned), the week against her calorie and protein
 * goals, and the chosen day as a timeline from breakfast to dinner. An empty
 * meal offers dishes from her diet in one tap; a planned one can be swapped,
 * ticked as eaten or removed. "Fill" plans the empty meals of a day or the
 * whole week, and the shopping list gathers what the planned recipes need.
 */

type Plan = Entry<"plan">;
export interface Dish { food: string; recipe?: string; kcal?: number; protein?: number; mins?: number }

const SLOT_TIME: Record<MealType, string> = { Breakfast: "8 am", Lunch: "1 pm", "Evening snack": "5 pm", Dinner: "8 pm" };
const WEEKDAY = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString("en-IN", { weekday: "short" });
const DATE_NUM = (d: string) => Number(d.slice(8, 10));
const LONG_DAY = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" });
const key = (s: string) => s.trim().toLowerCase();

/** Calories and protein of a planned dish — the recipe's, or an everyday dish's — when known. */
export function nutritionOf(food: string, recipe?: string): Dish | null {
  const r = recipe ? recipeFor(recipe) : RECIPES.find((x) => key(x.name) === key(food));
  if (r) return { food: r.name, recipe: r.id, kcal: r.kcal, protein: r.protein, mins: r.mins };
  const f = FOODS.find((x) => key(x.food) === key(food));
  return f ? { food: f.food, kcal: f.kcal, protein: f.protein } : null;
}

/** Everyday things she may log, but not ones to suggest as a planned meal. */
const NOT_A_PLAN = new Set(["Biscuits (4)", "Tea with milk"]);

/** Dishes for one meal in her diet: the recipes, the diet guide's pick, then everyday dishes that make a meal. */
export function ideasFor(mt: MealType, diet: HealthSettings["diet"]): Dish[] {
  const out: Dish[] = [];
  const push = (d: Dish) => { if (!out.some((o) => key(o.food) === key(d.food))) out.push(d); };
  RECIPES.filter((r) => r.meal === mt && r.suits.includes(diet))
    .forEach((r) => push({ food: r.name, recipe: r.id, kcal: r.kcal, protein: r.protein, mins: r.mins }));
  const pick = DIET_GUIDE[diet]?.day[mt];
  if (pick) push(nutritionOf(pick) ?? { food: pick });
  FOODS.filter((f) => f.meal.includes(mt) && (!f.suits || f.suits.includes(diet)) && !NOT_A_PLAN.has(f.food) && f.kcal >= (mt === "Evening snack" ? 80 : 180))
    .forEach((f) => push({ food: f.food, kcal: f.kcal, protein: f.protein }));
  return out;
}

const sumOf = (ps: Plan[]) => ps.reduce(
  (a, p) => { const n = nutritionOf(p.data.food, p.data.recipe); return n ? { kcal: a.kcal + (n.kcal ?? 0), protein: a.protein + (n.protein ?? 0), known: a.known + 1 } : a; },
  { kcal: 0, protein: 0, known: 0 },
);

/** Four arcs round the date: one per meal, filled when planned, darker when eaten. */
function DayRing({ planned, eaten, size = 44 }: { planned: boolean[]; eaten: boolean[]; size?: number }) {
  const r = 19, c = 2 * Math.PI * r, seg = c / 4, gap = 5;
  return (
    <svg viewBox="0 0 44 44" width={size} height={size} className={css.ring} aria-hidden>
      {planned.map((on, i) => (
        <circle key={i} cx="22" cy="22" r={r} fill="none" strokeWidth="4" strokeLinecap="round"
                className={eaten[i] ? css.arcEaten : on ? css.arcOn : css.arcOff}
                strokeDasharray={`${seg - gap} ${c - seg + gap}`} strokeDashoffset={-(i * seg) + c / 4 - gap / 2} />
      ))}
    </svg>
  );
}

/** A meter: how far she is to a goal, in the week's colours. */
function Meter({ value, goal, label, unit }: { value: number; goal: number; label: string; unit: string }) {
  const pct = goal ? Math.min(100, Math.round((value / goal) * 100)) : 0;
  return (
    <div className={css.meter}>
      <div className={css.meterHead}><span>{label}</span><b>{value ? `≈ ${value.toLocaleString("en-IN")}` : "–"}<small> / {goal.toLocaleString("en-IN")} {unit}</small></b></div>
      <i className={css.bar} role="img" aria-label={`${label}: about ${value} of ${goal} ${unit}`}><i style={{ width: `${pct}%` }} data-over={value > goal * 1.1 || undefined} /></i>
    </div>
  );
}

export function MealPlanBoard({ plans, diet, kcalGoal, proteinGoal, onPlan, onAdd, onSwap, onEat, onRemove, onRecipe }: {
  plans: Plan[];
  diet: HealthSettings["diet"];
  kcalGoal: number;
  proteinGoal: number;
  /** Open the "Plan a meal" flow at the dish, for this day and meal. */
  onPlan: (date: string, mt: MealType) => void;
  onAdd: (date: string, mt: MealType, d: Dish, msg?: string) => Promise<unknown>;
  onSwap: (p: Plan, d: Dish) => Promise<unknown>;
  onEat: (p: Plan) => Promise<unknown>;
  onRemove: (p: Plan) => void;
  onRecipe: (id: string) => void;
}) {
  const t = today();
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(t, i)), [t]);
  const [sel, setSel] = useState(t);
  const [busy, setBusy] = useState("");
  const [askWeek, setAskWeek] = useState(false);
  const [shop, setShop] = useState(false);
  const [nowMeal] = useState<MealType>(() => mealByTime());

  const week = plans.filter((p) => p.date >= t && p.date <= days[6]);
  const at = (d: string, mt: MealType) => week.filter((p) => p.date === d && p.data.mealType === mt);
  const ideas = useMemo(() => Object.fromEntries(MEAL_TYPES.map((mt) => [mt, ideasFor(mt, diet)])) as Record<MealType, Dish[]>, [diet]);

  /** A dish for an empty meal, turning through her ideas so the week has variety. */
  const choose = (d: string, mt: MealType, taken: Set<string>) => {
    const pool = ideas[mt];
    if (!pool.length) return null;
    const di = days.indexOf(d), start = (di * 3 + MEAL_TYPES.indexOf(mt)) % pool.length;
    for (let k = 0; k < pool.length; k++) {
      const x = pool[(start + k) % pool.length];
      if (!taken.has(`${addDays(d, -1)}|${mt}|${key(x.food)}`) && !taken.has(`${d}|*|${key(x.food)}`)) return x;
    }
    return pool[start];
  };
  const takenSet = () => new Set(week.flatMap((p) => [`${p.date}|${p.data.mealType}|${key(p.data.food)}`, `${p.date}|*|${key(p.data.food)}`]));
  const emptyOf = (ds: string[]) => ds.flatMap((d) => MEAL_TYPES.filter((mt) => !at(d, mt).length).map((mt) => [d, mt] as const));

  const fill = async (ds: string[], label: string) => {
    const empty = emptyOf(ds);
    if (!empty.length) return;
    setBusy(label);
    const taken = takenSet();
    let n = 0;
    for (const [d, mt] of empty) {
      const x = choose(d, mt, taken);
      if (!x) continue;
      taken.add(`${d}|${mt}|${key(x.food)}`); taken.add(`${d}|*|${key(x.food)}`);
      if (await onAdd(d, mt, x)) n++;
    }
    setBusy("");
    if (n) toast(`${n} meal${n === 1 ? "" : "s"} planned`, { tone: "success" });
  };

  const swap = (p: Plan) => {
    const pool = ideas[p.data.mealType];
    const i = pool.findIndex((x) => key(x.food) === key(p.data.food));
    const sameDay = new Set(week.filter((q) => q.date === p.date).map((q) => key(q.data.food)));
    for (let k = 1; k <= pool.length; k++) {
      const x = pool[(Math.max(i, 0) + k) % pool.length];
      if (!sameDay.has(key(x.food))) return onSwap(p, x);
    }
  };

  /* the week in numbers */
  const filled = days.reduce((a, d) => a + MEAL_TYPES.filter((mt) => at(d, mt).length).length, 0);
  const daySums = days.map((d) => sumOf(week.filter((p) => p.date === d)));
  const planDays = daySums.filter((s) => s.known > 0);
  const avgK = planDays.length ? Math.round(planDays.reduce((a, s) => a + s.kcal, 0) / planDays.length) : 0;
  const avgP = planDays.length ? Math.round(planDays.reduce((a, s) => a + s.protein, 0) / planDays.length) : 0;
  const eaten = week.filter((p) => p.data.eaten).length;
  const recipesPlanned = new Set(week.filter((p) => !p.data.eaten && (p.data.recipe || nutritionOf(p.data.food)?.recipe)).map((p) => p.data.recipe || nutritionOf(p.data.food)!.recipe!)).size;
  const weekEmpty = emptyOf(days).length;

  const selPlans = week.filter((p) => p.date === sel);
  const selSum = sumOf(selPlans);
  const selEmpty = emptyOf([sel]).length;

  return (
    <section className={css.board} aria-label="This week's meal plan" data-plan-board>
      {/* ── head: the week in numbers, and the big actions ── */}
      <header className={css.head}>
        <div className={css.headText}>
          <p className={css.eyebrow}>Your week of meals · {diet}</p>
          <h2>{filled ? `${filled} of 28 meals planned` : "Plan your week in a few taps"}</h2>
          <p className={css.headSub}>{filled ? "Tap a day to see it. Swap anything, or tick it when you eat it." : "Tap a dish under any meal, or let us fill the week from your diet."}</p>
        </div>
        <div className={css.headActs}>
          {askWeek ? (
            <div className={css.confirm} role="group" aria-label="Fill the week">
              <span>Plan the {weekEmpty} empty meal{weekEmpty === 1 ? "" : "s"}?</span>
              <Btn size="sm" icon="Sparkles" onClick={() => { setAskWeek(false); void fill(days, "week"); }}>Yes, fill</Btn>
              <Btn size="sm" variant="ghost" onClick={() => setAskWeek(false)}>Cancel</Btn>
            </div>
          ) : (
            <Btn size="sm" icon="Sparkles" disabled={!weekEmpty || !!busy} onClick={() => setAskWeek(true)}>
              {busy === "week" ? "Planning your week…" : weekEmpty ? "Fill my week" : "Week is full"}
            </Btn>
          )}
          <Btn size="sm" variant="soft" icon="ShoppingBag" onClick={() => setShop(true)}>
            Shopping list{recipesPlanned ? ` · ${recipesPlanned}` : ""}
          </Btn>
          <Btn size="sm" variant="ghost" icon="ChefHat" href="?tab=recipes">Recipes</Btn>
        </div>
        <div className={css.kpis}>
          <div className={css.kpi}>
            <span>Planned</span><b>{filled}<small>/28</small></b>
            <i className={css.bar}><i style={{ width: `${(filled / 28) * 100}%` }} /></i>
          </div>
          <div className={css.kpi}><span>Calories a day</span><b>{avgK ? `≈ ${avgK.toLocaleString("en-IN")}` : "–"}<small> / {kcalGoal.toLocaleString("en-IN")}</small></b>
            <i className={css.bar}><i style={{ width: `${Math.min(100, (avgK / kcalGoal) * 100)}%` }} /></i></div>
          <div className={css.kpi}><span>Protein a day</span><b>{avgP ? `≈ ${avgP} g` : "–"}<small> / {proteinGoal} g</small></b>
            <i className={css.bar}><i style={{ width: `${Math.min(100, (avgP / proteinGoal) * 100)}%` }} /></i></div>
          <div className={css.kpi}><span>Eaten so far</span><b>{eaten}<small> of {week.length || 0}</small></b>
            <i className={css.bar}><i style={{ width: `${week.length ? (eaten / week.length) * 100 : 0}%` }} /></i></div>
        </div>
      </header>

      {/* ── the ribbon of days ── */}
      <div className={css.ribbon} role="group" aria-label="Pick a day">
        {days.map((d, i) => {
          const planned = MEAL_TYPES.map((mt) => at(d, mt).length > 0);
          const ate = MEAL_TYPES.map((mt) => { const xs = at(d, mt); return xs.length > 0 && xs.every((p) => p.data.eaten); });
          const n = planned.filter(Boolean).length;
          return (
            <button key={d} type="button" className={css.day} aria-pressed={sel === d} data-today={d === t || undefined}
                    aria-label={`${LONG_DAY(d)}: ${n} of 4 meals planned`} onClick={() => setSel(d)}>
              <span className={css.dayName}>{d === t ? "Today" : WEEKDAY(d)}</span>
              <span className={css.dayRing}>
                <DayRing planned={planned} eaten={ate} />
                <b>{DATE_NUM(d)}</b>
              </span>
              <small className={css.dayKcal}>{daySums[i].known ? `≈ ${daySums[i].kcal.toLocaleString("en-IN")}` : n ? `${n}/4` : "—"}</small>
            </button>
          );
        })}
      </div>

      {/* ── the chosen day ── */}
      <div className={css.focus} key={sel}>
        <div className={css.focusHead}>
          <div>
            <h3>{sel === t ? "Today" : sel === addDays(t, 1) ? "Tomorrow" : LONG_DAY(sel).split(",")[0]}<span> · {fmtDay(sel)}</span></h3>
            <p>{selPlans.length ? `${selPlans.length} dish${selPlans.length === 1 ? "" : "es"} planned` : "Nothing planned yet"}{selSum.known < selPlans.length ? " · some without an estimate" : ""}</p>
          </div>
          <Btn size="sm" variant="soft" icon="Sparkles" disabled={!selEmpty || !!busy} onClick={() => void fill([sel], "day")}>
            {busy === "day" ? "Planning…" : selEmpty ? `Fill ${selEmpty === 4 ? "this day" : `${selEmpty} empty`}` : "Day is full"}
          </Btn>
        </div>
        <div className={css.meters}>
          <Meter label="Calories" value={selSum.kcal} goal={kcalGoal} unit="kcal" />
          <Meter label="Protein" value={selSum.protein} goal={proteinGoal} unit="g" />
        </div>

        <ol className={css.slots}>
          {MEAL_TYPES.map((mt) => {
            const xs = at(sel, mt);
            const next = sel === t && mt === nowMeal && !xs.every((p) => p.data.eaten);
            const taken = new Set(selPlans.map((p) => key(p.data.food)));
            const offers = ideas[mt].filter((x) => !taken.has(key(x.food)));
            const shift = (days.indexOf(sel) * 2) % Math.max(1, offers.length);
            const three = [...offers.slice(shift), ...offers.slice(0, shift)].slice(0, 3);
            return (
              <li key={mt} className={css.slot} data-empty={!xs.length || undefined} data-next={next || undefined}>
                <div className={css.rail} aria-hidden><span>{SLOT_TIME[mt]}</span><i /></div>
                <div className={css.card}>
                  <div className={css.cardHead}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={artOf(mt)} alt="" className={css.mealArt} />
                    <b>{mt}</b>
                    {next && <em className={css.next}>Up next</em>}
                    <button type="button" className={css.add} aria-label={`Plan ${mt.toLowerCase()} for ${LONG_DAY(sel)}`} onClick={() => onPlan(sel, mt)}>
                      <I name="Plus" className="h-4 w-4" />
                    </button>
                  </div>

                  {xs.map((p) => {
                    const n = nutritionOf(p.data.food, p.data.recipe);
                    const rid = p.data.recipe || n?.recipe;
                    return (
                      <div key={p.id} className={css.dish} data-eaten={p.data.eaten || undefined}>
                        <div className={css.dishMain}>
                          <p className={css.dishName}>
                            {p.data.eaten && <I name="CheckCircle2" className={`${css.ok} h-4 w-4`} />}
                            {rid ? <button type="button" className={css.link} onClick={() => onRecipe(rid)}>{p.data.food}</button> : p.data.food}
                          </p>
                          <p className={css.facts}>
                            {n?.kcal ? <span>≈ {n.kcal} kcal</span> : <span>No estimate</span>}
                            {n?.protein ? <span>{n.protein} g protein</span> : null}
                            {n?.mins ? <span><I name="Clock" className="h-3 w-3" /> {n.mins} min</span> : null}
                            {rid && <span className={css.recipe}>Recipe</span>}
                          </p>
                        </div>
                        <div className={css.acts}>
                          {!p.data.eaten && sel <= t && (
                            <button type="button" className={css.eat} onClick={() => void onEat(p)} aria-label={`Mark ${p.data.food} eaten`}>
                              <I name="Check" className="h-3.5 w-3.5" /> Eaten
                            </button>
                          )}
                          {!p.data.eaten && (
                            <button type="button" className={css.icon} onClick={() => void swap(p)} aria-label={`Swap ${p.data.food} for another dish`} title="Swap for another dish">
                              <I name="Shuffle" className="h-3.5 w-3.5" />
                            </button>
                          )}
                          <button type="button" className={css.icon} onClick={() => onRemove(p)} aria-label={`Remove ${p.data.food}`} title="Remove">
                            <I name="X" className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}

                  {!xs.length && (
                    <div className={css.ideas}>
                      <span className={css.ideasLabel}>Tap to plan</span>
                      {three.map((x) => (
                        <button key={x.food} type="button" className={css.idea} disabled={!!busy}
                                onClick={() => void onAdd(sel, mt, x, `${x.food} planned`)}>
                          <I name="Plus" className="h-3 w-3" />
                          <span>{x.food}</span>
                          {x.kcal ? <small>{x.kcal} kcal</small> : null}
                        </button>
                      ))}
                      <button type="button" className={css.more} onClick={() => onPlan(sel, mt)}>More dishes</button>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </div>
      <p className={css.foot}>Calories and protein are estimates from the recipes and everyday dishes. “Eaten” adds the dish to your diary.</p>

      <ShoppingList open={shop} onClose={() => setShop(false)} plans={week} weekStart={days[0]} />
    </section>
  );
}

/* ── the shopping list ─────────────────────────────────────────────────── */

function ShoppingList({ open, onClose, plans, weekStart }: { open: boolean; onClose: () => void; plans: Plan[]; weekStart: string }) {
  const store = `ws-shop-${weekStart}`;
  const [got, setGot] = useState<string[]>([]);
  useEffect(() => {
    if (!open) return;
    let saved: string[] = [];
    try { saved = JSON.parse(localStorage.getItem(store) || "[]"); } catch { /* private mode: start empty */ }
    const id = setTimeout(() => setGot(saved), 0);
    return () => clearTimeout(id);
  }, [open, store]);
  const toggle = (k: string) => setGot((g) => {
    const n = g.includes(k) ? g.filter((x) => x !== k) : [...g, k];
    try { localStorage.setItem(store, JSON.stringify(n)); } catch { /* fine */ }
    return n;
  });

  // Each recipe once, with the days it is planned for.
  const todo = plans.filter((p) => !p.data.eaten);
  const byRecipe = new Map<string, string[]>();
  const loose: string[] = [];
  for (const p of todo) {
    const rid = p.data.recipe || nutritionOf(p.data.food)?.recipe;
    if (rid && recipeFor(rid)) byRecipe.set(rid, [...(byRecipe.get(rid) ?? []), p.date]);
    else if (!loose.some((l) => key(l) === key(p.data.food))) loose.push(p.data.food);
  }
  const groups = [...byRecipe].map(([rid, ds]) => ({ r: recipeFor(rid)!, ds: [...new Set(ds)].sort() }));
  const total = groups.reduce((a, g) => a + g.r.ing.length, 0);
  const done = groups.reduce((a, g) => a + g.r.ing.filter((i) => got.includes(`${g.r.id}|${i}`)).length, 0);

  return (
    <Sheet open={open} onClose={onClose} icon="ShoppingBag" title="Shopping list" width={480}
           description={total ? `${done} of ${total} things ticked · from the recipes on your plan this week` : "Plan a recipe and what it needs shows here."}>
      <div className={css.shop} data-shopping-list>
        {total > 0 && <i className={css.bar} role="img" aria-label={`${done} of ${total} ticked`}><i style={{ width: `${(done / total) * 100}%` }} /></i>}
        {groups.map(({ r, ds }) => (
          <section key={r.id} className={css.shopGroup}>
            <h4>{r.name}<span>{ds.map((d) => (d === today() ? "Today" : WEEKDAY(d))).join(", ")}</span></h4>
            <ul>
              {r.ing.map((i) => {
                const k = `${r.id}|${i}`;
                return (
                  <li key={k}>
                    <label className={css.shopItem} data-got={got.includes(k) || undefined}>
                      <input type="checkbox" checked={got.includes(k)} onChange={() => toggle(k)} />
                      <span>{i}</span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
        {loose.length > 0 && (
          <section className={css.shopGroup}>
            <h4>Also on your plan<span>no recipe</span></h4>
            <p className={css.loose}>{loose.join(" · ")}</p>
          </section>
        )}
        {!total && !loose.length && <p className={css.loose}>Your plan for the week is empty.</p>}
      </div>
    </Sheet>
  );
}
