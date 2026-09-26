"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import * as Icons from "@/components/ux/icons";
import { HomeShell } from "@/components/ux/home/HomeShell";
import { Icon } from "@/components/ux/cycle/parts";
import { MOODS, SYMPTOMS } from "@/components/ux/cycle/data";
import { useCycle } from "@/components/ux/cycle/use-cycle";
import {
  apiCycleDay,
  apiCycleLog,
  type CervicalMucus,
  type CycleLog,
  type Flow,
  type Intimacy,
  type Mood,
  type OvulationTest,
  type PregnancyTest,
  type SleepQuality,
  type Symptom,
} from "@/lib/cycle-api";
import { messageFrom } from "@/lib/use-action";

const empty = (date: string): CycleLog => ({
  date, period: null, mood: null, feelings: [], symptoms: [], symptom_severity: {},
  flow: null, pain: null, energy: null, sleep_hours: null, sleep_quality: null,
  basal_temp_c: null, weight_kg: null, water_glasses: null, exercise_minutes: null,
  cervical_mucus: null, ovulation_test: null, pregnancy_test: null, intimacy: null,
  medications_taken: [], note: "",
});

type Choice<T extends string> = { value: T; label: string; icon?: string };

const FLOWS: Choice<Flow>[] = [
  { value: "spotting", label: "Spotting", icon: "CircleDot" },
  { value: "light", label: "Light", icon: "Droplet" },
  { value: "medium", label: "Medium", icon: "Droplets" },
  { value: "heavy", label: "Heavy", icon: "Waves" },
];
const SLEEP: Choice<SleepQuality>[] = [
  { value: "poor", label: "Poor" }, { value: "fair", label: "Fair" },
  { value: "good", label: "Good" }, { value: "restful", label: "Restful" },
];
const MUCUS: Choice<CervicalMucus>[] = [
  { value: "dry", label: "Dry" }, { value: "sticky", label: "Sticky" },
  { value: "creamy", label: "Creamy" }, { value: "watery", label: "Watery" },
  { value: "egg-white", label: "Egg-white" },
];
const OPK: Choice<OvulationTest>[] = [
  { value: "not-taken", label: "Not taken" }, { value: "negative", label: "Negative" },
  { value: "high", label: "High" }, { value: "peak", label: "Peak" },
  { value: "positive", label: "Positive" },
];
const PREGNANCY: Choice<PregnancyTest>[] = [
  { value: "not-taken", label: "Not taken" }, { value: "negative", label: "Negative" },
  { value: "positive", label: "Positive" }, { value: "unclear", label: "Unclear" },
];
const INTIMACY: Choice<Intimacy>[] = [
  { value: "none", label: "None" }, { value: "protected", label: "Protected" },
  { value: "unprotected", label: "Unprotected" },
];

function Card({ title, sub, icon, children }: { title: string; sub: string; icon: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[22px] p-5" style={{ background: "var(--ux-surface)", border: "1px solid var(--ux-line)", boxShadow: "var(--ux-shadow-soft)" }}>
      <div className="mb-5 flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[14px]" style={{ background: "var(--cy-predicted)" }}>
          <Icon name={icon} className="h-5 w-5" style={{ color: "var(--cy-period-ink)" }} />
        </span>
        <div>
          <h2 className="text-[17px] font-semibold" style={{ color: "var(--ux-ink)" }}>{title}</h2>
          <p className="mt-0.5 text-[13px]" style={{ color: "var(--ux-muted)" }}>{sub}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function Choices<T extends string>({ label, value, items, onChange, nullable = true }: {
  label: string; value: T | null; items: Choice<T>[]; onChange: (v: T | null) => void; nullable?: boolean;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {items.map((item) => {
        const on = value === item.value;
        return (
          <button key={item.value} type="button" role="radio" aria-checked={on}
                  onClick={() => on && nullable ? onChange(null) : onChange(item.value)}
                  className="ux-press flex min-h-11 items-center gap-2 rounded-[12px] px-3.5 text-[13px] font-medium"
                  style={on
                    ? { background: "var(--cy-predicted)", color: "var(--cy-period-ink)", boxShadow: "inset 0 0 0 1.5px var(--cy-period)" }
                    : { background: "var(--ux-surface-2)", color: "var(--ux-ink-2)", border: "1px solid var(--ux-line)" }}>
            {item.icon && <Icon name={item.icon} className="h-4 w-4" />}{item.label}
          </button>
        );
      })}
    </div>
  );
}

function Slider({ label, value, min, max, suffix, onChange }: {
  label: string; value: number | null; min: number; max: number; suffix?: string; onChange: (v: number | null) => void;
}) {
  return (
    <label className="block">
      <span className="mb-2 flex items-center justify-between text-[13px] font-medium" style={{ color: "var(--ux-ink-2)" }}>
        {label}<b style={{ color: "var(--ux-ink)" }}>{value == null ? "Not logged" : `${value}${suffix ?? ""}`}</b>
      </span>
      <input type="range" min={min} max={max} value={value ?? min}
             aria-label={label} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-[var(--cy-period)]" />
      {value != null && <button type="button" onClick={() => onChange(null)} className="mt-1 text-[12px] underline" style={{ color: "var(--ux-muted)" }}>Clear</button>}
    </label>
  );
}

const nav = [
  ["Overview", "/app/health/cycle"], ["Daily log", "/app/health/cycle/daily"],
  ["Insights", "/app/health/cycle/insights"], ["Medicines", "/app/health/cycle/medicines"],
  ["Report", "/app/health/cycle/report"], ["Settings", "/app/health/cycle/settings"],
];

export function CycleDesktopNav({ active }: { active: string }) {
  return (
    <nav aria-label="Cycle sections" className="mb-6 grid grid-cols-3 gap-2 sm:grid-cols-6">
      {nav.map(([label, href]) => (
        <Link key={href} href={href} aria-current={active === label ? "page" : undefined}
              className="ux-press flex min-h-11 items-center justify-center rounded-full px-3 text-center text-[13px] font-semibold"
              style={active === label
                ? { background: "linear-gradient(90deg, var(--cy-period), var(--ux-fill))", color: "var(--ux-on-brand)" }
                : { background: "var(--ux-surface)", color: "var(--ux-ink-2)", border: "1px solid var(--ux-line)" }}>
          {label}
        </Link>
      ))}
    </nav>
  );
}

export default function AdvancedDailyLog() {
  const cycle = useCycle();
  const { state, data, act, busy } = cycle;
  const [date, setDate] = useState("");
  const [log, setLog] = useState<CycleLog | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [showSensitive, setShowSensitive] = useState(false);

  useEffect(() => { if (state?.today && !date) setDate(state.today); }, [state?.today, date]);
  useEffect(() => {
    if (!date || !state) return;
    const ctl = new AbortController();
    setLoading(true); setError(null); setSaved(false);
    apiCycleDay(date, ctl.signal).then(setLog).catch((e) => {
      if (!ctl.signal.aborted) setError(messageFrom(e, "We could not open that day."));
    }).finally(() => { if (!ctl.signal.aborted) setLoading(false); });
    return () => ctl.abort();
  }, [date, state]);

  const set = <K extends keyof CycleLog>(key: K, value: CycleLog[K]) => setLog((v) => ({ ...(v ?? empty(date)), [key]: value }));
  const activeMedicines = useMemo(() => state?.profile.medicines.filter((m) => m.active) ?? [], [state]);
  const toggleSymptom = (symptom: Symptom) => {
    if (!log || symptom === "none") return;
    const current = log.symptoms.filter((x) => x !== "none");
    const on = current.includes(symptom);
    const symptoms = on ? current.filter((x) => x !== symptom) : [...current, symptom];
    const severity = { ...log.symptom_severity };
    if (on) delete severity[symptom as Exclude<Symptom, "none">];
    else severity[symptom as Exclude<Symptom, "none">] = 1;
    setLog({ ...log, symptoms, symptom_severity: severity });
  };
  const severity = (symptom: Exclude<Symptom, "none">, amount: 1 | 2 | 3) => {
    if (!log) return;
    setLog({ ...log, symptom_severity: { ...log.symptom_severity, [symptom]: amount } });
  };
  const save = async () => {
    if (!log) return;
    const { date: _, ...body } = log;
    const result = await act(() => apiCycleLog(date, body));
    if (result) { setSaved(true); setError(null); }
    else setError("That did not save. Check your connection and try again.");
  };

  if (data && !data.setup) return (
    <HomeShell immersive bare><div className="mx-auto max-w-[980px] py-12 text-center"><Link href="/app/health/cycle/start" className="font-semibold underline">Set up Cycle first</Link></div></HomeShell>
  );

  return (
    <HomeShell immersive bare>
      <div className="mx-auto max-w-[1500px] px-5 py-7 lg:px-8">
        <header className="mb-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[12px] font-bold uppercase tracking-[0.16em]" style={{ color: "var(--cy-period-ink)" }}>Private daily health log</p>
            <h1 className="ux-screen-title mt-1 text-[34px] font-bold" style={{ color: "var(--ux-ink)" }}>How is your body today?</h1>
            <p className="mt-1 text-[14px]" style={{ color: "var(--ux-muted)" }}>Choose only what matters today. Every field is optional.</p>
          </div>
          <label className="rounded-[14px] px-4 py-2" style={{ background: "var(--ux-surface)", border: "1px solid var(--ux-line)" }}>
            <span className="me-3 text-[13px] font-medium" style={{ color: "var(--ux-muted)" }}>Log date</span>
            <input type="date" aria-label="Log date" value={date} max={state?.today ?? undefined} onChange={(e) => setDate(e.target.value)}
                   className="bg-transparent text-[14px] font-semibold outline-none" style={{ color: "var(--ux-ink)" }} />
          </label>
        </header>
        <CycleDesktopNav active="Daily log" />

        {!log || loading ? <div className="h-[520px] animate-pulse rounded-[24px]" style={{ background: "var(--ux-surface-2)" }} /> : (
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
            <div className="grid gap-5 lg:grid-cols-2">
              <Card title="Period and flow" sub="Quick details improve your personal pattern" icon="Droplets">
                <div className="mb-4 grid grid-cols-3 gap-2" role="radiogroup" aria-label="Period today">
                  {([{ v: true, label: "Yes" }, { v: false, label: "No" }, { v: null, label: "Not logged" }] as const).map((x) => (
                    <button key={x.label} type="button" role="radio" aria-checked={log.period === x.v} onClick={() => set("period", x.v)}
                            className="ux-press min-h-11 rounded-[12px] text-[13px] font-semibold"
                            style={log.period === x.v ? { background: "var(--cy-predicted)", color: "var(--cy-period-ink)", boxShadow: "inset 0 0 0 1.5px var(--cy-period)" }
                              : { background: "var(--ux-surface-2)", color: "var(--ux-ink-2)" }}>{x.label}</button>
                  ))}
                </div>
                {log.period && <Choices label="Flow" value={log.flow} items={FLOWS} onChange={(v) => set("flow", v)} />}
                <div className="mt-5"><Slider label="Pain or cramps" value={log.pain} min={0} max={10} suffix=" / 10" onChange={(v) => set("pain", v)} /></div>
              </Card>

              <Card title="Mood and energy" sub="See how they move across your cycle" icon="Smile">
                <Choices label="Mood" value={log.mood} items={MOODS.map((x) => ({ value: x.key, label: x.label })) as Choice<Mood>[]}
                         onChange={(v) => set("mood", v)} />
                <div className="mt-5"><Slider label="Energy" value={log.energy} min={1} max={5} suffix=" / 5" onChange={(v) => set("energy", v)} /></div>
              </Card>

              <Card title="Symptoms" sub="Select symptoms, then record how strong they feel" icon="Activity">
                <div className="grid grid-cols-2 gap-2 2xl:grid-cols-3">
                  {SYMPTOMS.filter((x) => x.key !== "none").map((item) => {
                    const on = log.symptoms.includes(item.key);
                    const level = log.symptom_severity[item.key as Exclude<Symptom, "none">] ?? 1;
                    return (
                      <div key={item.key} className="rounded-[13px] p-2" style={{ background: on ? "var(--cy-predicted)" : "var(--ux-surface-2)", border: "1px solid var(--ux-line)" }}>
                        <button type="button" aria-pressed={on} onClick={() => toggleSymptom(item.key)} className="flex min-h-9 w-full items-center gap-2 text-start text-[13px]">
                          <Icon name={item.icon} className="h-4 w-4" style={{ color: on ? "var(--cy-period-ink)" : "var(--ux-muted)" }} />
                          <span className="font-medium" style={{ color: "var(--ux-ink-2)" }}>{item.label}</span>
                        </button>
                        {on && <div className="mt-1 flex gap-1" aria-label={`${item.label} severity`}>
                          {([1, 2, 3] as const).map((n) => <button key={n} type="button" onClick={() => severity(item.key as Exclude<Symptom, "none">, n)}
                            className="min-h-8 flex-1 rounded-[8px] text-[11px] font-semibold" style={level === n ? { background: "var(--cy-period)", color: "var(--ux-on-brand)" } : { background: "var(--ux-surface)", color: "var(--ux-muted)" }}>
                            {n === 1 ? "Mild" : n === 2 ? "Medium" : "Strong"}
                          </button>)}
                        </div>}
                      </div>
                    );
                  })}
                </div>
              </Card>

              <Card title="Sleep and daily care" sub="Small habits can explain recurring patterns" icon="Moon">
                <div className="grid grid-cols-2 gap-4">
                  <label className="block"><span className="mb-1 block text-[13px] font-medium" style={{ color: "var(--ux-ink-2)" }}>Sleep hours</span>
                    <input type="number" aria-label="Sleep hours" min="0" max="24" step="0.5" value={log.sleep_hours ?? ""} onChange={(e) => set("sleep_hours", e.target.value ? Number(e.target.value) : null)}
                           className="h-11 w-full rounded-[12px] px-3" style={{ background: "var(--ux-surface-2)", color: "var(--ux-ink)", border: "1px solid var(--ux-line)" }} /></label>
                  <label className="block"><span className="mb-1 block text-[13px] font-medium" style={{ color: "var(--ux-ink-2)" }}>Movement</span>
                    <div className="relative"><input type="number" aria-label="Movement in minutes" min="0" max="600" value={log.exercise_minutes ?? ""} onChange={(e) => set("exercise_minutes", e.target.value ? Number(e.target.value) : null)}
                           className="h-11 w-full rounded-[12px] px-3 pe-12" style={{ background: "var(--ux-surface-2)", color: "var(--ux-ink)", border: "1px solid var(--ux-line)" }} /><span className="absolute end-3 top-3 text-[12px]" style={{ color: "var(--ux-muted)" }}>min</span></div></label>
                </div>
                <div className="mt-4"><Choices label="Sleep quality" value={log.sleep_quality} items={SLEEP} onChange={(v) => set("sleep_quality", v)} /></div>
                <div className="mt-5"><Slider label="Water" value={log.water_glasses} min={0} max={20} suffix=" glasses" onChange={(v) => set("water_glasses", v)} /></div>
              </Card>

              <Card title="Fertility signs" sub="Optional body observations; calendar estimates are not contraception" icon="Sparkles">
                <div className="mb-4 grid grid-cols-2 gap-3">
                  <label className="block"><span className="mb-1 block text-[13px] font-medium" style={{ color: "var(--ux-ink-2)" }}>Morning temperature</span>
                    <div className="relative"><input type="number" aria-label="Morning temperature in Celsius" min="34" max="42" step="0.01" value={log.basal_temp_c ?? ""} onChange={(e) => set("basal_temp_c", e.target.value ? Number(e.target.value) : null)}
                      className="h-11 w-full rounded-[12px] px-3 pe-9" style={{ background: "var(--ux-surface-2)", color: "var(--ux-ink)", border: "1px solid var(--ux-line)" }} /><span className="absolute end-3 top-3 text-[12px]" style={{ color: "var(--ux-muted)" }}>°C</span></div></label>
                  <label className="block"><span className="mb-1 block text-[13px] font-medium" style={{ color: "var(--ux-ink-2)" }}>Weight</span>
                    <div className="relative"><input type="number" aria-label="Weight in kilograms" min="20" max="400" step="0.1" value={log.weight_kg ?? ""} onChange={(e) => set("weight_kg", e.target.value ? Number(e.target.value) : null)}
                      className="h-11 w-full rounded-[12px] px-3 pe-9" style={{ background: "var(--ux-surface-2)", color: "var(--ux-ink)", border: "1px solid var(--ux-line)" }} /><span className="absolute end-3 top-3 text-[12px]" style={{ color: "var(--ux-muted)" }}>kg</span></div></label>
                </div>
                <p className="mb-2 text-[12px] font-bold uppercase tracking-[0.08em]" style={{ color: "var(--ux-muted)" }}>Cervical fluid</p>
                <Choices label="Cervical fluid" value={log.cervical_mucus} items={MUCUS} onChange={(v) => set("cervical_mucus", v)} />
                <p className="mb-2 mt-4 text-[12px] font-bold uppercase tracking-[0.08em]" style={{ color: "var(--ux-muted)" }}>Ovulation test</p>
                <Choices label="Ovulation test" value={log.ovulation_test} items={OPK} onChange={(v) => set("ovulation_test", v)} />
              </Card>

              <Card title="Private details" sub="Hidden until you choose to open them" icon="Lock">
                {!showSensitive ? <button type="button" onClick={() => setShowSensitive(true)} className="ux-press flex min-h-12 w-full items-center justify-center gap-2 rounded-[12px] font-semibold"
                  style={{ background: "var(--ux-surface-2)", color: "var(--ux-ink-2)", border: "1px solid var(--ux-line)" }}><Icons.Eye className="h-4 w-4" /> Show private fields</button> : <>
                  <p className="mb-2 text-[12px] font-bold uppercase tracking-[0.08em]" style={{ color: "var(--ux-muted)" }}>Pregnancy test</p>
                  <Choices label="Pregnancy test" value={log.pregnancy_test} items={PREGNANCY} onChange={(v) => set("pregnancy_test", v)} />
                  <p className="mb-2 mt-4 text-[12px] font-bold uppercase tracking-[0.08em]" style={{ color: "var(--ux-muted)" }}>Sexual activity</p>
                  <Choices label="Sexual activity" value={log.intimacy} items={INTIMACY} onChange={(v) => set("intimacy", v)} />
                  <button type="button" onClick={() => setShowSensitive(false)} className="mt-4 text-[12px] underline" style={{ color: "var(--ux-muted)" }}>Hide private fields</button>
                </>}
              </Card>
            </div>

            <aside className="space-y-5 xl:sticky xl:top-6 xl:self-start">
              <section className="rounded-[22px] p-5" style={{ background: "linear-gradient(145deg, var(--cy-predicted), var(--cy-fertile))", border: "1px solid var(--ux-line)" }}>
                <p className="text-[12px] font-bold uppercase tracking-[0.12em]" style={{ color: "var(--cy-period-ink)" }}>Today at a glance</p>
                <h2 className="mt-2 text-[22px] font-semibold" style={{ color: "var(--ux-ink)" }}>{state && !state.profile.predictions.phase ? "Phase guidance is off" : state?.status.phase_label || "Learning your pattern"}</h2>
                <p className="mt-1 text-[13px]" style={{ color: "var(--ux-ink-2)" }}>
                  {state?.status.cycle_day ? `Cycle day ${state.status.cycle_day}` : "Log a period to begin predictions"}
                  {state?.status.days_until != null && state.status.days_until >= 0 ? ` · ${state.status.days_until} days to next period` : ""}
                </p>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <div className="rounded-[12px] p-3" style={{ background: "var(--ux-surface)" }}><b className="block text-[20px]">{log.symptoms.length}</b><span className="text-[12px]" style={{ color: "var(--ux-muted)" }}>symptoms</span></div>
                  <div className="rounded-[12px] p-3" style={{ background: "var(--ux-surface)" }}><b className="block text-[20px]">{log.energy ?? "—"}</b><span className="text-[12px]" style={{ color: "var(--ux-muted)" }}>energy / 5</span></div>
                </div>
              </section>

              <Card title="Medicines" sub="Mark what you took today" icon="Pill">
                {activeMedicines.length ? <div className="space-y-2">{activeMedicines.map((medicine) => {
                  const on = log.medications_taken.includes(medicine.id);
                  return <button key={medicine.id} type="button" aria-pressed={on} onClick={() => set("medications_taken", on ? log.medications_taken.filter((x) => x !== medicine.id) : [...log.medications_taken, medicine.id])}
                    className="ux-press flex min-h-11 w-full items-center gap-3 rounded-[11px] px-3 text-start" style={on ? { background: "var(--ux-tint-green)", color: "var(--ux-green-ink)" } : { background: "var(--ux-surface-2)", color: "var(--ux-ink-2)" }}>
                    {on ? <Icons.CheckCircle2 className="h-4 w-4" /> : <Icons.Circle className="h-4 w-4" />}<span><b className="block text-[13px]">{medicine.name}</b><span className="text-[11px]">{medicine.dose || medicine.times.join(", ")}</span></span>
                  </button>;
                })}</div> : <p className="text-[13px]" style={{ color: "var(--ux-muted)" }}>No medicines added yet.</p>}
                <Link href="/app/health/cycle/medicines" className="mt-3 inline-flex min-h-10 items-center text-[13px] font-semibold" style={{ color: "var(--cy-period-ink)" }}>Manage medicines <Icons.ArrowRight className="ms-1 h-4 w-4" /></Link>
              </Card>

              <Card title="Private note" sub="Up to 500 characters, visible only to you" icon="NotebookPen">
                <textarea value={log.note} onChange={(e) => set("note", e.target.value.slice(0, 500))} rows={5} placeholder="Anything you want to remember..."
                          className="w-full resize-none rounded-[12px] p-3 text-[13px] outline-none" style={{ background: "var(--ux-surface-2)", color: "var(--ux-ink)", border: "1px solid var(--ux-line)" }} />
                <span className="mt-1 block text-end text-[11px]" style={{ color: "var(--ux-muted)" }}>{log.note.length}/500</span>
              </Card>

              {error && <p role="alert" className="rounded-[12px] p-3 text-[13px]" style={{ background: "var(--ux-danger-tint)", color: "var(--ux-danger-solid)" }}>{error}</p>}
              {saved && <p role="status" className="rounded-[12px] p-3 text-[13px] font-semibold" style={{ background: "var(--ux-tint-green)", color: "var(--ux-green-ink)" }}>Saved. Your dashboard and insights are updated.</p>}
              <button type="button" disabled={busy} onClick={save} className="ux-press h-[52px] w-full rounded-[14px] text-[16px] font-semibold disabled:opacity-50"
                      style={{ background: "linear-gradient(90deg, var(--cy-period), var(--ux-fill))", color: "var(--ux-on-brand)", boxShadow: "0 12px 24px -14px var(--cy-period)" }}>
                {busy ? "Saving…" : "Save today’s log"}
              </button>
              <p className="flex items-start gap-2 text-[12px] leading-relaxed" style={{ color: "var(--ux-muted)" }}><Icons.ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />Cycle estimates support awareness. They do not diagnose a condition or prevent pregnancy.</p>
            </aside>
          </div>
        )}
      </div>
    </HomeShell>
  );
}
