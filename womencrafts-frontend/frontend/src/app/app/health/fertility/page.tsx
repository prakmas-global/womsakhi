"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { Btn } from "@/components/ux/kit";
import { Sheet } from "@/components/ux/kit/sheet";
import { MonthCalendar, Legend, PhaseBar, InsightRow } from "@/components/ux/cycle/parts";
import { SYMPTOMS, symptomLabel } from "@/components/ux/cycle/data";
import { useCycle } from "@/components/ux/cycle/use-cycle";
import {
  BarChart, Chips, Cols, Disclaimer, Empty, HealthFrame, HUE, I, Metric, MetricGrid, Panel,
} from "@/components/ux/health/kit";
import { FERT_QUESTIONS, GOAL_LABEL, PRECONCEPTION } from "@/components/ux/health/pregnancy-data";
import { Checklist, ConsultCard, useChecks } from "@/components/ux/health/checklist";
import {
  apiCycleDay, apiCycleLog, apiCycleSettings,
  type CycleLog, type CycleState, type Flow, type Symptom, type TrackingGoal,
} from "@/lib/cycle-api";
import { addDays, fmtDay } from "@/lib/health-api";

/**
 * Fertility — the cycle tracker, laid out the way the Health module is.
 *
 * Every number here comes from `/me/cycle` (routes/cycle.py); this screen
 * keeps no period data of its own. Where the cycle tracker already has a
 * fuller screen (the daily log, guides, the doctor report) it links there.
 * Predictions are labelled as estimates wherever they appear: a fertile
 * window is never a method of contraception.
 */

const TABS = [
  { id: "cycle", label: "Cycle" },
  { id: "calendar", label: "Calendar" },
  { id: "insights", label: "Insights" },
  { id: "plan", label: "Plan" },
  { id: "consultation", label: "Consultation" },
];

const FLOWS: { value: Flow; label: string }[] = [
  { value: "spotting", label: "Spotting" }, { value: "light", label: "Light" },
  { value: "medium", label: "Medium" }, { value: "heavy", label: "Heavy" },
];
const QUICK_SYMPTOMS = SYMPTOMS.filter((s) => s.key !== "none");

const est = (
  <span className="ms-1 rounded-[6px] px-1.5 py-[1px] align-middle text-[10px] font-extrabold uppercase tracking-[0.06em]"
        style={{ background: "var(--ux-tint-amber)", color: "var(--ux-amber-ink)" }}>Estimate</span>
);

export default function FertilityPage() {
  const [month, setMonth] = useState<string | undefined>(undefined);
  const cycle = useCycle(month);
  const { data, act, busy, error, reload } = cycle;
  const state = data && data.setup ? data : null;
  const notSetUp = data && !data.setup;
  const today = data?.today ?? "";
  const loggedToday = !!state?.log?.period;

  const periodToday = () => act(() => apiCycleLog(today, { period: true }));

  return (
    <HealthFrame active="/app/health/fertility" hue="pink" icon="Flower2" eyebrow="Fertility"
                 title="Fertility" sub="Understand your cycle and plan your future. Everything here is private to you."
                 art="/ux/art/learn-dashboard-mindfulness.webp" tabs={TABS}
                 actions={state ? (
                   <>
                     {loggedToday
                       ? <span className="inline-flex min-h-[40px] items-center gap-1.5 rounded-full px-3.5 text-sm font-bold"
                               style={{ background: "var(--ux-tint-green)", color: "var(--ux-green-ink)" }}>
                           <I name="Check" className="h-4 w-4" /> Period logged for today
                         </span>
                       : <Btn icon="Droplet" loading={busy} onClick={periodToday}>My period started today</Btn>}
                     <Btn variant="outline" icon="CalendarDays" href="/app/health/fertility?tab=calendar">Track symptoms</Btn>
                   </>
                 ) : null}>
      {(tab) => (
        <>
          {error && (
            <p role="alert" className="flex flex-wrap items-center gap-2 rounded-[12px] p-3 text-sm font-semibold"
               style={{ background: "var(--ux-danger-tint)", color: "var(--ux-danger-ink)" }}>
              {error} <button type="button" className="underline" onClick={reload}>Try again</button>
            </p>
          )}
          {notSetUp ? <SetUp /> : !state ? <Loading /> : (
            <>
              {tab === "cycle" && <CycleTab s={state} onPeriod={periodToday} busy={busy} act={act} />}
              {tab === "calendar" && <CalendarTab s={state} month={month} setMonth={setMonth} act={act} />}
              {tab === "insights" && <InsightsTab s={state} />}
              {tab === "plan" && <PlanTab s={state} act={act} />}
              {tab === "consultation" && <ConsultTab s={state} />}
            </>
          )}
        </>
      )}
    </HealthFrame>
  );
}

type Act = (fn: () => Promise<CycleState>) => Promise<CycleState | null>;

function Loading() {
  return <div className="h-[320px] animate-pulse rounded-[20px]" style={{ background: "var(--ux-surface-2)" }} />;
}

function SetUp() {
  return (
    <Panel>
      <Empty icon="Flower2" title="Start tracking your cycle"
             body="Tell us when your last period started and how long your cycle usually is. It takes a minute, and your estimates get better each month."
             action={<Btn icon="ArrowRight" href="/app/health/cycle/start">Set up cycle tracking</Btn>} />
    </Panel>
  );
}

/* ── Cycle ─────────────────────────────────────────────────────────────── */

function predictions(s: CycleState, n = 3) {
  const st = s.status;
  if (!st.next_start) return [];
  const L = st.avg_cycle || s.profile.typical_cycle || 28;
  const P = st.avg_period || s.profile.typical_period || 5;
  return Array.from({ length: n }, (_, k) => {
    const start = addDays(st.next_start!, L * k);
    const ov = addDays(start, -14);
    return { start, end: addDays(start, P - 1), ov, fs: addDays(ov, -5), fe: addDays(ov, 1) };
  });
}

function CycleTab({ s, onPeriod, busy, act }: { s: CycleState; onPeriod: () => void; busy: boolean; act: Act }) {
  const st = s.status;
  const preds = predictions(s);
  const len = st.avg_cycle || s.profile.typical_cycle;
  const symptomsToday: Symptom[] = (s.log?.symptoms ?? []).filter((x) => x !== "none");
  const toggleSymptom = (k: Symptom) => {
    const next = symptomsToday.includes(k) ? symptomsToday.filter((x) => x !== k) : [...symptomsToday, k];
    act(() => apiCycleLog(s.today, { symptoms: next }));
  };
  const fertileOn = s.profile.predictions.fertility;

  return (
    <Cols
      main={
        <>
          <Panel title="Cycle overview" sub={st.phase_label ? `You are in your ${st.phase_label.toLowerCase()}` : undefined}>
            {st.cycle_day ? (
              <div className="flex flex-wrap items-end gap-x-6 gap-y-2">
                <p className="text-[44px] font-extrabold leading-none tabular-nums" style={{ color: HUE.pink.ink }} data-cycle-day>
                  Day {st.cycle_day}
                </p>
                <p className="pb-1 text-sm" style={{ color: "var(--ux-muted)" }}>of about {len} days{st.on_period && st.period_day ? ` · period day ${st.period_day}` : ""}</p>
              </div>
            ) : <p className="text-sm" style={{ color: "var(--ux-muted)" }}>Log your period to see where you are in your cycle.</p>}
            {st.cycle_day && <PhaseBar phases={s.phases} day={st.cycle_day} length={len} />}
            <MetricGrid>
              <Metric hue="pink" icon="Droplet" label="Next period" value={st.next_start ? (st.days_until != null && st.days_until < 0 ? "Late" : fmtDay(st.next_start)) : "—"}
                      sub={st.days_until != null ? (st.days_until < 0 ? `Expected around ${fmtDay(st.next_start!)}` : st.days_until === 0 ? "Expected today" : `In ${st.days_until} days`) : undefined} />
              {fertileOn && (
                <Metric hue="violet" icon="Sparkles" label="Fertile window"
                        value={st.fertile_start && st.fertile_end ? `${fmtDay(st.fertile_start)} – ${fmtDay(st.fertile_end)}` : "—"} />
              )}
              {fertileOn && <Metric hue="violet" icon="Circle" label="Ovulation" value={st.ovulation ? fmtDay(st.ovulation) : "—"} />}
              <Metric hue="amber" icon="RefreshCw" label="Cycle length used" value={len} unit="days"
                      sub={st.measured_cycles ? `From ${st.measured_cycles} logged cycle${st.measured_cycles > 1 ? "s" : ""}` : "Your usual length"} />
            </MetricGrid>
            <p className="text-xs" style={{ color: "var(--ux-muted)" }}>Dates above are estimates{est}</p>
            <Disclaimer>
              <b>These are estimates, not guaranteed dates.</b> Cycles change from month to month. Don&rsquo;t rely on the
              fertile window to prevent pregnancy. See a doctor if your periods are very irregular or much later than usual.
            </Disclaimer>
          </Panel>

          {preds.length > 0 && (
            <Panel title="Coming up" sub="Your next three estimated periods">
              <ul className="flex flex-col">
                {preds.map((p, i) => (
                  <li key={p.start} className={`flex items-center gap-3 py-2.5 ${i ? "border-t" : ""}`} style={{ borderColor: "var(--ux-line)" }}>
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px]" style={{ background: "var(--cy-predicted)", color: "var(--cy-predicted-ink)" }}>
                      <I name="Droplet" className="h-[18px] w-[18px]" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <b className="block text-sm" style={{ color: "var(--ux-ink)" }}>{fmtDay(p.start, { weekday: "short", day: "numeric", month: "short" })}</b>
                      <span className="text-xs" style={{ color: "var(--ux-muted)" }}>
                        Estimated period{fertileOn ? ` · fertile window ${fmtDay(p.fs)}–${fmtDay(p.fe)}` : ""}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </>
      }
      side={
        <>
          <Panel title="Quick log" sub="Tap to add or remove. Saved straight away.">
            {s.log?.period
              ? <span className="inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-bold"
                      style={{ background: "var(--ux-tint-green)", color: "var(--ux-green-ink)" }}><I name="Check" className="h-4 w-4" /> Period logged for today</span>
              : <Btn icon="Droplet" loading={busy} onClick={onPeriod}>My period started today</Btn>}
            <div>
              <p className="mb-2 text-xs font-bold" style={{ color: "var(--ux-ink-2)" }}>Symptoms today</p>
              <Chips label="Today's symptoms" hue="pink" options={QUICK_SYMPTOMS.map((x) => ({ value: x.key, label: x.label }))}
                     value={symptomsToday} onChange={(k) => toggleSymptom(k as Symptom)} />
            </div>
            <Link href="/app/health/cycle/log" className="text-sm font-bold" style={{ color: "var(--ux-brand)" }}>
              Full daily log — mood, flow, sleep →
            </Link>
          </Panel>
          <ExpertCard />
        </>
      }
    />
  );
}

function ExpertCard() {
  return (
    <Panel hue="green" tint>
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[12px]" style={{ background: "var(--ux-surface)", color: HUE.green.ink }}>
          <I name="Stethoscope" />
        </span>
        <div className="min-w-0">
          <h2 className="text-base font-extrabold" style={{ color: "var(--ux-ink)" }}>Talk to a fertility expert</h2>
          <p className="text-xs" style={{ color: "var(--ux-ink-2)" }}>Questions about your cycle or trying to conceive.</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Btn size="sm" href="/app/health/doctors?speciality=Gynaecologist">Find a gynaecologist</Btn>
        <Btn size="sm" variant="outline" href="/app/health/mentors?topic=Fertility">Talk to a mentor</Btn>
      </div>
    </Panel>
  );
}

/* ── Calendar ─────────────────────────────────────────────────────────── */

function CalendarTab({ s, month, setMonth, act }: { s: CycleState; month?: string; setMonth: (m: string) => void; act: Act }) {
  const shown = month ?? s.calendar.month;
  const cells = s.calendar.month === shown ? s.calendar.days : [];
  const [day, setDay] = useState<string | null>(null);
  const shift = (n: number) => {
    const [y, m] = shown.split("-").map(Number);
    const d = new Date(y, m - 1 + n, 1);
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  };
  return (
    <>
      <Cols
        main={
          <Panel title="Cycle calendar" sub="Tap a past date or today to log your period or symptoms for that day.">
            <div data-fert-calendar className="mx-auto w-full max-w-[460px]">
              {cells.length ? (
                <MonthCalendar month={shown} cells={cells} today={s.today} onPrev={() => shift(-1)} onNext={() => shift(1)} onPick={setDay} />
              ) : <Loading />}
            </div>
            <Legend />
            <p className="text-xs" style={{ color: "var(--ux-muted)" }}>Predicted days, fertile days and ovulation are estimates.</p>
          </Panel>
        }
        side={
          <Panel title="Period history" sub="Most recent first">
            {s.history.length ? (
              <ul className="flex flex-col">
                {[...s.history].sort((a, b) => b.start.localeCompare(a.start)).slice(0, 8).map((h, i) => (
                  <li key={h.start} className={`flex items-center justify-between gap-3 py-2.5 text-sm ${i ? "border-t" : ""}`} style={{ borderColor: "var(--ux-line)" }}>
                    <b style={{ color: "var(--ux-ink)" }}>{fmtDay(h.start, { day: "numeric", month: "short", year: "numeric" })}</b>
                    <span className="text-xs" style={{ color: "var(--ux-muted)" }}>
                      {h.period_days} day period{h.cycle_days ? ` · ${h.cycle_days} day cycle` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm" style={{ color: "var(--ux-muted)" }}>Your periods will be listed here once you log them.</p>}
          </Panel>
        }
      />
      {day && <DaySheet date={day} onClose={() => setDay(null)} act={act} />}
    </>
  );
}

function DaySheet({ date, onClose, act }: { date: string; onClose: () => void; act: Act }) {
  const [log, setLog] = useState<CycleLog | null>(null);
  const [period, setPeriod] = useState<boolean | null>(null);
  const [flow, setFlow] = useState<Flow | null>(null);
  const [symptoms, setSymptoms] = useState<Symptom[]>([]);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    const ctl = new AbortController();
    apiCycleDay(date, ctl.signal).then((l) => {
      setLog(l); setPeriod(l.period); setFlow(l.flow); setSymptoms((l.symptoms ?? []).filter((x) => x !== "none"));
    }).catch(() => setLog({} as CycleLog));
    return () => ctl.abort();
  }, [date]);
  const save = async () => {
    setSaving(true);
    const ok = await act(() => apiCycleLog(date, { period, flow: period ? flow : null, symptoms }));
    setSaving(false);
    if (ok) onClose();
  };
  return (
    <Sheet open onClose={onClose} icon="CalendarDays" title={fmtDay(date, { weekday: "long", day: "numeric", month: "long" })}
           description="Log your period and how you felt that day."
           footer={<Btn full icon="Check" loading={saving} disabled={!log} onClick={save}>Save this day</Btn>}>
      {!log ? <Loading /> : (
        <div className="flex flex-col gap-5">
          <div>
            <p className="mb-2 text-xs font-bold" style={{ color: "var(--ux-ink-2)" }}>Were you on your period?</p>
            <Chips label="Period" hue="pink" options={[{ value: "yes", label: "Yes" }, { value: "no", label: "No" }]}
                   value={period == null ? "" : period ? "yes" : "no"} onChange={(v) => setPeriod(v === "yes")} />
          </div>
          {period && (
            <div>
              <p className="mb-2 text-xs font-bold" style={{ color: "var(--ux-ink-2)" }}>Flow</p>
              <Chips label="Flow" hue="pink" options={FLOWS} value={flow ?? ""} onChange={(v) => setFlow(v as Flow)} />
            </div>
          )}
          <div>
            <p className="mb-2 text-xs font-bold" style={{ color: "var(--ux-ink-2)" }}>Symptoms</p>
            <Chips label="Symptoms" hue="pink" options={QUICK_SYMPTOMS.map((x) => ({ value: x.key, label: x.label }))} value={symptoms}
                   onChange={(k) => setSymptoms((cur) => (cur.includes(k as Symptom) ? cur.filter((x) => x !== k) : [...cur, k as Symptom]))} />
          </div>
        </div>
      )}
    </Sheet>
  );
}

/* ── Insights ─────────────────────────────────────────────────────────── */

function InsightsTab({ s }: { s: CycleState }) {
  // Oldest first for the chart, the last eight measured cycles.
  const cycles = [...s.history].sort((a, b) => a.start.localeCompare(b.start)).filter((h) => h.cycle_days).slice(-8);
  const lens = cycles.map((h) => h.cycle_days as number);
  const counts = Object.entries(s.symptom_counts).filter(([k, n]) => k !== "none" && n).sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0)).slice(0, 8);
  const maxCount = Math.max(1, ...counts.map(([, n]) => n ?? 0));
  const mn = lens.length ? Math.min(...lens) : 0, mx = lens.length ? Math.max(...lens) : 0;
  return (
    <Cols
      main={
        <Panel title="Cycle insights" sub="From the periods you have logged">
          {lens.length < 1 ? (
            <Empty icon="BarChart3" title="Log two or more periods"
                   body="Insights about your cycle length appear once you've logged at least two periods."
                   action={<Btn size="sm" variant="outline" href="/app/health/fertility?tab=calendar">Log a period</Btn>} />
          ) : (
            <>
              <MetricGrid>
                <Metric hue="pink" icon="RefreshCw" label="Average cycle" value={Math.round(lens.reduce((a, b) => a + b, 0) / lens.length)} unit="days" sub={`${lens.length} cycle${lens.length > 1 ? "s" : ""}`} />
                <Metric hue="violet" icon="ArrowLeftRight" label="Shortest / longest" value={`${mn} / ${mx}`} unit="days" />
                <Metric hue="amber" icon="Droplet" label="Average period" value={s.status.avg_period} unit="days" />
                <Metric hue="green" icon="Activity" label="Variation" value={mx - mn} unit="days" sub={mx - mn <= 7 ? "Fairly regular" : "Varies quite a bit"} />
              </MetricGrid>
              <div>
                <h3 className="mb-2 text-sm font-extrabold" style={{ color: "var(--ux-ink)" }}>Length of each cycle</h3>
                {/* Few cycles would stretch to the full width and look enormous; the
                    chart grows with the number of bars instead. */}
                <div style={{ maxWidth: Math.max(300, cycles.length * 80) }}>
                  <BarChart hue="pink" unit="d" height={150} data={cycles.map((h) => ({ label: fmtDay(h.start), value: h.cycle_days as number }))} />
                </div>
              </div>
              <p className="text-xs" style={{ color: "var(--ux-muted)" }}>
                Cycles shorter than 21 days, longer than 35 days, or that change a lot are worth discussing with a doctor.
              </p>
            </>
          )}
          {s.insights.length > 0 && (
            <div className="flex flex-col gap-2">{s.insights.slice(0, 4).map((i, k) => <InsightRow key={k} i={i} />)}</div>
          )}
          <Link href="/app/health/cycle/insights" className="text-sm font-bold" style={{ color: "var(--ux-brand)" }}>All your health insights →</Link>
        </Panel>
      }
      side={
        <Panel title="Symptom trends" sub="Days each symptom was logged">
          {counts.length ? (
            <ul className="flex flex-col gap-2.5" data-symptom-bars>
              {counts.map(([k, n]) => (
                <li key={k} className="grid grid-cols-[110px_minmax(0,1fr)_32px] items-center gap-2.5 text-[13px] font-semibold">
                  <span className="truncate" style={{ color: "var(--ux-ink-2)" }}>{symptomLabel(k)}</span>
                  <span className="h-[10px] overflow-hidden rounded-full" style={{ background: "var(--ux-surface-2)" }}>
                    <span className="block h-full rounded-full" style={{ width: `${((n ?? 0) / maxCount) * 100}%`, background: HUE.pink.ink }} />
                  </span>
                  <span className="text-end tabular-nums" style={{ color: "var(--ux-muted)" }}>{n}</span>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm" style={{ color: "var(--ux-muted)" }}>No symptoms logged yet. Tap symptoms on the Cycle tab.</p>}
          <Link href="/app/health/cycle/learn" className="text-sm font-bold" style={{ color: "var(--ux-brand)" }}>Read the cycle guides →</Link>
        </Panel>
      }
    />
  );
}

/* ── Plan ─────────────────────────────────────────────────────────────── */

function PlanTab({ s, act }: { s: CycleState; act: Act }) {
  const { checks, toggle } = useChecks();
  const goal = s.profile.tracking_goal;
  const goals = Object.keys(GOAL_LABEL) as TrackingGoal[];
  const preds = s.profile.predictions;
  return (
    <Cols
      main={
        <>
          <Panel title="What are you tracking for?" sub="This changes what we show you first.">
            <Chips label="Tracking goal" hue="pink" options={goals.map((g) => ({ value: g, label: GOAL_LABEL[g].label }))}
                   value={goal} onChange={(g) => act(() => apiCycleSettings({ tracking_goal: g as TrackingGoal }))} />
            <p className="text-sm" style={{ color: "var(--ux-muted)" }}>{GOAL_LABEL[goal]?.note}</p>
            {goal !== "trying-to-conceive" && (
              <Disclaimer>Want to avoid pregnancy? Fertile-window estimates are <b>not a method of contraception</b>. Ask a doctor or your nearest health centre about free family-planning options.</Disclaimer>
            )}
          </Panel>
          <Panel title={goal === "trying-to-conceive" ? "Getting ready for pregnancy" : "If you plan a pregnancy"} sub="A checklist to go through with your doctor">
            <Checklist label="preconception" items={PRECONCEPTION} done={checks.preconception ?? []} onToggle={(id) => toggle("preconception", id)} />
          </Panel>
        </>
      }
      side={
        <>
          <Panel title="What to show" sub="Turn estimates on or off">
            {([
              ["period_predictions", "Next period", preds.period],
              ["fertility_predictions", "Fertile window and ovulation", preds.fertility],
              ["phase_predictions", "Cycle phase", preds.phase],
            ] as const).map(([key, label, on]) => (
              <button key={key} type="button" role="switch" aria-checked={on}
                      onClick={() => act(() => apiCycleSettings({ [key]: !on }))}
                      className="ux-press flex min-h-[44px] items-center justify-between gap-3 text-start text-sm font-semibold" style={{ color: "var(--ux-ink)" }}>
                {label}
                <span className="flex h-[24px] w-[42px] shrink-0 items-center rounded-full p-[3px]" style={{ background: on ? "var(--ux-fill)" : "var(--ux-line-strong)" }}>
                  <span className="h-[18px] w-[18px] rounded-full transition-transform" style={{ background: "var(--ux-surface)", transform: on ? "translateX(18px)" : "none" }} />
                </span>
              </button>
            ))}
          </Panel>
          <Panel title="About estimates">
            <p className="text-sm leading-relaxed" style={{ color: "var(--ux-muted)" }}>
              WomSakhi estimates your next period from your average cycle length, and the fertile window as about 5 days before to
              1 day after the estimated ovulation day (about 14 days before your next period). These are estimates, not medical
              results, and not a method of contraception.
            </p>
            <Link href="/app/health/cycle/settings" className="text-sm font-bold" style={{ color: "var(--ux-brand)" }}>Cycle settings and privacy →</Link>
          </Panel>
        </>
      }
    />
  );
}

/* ── Consultation ─────────────────────────────────────────────────────── */

function ConsultTab({ s }: { s: CycleState }) {
  const { checks, toggle } = useChecks();
  const top = useMemo(() => Object.entries(s.symptom_counts).filter(([k, n]) => k !== "none" && n)
    .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0)).slice(0, 3).map(([k]) => symptomLabel(k)), [s.symptom_counts]);
  return (
    <Cols
      main={
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <ConsultCard icon="Stethoscope" hue="green" title="Gynaecologist" body="Period problems, PCOS, trying to conceive, or anything that worries you."
                         href="/app/health/doctors?speciality=Gynaecologist" cta="Find a gynaecologist" />
            <ConsultCard icon="Users" hue="orange" title="Talk to a mentor" body="Women who have been through it share what helped — not medical advice."
                         href="/app/health/mentors?topic=Fertility" cta="Find a mentor" />
          </div>
          <Panel title="Questions to ask your doctor" sub="Tick the ones you want to ask">
            <Checklist label="fert-questions" items={FERT_QUESTIONS} hue="green" done={checks["fert-questions"] ?? []} onToggle={(id) => toggle("fert-questions", id)} />
          </Panel>
        </>
      }
      side={
        <Panel title="Your cycle, for the doctor" sub="Show this at your appointment">
          <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
            <dt style={{ color: "var(--ux-muted)" }}>Average cycle</dt><dd style={{ color: "var(--ux-ink)" }}><b>{s.status.avg_cycle} days</b></dd>
            <dt style={{ color: "var(--ux-muted)" }}>Average period</dt><dd style={{ color: "var(--ux-ink)" }}><b>{s.status.avg_period} days</b></dd>
            <dt style={{ color: "var(--ux-muted)" }}>Last period</dt><dd style={{ color: "var(--ux-ink)" }}><b>{s.status.last_start ? fmtDay(s.status.last_start, { day: "numeric", month: "short", year: "numeric" }) : "—"}</b></dd>
            <dt style={{ color: "var(--ux-muted)" }}>Cycles logged</dt><dd style={{ color: "var(--ux-ink)" }}><b>{s.status.measured_cycles}</b></dd>
            <dt style={{ color: "var(--ux-muted)" }}>Common symptoms</dt><dd style={{ color: "var(--ux-ink)" }}><b>{top.join(", ") || "None logged"}</b></dd>
          </dl>
          <Btn variant="outline" icon="FileText" href="/app/health/cycle/report">Open the full report</Btn>
        </Panel>
      }
    />
  );
}
