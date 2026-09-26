"use client";

import Link from "next/link";

import { useT } from "@/i18n";
import * as Icons from "@/components/ux/icons";
import type { CycleState } from "@/lib/cycle-api";
import { InsightRow, MoodFace, Panel, PhaseBar, SoftHeart, heroBg } from "./parts";
import { GUIDES as RAW_GUIDES, PHASE_COPY as RAW_PHASE_COPY, carePlan, symptomLabel } from "./data";
import { shortDate } from "./use-cycle";
import { useTranslated } from "@/i18n/data";

/** "Your cycle at a glance" — three numbers, each with what it means. */
export function Glance({ s, art = true }: { s: CycleState; art?: boolean }) {
  const tr = useT();
  const st = s.status;
  const rows = [
    { icon: "RefreshCw", big: `${st.avg_cycle} days`, small: st.measured_cycles ? "Average cycle length" : "Usual cycle length" },
    { icon: "Droplet", big: `${st.avg_period} days`, small: st.measured_cycles ? "Average period length" : "Usual period length" },
    { icon: "CalendarDays", big: st.next_start ? shortDate(st.next_start) : "—", small: "Next period (predicted)" },
  ];
  return (
    <section className="relative overflow-hidden rounded-[20px] p-4" style={{ background: heroBg, border: "1px solid var(--ux-line)" }}>
      <h2 className="relative z-[1] text-[17px] font-semibold" style={{ color: "var(--ux-ink)" }}>{tr("insights.yourCycleAtAGlance")}</h2>
      <ul className="relative z-[1] mt-3 space-y-3">
        {rows.map((r) => (
          <li key={r.small} className="flex items-center gap-3">
            <span className="grid h-[36px] w-[36px] shrink-0 place-items-center rounded-[10px]" style={{ background: "var(--ux-surface)" }}>
              {r.icon === "RefreshCw" ? <Icons.RefreshCw className="h-[18px] w-[18px]" style={{ color: "var(--cy-period-ink)" }} aria-hidden />
                : r.icon === "Droplet" ? <Icons.Droplet className="h-[18px] w-[18px]" style={{ color: "var(--cy-period-ink)" }} aria-hidden />
                : <Icons.CalendarDays className="h-[18px] w-[18px]" style={{ color: "var(--cy-ovulation-ink)" }} aria-hidden />}
            </span>
            <span>
              <b className="block text-[15px] font-semibold leading-tight" style={{ color: "var(--ux-ink)" }}>{r.big}</b>
              <span className="block text-[12px]" style={{ color: "var(--ux-muted)" }}>{r.small}</span>
            </span>
          </li>
        ))}
      </ul>
      {art && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src="/ux/art/scene-woman-writing-notes.webp" alt="" aria-hidden
             className="pointer-events-none absolute -bottom-2 end-0 h-[150px] w-auto object-contain" />
      )}
    </section>
  );
}

export function Phases({ s }: { s: CycleState }) {
  const PHASE_COPY = useTranslated(RAW_PHASE_COPY);
  const tr = useT();
  const st = s.status;
  const phase = st.phase ?? "follicular";
  const copy = PHASE_COPY[phase];
  if (!s.profile.predictions.phase) return (
    <Panel>
      <h2 className="text-[17px] font-semibold" style={{ color: "var(--ux-ink)" }}>Phase guidance is off</h2>
      <p className="mt-1 text-[14px]" style={{ color: "var(--ux-muted)" }}>You can turn phase estimates back on from Cycle settings.</p>
      <Link href="/app/health/cycle/settings" className="mt-3 inline-flex min-h-10 items-center text-[13px] font-semibold" style={{ color: "var(--cy-period-ink)" }}>Open settings <Icons.ArrowRight className="ms-1 h-4 w-4" /></Link>
    </Panel>
  );
  return (
    <Panel>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-[17px] font-semibold" style={{ color: "var(--ux-ink)" }}>{tr("insights.yourPhases")}</h2>
        {st.cycle_day && (
          <span className="text-[13px]" style={{ color: "var(--ux-muted)" }}>Day {st.cycle_day} of {st.avg_cycle}</span>
        )}
      </div>
      <PhaseBar phases={s.phases} day={st.cycle_day && st.cycle_day <= st.avg_cycle ? st.cycle_day : null} length={st.avg_cycle} />
      <div className="mt-5">
        <b className="block text-[15px] font-semibold" style={{ color: "var(--ux-ink)" }}>{copy.title}</b>
        <p className="mt-1 text-[15px] leading-relaxed" style={{ color: "var(--ux-ink-2)" }}>
          {copy.body} <SoftHeart />
        </p>
      </div>
    </Panel>
  );
}

export function Patterns({ s }: { s: CycleState }) {
  const tr = useT();
  const top = Object.entries(s.symptom_counts).sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0)).slice(0, 5);
  const max = Math.max(1, ...top.map(([, n]) => n ?? 0));
  const moods = s.moods.slice(-14);
  return (
    <div className="space-y-3">
      <HealthMetrics s={s} />
      <Panel>
        <h2 className="mb-3 text-[17px] font-semibold" style={{ color: "var(--ux-ink)" }}>{tr("insights.whatYourDataSays")}</h2>
        {s.insights.length ? (
          <div className="space-y-3.5">{s.insights.map((i) => <InsightRow key={i.text} i={i} />)}</div>
        ) : (
          <p className="text-[15px]" style={{ color: "var(--ux-muted)" }}>{tr("insights.logAFewDaysAndYour")}</p>
        )}
      </Panel>

      <Panel>
        <h2 className="mb-3 text-[17px] font-semibold" style={{ color: "var(--ux-ink)" }}>{tr("insights.symptomsLast3Months")}</h2>
        {top.length ? (
          <ul className="space-y-2.5">
            {top.map(([k, n]) => (
              <li key={k}>
                <div className="mb-1 flex justify-between text-[13px]">
                  <span style={{ color: "var(--ux-ink-2)" }}>{symptomLabel(k)}</span>
                  <span className="tabular-nums" style={{ color: "var(--ux-muted)" }}>{n} day{n === 1 ? "" : "s"}</span>
                </div>
                <div className="h-[8px] overflow-hidden rounded-full" style={{ background: "var(--cy-predicted)" }}>
                  <div className="h-full rounded-full" style={{ width: `${((n ?? 0) / max) * 100}%`, background: "linear-gradient(90deg, var(--cy-period), var(--cy-ovulation))" }} />
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[15px]" style={{ color: "var(--ux-muted)" }}>
            {tr("insights.noSymptomsLoggedYet")} <Link href="/app/health/cycle/symptoms" className="font-semibold" style={{ color: "var(--cy-period-ink)" }}>Add today&apos;s</Link>
          </p>
        )}
      </Panel>

      <Panel>
        <h2 className="mb-3 text-[17px] font-semibold" style={{ color: "var(--ux-ink)" }}>{tr("insights.yourMoodsLastTwoWeeks")}</h2>
        {moods.length ? (
          <div className="flex flex-wrap gap-2">
            {moods.map((m) => (
              <span key={m.date} className="flex flex-col items-center gap-1">
                {m.mood ? <MoodFace mood={m.mood} size={32} /> : <span className="h-8 w-8 rounded-full" style={{ background: "var(--ux-surface-2)" }} />}
                <span className="text-[12px] tabular-nums" style={{ color: "var(--ux-muted)" }}>{shortDate(m.date).split(" ")[1]}</span>
              </span>
            ))}
          </div>
        ) : (
          <p className="text-[15px]" style={{ color: "var(--ux-muted)" }}>
            {tr("insights.noMoodsYet")} <Link href="/app/health/cycle/mood" className="font-semibold" style={{ color: "var(--cy-period-ink)" }}>{tr("insights.howAreYouToday")}</Link>
          </p>
        )}
      </Panel>

      {s.history.length > 0 && (
        <Panel>
          <h2 className="mb-3 text-[17px] font-semibold" style={{ color: "var(--ux-ink)" }}>{tr("insights.yourRecentCycles")}</h2>
          <ul className="divide-y" style={{ borderColor: "var(--ux-line)" }}>
            {[...s.history].reverse().map((h) => (
              <li key={h.start} className="flex items-center justify-between py-2.5 text-[15px]" style={{ borderColor: "var(--ux-line)" }}>
                <span style={{ color: "var(--ux-ink-2)" }}>Started {shortDate(h.start)}</span>
                <span className="tabular-nums" style={{ color: "var(--ux-muted)" }}>
                  {h.period_days}-day period{h.cycle_days ? ` · ${h.cycle_days}-day cycle` : " · this cycle"}
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  );
}

function HealthMetrics({ s }: { s: CycleState }) {
  const m = s.health_metrics;
  const bbt = m.bbt.slice(-14);
  const min = bbt.length ? Math.min(...bbt.map((p) => p.value)) : 0;
  const max = bbt.length ? Math.max(...bbt.map((p) => p.value)) : 0;
  const spread = Math.max(0.15, max - min);
  const metrics = [
    ["Days logged", String(m.days_logged), "Last 90 days"],
    ["Average pain", m.average_pain == null ? "—" : `${m.average_pain}/10`, "On logged days"],
    ["Average sleep", m.average_sleep == null ? "—" : `${m.average_sleep} h`, "On logged days"],
    ["Average energy", m.average_energy == null ? "—" : `${m.average_energy}/5`, "On logged days"],
  ];
  return (
    <Panel>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[17px] font-semibold" style={{ color: "var(--ux-ink)" }}>Your health patterns</h2>
          <p className="mt-1 text-[13px]" style={{ color: "var(--ux-muted)" }}>Averages use only the details you chose to record.</p>
        </div>
        <Link href="/app/health/cycle/report" className="inline-flex min-h-10 items-center text-[13px] font-semibold" style={{ color: "var(--cy-period-ink)" }}>Open full report <Icons.ArrowRight className="ms-1 h-4 w-4" /></Link>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
        {metrics.map(([label, value, note]) => <div key={label} className="rounded-[13px] p-3" style={{ background: "var(--ux-surface-2)" }}><span className="block text-[11px]" style={{ color: "var(--ux-muted)" }}>{label}</span><b className="mt-1 block text-[19px]" style={{ color: "var(--ux-ink)" }}>{value}</b><span className="text-[11px]" style={{ color: "var(--ux-muted)" }}>{note}</span></div>)}
      </div>
      {bbt.length > 1 && <div className="mt-5">
        <div className="mb-2 flex items-center justify-between"><h3 className="text-[14px] font-semibold" style={{ color: "var(--ux-ink)" }}>Morning temperature</h3><span className="text-[11px]" style={{ color: "var(--ux-muted)" }}>Last {bbt.length} readings</span></div>
        <div className="flex h-[110px] items-end gap-1.5 rounded-[14px] px-3 pb-3 pt-5" style={{ background: "var(--ux-surface-2)" }}>
          {bbt.map((point) => {
            const height = 24 + ((point.value - min) / spread) * 56;
            return <span key={point.date} className="group relative flex min-w-0 flex-1 justify-center" title={`${shortDate(point.date)}: ${point.value} °C`}><span className="w-full max-w-5 rounded-t-full" style={{ height, background: "linear-gradient(180deg, var(--cy-ovulation), var(--cy-period))" }} /><span className="sr-only">{shortDate(point.date)}: {point.value} degrees Celsius</span></span>;
          })}
        </div>
        <p className="mt-2 text-[11px] leading-relaxed" style={{ color: "var(--ux-muted)" }}>Temperature patterns can support awareness but cannot confirm ovulation or pregnancy.</p>
      </div>}
    </Panel>
  );
}

export function WellnessList({ s }: { s: CycleState }) {
  const GUIDES = useTranslated(RAW_GUIDES);
  const tr = useT();
  const cards = carePlan(s.status.phase ?? "follicular");
  return (
    <div className="space-y-3">
      {cards.map((c) => (
        <Link key={c.key} href={c.href} className="ux-press flex items-center gap-3.5 rounded-[16px] p-3"
              style={{ background: "var(--ux-surface)", border: "1px solid var(--ux-line)" }}>
          <span className="relative h-[72px] w-[88px] shrink-0 overflow-hidden rounded-[12px]" style={{ background: "var(--cy-hero-b)" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={c.img} alt="" loading="lazy"
                 className={c.art ? "absolute bottom-0 left-1/2 h-[70px] w-auto max-w-none -translate-x-1/2" : "h-full w-full object-cover"} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[12px] font-semibold uppercase tracking-[0.04em]" style={{ color: "var(--cy-period-ink)" }}>{c.label}</span>
            <b className="block text-[15px] font-semibold leading-snug" style={{ color: "var(--ux-ink)" }}>{c.title}</b>
            <span className="block text-[13px] leading-snug" style={{ color: "var(--ux-muted)" }}>{c.sub}</span>
          </span>
        </Link>
      ))}
      <h2 className="pt-2 text-[17px] font-semibold" style={{ color: "var(--ux-ink)" }}>{tr("healthCycleLearn.helpfulResources")}</h2>
      {GUIDES.slice(0, 3).map((g) => (
        <Link key={g.slug} href={`/app/health/cycle/learn/${g.slug}`} className="ux-press flex items-center justify-between gap-3 rounded-[14px] px-4 py-3"
              style={{ background: "var(--ux-surface)", border: "1px solid var(--ux-line)" }}>
          <span>
            <b className="block text-[15px] font-semibold" style={{ color: "var(--ux-ink)" }}>{g.title}</b>
            <span className="block text-[13px]" style={{ color: "var(--ux-muted)" }}>{g.sub}</span>
          </span>
          <Icons.ChevronRight className="h-5 w-5 shrink-0" style={{ color: "var(--ux-faint)" }} aria-hidden />
        </Link>
      ))}
    </div>
  );
}
