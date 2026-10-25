"use client";

import { useState, useSyncExternalStore } from "react";
import { GAMES } from "@/components/ux/games/catalog";
import Link from "next/link";

import { Btn } from "@/components/ux/kit";
import { useAuth } from "@/context/AuthContext";
import {
  addDays, daysBetween, fmtDay, sleepHours, today, type DaySummary, type Entry, type HealthKind,
} from "@/lib/health-api";
import { SECTION_ART, TIPS } from "./fitness-data";
import {
  Chips, Cols, Empty, HUE, HealthFrame, I, Metric, MetricGrid, Panel, SECTIONS, lastDays, sumOn, useEntries, useHealthSettings,
  type Hue,
} from "./kit";
import { MealForm, SleepForm, WaterButtons, WorkoutForm, fmtTime } from "./QuickForms";

/**
 * The Health home — her day at a glance, after the approved design: a
 * wellness overview, one-tap quick actions, today's journey, the week, what
 * is coming up, and every section of Health & Wellness as a big picture.
 *
 * Every number is read from what she logged (the Health store and its
 * `/summary`); nothing here is invented. Widgets she hides are kept in her
 * health settings (`dashHidden`), so the choice follows her to any phone.
 */

const TABS = [{ id: "main", label: "Overview" }, { id: "activity", label: "Activity history" }];

const WIDGETS = [
  ["overview", "Today's wellness overview"], ["quick", "Quick actions"], ["journey", "Today's journey"],
  ["weekly", "Weekly progress"], ["recs", "Suggestions for you"], ["upcoming", "Upcoming"],
  ["games", "Games & Stress Relief"], ["consult", "Mentor and doctor shortcuts"], ["recent", "Recent activity"],
  ["tips", "Today's tips"], ["sections", "All of Health & Wellness"],
] as const;

const GLASS = 250;

/** Kinds the history tab and "Recent activity" read. */
const LOGGED: HealthKind[] = ["water", "workout", "meal", "sleep", "journal", "activity", "symptom", "pregsym", "kick", "measure", "game", "reminder", "document"];

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
  reminder: { label: "Reminder", icon: "CalendarClock", hue: "amber", href: "/app/health/reminders" },
  document: { label: "Document", icon: "FileText", hue: "blue", href: "/app/health/records?tab=records" },
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

export function HomeDashboard() {
  const { user } = useAuth();
  const onClient = useOnClient();
  const { settings, save } = useHealthSettings();
  const t = today();
  const first = (settings.name || user?.full_name || "").split(" ")[0];
  const day = useEntries(["water", "workout", "meal", "sleep", "activity", "game"], { from: addDays(t, -6) });
  const recent = useEntries(LOGGED, { from: addDays(t, -13) });
  const reminders = useEntries("reminder");
  const [quick, setQuick] = useState("");
  const [customize, setCustomize] = useState(false);

  const hidden = (k: string) => settings.dashHidden.includes(k);
  const toggleWidget = (k: string) =>
    save({ dashHidden: hidden(k) ? settings.dashHidden.filter((x) => x !== k) : [...settings.dashHidden, k] });

  const rows = day.rows;
  const waterMl = sumOn(rows, t, "ml");
  const goalMl = settings.waterGoal * GLASS;
  const workoutMins = rows.filter((r) => r.kind === "workout" && r.date === t).reduce((a, r) => a + ((r.data as { minutes: number }).minutes || 0), 0);
  const steps = sumOn(rows, t, "steps");
  const sleepToday = rows.find((r) => r.kind === "sleep" && r.date === t) as Entry<"sleep"> | undefined;
  const sleepH = sleepToday ? sleepHours(sleepToday.data.bed, sleepToday.data.wake) : 0;
  const meals = rows.filter((r) => r.kind === "meal" && r.date === t).length;
  const calmToday = rows.some((r) => (r.kind === "activity" || r.kind === "game") && r.date === t);

  type Quick = "water" | "meal" | "workout" | "sleep";
  const save2 = async <K extends Quick>(kind: K, data: Entry<K>["data"], date: string, msg: string) => {
    const made = await day.add(kind, data, date, msg);
    if (made) { recent.reload(); if (kind !== "water") setQuick(""); }
    return made;
  };

  const upcoming = reminders.rows
    .map((r) => ({ r, on: nextOccurrence(r) }))
    .filter((x) => x.on)
    .sort((a, b) => (a.on + (a.r.data.time || "")).localeCompare(b.on + (b.r.data.time || "")))
    .slice(0, 3);
  const dueToday = upcoming.filter((x) => x.on === t);

  const journey: { done: boolean; label: string; sub?: string; action: React.ReactNode; undoable?: boolean }[] = [
    { done: !!sleepToday, label: "Log last night's sleep", action: <Btn size="sm" variant="soft" onClick={() => setQuick("sleep")}>Add</Btn> },
    { done: waterMl >= goalMl, label: `Drink water: ${(waterMl / 1000).toFixed(1)} of ${(goalMl / 1000).toFixed(1)} L`, action: <Btn size="sm" variant="soft" onClick={() => setQuick("water")}>Log</Btn> },
    { done: workoutMins >= settings.activeGoal, label: `Move for ${settings.activeGoal} minutes`, sub: workoutMins ? `${workoutMins} min so far` : "", action: <Btn size="sm" variant="soft" href="/app/health/fitness?tab=workouts">Start</Btn> },
    { done: meals >= 3, label: "Log your meals", sub: meals ? `${meals} logged` : "", action: <Btn size="sm" variant="soft" onClick={() => setQuick("meal")}>Log</Btn> },
    { done: calmToday, label: "Take a calm break", action: <Btn size="sm" variant="soft" href="/app/health/games">Play</Btn> },
    ...dueToday.map(({ r }) => ({
      done: (r.data.done || []).includes(t), undoable: true, label: r.data.title, sub: [r.data.time ? fmtTime(r.data.time) : "", r.data.category].filter(Boolean).join(" · "),
      action: <Btn size="sm" variant="soft" onClick={() => reminders.edit(r.id, { data: { done: (r.data.done || []).includes(t) ? (r.data.done || []).filter((x) => x !== t) : [...(r.data.done || []), t] } }, "Updated")}>
        {(r.data.done || []).includes(t) ? "Undo" : "Done"}
      </Btn>,
    })),
  ];
  const doneCount = journey.filter((j) => j.done).length;

  const recs: { icon: string; hue: Hue; text: string; action: React.ReactNode }[] = [];
  const h = new Date().getHours();
  if (waterMl < goalMl * Math.min(1, (h - 7) / 12) && h >= 10) recs.push({ icon: "Droplets", hue: "blue", text: "You're behind on water. A glass now helps.", action: <Btn size="sm" variant="soft" onClick={() => setQuick("water")}>Log</Btn> });
  if (!workoutMins && h >= 9) recs.push({ icon: "Dumbbell", hue: "orange", text: "No movement logged yet. Try the 8-minute Desk Stretch Break.", action: <Btn size="sm" variant="soft" href="/app/health/fitness?tab=workouts">Start</Btn> });
  if (sleepToday && sleepH < settings.sleepGoal - 1) recs.push({ icon: "Moon", hue: "violet", text: `You slept ${sleepH} h. An early night tonight could help.`, action: <Btn size="sm" variant="soft" href="/app/health/sleep?tab=bedtime">Bedtime</Btn> });
  if (!calmToday && h >= 14) recs.push({ icon: "Flower2", hue: "blue", text: "Take a two-minute breathing break.", action: <Btn size="sm" variant="soft" href="/app/health/games/breathe">Breathe</Btn> });
  if (!meals && h >= 11) recs.push({ icon: "Apple", hue: "green", text: "Log what you ate to see your nutrition.", action: <Btn size="sm" variant="soft" onClick={() => setQuick("meal")}>Log</Btn> });
  if (!recs.length) recs.push({ icon: "Sparkles", hue: "pink", text: "You're on track today. Keep going!", action: null });

  const QUICK: { id: string; label: string; icon: string; hue: Hue; href?: string }[] = [
    { id: "water", label: "Log water", icon: "Droplets", hue: "blue" },
    { id: "meal", label: "Log meal", icon: "Apple", hue: "green" },
    { id: "workout", label: "Log workout", icon: "Dumbbell", hue: "orange" },
    { id: "sleep", label: "Add sleep", icon: "Moon", hue: "violet" },
    { id: "mood", label: "Track mood", icon: "Smile", hue: "blue", href: "/app/health/mind?tab=mood" },
    { id: "period", label: "Period", icon: "Droplet", hue: "pink", href: "/app/health/fertility" },
    { id: "game", label: "Start game", icon: "Gamepad2", hue: "amber", href: "/app/health/games" },
    { id: "reminder", label: "Add reminder", icon: "CalendarClock", hue: "amber", href: "/app/health/reminders?tab=all" },
    { id: "doctor", label: "Book doctor", icon: "Stethoscope", hue: "green", href: "/app/health/doctors" },
    { id: "mentor", label: "Talk to mentor", icon: "Users", hue: "orange", href: "/app/health/mentors" },
  ];

  const sheet = quick && (
    <Panel title={{ water: "Log water", meal: "Log a meal", workout: "Log a workout", sleep: "Add last night's sleep" }[quick]}
           action={<Btn size="sm" variant="ghost" icon="X" onClick={() => setQuick("")}>Close</Btn>} id="quick-sheet">
      {quick === "water" && <WaterButtons totalMl={waterMl} goalMl={goalMl} onAdd={(ml) => save2("water", { ml }, t, `${ml} ml added`)} />}
      {quick === "meal" && <MealForm onSave={(d, date) => save2("meal", d, date, "Meal saved")} />}
      {quick === "workout" && <WorkoutForm onSave={(d, date) => save2("workout", d, date, "Workout saved")} />}
      {quick === "sleep" && <SleepForm onSave={(d, date) => save2("sleep", d, date, "Sleep saved")} />}
    </Panel>
  );

  // The week, added up from the entries already loaded — the same sums as
  // GET /me/health/summary, without a second request that could disagree.
  const days7: DaySummary[] = lastDays(7).map(({ day: d }) => {
    const on = rows.filter((r) => r.date === d);
    const sl = on.find((r) => r.kind === "sleep") as Entry<"sleep"> | undefined;
    return {
      date: d, water_ml: sumOn(on, d, "ml"),
      active_minutes: on.filter((r) => r.kind === "workout").reduce((a, r) => a + ((r.data as { minutes: number }).minutes || 0), 0),
      steps: sumOn(on, d, "steps"), kcal: sumOn(on, d, "kcal"), sleep_hours: sl ? sleepHours(sl.data.bed, sl.data.wake) : 0,
      workouts: on.filter((r) => r.kind === "workout").length, meals: on.filter((r) => r.kind === "meal").length,
      calm_minutes: on.filter((r) => r.kind === "activity").reduce((a, r) => a + ((r.data as { minutes: number }).minutes || 0), 0),
    };
  });
  const calmDays = new Set(rows.filter((r) => r.kind === "activity" || r.kind === "game").map((r) => r.date));
  const weekRows: [string, (d: DaySummary) => boolean, Hue][] = [
    ["Water goal", (d) => d.water_ml >= goalMl, "blue"],
    [`Active ${settings.activeGoal} min`, (d) => d.active_minutes >= settings.activeGoal, "orange"],
    ["Sleep goal", (d) => d.sleep_hours >= settings.sleepGoal - 0.5, "violet"],
    ["Calm break", (d) => calmDays.has(d.date), "amber"],
  ];
  const met = weekRows.reduce((a, [, fn]) => a + days7.filter(fn).length, 0);

  return (
    <HealthFrame active="/app/wellness" hue="pink" icon="Heart" eyebrow="WomSakhi wellness" tabs={TABS}
                 title={`${onClient ? greet() : "Welcome"}${first ? `, ${first}` : ""}`}
                 sub="A healthier, stronger, happier you. Here's your day at a glance."
                 art="/ux/wellness/wellness-hero-v2.webp"
                 actions={<>
                   <Btn icon="Plus" onClick={() => setQuick("water")}>Log water</Btn>
                   <Btn variant="outline" icon="SlidersHorizontal" onClick={() => setCustomize(!customize)}>Customize</Btn>
                 </>}>
      {(tab) => tab === "activity" ? <History /> : (
        <>
          {customize && (
            <Panel title="Customize your dashboard" sub="Choose what to show. Your choice is saved to your account." hue="pink" tint
                   action={<Btn size="sm" onClick={() => setCustomize(false)}>Done</Btn>}>
              <div className="flex flex-wrap gap-2" data-customize>
                {WIDGETS.map(([k, l]) => (
                  <button key={k} type="button" aria-pressed={!hidden(k)} onClick={() => toggleWidget(k)}
                          className="ux-press inline-flex min-h-[40px] items-center gap-1.5 rounded-full border-[1.5px] px-3.5 text-[13.5px] font-bold"
                          style={!hidden(k) ? { borderColor: HUE.pink.ink, background: "var(--ux-surface)", color: "var(--ux-ink)" } : { borderColor: "var(--ux-line-strong)", color: "var(--ux-muted)" }}>
                    <I name={hidden(k) ? "EyeOff" : "Eye"} className="h-4 w-4" />{l}
                  </button>
                ))}
              </div>
            </Panel>
          )}

          {!hidden("overview") && (
            <Panel title="Today's wellness overview" sub={onClient ? new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" }) : ""}>
              <MetricGrid>
                <Metric hue="blue" icon="Droplets" label="Water" value={Math.floor(waterMl / GLASS)} unit={`/ ${settings.waterGoal} glasses`} pct={(waterMl / goalMl) * 100} href="/app/health/nutrition" />
                <Metric hue="orange" icon="Timer" label="Active" value={workoutMins} unit={`/ ${settings.activeGoal} min`} pct={(workoutMins / settings.activeGoal) * 100} href="/app/health/fitness" />
                <Metric hue="orange" icon="Footprints" label="Steps" value={steps.toLocaleString()} unit={`/ ${settings.stepsGoal.toLocaleString()}`} pct={(steps / settings.stepsGoal) * 100} href="/app/health/fitness?tab=progress" />
                <Metric hue="violet" icon="Moon" label="Sleep" value={sleepToday ? sleepH : "—"} unit={sleepToday ? `/ ${settings.sleepGoal} h` : ""} sub={sleepToday ? sleepToday.data.quality : "Not logged"} pct={sleepToday ? (sleepH / settings.sleepGoal) * 100 : undefined} href="/app/health/sleep" />
                <Metric hue="green" icon="Apple" label="Meals" value={meals} unit="logged" href="/app/health/nutrition" />
                <Metric hue="blue" icon="Smile" label="Mood" value="Check in" sub="How are you feeling?" href="/app/health/mind?tab=mood" />
              </MetricGrid>
            </Panel>
          )}

          {!hidden("quick") && (
            <section aria-label="Quick actions" className="grid gap-2.5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(104px, 1fr))" }} data-quick-actions>
              {QUICK.map((q) => {
                const inner = (
                  <>
                    <span className="grid h-11 w-11 place-items-center rounded-[13px]" style={{ background: HUE[q.hue].tint, color: HUE[q.hue].ink }}>
                      <I name={q.icon} className="h-5 w-5" />
                    </span>
                    <span>{q.label}</span>
                  </>
                );
                const cls = "ux-card ux-press ux-hov flex flex-col items-center gap-2 px-1.5 py-3.5 text-center text-[13px] font-bold";
                return q.href
                  ? <Link key={q.id} href={q.href} className={cls} style={{ color: "var(--ux-ink)" }}>{inner}</Link>
                  : <button key={q.id} type="button" aria-expanded={quick === q.id} aria-controls="quick-sheet" data-quick={q.id}
                            onClick={() => setQuick(quick === q.id ? "" : q.id)} className={cls}
                            style={{ color: "var(--ux-ink)", ...(quick === q.id ? { outline: `2px solid ${HUE[q.hue].ink}` } : {}) }}>{inner}</button>;
              })}
            </section>
          )}
          {sheet}

          <Cols
            main={<>
              {!hidden("journey") && (
                <Panel title="Today's journey" sub={`${doneCount} of ${journey.length} done today. Small steps add up.`}>
                  <div className="h-[7px] overflow-hidden rounded-full" style={{ background: HUE.pink.tint }}>
                    <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${(doneCount / journey.length) * 100}%`, background: HUE.pink.ink }} />
                  </div>
                  <ul className="flex flex-col" data-journey>
                    {journey.map((j, k) => (
                      <li key={k} className="flex items-center gap-3 border-t py-2.5 first:border-t-0" style={{ borderColor: "var(--ux-line)" }}>
                        <span className="grid h-[26px] w-[26px] shrink-0 place-items-center rounded-full border-2"
                              style={j.done ? { background: "var(--ux-green-ink)", borderColor: "var(--ux-green-ink)", color: "#fff" } : { borderColor: "var(--ux-line-strong)" }}>
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
              {!hidden("weekly") && (
                <Panel title="Weekly progress" sub={`${met} of ${weekRows.length * 7} daily goals met in the last 7 days.`}>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[420px] border-separate" style={{ borderSpacing: 5 }} data-weekly>
                      <thead>
                        <tr><th className="sr-only">Goal</th>{days7.map((d) => (
                          <th key={d.date} scope="col" className="text-center text-xs font-bold" style={{ color: "var(--ux-muted)" }}>
                            {new Date(`${d.date}T00:00:00`).toLocaleDateString("en-IN", { weekday: "short" }).slice(0, 2)}
                          </th>
                        ))}</tr>
                      </thead>
                      <tbody>
                        {weekRows.map(([l, fn, hue]) => (
                          <tr key={l}>
                            <th scope="row" className="whitespace-nowrap pe-2 text-start text-xs font-bold" style={{ color: "var(--ux-muted)" }}>{l}</th>
                            {days7.map((d) => (
                              <td key={d.date} aria-label={`${l}, ${fmtDay(d.date)}: ${fn(d) ? "met" : "not met"}`}
                                  className="h-[30px] rounded-[8px]" style={{ background: fn(d) ? HUE[hue].ink : "var(--ux-surface-2)" }} />
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Panel>
              )}
              {!hidden("recent") && (
                <Panel title="Recent activity" action={<Btn size="sm" variant="ghost" iconEnd="ArrowRight" href="/app/wellness?tab=activity">All</Btn>}>
                  {recent.rows.length ? (
                    <ul className="flex flex-col" data-recent>
                      {[...recent.rows].sort((a, b) => b.updated_at.localeCompare(a.updated_at)).slice(0, 6).map((e) => {
                        const k = KIND_INFO[e.kind];
                        return (
                          <li key={e.id} className="flex items-center gap-3 border-t py-2.5 first:border-t-0" style={{ borderColor: "var(--ux-line)" }}>
                            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px]" style={{ background: HUE[k.hue].tint, color: HUE[k.hue].ink }}>
                              <I name={k.icon} className="h-[18px] w-[18px]" />
                            </span>
                            <Link href={k.href} className="min-w-0 flex-1 truncate text-sm font-semibold" style={{ color: "var(--ux-ink)" }}>{k.label}: {describe(e)}</Link>
                            <span className="shrink-0 text-xs" style={{ color: "var(--ux-muted)" }}>{e.date === t ? "Today" : fmtDay(e.date)}</span>
                          </li>
                        );
                      })}
                    </ul>
                  ) : <p className="text-sm" style={{ color: "var(--ux-muted)" }}>Your latest entries will show here. Try a quick action above.</p>}
                </Panel>
              )}
            </>}
            side={<>
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
              {!hidden("upcoming") && (
                <Panel title="Upcoming" action={<Btn size="sm" variant="ghost" iconEnd="ArrowRight" href="/app/health/reminders">See all</Btn>}>
                  {upcoming.length ? (
                    <ul className="flex flex-col gap-3" data-upcoming>
                      {upcoming.map(({ r, on }) => (
                        <li key={r.id} className="flex items-center gap-3">
                          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px]" style={{ background: HUE.amber.tint, color: HUE.amber.ink }}>
                            <I name="CalendarClock" className="h-[18px] w-[18px]" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <b className="block truncate text-sm" style={{ color: "var(--ux-ink)" }}>{r.data.title}</b>
                            <span className="text-xs" style={{ color: "var(--ux-muted)" }}>
                              {r.data.category} · {on === t ? "Today" : fmtDay(on, { weekday: "short", day: "numeric", month: "short" })}{r.data.time ? ` at ${fmtTime(r.data.time)}` : ""}
                            </span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : <p className="text-sm" style={{ color: "var(--ux-muted)" }}>Nothing scheduled. <Link href="/app/health/reminders?tab=all" className="font-bold" style={{ color: "var(--ux-brand)" }}>Add a reminder</Link></p>}
                </Panel>
              )}
              {!hidden("games") && (
                <Panel hue="amber" tint>
                  <div className="flex items-center gap-3">
                    <span className="grid h-12 w-12 shrink-0 place-items-center rounded-[14px]" style={{ background: "var(--ux-surface)", color: HUE.amber.ink }}>
                      <I name="Gamepad2" className="h-6 w-6" />
                    </span>
                    <div className="min-w-0">
                      <b className="block text-base" style={{ color: "var(--ux-ink)" }}>Games &amp; Stress Relief</b>
                      <span className="text-sm" style={{ color: "var(--ux-ink-2)" }}>Calming 1–5 minute breaks. One tap to start.</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Btn size="sm" icon="Wind" href="/app/health/games/breathe">Breathe</Btn>
                    <Btn size="sm" variant="outline" href="/app/health/games">All games</Btn>
                  </div>
                </Panel>
              )}
              {!hidden("consult") && (
                <Panel title="Talk to someone">
                  <div className="grid grid-cols-2 gap-2.5">
                    {[
                      { href: "/app/health/mentors", icon: "Users", hue: "orange" as Hue, t: "Mentor Connect", d: "Career, money, family and more" },
                      { href: "/app/health/doctors", icon: "Stethoscope", hue: "green" as Hue, t: "See a doctor", d: "Online or in-person" },
                    ].map((c) => (
                      <Link key={c.href} href={c.href} className="ux-card ux-hov ux-press flex flex-col gap-2 p-3">
                        <span className="grid h-10 w-10 place-items-center rounded-[11px]" style={{ background: HUE[c.hue].tint, color: HUE[c.hue].ink }}>
                          <I name={c.icon} className="h-5 w-5" />
                        </span>
                        <b className="text-sm" style={{ color: "var(--ux-ink)" }}>{c.t}</b>
                        <span className="text-xs" style={{ color: "var(--ux-muted)" }}>{c.d}</span>
                      </Link>
                    ))}
                  </div>
                </Panel>
              )}
              {!hidden("tips") && (
                <Panel title="Today's tips">
                  <ul className="flex flex-col gap-3">
                    {(() => { const n = Math.floor(Date.now() / 86_400_000) % TIPS.length; return [TIPS[n], TIPS[(n + 5) % TIPS.length]]; })().map((tip) => (
                      <li key={tip} className="flex items-start gap-3 text-sm" style={{ color: "var(--ux-ink)" }}>
                        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[9px]" style={{ background: HUE.green.tint, color: HUE.green.ink }}>
                          <I name="Leaf" className="h-4 w-4" />
                        </span>
                        <span className="pt-1">{tip}</span>
                      </li>
                    ))}
                  </ul>
                </Panel>
              )}
            </>}
          />

          {!hidden("sections") && (
            <Panel title="Everything in Health & Wellness" sub="Tap a section to open it.">
              <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))" }} data-sections>
                {SECTIONS.filter((s) => s.id !== "home").map((s) => (
                  <Link key={s.id} href={s.href} className="ux-card ux-hov ux-press group relative block overflow-hidden" style={{ padding: 0 }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={SECTION_ART[s.id]} alt="" loading="lazy" className="aspect-[16/10] w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]" />
                    <span className="flex items-center gap-2.5 p-3">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px]" style={{ background: HUE[s.hue].tint, color: HUE[s.hue].ink }}>
                        <I name={s.icon} className="h-[18px] w-[18px]" />
                      </span>
                      <span className="min-w-0">
                        <b className="block truncate text-sm" style={{ color: "var(--ux-ink)" }}>{s.label}</b>
                        <span className="block truncate text-xs" style={{ color: "var(--ux-muted)" }}>{s.note}</span>
                      </span>
                    </span>
                  </Link>
                ))}
              </div>
            </Panel>
          )}
        </>
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
        <Chips hue="pink" label="What" value={group} onChange={setGroup} options={GROUPS.map((x) => ({ value: x.id, label: x.label }))} />
        <Chips hue="pink" label="When" value={range} onChange={setRange}
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
                          <Btn size="sm" variant="ghost" icon="Pencil" href={k.href} ariaLabel={`Edit in ${k.label}`}>Edit</Btn>
                          <Btn size="sm" variant="ghost" icon="Trash2" ariaLabel={`Delete ${k.label}`} onClick={() => remove(e.id)}>Delete</Btn>
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
