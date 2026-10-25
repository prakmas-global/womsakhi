"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

import { Btn } from "@/components/ux/kit";
import { Text } from "@/components/ux/kit/form";
import { toast } from "@/components/ux/mobile/Toast";
import {
  BarChart, Chips, Cols, Disclaimer, Empty, HUE, I, Metric, MetricGrid, Panel, lastDays, type useEntries, type useHealthSettings,
} from "@/components/ux/health/kit";
import { addDays, daysBetween, fmtDay, today, type Entry, type KindData } from "@/lib/health-api";
import { DEFAULT_ROUTINE, FACTORS, SLEEP_TIPS } from "@/components/ux/health/nutrition/data";
import { Field, HBar, HistoryRow, StepNum, TimePick, fmt12 } from "@/components/ux/health/nutrition/parts";

/**
 * Sleep — Overview, Sleep Log, Bedtime, Insights.
 *
 * Each night is a `sleep` entry dated on the morning she woke. Her bedtime
 * routine and goal live in her health settings; tonight's ticks are kept in
 * `checks.bedtime` as "YYYY-MM-DD:<step>", so they reset each day by
 * themselves. The nightly reminder is an ordinary `reminder` entry, so it also
 * shows in Appointments & Reminders.
 */

export type SleepStore = ReturnType<typeof useEntries<"sleep" | "reminder">>;
type Settings = ReturnType<typeof useHealthSettings>;

export const BED_REMINDER = "Time for bed";
const QUALITIES = ["Poor", "Fair", "Good", "Great"] as const;
const BED_PRESETS = ["21:30", "22:00", "22:30", "23:00", "23:30"];
const WAKE_PRESETS = ["05:30", "06:00", "06:30", "07:00", "07:30"];

const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
export const sleepMin = (bed: string, wake: string) => (((toMin(wake) - toMin(bed)) % 1440) + 1440) % 1440;
export const hm = (m: number) => `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ""}`;
/** Minutes after 6 pm — so 11 pm (300) sorts before 1 am (420). */
const fromEvening = (t: string) => (toMin(t) - 1080 + 1440) % 1440;
const eveningToClock = (m: number) => {
  const x = (Math.round(m) + 1080) % 1440;
  return `${String(Math.floor(x / 60)).padStart(2, "0")}:${String(x % 60).padStart(2, "0")}`;
};

function nights(store: SleepStore) {
  return (store.rows.filter((r) => r.kind === "sleep") as Entry<"sleep">[]).slice().sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}
function minutesOn(ss: Entry<"sleep">[], day: string) {
  return ss.filter((s) => s.date === day).reduce((a, s) => a + sleepMin(s.data.bed, s.data.wake), 0);
}
export function bedReminder(store: SleepStore) {
  return (store.rows.filter((r) => r.kind === "reminder") as Entry<"reminder">[])
    .find((r) => r.data.title === BED_REMINDER && r.data.repeat === "Every day" && !r.data.cancelled);
}


/* ── Overview ──────────────────────────────────────────────────────── */

export function OverviewTab({ store, s }: { store: SleepStore; s: Settings }) {
  const ss = nights(store);
  const goal = s.settings.sleepGoal;
  const days = lastDays(7);
  const last = ss[0];
  const week = days.map((d) => minutesOn(ss, d.day)).filter(Boolean);
  const weekAvg = week.length ? Math.round(week.reduce((a, b) => a + b, 0) / week.length) : 0;
  const rem = bedReminder(store);

  if (store.loading) return <Panel title="Your sleep"><p className="text-sm" style={{ color: "var(--ux-muted)" }}>Loading your nights…</p></Panel>;

  return (
    <Cols
      main={
        ss.length === 0 ? (
          <Panel title="Your sleep">
            <Empty icon="Moon" title="No sleep logged yet" body="Add when you went to bed and woke up — two taps — to start seeing your sleep pattern."
                   action={<Btn size="sm" icon="Plus" href="?tab=log">Log last night</Btn>} />
          </Panel>
        ) : (
          <>
            <MetricGrid>
              <Metric hue="violet" icon="Moon" label={last.date === today() ? "Last night" : `Last logged · ${fmtDay(last.date)}`}
                      value={hm(sleepMin(last.data.bed, last.data.wake))} sub={`Goal ${goal} h`} pct={(sleepMin(last.data.bed, last.data.wake) / (goal * 60)) * 100} />
              <Metric hue="lilac" icon="Bed" label="Went to bed" value={fmt12(last.data.bed)} sub={last.data.quality ? `Felt ${last.data.quality.toLowerCase()}` : undefined} />
              <Metric hue="amber" icon="Sunrise" label="Woke up" value={fmt12(last.data.wake)} />
              <Metric hue="blue" icon="CalendarDays" label="Average, last 7 nights" value={weekAvg ? hm(weekAvg) : "–"} sub={`${week.length} night${week.length === 1 ? "" : "s"} logged`} />
            </MetricGrid>
            <Panel title="Hours slept, last 7 nights">
              <BarChart hue="violet" unit="h" goal={goal}
                        data={days.map((d) => ({ label: d.label, value: Math.round(minutesOn(ss, d.day) / 6) / 10 }))} />
            </Panel>
            <Panel title="Sleep consistency" sub="Each bar runs from bedtime to wake-up. Bars that line up mean a steady routine.">
              <Consistency ss={ss} days={days} />
            </Panel>
          </>
        )
      }
      side={
        <>
          <Panel title="Bedtime reminder" hue="violet" tint>
            {rem ? (
              <>
                <p><b className="text-xl tabular-nums" style={{ color: "var(--ux-ink)" }}>{fmt12(rem.data.time || s.settings.bedtime)}</b>
                  <span className="ms-2 text-sm" style={{ color: "var(--ux-muted)" }}>every night</span></p>
                <Btn size="sm" variant="outline" href="?tab=bedtime">Change</Btn>
              </>
            ) : (
              <>
                <p className="text-sm" style={{ color: "var(--ux-ink-2)" }}>No bedtime reminder yet. A nudge at the same time each night is one of the easiest ways to sleep better.</p>
                <Btn size="sm" icon="Bell" href="?tab=bedtime">Set a reminder</Btn>
              </>
            )}
          </Panel>
          <Panel title="Sleep tips">
            <ul className="flex flex-col gap-3">
              {SLEEP_TIPS.map((t) => (
                <li key={t} className="flex gap-2.5 text-sm" style={{ color: "var(--ux-ink)" }}>
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[9px]" style={{ background: HUE.violet.tint, color: HUE.violet.ink }}>
                    <I name="Moon" className="h-4 w-4" />
                  </span>
                  <span className="pt-1">{t}</span>
                </li>
              ))}
            </ul>
          </Panel>
          <CalmLinks />
        </>
      }
    />
  );
}

function CalmLinks() {
  return (
    <Panel title="Calm before bed" sub="A few quiet minutes help you fall asleep">
      <div className="flex flex-wrap gap-2">
        <Btn size="sm" variant="outline" icon="Wind" href="/app/health/games/breathe">Breathing</Btn>
        <Btn size="sm" variant="outline" icon="Sparkles" href="/app/health/games/bubbles">Bubble pop</Btn>
        <Btn size="sm" variant="outline" icon="Brain" href="/app/health/mind?tab=activities">Body scan</Btn>
      </div>
    </Panel>
  );
}

/** Bedtime → wake-up bars per night, on an axis from 6 pm to noon. */
function Consistency({ ss, days }: { ss: Entry<"sleep">[]; days: { day: string; label: string }[] }) {
  const W = 520, rowH = 26, top = 8, left = 40, H = top + days.length * rowH + 22, span = 18 * 60;
  const X = (m: number) => left + (m / span) * (W - left - 10);
  const ticks = [0, 3, 6, 9, 12, 15, 18];
  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full min-w-[300px] max-w-[640px]" role="img" aria-label="Bedtime to wake-up for each of the last 7 nights">
        {ticks.map((h) => {
          const x = X(h * 60), clock = (18 + h) % 24;
          return (
            <g key={h}>
              <line x1={x} x2={x} y1={top} y2={H - 20} stroke="var(--ux-line)" />
              <text x={x} y={H - 6} textAnchor="middle" fontSize="11" fontWeight="600" fill="var(--ux-muted)">
                {clock === 0 ? "12a" : clock === 12 ? "12p" : clock > 12 ? `${clock - 12}p` : `${clock}a`}
              </text>
            </g>
          );
        })}
        {days.map((d, i) => {
          const y = top + i * rowH;
          return (
            <g key={d.day}>
              <text x={left - 8} y={y + 16} textAnchor="end" fontSize="11" fontWeight="600" fill="var(--ux-muted)">{d.label}</text>
              {ss.filter((x) => x.date === d.day).map((x) => {
                const b = fromEvening(x.data.bed), len = sleepMin(x.data.bed, x.data.wake);
                const w = Math.max(4, X(Math.min(span, b + len)) - X(b));
                return <rect key={x.id} x={X(b)} y={y + 5} width={w} height={14} rx="7" fill={HUE.violet.ink} />;
              })}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/* ── Sleep log ─────────────────────────────────────────────────────── */

export function LogTab({ store }: { store: SleepStore }) {
  const ss = nights(store);
  const [editing, setEditing] = useState<Entry<"sleep"> | null>(null);
  // The form comes first on a phone — logging last night is why she came —
  // and sits on the right on a wide screen, beside her history.
  return (
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="order-2 flex min-w-0 flex-col gap-5 xl:order-1">
        <Panel title="Sleep history" sub={ss.length ? `${ss.length} night${ss.length === 1 ? "" : "s"} logged` : undefined}>
          {ss.length === 0 ? (
            <Empty icon="Moon" title="Nothing logged yet" body="Your nights will show here. Log last night with the form — it takes two taps." />
          ) : (
            <ul className="flex flex-col" data-sleep-history>
              {ss.map((x) => {
                const m = sleepMin(x.data.bed, x.data.wake);
                return (
                  <HistoryRow key={x.id} editing={editing?.id === x.id} when={fmtDay(x.date)}
                              title={`${hm(m)} of sleep`}
                              meta={[`${fmt12(x.data.bed)} to ${fmt12(x.data.wake)}`, x.data.quality, ...(x.data.factors || [])].filter(Boolean).join(" · ")}
                              onEdit={() => { setEditing(x); document.getElementById("sl-form")?.scrollIntoView({ behavior: "smooth", block: "center" }); }}
                              onDelete={() => store.remove(x.id, "Night deleted")} />
                );
              })}
            </ul>
          )}
        </Panel>
      </div>
      <div className="order-1 flex min-w-0 flex-col gap-5 xl:order-2">
        <SleepForm key={editing?.id ?? "new"} store={store} editing={editing} onDone={() => setEditing(null)} />
      </div>
    </div>
  );
}

function SleepForm({ store, editing, onDone }: { store: SleepStore; editing: Entry<"sleep"> | null; onDone: () => void }) {
  const ss = nights(store);
  const usual = ss[0]?.data;
  const [date, setDate] = useState(editing?.date ?? today());
  const [bed, setBed] = useState(editing?.data.bed ?? usual?.bed ?? "22:30");
  const [wake, setWake] = useState(editing?.data.wake ?? usual?.wake ?? "06:30");
  const [quality, setQuality] = useState<KindData["sleep"]["quality"]>(editing?.data.quality ?? "Good");
  const [factors, setFactors] = useState<string[]>(editing?.data.factors ?? []);
  const [note, setNote] = useState(editing?.data.note ?? "");
  const [busy, setBusy] = useState(false);
  const m = sleepMin(bed, wake);
  const bad = m < 60 || m > 960;
  const already = !editing && ss.some((x) => x.date === date);

  const save = async () => {
    setBusy(true);
    const data: KindData["sleep"] = { bed, wake, quality, factors, note: note.trim() };
    const ok = editing ? await store.edit(editing.id, { data, date }, "Night updated") : await store.add("sleep", data, date, "Sleep saved");
    setBusy(false);
    if (ok) { setFactors([]); setNote(""); onDone(); }
  };

  return (
    <Panel id="sl-form" title={editing ? "Change this night" : "Log your sleep"} sub="Dated on the morning you woke up" hue="violet">
      <Field label="Which night?">
        <Chips label="Which night" hue="violet" value={date} onChange={setDate}
               options={[{ value: today(), label: "Last night" }, { value: addDays(today(), -1), label: "The night before" },
                         ...(date !== today() && date !== addDays(today(), -1) ? [{ value: date, label: fmtDay(date) }] : [])]} />
        <input type="date" value={date} max={today()} onChange={(e) => e.target.value && setDate(e.target.value)} aria-label="Wake-up date"
               className="min-h-[40px] w-fit rounded-full border-[1.5px] px-3 text-[13.5px] font-bold"
               style={{ borderColor: "var(--ux-line-strong)", background: "var(--ux-surface)", color: "var(--ux-ink)" }} />
      </Field>
      <Field label="Went to bed at"><TimePick label="Bedtime" value={bed} onChange={setBed} presets={BED_PRESETS} /></Field>
      <Field label="Woke up at"><TimePick label="Wake-up time" value={wake} onChange={setWake} presets={WAKE_PRESETS} /></Field>
      <p className="rounded-[12px] px-3 py-2 text-sm font-bold" data-sleep-duration
         style={bad ? { background: "var(--ux-danger-tint)", color: "var(--ux-danger-ink)" } : { background: HUE.violet.tint, color: HUE.violet.ink }}>
        {bad ? "Sleep should be between 1 and 16 hours. Check both times." : `${hm(m)} of sleep`}
      </p>
      <Field label="How did you sleep?">
        <Chips label="Sleep quality" hue="violet" options={QUALITIES} value={quality} onChange={setQuality} />
      </Field>
      <Field label="Anything that affected it? (optional)">
        <Chips label="Factors" hue="violet" options={FACTORS} value={factors}
               onChange={(f) => setFactors((xs) => (xs.includes(f) ? xs.filter((x) => x !== f) : [...xs, f]))} />
      </Field>
      <Field label="Note (optional)"><Text label="Note" value={note} onChange={setNote} max={200} placeholder="Anything to remember" /></Field>
      {already && <p className="text-xs" style={{ color: "var(--ux-amber-ink)" }}>You already logged this night. Saving adds a second entry (a nap, or a broken night).</p>}
      <div className="flex flex-wrap gap-2">
        <Btn icon="Check" disabled={bad} loading={busy} onClick={save}>{editing ? "Save changes" : "Save sleep"}</Btn>
        {editing && <Btn variant="ghost" onClick={onDone}>Cancel</Btn>}
      </div>
    </Panel>
  );
}

/* ── Bedtime ───────────────────────────────────────────────────────── */

const STEP_IDEAS = ["Herbal tea", "Warm bath", "Write tomorrow's list", "Breathing for 2 minutes", "Light stretching"];

export function BedtimeTab({ store, s }: { store: SleepStore; s: Settings }) {
  const st = s.settings;
  const steps = st.sleepRoutine?.length ? st.sleepRoutine : DEFAULT_ROUTINE;
  const t = today();
  const ticks = (st.checks?.bedtime || []).filter((x) => x.startsWith(`${t}:`)).map((x) => Number(x.split(":")[1]));
  const [newStep, setNewStep] = useState("");

  const tick = (i: number) => {
    const others = (st.checks?.bedtime || []).filter((x) => x.startsWith(`${t}:`));
    const key = `${t}:${i}`;
    const next = others.includes(key) ? others.filter((x) => x !== key) : [...others, key];
    s.save({ checks: { ...(st.checks || {}), bedtime: next } }, next.length === steps.length && !others.includes(key) ? "Routine done — sleep well" : undefined);
  };
  const setSteps = (xs: string[], msg?: string) =>
    s.save({ sleepRoutine: xs, checks: { ...(st.checks || {}), bedtime: [] } }, msg);

  return (
    <Cols
      main={
        <>
          <Panel title="Bedtime routine" sub="Tick it off each night — it resets every day">
            <ul className="flex flex-col" data-routine>
              {steps.map((step, i) => {
                const on = ticks.includes(i);
                return (
                  <li key={`${step}${i}`} className="flex items-center gap-3 border-t py-2.5 first:border-t-0" style={{ borderColor: "var(--ux-line)" }}>
                    <button type="button" role="checkbox" aria-checked={on} onClick={() => tick(i)}
                            className="ux-press flex min-h-[40px] min-w-0 flex-1 items-center gap-3 text-start">
                      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border-2"
                            style={on ? { background: "var(--ux-green-ink)", borderColor: "var(--ux-green-ink)", color: "var(--ux-surface)" }
                                      : { borderColor: "var(--ux-line-strong)", color: "transparent" }}>
                        <I name="Check" className="h-4 w-4" />
                      </span>
                      <span className="text-[14.5px] font-semibold" style={{ color: on ? "var(--ux-muted)" : "var(--ux-ink)", textDecoration: on ? "line-through" : undefined }}>{step}</span>
                    </button>
                    <button type="button" aria-label={`Remove ${step}`} onClick={() => setSteps(steps.filter((_, j) => j !== i), "Step removed")}
                            className="ux-press grid h-8 w-8 shrink-0 place-items-center rounded-[9px]" style={{ background: "var(--ux-surface-2)", color: "var(--ux-muted)" }}>
                      <I name="X" className="h-3.5 w-3.5" />
                    </button>
                  </li>
                );
              })}
            </ul>
            <p className="text-sm font-bold" style={{ color: HUE.violet.ink }}>{ticks.length} of {steps.length} done tonight</p>
            {steps.length < 12 && (
              <Field label="Add a step">
                <Chips label="Step ideas" hue="violet" options={STEP_IDEAS.filter((x) => !steps.includes(x))} value=""
                       onChange={(x) => setSteps([...steps, x], "Step added")} />
                <div className="flex flex-wrap items-center gap-2">
                  <div className="min-w-[200px] flex-1"><Text label="Your own step" value={newStep} onChange={setNewStep} max={60} placeholder="Or write your own" /></div>
                  <Btn size="sm" icon="Plus" disabled={!newStep.trim()} onClick={() => { setSteps([...steps, newStep.trim()], "Step added"); setNewStep(""); }}>Add</Btn>
                </div>
              </Field>
            )}
          </Panel>
          <WindDown />
        </>
      }
      side={
        <>
          <BedtimeSettings s={s} />
          <BedReminder store={store} bedtime={st.bedtime} />
          <CalmLinks />
        </>
      }
    />
  );
}

function WindDown() {
  const [mins, setMins] = useState(10);
  const [left, setLeft] = useState<number | null>(null);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearInterval(timer.current), []);
  const start = () => {
    window.clearInterval(timer.current);
    setLeft(mins * 60);
    timer.current = window.setInterval(() => {
      setLeft((l) => {
        if (l === null) return null;
        if (l <= 1) { window.clearInterval(timer.current); toast("Wind-down done. Lights off — sleep well.", { tone: "success" }); return null; }
        return l - 1;
      });
    }, 1000);
  };
  const stop = () => { window.clearInterval(timer.current); setLeft(null); };
  return (
    <Panel title="Wind-down timer" sub="Phone down, lights low — we'll tell you when it's time to sleep" hue="violet">
      {left === null ? (
        <>
          <Chips label="Minutes" hue="violet" options={[{ value: "5", label: "5 min" }, { value: "10", label: "10 min" }, { value: "15", label: "15 min" }, { value: "20", label: "20 min" }]}
                 value={String(mins)} onChange={(v) => setMins(Number(v))} />
          <div><Btn icon="Play" onClick={start}>Start wind-down</Btn></div>
        </>
      ) : (
        <div className="flex flex-col items-center gap-3 py-2" data-wind-down>
          <span className="text-[44px] font-extrabold tabular-nums leading-none" style={{ color: HUE.violet.ink }} aria-live="off">
            {Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")}
          </span>
          <span className="text-sm" style={{ color: "var(--ux-muted)" }}>Breathe slowly. In for 4, out for 6.</span>
          <Btn variant="outline" icon="Square" onClick={stop}>Stop</Btn>
        </div>
      )}
    </Panel>
  );
}

function BedtimeSettings({ s }: { s: Settings }) {
  const st = s.settings;
  const [bed, setBed] = useState<string | null>(null);
  const [goal, setGoal] = useState<number | null>(null);
  const b = bed ?? st.bedtime, g = goal ?? st.sleepGoal;
  const dirty = b !== st.bedtime || g !== st.sleepGoal;
  return (
    <Panel title="Your bedtime and goal">
      <Field label="I want to be in bed by"><TimePick label="Target bedtime" value={b} onChange={setBed} presets={BED_PRESETS} /></Field>
      <Field label="Hours of sleep I'm aiming for" hint="Most adults do best with 7–9 hours.">
        <StepNum label="Sleep goal" value={g} onChange={setGoal} step={0.5} min={4} max={12} unit="h" />
      </Field>
      <div><Btn icon="Check" disabled={!dirty} onClick={async () => { const ok = await s.save({ bedtime: b, sleepGoal: g }, "Saved"); if (ok) { setBed(null); setGoal(null); } }}>Save</Btn></div>
    </Panel>
  );
}

function BedReminder({ store, bedtime }: { store: SleepStore; bedtime: string }) {
  const rem = bedReminder(store);
  return (
    <Panel title="Bedtime reminder" hue="violet" tint>
      {rem ? (
        <>
          <p className="text-sm" style={{ color: "var(--ux-ink)" }}>
            We&rsquo;ll remind you every night at <b className="tabular-nums">{fmt12(rem.data.time || bedtime)}</b>.
          </p>
          <div className="flex flex-wrap gap-2">
            {rem.data.time !== bedtime && (
              <Btn size="sm" icon="Clock" onClick={() => store.edit(rem.id, { data: { time: bedtime } }, `Reminder moved to ${fmt12(bedtime)}`)}>Move to {fmt12(bedtime)}</Btn>
            )}
            <Btn size="sm" variant="outline" icon="BellOff" onClick={() => store.remove(rem.id, "Bedtime reminder turned off")}>Turn off</Btn>
          </div>
          <p className="text-xs" style={{ color: "var(--ux-muted)" }}>It also shows in <Link href="/app/health/reminders" className="font-bold underline">Appointments & Reminders</Link>.</p>
        </>
      ) : (
        <>
          <p className="text-sm" style={{ color: "var(--ux-ink-2)" }}>A gentle nudge each night at your bedtime.</p>
          <div>
            <Btn size="sm" icon="Bell" onClick={() => store.add("reminder", { title: BED_REMINDER, category: "Other", time: bedtime, repeat: "Every day", note: "Start your wind-down routine" }, today(), `We'll remind you at ${fmt12(bedtime)}`)}>
              Remind me every night at {fmt12(bedtime)}
            </Btn>
          </div>
        </>
      )}
    </Panel>
  );
}

/* ── Insights ──────────────────────────────────────────────────────── */

export function InsightsTab({ store, s }: { store: SleepStore; s: Settings }) {
  const ss = nights(store);
  const goalM = s.settings.sleepGoal * 60;
  const d14 = useMemo(() => lastDays(14), []);
  if (ss.length < 2) {
    return (
      <Panel title="Sleep insights">
        <Empty icon="BarChart3" title="Not enough nights yet" body="Log at least two nights to see your averages, your bedtime pattern and suggestions."
               action={<Btn size="sm" icon="Plus" href="?tab=log">Log sleep</Btn>} />
      </Panel>
    );
  }
  const per7 = lastDays(7).map((d) => minutesOn(ss, d.day)).filter(Boolean);
  const per30 = lastDays(30).map((d) => minutesOn(ss, d.day)).filter(Boolean);
  const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : 0);
  const met = per30.filter((m) => m >= goalM).length;
  const recent = ss.filter((x) => daysBetween(today(), x.date) < 14);
  const beds = recent.map((x) => fromEvening(x.data.bed));
  const spread = beds.length > 1 ? Math.max(...beds) - Math.min(...beds) : 0;
  const q: Record<string, number> = {};
  ss.forEach((x) => { if (x.data.quality) q[x.data.quality] = (q[x.data.quality] || 0) + 1; });
  const qMax = Math.max(1, ...Object.values(q));
  const f: Record<string, number> = {};
  ss.forEach((x) => (x.data.factors || []).forEach((k) => { f[k] = (f[k] || 0) + 1; }));
  const topFactor = Object.entries(f).sort((a, b) => b[1] - a[1])[0];

  const recs: string[] = [];
  if (spread > 60) recs.push(`Your bedtime varied by ${hm(spread)} over two weeks. A steadier bedtime often makes sleep feel more restful.`);
  if (per7.length && avg(per7) < goalM) recs.push(`You're averaging ${hm(avg(per7))}, below your ${hm(goalM)} goal. Try moving bedtime 15 minutes earlier this week.`);
  if ((q.Poor || 0) + (q.Fair || 0) > (q.Good || 0) + (q.Great || 0)) recs.push("More nights felt poor than good. If this goes on for weeks, talk to a doctor.");
  if (topFactor && topFactor[1] >= 2) recs.push(`“${topFactor[0]}” came up on ${topFactor[1]} nights. It may be worth changing that first.`);
  if (!recs.length) recs.push("Your sleep looks steady. Keep your routine going.");

  return (
    <>
      <MetricGrid>
        <Metric hue="violet" icon="Moon" label="Average, 7 nights" value={per7.length ? hm(avg(per7)) : "–"} />
        <Metric hue="lilac" icon="CalendarDays" label="Average, 30 nights" value={per30.length ? hm(avg(per30)) : "–"} />
        <Metric hue="green" icon="Target" label="Nights meeting goal" value={`${met} of ${per30.length}`} sub="Last 30 days" />
        <Metric hue="amber" icon="Bed" label="Typical bedtime" value={beds.length ? fmt12(eveningToClock(avg(beds))) : "–"} sub="Last 2 weeks" />
      </MetricGrid>
      <Cols
        main={
          <>
            <Panel title="Hours per night, last 2 weeks">
              <BarChart hue="violet" unit="h" goal={s.settings.sleepGoal}
                        data={d14.map((d) => ({ label: String(Number(d.day.slice(8))), value: Math.round(minutesOn(ss, d.day) / 6) / 10 }))} />
            </Panel>
            <Panel title="Bedtime drift" sub={`Your bedtime each night against your ${fmt12(s.settings.bedtime)} target`}>
              <Drift ss={ss} days={d14} target={s.settings.bedtime} />
            </Panel>
          </>
        }
        side={
          <>
            <Panel title="How nights felt">
              <div className="flex flex-col gap-2.5">{QUALITIES.slice().reverse().map((k) => <HBar key={k} label={k} value={q[k] || 0} max={qMax} hue="violet" />)}</div>
            </Panel>
            <Panel title="Suggestions" hue="violet" tint>
              <ul className="flex flex-col gap-3" data-sleep-suggestions>
                {recs.map((r) => (
                  <li key={r} className="flex gap-2.5 text-sm" style={{ color: "var(--ux-ink)" }}>
                    <I name="Sparkles" className="mt-0.5 h-4 w-4 shrink-0" style={{ color: HUE.violet.ink }} />{r}
                  </li>
                ))}
              </ul>
            </Panel>
            <Disclaimer>These are general suggestions, not a sleep diagnosis.</Disclaimer>
          </>
        }
      />
    </>
  );
}

function Drift({ ss, days, target }: { ss: Entry<"sleep">[]; days: { day: string; label: string }[]; target: string }) {
  const W = 520, H = 170, top = 14, bottom = 24, left = 44, ch = H - top - bottom;
  const pts = days.map((d, i) => {
    const x = ss.find((n) => n.date === d.day);
    return { i, d, m: x ? fromEvening(x.data.bed) : null };
  });
  const vals = pts.filter((p) => p.m !== null).map((p) => p.m as number).concat(fromEvening(target));
  const lo = Math.min(...vals) - 30, hi = Math.max(...vals) + 30;
  const X = (i: number) => left + (i + 0.5) * ((W - left - 8) / days.length);
  const Y = (m: number) => top + ((m - lo) / Math.max(1, hi - lo)) * ch;
  const line = pts.filter((p) => p.m !== null).map((p) => `${X(p.i).toFixed(1)},${Y(p.m as number).toFixed(1)}`).join(" ");
  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full min-w-[300px] max-w-[640px]" role="img" aria-label="Bedtime each night for two weeks">
        <line x1={left} x2={W} y1={Y(fromEvening(target))} y2={Y(fromEvening(target))} stroke="var(--ux-ink)" strokeOpacity=".35" strokeDasharray="4 4" />
        <text x={left - 6} y={Y(fromEvening(target)) + 4} textAnchor="end" fontSize="10.5" fontWeight="700" fill="var(--ux-muted)">{fmt12(target).replace(":00", "")}</text>
        {line && <polyline points={line} fill="none" stroke={HUE.violet.ink} strokeWidth="2.5" strokeLinejoin="round" />}
        {pts.map((p) => (
          <g key={p.d.day}>
            {p.m !== null && <circle cx={X(p.i)} cy={Y(p.m)} r="4.5" fill="var(--ux-surface)" stroke={HUE.violet.ink} strokeWidth="2.5" />}
            <text x={X(p.i)} y={H - 6} textAnchor="middle" fontSize="11" fontWeight="600" fill="var(--ux-muted)">{Number(p.d.day.slice(8))}</text>
          </g>
        ))}
      </svg>
      <p className="mt-1 text-xs" style={{ color: "var(--ux-muted)" }}>Lower on the chart is later at night. The dashed line is your target.</p>
    </div>
  );
}
