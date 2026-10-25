"use client";

import { useState } from "react";

import { Btn } from "@/components/ux/kit";
import { Stepper } from "@/components/ux/kit/form";
import {
  BarChart, Chips, Cols, Disclaimer, Empty, HUE, HealthFrame, I, Metric, MetricGrid, Panel, lastDays, sumOn,
  useEntries, useHealthSettings,
} from "@/components/ux/health/kit";
import {
  CHALLENGES, PLANS, ROUTINES, challengeState, joinedOn, routineMinutes, streak, type Routine,
} from "@/components/ux/health/fitness-data";
import { WorkoutForm } from "@/components/ux/health/QuickForms";
import { WorkoutPlayer } from "@/components/ux/health/WorkoutPlayer";
import { addDays, fmtDay, today, type Entry } from "@/lib/health-api";

/**
 * Fitness — guided routines, a manual log, four-week plans, progress and
 * 7-day challenges. Everything she does lands as a `workout` entry in the
 * Health store; plans and challenges are read off those entries, never kept
 * as a separate score.
 */

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "workouts", label: "Workouts" },
  { id: "plans", label: "Plans" },
  { id: "progress", label: "Progress" },
  { id: "challenges", label: "Challenges" },
];

type W = Entry<"workout">;

export default function FitnessPage() {
  const t = today();
  const { rows, loading, add, edit, remove } = useEntries("workout", { from: addDays(t, -90) });
  const { settings, save } = useHealthSettings();
  const [playing, setPlaying] = useState<Routine | null>(null);

  const startRoutine = (r: Routine) => setPlaying(r);
  const logWorkout = (data: W["data"], date: string) => add("workout", data, date, "Workout saved");

  return (
    <HealthFrame active="/app/health/fitness" hue="orange" icon="Dumbbell" eyebrow="Fitness"
                 title="Move your body" sub="Move your body, feel stronger and more confident." tabs={TABS}
                 art="/ux/wellness/morning-yoga-v2.webp"
                 actions={<>
                   <Btn icon="Play" href="/app/health/fitness?tab=workouts">Start a workout</Btn>
                   <Btn variant="outline" icon="Plus" href="/app/health/fitness?tab=workouts#log">Log workout</Btn>
                 </>}>
      {(tab) => {
        const player = playing && (
          <WorkoutPlayer routine={playing} onClose={() => setPlaying(null)} onFinish={logWorkout} />
        );
        if (tab === "workouts") return (
          <>
            {player}
            <Cols
              main={<>
                <RoutineGrid onStart={startRoutine} />
                <Panel title="Workout videos" sub="Follow along with a demo"
                       action={<Btn variant="ghost" size="sm" iconEnd="ArrowRight" href="/app/health/videos?cat=Workout">All videos</Btn>}>
                  <p className="text-sm" style={{ color: "var(--ux-muted)" }}>Yoga, strength and stretching videos are in the Videos section.</p>
                </Panel>
                <RecentList rows={rows} loading={loading} onEdit={edit} onDelete={remove} />
              </>}
              side={<Panel title="Log a workout" sub="Did something else? Add it here." id="log">
                <WorkoutForm onSave={logWorkout} />
              </Panel>}
            />
          </>
        );
        if (tab === "plans") return (
          <>
            {player}
            <Plans rows={rows} current={settings.fitnessPlan} onPick={(id) => save({ fitnessPlan: id }, id ? "Plan started" : "Plan stopped")} onStart={startRoutine} />
            <Panel title="Your daily goals" sub="Used for your rings, charts and challenges.">
              <div className="grid gap-4 sm:grid-cols-2">
                <GoalPicker label="Active minutes a day" value={settings.activeGoal} options={[15, 20, 30, 45, 60]} unit="min"
                            onPick={(v) => save({ activeGoal: v }, "Goal updated")} />
                <GoalPicker label="Steps a day" value={settings.stepsGoal} options={[3000, 5000, 6000, 8000, 10000]} unit=""
                            onPick={(v) => save({ stepsGoal: v }, "Goal updated")} />
              </div>
            </Panel>
          </>
        );
        if (tab === "progress") return <Progress rows={rows} stepsGoal={settings.stepsGoal} activeGoal={settings.activeGoal} onDelete={remove} onEdit={edit} />;
        if (tab === "challenges") return (
          <Challenges rows={rows} joined={settings.challenges} stepsGoal={settings.stepsGoal}
                      onJoin={(id) => save({ challenges: [...settings.challenges.filter((x) => !x.startsWith(`${id}:`)), `${id}:${t}`].slice(-10) }, "Challenge joined")}
                      onLeave={(id) => save({ challenges: settings.challenges.filter((x) => !x.startsWith(`${id}:`)) }, "Challenge left")} />
        );
        return <Overview rows={rows} loading={loading} activeGoal={settings.activeGoal} stepsGoal={settings.stepsGoal}
                         planId={settings.fitnessPlan} player={player} onStart={startRoutine} />;
      }}
    </HealthFrame>
  );
}

/* ── overview ───────────────────────────────────────────────────────── */

function Overview({ rows, loading, activeGoal, stepsGoal, planId, player, onStart }: {
  rows: W[]; loading: boolean; activeGoal: number; stepsGoal: number; planId: string; player: React.ReactNode; onStart: (r: Routine) => void;
}) {
  const t = today();
  const mins = sumOn(rows, t, "minutes"), steps = sumOn(rows, t, "steps");
  const week = lastDays(7);
  const weekMins = week.reduce((a, d) => a + sumOn(rows, d.day, "minutes"), 0);
  const plan = PLANS.find((p) => p.id === planId);
  const dow = (new Date().getDay() + 6) % 7;
  const todays = plan && plan.days[dow] ? ROUTINES.find((r) => r.id === plan.days[dow]) : null;
  return (
    <>
      {player}
      <MetricGrid>
        <Metric hue="orange" icon="Timer" label="Active today" value={mins} unit={`/ ${activeGoal} min`} pct={(mins / activeGoal) * 100} />
        <Metric hue="orange" icon="Footprints" label="Steps today" value={steps.toLocaleString()} unit={`/ ${stepsGoal.toLocaleString()}`} pct={(steps / stepsGoal) * 100} />
        <Metric hue="orange" icon="CalendarDays" label="This week" value={weekMins} unit="min" sub="WHO suggests 150 a week" pct={(weekMins / 150) * 100} />
        <Metric hue="orange" icon="Flame" label="Streak" value={streak(rows, t)} unit="days" sub="Days in a row you moved" />
      </MetricGrid>
      <Cols
        main={<>
          {todays && (
            <Panel title="Today in your plan" sub={plan!.name} hue="orange" tint>
              <RoutineRow r={todays} onStart={onStart} />
            </Panel>
          )}
          <Panel title="Last 7 days" sub="Minutes you moved each day">
            <BarChart hue="orange" unit=" min" goal={activeGoal}
                      data={week.map((d) => ({ label: d.label, value: sumOn(rows, d.day, "minutes") }))} />
          </Panel>
          <RecentList rows={rows.slice(0, 5)} loading={loading} />
        </>}
        side={<Panel title="Start a workout" sub="Guided, step by step">
          {ROUTINES.slice(0, 4).map((r) => <RoutineRow key={r.id} r={r} onStart={onStart} />)}
          <Btn variant="ghost" size="sm" iconEnd="ArrowRight" href="/app/health/fitness?tab=workouts">All routines</Btn>
        </Panel>}
      />
      <Disclaimer>Start slowly and stop if anything hurts. If you are pregnant, recovering from illness or have a health condition, check with a doctor first.</Disclaimer>
    </>
  );
}

function RoutineRow({ r, onStart }: { r: Routine; onStart: (r: Routine) => void }) {
  return (
    <div className="flex items-center gap-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={r.image} alt="" className="h-14 w-14 shrink-0 rounded-[12px] object-cover" />
      <div className="min-w-0 flex-1">
        <b className="block truncate text-sm" style={{ color: "var(--ux-ink)" }}>{r.name}</b>
        <span className="text-xs" style={{ color: "var(--ux-muted)" }}>{routineMinutes(r)} min · {r.level}</span>
      </div>
      <Btn size="sm" variant="soft" icon="Play" onClick={() => onStart(r)} ariaLabel={`Start ${r.name}`}>Start</Btn>
    </div>
  );
}

function RoutineGrid({ onStart }: { onStart: (r: Routine) => void }) {
  return (
    <Panel title="Guided routines" sub="Tap Start and follow along. No equipment needed.">
      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}>
        {ROUTINES.map((r) => (
          <article key={r.id} className="ux-card ux-hov flex flex-col overflow-hidden" style={{ padding: 0 }} data-routine={r.id}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={r.image} alt="" className="aspect-[16/10] w-full object-cover" />
            <div className="flex flex-1 flex-col gap-2 p-3.5">
              <div className="flex flex-wrap gap-1.5">
                <Tag>{r.cat}</Tag><Tag>{r.level}</Tag><Tag>{routineMinutes(r)} min</Tag>
              </div>
              <b className="text-[15px]" style={{ color: "var(--ux-ink)" }}>{r.name}</b>
              <p className="text-[13px]" style={{ color: "var(--ux-muted)" }}>{r.desc}</p>
              <div className="mt-auto pt-1"><Btn size="sm" icon="Play" onClick={() => onStart(r)}>Start</Btn></div>
            </div>
          </article>
        ))}
      </div>
    </Panel>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full px-2.5 py-0.5 text-2xs font-bold" style={{ background: HUE.orange.tint, color: HUE.orange.ink }}>{children}</span>;
}

/* ── list with inline edit ──────────────────────────────────────────── */

function RecentList({ rows, loading, onEdit, onDelete }: {
  rows: W[]; loading: boolean;
  onEdit?: (id: string, p: { data?: Partial<W["data"]> }, msg?: string) => Promise<unknown>;
  onDelete?: (id: string) => Promise<unknown>;
}) {
  const [editing, setEditing] = useState("");
  const [mins, setMins] = useState("");
  return (
    <Panel title="Recent workouts" action={rows.length ? <Btn variant="ghost" size="sm" iconEnd="ArrowRight" href="/app/health/fitness?tab=progress">History</Btn> : undefined}>
      {loading ? <p className="text-sm" style={{ color: "var(--ux-muted)" }}>Loading…</p>
        : !rows.length ? <Empty icon="Dumbbell" title="No workouts yet" body="Start a guided routine or log a walk. Every minute counts." />
        : (
          <ul className="flex flex-col" data-workout-list>
            {rows.slice(0, 12).map((w) => (
              <li key={w.id} className="flex flex-wrap items-center gap-3 border-t py-2.5 first:border-t-0" style={{ borderColor: "var(--ux-line)" }}>
                <span className="w-[64px] shrink-0 text-xs font-bold tabular-nums" style={{ color: "var(--ux-muted)" }}>{fmtDay(w.date)}</span>
                <span className="min-w-0 flex-1">
                  <b className="block text-sm" style={{ color: "var(--ux-ink)" }}>{w.data.activity} · {w.data.minutes} min</b>
                  <span className="text-xs" style={{ color: "var(--ux-muted)" }}>
                    {[w.data.routine ? ROUTINES.find((r) => r.id === w.data.routine)?.name : "", w.data.steps ? `${w.data.steps.toLocaleString()} steps` : "", w.data.intensity].filter(Boolean).join(" · ")}
                  </span>
                </span>
                {onEdit && editing === w.id ? (
                  <span className="flex flex-wrap items-center gap-2">
                    <Stepper value={mins} onChange={setMins} label="Minutes" min={1} />
                    <Btn size="sm" onClick={async () => { await onEdit(w.id, { data: { minutes: Number(mins) || 1 } }, "Workout updated"); setEditing(""); }}>Save</Btn>
                    <Btn size="sm" variant="ghost" onClick={() => setEditing("")}>Cancel</Btn>
                  </span>
                ) : (
                  <span className="flex gap-1.5">
                    {onEdit && <Btn size="sm" variant="ghost" icon="Pencil" ariaLabel="Edit minutes" onClick={() => { setEditing(w.id); setMins(String(w.data.minutes)); }}>Edit</Btn>}
                    {onDelete && <Btn size="sm" variant="ghost" icon="Trash2" ariaLabel="Delete workout" onClick={() => onDelete(w.id)}>Delete</Btn>}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
    </Panel>
  );
}

/* ── plans ──────────────────────────────────────────────────────────── */

const WEEK = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function Plans({ rows, current, onPick, onStart }: { rows: W[]; current: string; onPick: (id: string) => void; onStart: (r: Routine) => void }) {
  const plan = PLANS.find((p) => p.id === current);
  const t = today();
  const monday = addDays(t, -((new Date().getDay() + 6) % 7));
  return (
    <>
      {plan && (
        <Panel title={`This week · ${plan.name}`} sub="Ticks fill in from the workouts you log." hue="orange" tint
               action={<Btn size="sm" variant="ghost" onClick={() => onPick("")}>Stop plan</Btn>}>
          <div className="grid grid-cols-7 gap-1.5 sm:gap-2" data-plan-week>
            {WEEK.map((d, k) => {
              const day = addDays(monday, k);
              const r = ROUTINES.find((x) => x.id === plan.days[k]);
              // A rest day is never "done": it is rest. A session day is done by
              // that routine, or by any workout of the same activity.
              const did = !!r && rows.some((w) => w.date === day && (w.data.activity === r.activity || w.data.routine === r.id));
              const isToday = day === t;
              return (
                <div key={d} className="flex min-w-0 flex-col items-center gap-1 rounded-[12px] p-1.5 text-center sm:p-2"
                     style={isToday
                       ? { background: HUE.orange.tint, color: "var(--ux-ink)", boxShadow: `inset 0 0 0 2px ${HUE.orange.ink}` }
                       : { background: "var(--ux-surface)", color: "var(--ux-ink)" }}>
                  <span className="text-2xs font-bold">{d}</span>
                  <span className="grid h-7 w-7 place-items-center rounded-full"
                        style={{ background: did ? "var(--ux-green-ink)" : r ? "var(--ux-surface-2)" : "transparent", color: did ? "#fff" : "var(--ux-muted)" }}>
                    {did ? <I name="Check" className="h-4 w-4" /> : r ? <I name="Dumbbell" className="h-3.5 w-3.5" /> : "–"}
                  </span>
                  <span className="hidden truncate text-[11px] sm:block" style={{ maxWidth: "100%" }}>{r ? r.cat : "Rest"}</span>
                </div>
              );
            })}
          </div>
          {plan.days[(new Date().getDay() + 6) % 7] && (
            <div><Btn icon="Play" onClick={() => onStart(ROUTINES.find((r) => r.id === plan.days[(new Date().getDay() + 6) % 7])!)}>Start today&rsquo;s session</Btn></div>
          )}
        </Panel>
      )}
      <Panel title="Four-week plans" sub="Pick one. You can change or stop it any time.">
        <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))" }}>
          {PLANS.map((p) => {
            const on = p.id === current;
            return (
              <article key={p.id} className="ux-card flex flex-col gap-2 p-4" data-plan={p.id}
                       style={on ? { border: `1.5px solid ${HUE.orange.ink}` } : undefined}>
                <div className="flex items-center justify-between gap-2">
                  <b className="text-[15px]" style={{ color: "var(--ux-ink)" }}>{p.name}</b>
                  <Tag>{p.level}</Tag>
                </div>
                <p className="text-[13px]" style={{ color: "var(--ux-muted)" }}>{p.desc}</p>
                <p className="text-xs" style={{ color: "var(--ux-ink-2)" }}>
                  {Object.keys(p.days).length} days a week · {Object.entries(p.days).map(([k, id]) => `${WEEK[Number(k)]} ${ROUTINES.find((r) => r.id === id)?.cat}`).join(", ")}
                </p>
                <div className="mt-auto pt-1">
                  {on ? <span className="inline-flex items-center gap-1 text-sm font-bold" style={{ color: "var(--ux-green-ink)" }}><I name="Check" className="h-4 w-4" /> Your plan</span>
                      : <Btn size="sm" variant="soft" onClick={() => onPick(p.id)}>Choose this plan</Btn>}
                </div>
              </article>
            );
          })}
        </div>
      </Panel>
    </>
  );
}

function GoalPicker({ label, value, options, unit, onPick }: { label: string; value: number; options: number[]; unit: string; onPick: (v: number) => void }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[13.5px] font-bold" style={{ color: "var(--ux-ink)" }}>{label}</span>
      <Chips hue="orange" label={label} value={String(value)} onChange={(v) => onPick(Number(v))}
             options={options.map((o) => ({ value: String(o), label: `${o.toLocaleString()}${unit ? ` ${unit}` : ""}` }))} />
    </div>
  );
}

/* ── progress ───────────────────────────────────────────────────────── */

function Progress({ rows, stepsGoal, activeGoal, onDelete, onEdit }: {
  rows: W[]; stepsGoal: number; activeGoal: number; onDelete: (id: string) => Promise<unknown>;
  onEdit: (id: string, p: { data?: Partial<W["data"]> }, msg?: string) => Promise<unknown>;
}) {
  const [range, setRange] = useState<"7" | "30">("7");
  const days = lastDays(Number(range));
  const inRange = rows.filter((r) => r.date >= days[0].day);
  const total = inRange.reduce((a, r) => a + r.data.minutes, 0);
  const byAct = Object.entries(inRange.reduce<Record<string, number>>((a, r) => ({ ...a, [r.data.activity]: (a[r.data.activity] || 0) + r.data.minutes }), {}))
    .sort((a, b) => b[1] - a[1]);
  const max = byAct[0]?.[1] || 1;
  const label = (d: { day: string; label: string }) => (range === "7" ? d.label : d.day.slice(8));
  return (
    <>
      <Chips hue="orange" label="Range" value={range} onChange={(v) => setRange(v as "7" | "30")}
             options={[{ value: "7", label: "Last 7 days" }, { value: "30", label: "Last 30 days" }]} />
      <MetricGrid>
        <Metric hue="orange" icon="Timer" label="Active minutes" value={total} unit="min" />
        <Metric hue="orange" icon="Dumbbell" label="Workouts" value={inRange.length} />
        <Metric hue="orange" icon="Footprints" label="Steps" value={inRange.reduce((a, r) => a + (r.data.steps || 0), 0).toLocaleString()} />
        <Metric hue="orange" icon="Flame" label="Streak" value={streak(rows, today())} unit="days" />
      </MetricGrid>
      <Cols
        main={<>
          <Panel title="Minutes moved" sub={`Goal ${activeGoal} min a day`}>
            <BarChart hue="orange" unit="" goal={activeGoal} data={days.map((d) => ({ label: label(d), value: sumOn(rows, d.day, "minutes") }))} />
          </Panel>
          <Panel title="Steps" sub={`Goal ${stepsGoal.toLocaleString()} a day`}>
            <BarChart hue="orange" goal={stepsGoal} data={days.map((d) => ({ label: label(d), value: sumOn(rows, d.day, "steps") }))} />
          </Panel>
          <RecentList rows={inRange} loading={false} onDelete={onDelete} onEdit={onEdit} />
        </>}
        side={<Panel title="By activity">
          {byAct.length ? byAct.map(([a, m]) => (
            <div key={a} className="grid grid-cols-[110px_minmax(0,1fr)_48px] items-center gap-2.5 text-[13px] font-semibold">
              <span className="truncate" style={{ color: "var(--ux-ink)" }}>{a}</span>
              <span className="h-2.5 overflow-hidden rounded-full" style={{ background: "var(--ux-surface-2)" }}>
                <span className="block h-full rounded-full" style={{ width: `${(m / max) * 100}%`, background: HUE.orange.ink }} />
              </span>
              <span className="text-end tabular-nums" style={{ color: "var(--ux-muted)" }}>{m} min</span>
            </div>
          )) : <p className="text-sm" style={{ color: "var(--ux-muted)" }}>Nothing logged in this range yet.</p>}
        </Panel>}
      />
    </>
  );
}

/* ── challenges ─────────────────────────────────────────────────────── */

function Challenges({ rows, joined, stepsGoal, onJoin, onLeave }: {
  rows: W[]; joined: string[]; stepsGoal: number; onJoin: (id: string) => void; onLeave: (id: string) => void;
}) {
  const t = today();
  return (
    <Panel title="Challenges" sub="Join a 7-day challenge. Progress fills in from the workouts you log.">
      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))" }}>
        {CHALLENGES.map((c) => {
          const start = joinedOn(joined, c.id);
          const st = start ? challengeState(c, start, rows, stepsGoal, t) : null;
          return (
            <article key={c.id} className="ux-card flex flex-col gap-2.5 p-4" data-challenge={c.id}>
              <div className="flex items-center gap-2.5">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[11px]" style={{ background: HUE.orange.tint, color: HUE.orange.ink }}>
                  <I name="Trophy" className="h-5 w-5" />
                </span>
                <b className="text-[15px] leading-snug" style={{ color: "var(--ux-ink)" }}>{c.name}</b>
              </div>
              <p className="text-[13px]" style={{ color: "var(--ux-muted)" }}>{c.desc}</p>
              {st && (
                <div>
                  <div className="flex justify-between text-[13px] font-bold">
                    <span style={{ color: "var(--ux-ink)" }}>{st.v} / {c.goal} {c.unit}</span>
                    <span style={{ color: st.done ? "var(--ux-green-ink)" : "var(--ux-muted)" }}>
                      {st.done ? "Completed" : st.ended ? "Ended" : `${st.left} day${st.left === 1 ? "" : "s"} left`}
                    </span>
                  </div>
                  <div className="mt-1.5 h-[7px] overflow-hidden rounded-full" style={{ background: HUE.orange.tint }}>
                    <div className="h-full rounded-full" style={{ width: `${Math.min(100, (st.v / c.goal) * 100)}%`, background: st.done ? "var(--ux-green-ink)" : HUE.orange.ink }} />
                  </div>
                </div>
              )}
              <div className="mt-auto pt-1">
                {st ? <Btn size="sm" variant="ghost" onClick={() => onLeave(c.id)}>{st.ended || st.done ? "Clear" : "Leave"}</Btn>
                    : <Btn size="sm" variant="soft" icon="Flag" onClick={() => onJoin(c.id)}>Join</Btn>}
              </div>
            </article>
          );
        })}
      </div>
    </Panel>
  );
}
