"use client";

import Link from "next/link";
import { useT } from "@/i18n";
import { useCallback, useState } from "react";

import * as Icons from "@/components/ux/icons";
import type { CycleState, Mood, Phase, Symptom } from "@/lib/cycle-api";
import { apiCycleLog } from "@/lib/cycle-api";
import { apiMentors, type ApiMentor } from "@/lib/me-api";
import { useResource } from "@/lib/use-resource";
import {
  CycleRing, Icon, InsightRow, Legend, MonthCalendar, MoodRow, RingSeed, SoftHeart, heroBg,
} from "./parts";
import { GUIDES as RAW_GUIDES, MOODS as RAW_MOODS, PHASE_COPY as RAW_PHASE_COPY, SYMPTOMS as RAW_SYMPTOMS, carePlan, quoteFor, symptomLabel } from "./data";
import { shortDate, shiftMonth, type useCycle } from "./use-cycle";
import { useTranslated } from "@/i18n/data";
import { EngineNudge } from "@/components/ux/reminders/EngineNudge";

/**
 * The laptop view of the tracker — the owner's second reference, one screen.
 *
 * Laid out with grid areas so the arrangement can change with the width
 * without any card knowing: four columns from 1440px, where the reference was
 * drawn; three below that, with the right-hand cards moved into a row of
 * their own rather than squeezed to 150px.
 */

const CSS = `
.cy-dash { display: grid; gap: 16px; grid-template-columns: minmax(0,1fr) minmax(0,1fr) 284px;
  grid-template-areas: "hero hero cal" "glance feel cal" "plan plan sym" "bottom bottom bottom" "ins mentor quote"; }
@media (min-width: 1440px) {
  .cy-dash { grid-template-columns: minmax(0,1fr) minmax(0,1fr) 264px 240px;
    grid-template-areas: "hero hero cal ins" "glance feel cal mentor" "plan plan sym mentor" "plan plan sym quote" "bottom bottom bottom quote"; }
}
.cy-dash > [data-a] { min-width: 0; }
`;

const A = ({ a, children, className = "" }: { a: string; children: React.ReactNode; className?: string }) => (
  <div data-a={a} style={{ gridArea: a }} className={className}>{children}</div>
);

function Card({ children, className = "", style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <section className={`h-full rounded-[18px] p-4 ${className}`}
             style={{ background: "var(--ux-surface)", border: "1px solid var(--ux-line)", boxShadow: "var(--ux-shadow-sm)", ...style }}>
      {children}
    </section>
  );
}

const ViewAll = ({ href, label = "View all" }: { href: string; label?: string }) => (
  <Link href={href} className="flex shrink-0 items-center gap-1 whitespace-nowrap text-[13px] font-semibold" style={{ color: "var(--cy-period-ink)" }}>
    {label} <Icons.ArrowRight className="h-3.5 w-3.5" aria-hidden />
  </Link>
);

const MOOD_SCORE: Record<Mood, number> = { happy: 5, calm: 4, tired: 3, irritable: 2, sad: 1 };

export function CycleDashboard({ cycle }: { cycle: ReturnType<typeof useCycle> & { state: CycleState } }) {
  const GUIDES = useTranslated(RAW_GUIDES);
  const SYMPTOMS = useTranslated(RAW_SYMPTOMS);
  const PHASE_COPY = useTranslated(RAW_PHASE_COPY);
  const tr = useT();
  const { state: s, act, busy } = cycle;
  const st = s.status;
  const [month, setMonth] = useState(s.calendar.month);
  const [note, setNote] = useState("");
  const [planPhase, setPlanPhase] = useState<Phase>(st.phase ?? "follicular");
  const [journey, setJourney] = useState<"history" | "moods" | "symptoms" | "notes">("history");
  const mentors = useResource(
    useCallback(async (sig: AbortSignal) => (await apiMentors(sig)).filter((m) => m.expertise.includes("Women's Health")), []),
    [] as ApiMentor[],
  );
  const mentor = mentors.data[0];

  const cells = month === s.calendar.month ? s.calendar.days : null;
  const phases = s.phases;
  const legend = [
    { tone: "var(--cy-period)", label: "Period", sub: `${st.avg_period} days` },
    { tone: "var(--cy-fertile-ink)", label: tr("wellness.fertileWindow"), sub: `Day ${phases[2].from - 4}–${phases[2].from + 1}` },
    { tone: "var(--cy-ovulation)", label: "Ovulation", sub: `Day ${phases[2].from + 1}` },
    { tone: "var(--cy-mood-happy)", label: tr("dashboard.lutealPhase"), sub: `Day ${phases[3].from}–${phases[3].to}` },
  ];
  const plan = carePlan(planPhase);
  const order: Phase[] = ["menstrual", "follicular", "ovulation", "luteal"];
  const stepPhase = (d: number) => setPlanPhase((p) => order[(order.indexOf(p) + d + 4) % 4]);
  const inPhaseDay = st.on_period ? `Day ${st.period_day} of ${st.avg_period}` : st.cycle_day ? `Day ${st.cycle_day} of ${st.avg_cycle}` : "";
  const symptoms = s.log?.symptoms ?? [];

  const toggleSymptom = (k: Symptom) => {
    const cur = symptoms.filter((x) => x !== "none");
    const next = k === "none" ? (symptoms.includes("none") ? [] : ["none"])
      : cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k];
    act(() => apiCycleLog(s.today, { symptoms: next as Symptom[] }));
  };

  return (
    <div className="cy-dash">
      {/*
        Her own check-in, pointed at from the module that already asks about
        her body. It links rather than duplicating the question: one place
        records a mood, and this is not it.
      */}
      <div className="mb-4">
        <EngineNudge href="/app/health/today"
          icon="Smile" tint="--ux-tint-violet" ink="--ux-violet-ink"
          labelKey="nudge.cycle.label" noteKey="nudge.cycle.note" />
      </div>
      <style>{CSS}</style>

      {/* ── Hero ── */}
      <A a="hero">
        <section className="relative h-full min-h-[212px] overflow-hidden rounded-[24px] px-7 py-6" style={{ background: heroBg, border: "1px solid var(--ux-line)" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/ux/art/leaves-pink.webp" alt="" aria-hidden className="pointer-events-none absolute -bottom-10 end-[30%] h-[190px] w-auto opacity-40 mix-blend-multiply" />
          <div className="relative z-[1] max-w-[440px]">
            <h1 className="ux-display text-[34px] font-bold leading-[1.1]" style={{ color: "var(--ux-ink)" }}>
              {tr("dashboard.understandYourCycle")}<br />{tr("dashboard.embraceYour")} <span style={{ color: "var(--cy-period-ink)" }}>Power</span>
            </h1>
            <p className="mt-3 text-[15px] leading-relaxed" style={{ color: "var(--ux-ink-2)" }}>
              {tr("dashboard.trackLearnGetPersonalisedInsights")}<br />{tr("dashboard.becauseAHealthierYouCreatesA")}
            </p>
            <Link href="/app/health/cycle/log"
                  className="ux-press mt-5 inline-flex h-[48px] items-center gap-2 rounded-[14px] px-6 text-[15px] font-semibold"
                  style={{ background: "linear-gradient(90deg, var(--cy-period), var(--ux-fill))", color: "var(--ux-on-brand)", boxShadow: "0 10px 22px -12px var(--cy-period)" }}>
              Log Today&apos;s Update <Icons.ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
          <p className="ux-display pointer-events-none absolute end-6 top-5 z-[2] hidden rotate-[-6deg] text-[18px] italic leading-tight xl:block" style={{ color: "var(--cy-period-ink)" }}>
            {tr("dashboard.yourHealth")}<br />&nbsp;Your rhythm,<br />&nbsp;&nbsp;Your power&rdquo; <SoftHeart />
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/ux/art/scene-woman-meditating.webp" alt="" aria-hidden
               className="pointer-events-none absolute -bottom-[92px] -end-6 h-[330px] w-auto object-contain" />
        </section>
      </A>

      {/* ── Calendar ── */}
      <A a="cal">
        <Card>
          <MonthCalendar compact month={month} cells={cells ?? []} today={s.today}
                         onPrev={() => setMonth((m) => shiftMonth(m, -1))} onNext={() => setMonth((m) => shiftMonth(m, 1))} />
          {!cells && (
            <p className="mt-2 text-center text-[13px]" style={{ color: "var(--ux-muted)" }}>
              <Link href={`/app/health/cycle?month=${month}`} className="font-semibold" style={{ color: "var(--cy-period-ink)" }}>{tr("dashboard.openThisMonth")}</Link>
            </p>
          )}
          <Legend className="mt-4 justify-center" />
        </Card>
      </A>

      {/* ── Cycle insights ── */}
      <A a="ins">
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-[17px] font-semibold" style={{ color: "var(--ux-ink)" }}>{tr("healthCycle.cycleInsights")}</h2>
            <ViewAll href="/app/health/cycle/insights" />
          </div>
          <div className="space-y-4">
            {s.insights.length ? s.insights.slice(0, 4).map((i) => <InsightRow key={i.text} i={i} />)
              : <p className="text-[15px]" style={{ color: "var(--ux-muted)" }}>{tr("dashboard.logAFewDaysToSee")}</p>}
          </div>
        </Card>
      </A>

      {/* ── At a glance ── */}
      <A a="glance">
        <Card>
          <h2 className="text-[17px] font-semibold" style={{ color: "var(--ux-ink)" }}>{tr("dashboard.yourCycleAtAGlance")}</h2>
          <div className="mt-3 flex items-center gap-4">
            <CycleRing value={Math.min(st.cycle_day ?? 0, st.avg_cycle)} max={st.avg_cycle} size={116} stroke={12}>
              <RingSeed size={48} />
            </CycleRing>
            <div className="min-w-0">
              <b className="block text-[20px] font-semibold" style={{ color: "var(--ux-ink)" }}>
                {st.cycle_day ? `Day ${st.cycle_day} of ${st.avg_cycle}` : "Not started"}
              </b>
              <span className="block text-[13px]" style={{ color: "var(--ux-muted)" }}>
                {st.on_period ? `Period day ${st.period_day}` : st.days_until != null && st.days_until >= 0 ? `Next period in ${st.days_until} days` : st.days_until != null ? `${-st.days_until} days late` : ""}
              </span>
              <Link href="/app/health/cycle/log" className="ux-press mt-3 inline-flex h-[40px] items-center rounded-[12px] px-4 text-[15px] font-semibold"
                    style={{ background: "linear-gradient(90deg, var(--cy-period), var(--ux-fill))", color: "var(--ux-on-brand)" }}>
                {tr("dashboard.logToday")}
              </Link>
            </div>
          </div>
          <ul className="mt-4 grid grid-cols-2 gap-x-3 gap-y-2">
            {legend.map((l) => (
              <li key={l.label} className="flex items-start gap-2">
                <span className="mt-1.5 h-[9px] w-[9px] shrink-0 rounded-full" style={{ background: l.tone }} />
                <span className="text-[13px] leading-tight" style={{ color: "var(--ux-ink-2)" }}>
                  {l.label}<br /><span style={{ color: "var(--ux-muted)" }}>{l.sub}</span>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </A>

      {/* ── Feeling ── */}
      <A a="feel">
        <Card>
          <h2 className="mb-3 text-[17px] font-semibold" style={{ color: "var(--ux-ink)" }}>{tr("healthCycle.howAreYouFeelingToday")}</h2>
          <MoodRow value={s.log?.mood ?? null} size={40} onPick={(m) => act(() => apiCycleLog(s.today, { mood: m }))} />
          <form className="mt-4 flex items-center gap-2 rounded-[14px] px-3.5 py-1.5"
                style={{ background: "var(--ux-surface-2)", border: "1px solid var(--ux-line)" }}
                onSubmit={(e) => { e.preventDefault(); if (note.trim()) act(() => apiCycleLog(s.today, { note: note.trim() })).then((r) => r && setNote("")); }}>
            <input value={note} onChange={(e) => setNote(e.target.value.slice(0, 500))} aria-label={tr("dashboard.addAQuickNote")}
                   placeholder={s.log?.note ? `Today: ${s.log.note}` : "Add a quick note (optional)"}
                   className="h-[40px] min-w-0 flex-1 bg-transparent text-[15px] outline-none" style={{ color: "var(--ux-ink)" }} />
            <button type="submit" disabled={busy || !note.trim()} aria-label={tr("healthCycle.saveNote")}
                    className="grid h-9 w-9 place-items-center rounded-full disabled:opacity-40" style={{ color: "var(--cy-period-ink)" }}>
              <Icons.Send className="h-[18px] w-[18px]" aria-hidden />
            </button>
          </form>
        </Card>
      </A>

      {/* ── Care plan ── */}
      <A a="plan">
        <Card>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <span className="grid h-[40px] w-[40px] place-items-center rounded-full" style={{ background: "var(--ux-tint-amber)" }}>
              <Icons.Lightbulb className="h-5 w-5" style={{ color: "var(--cy-mood-tired)" }} aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-[17px] font-semibold" style={{ color: "var(--ux-ink)" }}>Today&apos;s Care Plan</h2>
              <p className="text-[13px]" style={{ color: "var(--ux-muted)" }}>{tr("dashboard.personalisedSuggestionsBasedOnYourCycle")}</p>
            </div>
            <span className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-semibold" style={{ background: "var(--cy-predicted)", color: "var(--cy-period-ink)" }}>
              <Icons.Droplet className="h-3.5 w-3.5" aria-hidden /> {PHASE_COPY[planPhase].chip}
            </span>
            {planPhase === st.phase && inPhaseDay && (
              <span className="rounded-full px-3 py-1.5 text-[13px]" style={{ border: "1px solid var(--ux-line-strong)", color: "var(--ux-ink-2)" }}>{inPhaseDay}</span>
            )}
            <span className="flex gap-1">
              <button type="button" onClick={() => stepPhase(-1)} aria-label={tr("dashboard.previousPhase")} className="ux-press grid h-9 w-9 place-items-center rounded-full" style={{ border: "1px solid var(--ux-line-strong)", color: "var(--ux-ink-2)" }}>
                <Icons.ChevronLeft className="h-4 w-4" aria-hidden />
              </button>
              <button type="button" onClick={() => stepPhase(1)} aria-label={tr("dashboard.nextPhase")} className="ux-press grid h-9 w-9 place-items-center rounded-full" style={{ border: "1px solid var(--ux-line-strong)", color: "var(--ux-ink-2)" }}>
                <Icons.ChevronRight className="h-4 w-4" aria-hidden />
              </button>
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3 2xl:grid-cols-4">
            {plan.map((c) => (
              <div key={c.key} className="flex flex-col rounded-[14px] p-3" style={{ border: "1px solid var(--ux-line)" }}>
                <span className="mb-2 flex items-center gap-2 text-[13px] font-semibold" style={{ color: "var(--ux-ink)" }}>
                  <span className="grid h-7 w-7 place-items-center rounded-full" style={{ background: `var(${c.tint})` }}>
                    <Icon name={c.icon} className="h-4 w-4" style={{ color: "var(--ux-ink-2)" }} />
                  </span>
                  {c.label}
                </span>
                <div className="relative h-[88px] overflow-hidden rounded-[10px]" style={{ background: "var(--cy-hero-b)" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={c.img} alt="" loading="lazy"
                       className={c.art ? "absolute bottom-0 left-1/2 h-[86px] w-auto max-w-none -translate-x-1/2" : "h-full w-full object-cover"} />
                </div>
                <b className="mt-2 block text-[13px] font-semibold leading-snug" style={{ color: "var(--ux-ink)" }}>{c.title}</b>
                <span className="block flex-1 text-[12px] leading-snug" style={{ color: "var(--ux-muted)" }}>{c.sub}</span>
                <Link href={c.href} className="mt-2 flex items-center gap-1 text-[12px] font-semibold" style={{ color: "var(--cy-period-ink)" }}>
                  {c.cta} <Icons.ArrowRight className="h-3 w-3" aria-hidden />
                </Link>
              </div>
            ))}
          </div>
        </Card>
      </A>

      {/* ── Symptoms ── */}
      <A a="sym">
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[17px] font-semibold" style={{ color: "var(--ux-ink)" }}>{tr("dashboard.commonSymptoms")}</h2>
            <Link href="/app/health/cycle/symptoms" className="text-[13px] font-semibold" style={{ color: "var(--cy-period-ink)" }}>Edit</Link>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {SYMPTOMS.map((x) => {
              const on = symptoms.includes(x.key);
              return (
                <button key={x.key} type="button" aria-pressed={on} onClick={() => toggleSymptom(x.key)} disabled={busy}
                        className="ux-press flex min-h-[72px] flex-col items-center justify-center gap-1 rounded-[12px] px-1 text-center"
                        style={on ? { background: "var(--cy-predicted)", boxShadow: "inset 0 0 0 1.5px var(--cy-period)" }
                                  : { background: "var(--ux-surface-2)" }}>
                  <Icon name={x.icon} className="h-5 w-5" style={{ color: on ? "var(--cy-period)" : "var(--cy-predicted-ink)" }} />
                  <span className="text-[12px] leading-tight" style={{ color: "var(--ux-ink-2)", fontWeight: on ? 600 : 400 }}>{x.label}</span>
                </button>
              );
            })}
          </div>
        </Card>
      </A>

      {/* ── Mentor ── */}
      <A a="mentor">
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[15px] font-semibold" style={{ color: "var(--ux-ink)", whiteSpace: "nowrap" }}>{tr("dashboard.yourHealthMentor")}</h2>
            <ViewAll href="/app/health/mentors" />
          </div>
          {mentor ? (
            <div className="flex items-center gap-3">
              <span className="h-[64px] w-[64px] shrink-0 overflow-hidden rounded-full" style={{ background: "var(--cy-predicted)" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {mentor.photo ? <img src={mentor.photo} alt="" className="h-full w-full object-cover object-top" /> : null}
              </span>
              <span className="min-w-0">
                <b className="block text-[15px] font-semibold" style={{ color: "var(--ux-ink)" }}>{mentor.name}</b>
                <span className="block text-[13px]" style={{ color: "var(--ux-muted)" }}>{mentor.headline}</span>
              </span>
            </div>
          ) : (
            <div className="h-[64px] animate-pulse rounded-[12px]" style={{ background: "var(--ux-surface-2)" }} />
          )}
          <p className="mt-3 text-[13px] leading-snug" style={{ color: "var(--ux-ink-2)" }}>
            {tr("dashboard.getExpertAdviceOnMenstrualHealth")}
          </p>
          <Link href="/app/health/mentors" className="ux-press mt-3 flex h-[44px] items-center justify-center gap-2 rounded-[12px] text-[15px] font-semibold"
                style={{ background: "linear-gradient(90deg, var(--cy-period), var(--ux-fill))", color: "var(--ux-on-brand)" }}>
            {tr("dashboard.askAQuestion")} <Icons.ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </Card>
      </A>

      {/* ── Quote ── */}
      <A a="quote">
        <section className="relative h-full min-h-[300px] overflow-hidden rounded-[18px] p-5" style={{ background: heroBg, border: "1px solid var(--ux-line)" }}>
          <p className="ux-display relative z-[1] max-w-[70%] text-[22px] italic leading-snug" style={{ color: "var(--cy-period-ink)" }}>
            &ldquo;{quoteFor(null, s.today).includes("cycle") ? quoteFor(null, s.today) : "It's not just a cycle, it's a sign of a strong, healthy you."}&rdquo; <SoftHeart />
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/ux/art/scene-two-women-support.webp" alt="" aria-hidden className="pointer-events-none absolute -bottom-2 end-0 h-[200px] w-auto object-contain" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/womsakhi-wordmark.png" alt="" aria-hidden className="absolute bottom-4 start-5 z-[1] h-[22px] w-auto opacity-80" />
        </section>
      </A>

      {/* ── Journey + resources ── */}
      <A a="bottom" className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[17px] font-semibold" style={{ color: "var(--ux-ink)" }}>{tr("dashboard.trackYourJourney")}</h2>
            <span className="rounded-[10px] px-3 py-1.5 text-[13px]" style={{ border: "1px solid var(--ux-line-strong)", color: "var(--ux-ink-2)" }}>{tr("dashboard.last6Months")}</span>
          </div>
          <div role="tablist" className="mb-3 flex flex-wrap gap-1.5">
            {([["history", "Cycle History"], ["moods", "Mood Trends"], ["symptoms", "Symptoms"], ["notes", "Health Notes"]] as const).map(([k, l]) => (
              <button key={k} type="button" role="tab" aria-selected={journey === k} onClick={() => setJourney(k)}
                      className="h-[34px] rounded-full px-3.5 text-[13px]"
                      style={journey === k ? { background: "linear-gradient(90deg, var(--cy-period), var(--ux-fill))", color: "var(--ux-on-brand)", fontWeight: 600 }
                                           : { background: "var(--ux-surface-2)", color: "var(--ux-ink-2)" }}>
                {l}
              </button>
            ))}
          </div>
          {journey === "history" && <HistoryChart s={s} />}
          {journey === "moods" && <MoodChart s={s} />}
          {journey === "symptoms" && (
            <ul className="space-y-2">
              {Object.entries(s.symptom_counts).sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0)).slice(0, 5).map(([k, n]) => (
                <li key={k} className="flex justify-between text-[13px]"><span style={{ color: "var(--ux-ink-2)" }}>{symptomLabel(k)}</span><span style={{ color: "var(--ux-muted)" }}>{n} days</span></li>
              ))}
              {!Object.keys(s.symptom_counts).length && <li className="text-[13px]" style={{ color: "var(--ux-muted)" }}>{tr("dashboard.noSymptomsLoggedInTheLast")}</li>}
            </ul>
          )}
          {journey === "notes" && (
            <ul className="space-y-2">
              {s.notes.map((n) => (
                <li key={n.date} className="text-[13px]"><b style={{ color: "var(--ux-ink)" }}>{shortDate(n.date)}</b> <span style={{ color: "var(--ux-ink-2)" }}>{n.note}</span></li>
              ))}
              {!s.notes.length && <li className="text-[13px]" style={{ color: "var(--ux-muted)" }}>{tr("dashboard.notesYouAddAppearHere")}</li>}
            </ul>
          )}
        </Card>
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[17px] font-semibold" style={{ color: "var(--ux-ink)" }}>{tr("healthCycleLearn.helpfulResources")}</h2>
            <ViewAll href="/app/health/cycle/learn" />
          </div>
          <ul className="space-y-2.5">
            {GUIDES.slice(0, 3).map((g) => (
              <li key={g.slug}>
                <Link href={`/app/health/cycle/learn/${g.slug}`} className="ux-press flex items-center gap-3">
                  <span className="relative h-[52px] w-[72px] shrink-0 overflow-hidden rounded-[10px]" style={{ background: "var(--cy-hero-b)" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={g.img} alt="" loading="lazy" className={g.art ? "absolute bottom-0 left-1/2 h-[50px] w-auto max-w-none -translate-x-1/2" : "h-full w-full object-cover"} />
                  </span>
                  <span className="min-w-0">
                    <b className="block truncate text-[15px] font-semibold" style={{ color: "var(--ux-ink)" }}>{g.title}</b>
                    <span className="block text-[13px]" style={{ color: "var(--ux-muted)" }}>{g.sub}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </A>
    </div>
  );
}

/* ── Charts: one scale, labels only where the data reaches ─────────────── */

function HistoryChart({ s }: { s: CycleState }) {
  const tr = useT();
  const pts = s.history.filter((h) => h.cycle_days).slice(-6);
  if (pts.length < 2) {
    return <p className="py-8 text-center text-[13px]" style={{ color: "var(--ux-muted)" }}>{tr("dashboard.twoFinishedCyclesAndYourHistory")}</p>;
  }
  const W = 520, H = 180, L = 30, B = 24, T = 10;
  const x = (i: number) => L + (i * (W - L - 12)) / Math.max(1, pts.length - 1);
  const y = (v: number) => T + (1 - v / 35) * (H - T - B);
  const d = pts.map((p, i) => `${i ? "L" : "M"}${x(i)},${y(p.cycle_days!)}`).join(" ");
  const last = pts[pts.length - 1];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Cycle lengths: ${pts.map((p) => `${p.label} ${p.cycle_days} days`).join(", ")}`}>
      {[0, 7, 14, 21, 28, 35].map((v) => (
        <g key={v}>
          <line x1={L} x2={W - 6} y1={y(v)} y2={y(v)} stroke="var(--ux-line)" strokeWidth={1} />
          <text x={L - 8} y={y(v) + 4} textAnchor="end" fontSize="12" fill="var(--ux-muted)">{v}</text>
        </g>
      ))}
      <path d={d} fill="none" stroke="var(--cy-period)" strokeWidth={2.5} strokeLinejoin="round" />
      {pts.map((p, i) => (
        <g key={p.start}>
          <circle cx={x(i)} cy={y(p.cycle_days!)} r={4.5} fill="var(--ux-surface)" stroke="var(--cy-period)" strokeWidth={2} />
          <text x={x(i)} y={H - 6} textAnchor="middle" fontSize="12" fill="var(--ux-muted)">{p.label}</text>
        </g>
      ))}
      <g transform={`translate(${Math.min(x(pts.length - 1), W - 70) - 34}, ${y(last.cycle_days!) - 44})`}>
        <rect width="68" height="34" rx="8" fill="var(--ux-surface)" stroke="var(--ux-line-strong)" />
        <text x="34" y="15" textAnchor="middle" fontSize="12" fontWeight="600" fill="var(--ux-ink)">{last.cycle_days} days</text>
        <text x="34" y="28" textAnchor="middle" fontSize="12" fill="var(--ux-muted)">{last.label}</text>
      </g>
    </svg>
  );
}

function MoodChart({ s }: { s: CycleState }) {
  const MOODS = useTranslated(RAW_MOODS);
  const tr = useT();
  const pts = s.moods.filter((m) => m.mood).slice(-14);
  if (pts.length < 2) {
    return <p className="py-8 text-center text-[13px]" style={{ color: "var(--ux-muted)" }}>{tr("dashboard.logYourMoodOnAFew")}</p>;
  }
  const W = 520, H = 180, L = 70, B = 24, T = 10;
  const x = (i: number) => L + (i * (W - L - 12)) / Math.max(1, pts.length - 1);
  const y = (v: number) => T + (1 - (v - 1) / 4) * (H - T - B);
  const d = pts.map((p, i) => `${i ? "L" : "M"}${x(i)},${y(MOOD_SCORE[p.mood!])}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={tr("dashboard.yourMoodsOverTheLastTwo")}>
      {MOODS.map((m) => (
        <g key={m.key}>
          <line x1={L} x2={W - 6} y1={y(MOOD_SCORE[m.key])} y2={y(MOOD_SCORE[m.key])} stroke="var(--ux-line)" />
          <text x={L - 8} y={y(MOOD_SCORE[m.key]) + 4} textAnchor="end" fontSize="12" fill="var(--ux-muted)">{m.label}</text>
        </g>
      ))}
      <path d={d} fill="none" stroke="var(--cy-ovulation)" strokeWidth={2.5} strokeLinejoin="round" />
      {pts.map((p, i) => (
        <g key={p.date}>
          <circle cx={x(i)} cy={y(MOOD_SCORE[p.mood!])} r={4} fill={`var(${MOODS.find((m) => m.key === p.mood)?.tone})`} />
          {(i === 0 || i === pts.length - 1 || i % 3 === 0) && (
            <text x={x(i)} y={H - 6} textAnchor="middle" fontSize="12" fill="var(--ux-muted)">{shortDate(p.date)}</text>
          )}
        </g>
      ))}
    </svg>
  );
}
