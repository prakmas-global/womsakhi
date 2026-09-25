"use client";

import Link from "next/link";

import { useT } from "@/i18n";
import * as Icons from "@/components/ux/icons";
import { CycleRing, Icon, QuoteCard, RingSeed } from "./parts";
import { PHASE_COPY as RAW_PHASE_COPY, TODAY_CARE as RAW_TODAY_CARE, quoteFor } from "./data";
import { dow, useCycle } from "./use-cycle";
import { useTranslated } from "@/i18n/data";

const QUICK = [
  { label: "Mood", icon: "Smile", href: "/app/health/cycle/mood", tint: "--cy-predicted", ink: "--cy-period" },
  { label: "Symptoms", icon: "Activity", href: "/app/health/cycle/symptoms", tint: "--cy-fertile", ink: "--cy-ovulation" },
  { label: "Insights", icon: "FileText", href: "/app/health/cycle/insights", tint: "--ux-tint-green", ink: "--ux-green" },
  { label: "Reminders", icon: "Bell", href: "/app/health/cycle/reminders", tint: "--ux-tint-amber", ink: "--cy-mood-tired" },
];

/**
 * "Your Cycle — Day 18 of 28" on Home, with the four ways in and today's tip.
 *
 * Three rules keep it from being the wrong thing on the first screen:
 * - **Discreet mode hides it completely.** Home is the screen a phone is most
 *   often shown to someone else on.
 * - **It never guesses.** Until her real state arrives it draws a skeleton,
 *   and if the request fails it draws nothing — a health figure from a
 *   fixture would be a statement about her body that is not true.
 * - **Not tracking is not an error.** She gets one quiet line inviting her in.
 */
export function HomeCycleCard() {
  const PHASE_COPY = useTranslated(RAW_PHASE_COPY);
  const TODAY_CARE = useTranslated(RAW_TODAY_CARE);
  const tr = useT();
  const { data, state, loading } = useCycle();

  if (loading && !data) {
    return <div className="mt-4 h-[176px] animate-pulse rounded-[18px]" style={{ background: "var(--ux-surface-2)" }} aria-hidden />;
  }
  if (!data) return null;

  if (!state) {
    return (
      <Link href="/app/health/cycle/start" className="ux-press mt-4 flex items-center gap-3 rounded-[16px] p-4"
            style={{ background: "linear-gradient(135deg, var(--cy-hero-a), var(--cy-hero-b))", border: "1px solid var(--ux-line)" }}>
        <span className="grid h-[44px] w-[44px] shrink-0 place-items-center rounded-[12px]" style={{ background: "var(--ux-surface)" }}>
          <Icons.Heart className="h-5 w-5" style={{ color: "var(--cy-period-ink)" }} aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <b className="block text-[17px] font-semibold" style={{ color: "var(--ux-ink)" }}>{tr("homeCycleCard.trackYourCycle")}</b>
          <span className="block text-[13px]" style={{ color: "var(--ux-ink-2)" }}>{tr("homeCycleCard.oneTapADayOnlyYou")}</span>
        </span>
        <Icons.ChevronRight className="h-[18px] w-[18px] shrink-0" style={{ color: "var(--cy-period-ink)" }} aria-hidden />
      </Link>
    );
  }
  if (state.profile.discreet) return null;

  const st = state.status;
  const phase = st.phase ?? "follicular";
  const tip = TODAY_CARE[st.on_period ? "menstrual" : phase][1];
  const sub = st.on_period ? `Period day ${st.period_day}`
    : st.days_until != null && st.days_until >= 0 ? `Next period in ${st.days_until} days`
    : st.days_until != null ? `${-st.days_until} days later than expected` : "";

  return (
    <div className="mt-4">
      <Link href="/app/health/cycle" className="ux-press block rounded-[18px] p-4"
            style={{ background: "var(--ux-surface)", border: "1px solid var(--ux-line)", boxShadow: "var(--ux-shadow-sm)" }}>
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold" style={{ color: "var(--ux-ink-2)" }}>{tr("healthCycleStart.yourCycle")}</p>
            <p className="mt-0.5 text-[24px] font-bold leading-tight" style={{ color: "var(--ux-ink)" }}>
              {st.cycle_day ? `Day ${st.cycle_day} of ${st.avg_cycle}` : "Log your period"}
            </p>
            <p className="text-[13px]" style={{ color: "var(--ux-muted)" }}>{sub}</p>
            <span className="mt-3 inline-flex h-[38px] items-center gap-1.5 rounded-[12px] px-4 text-[15px] font-semibold"
                  style={{ background: "linear-gradient(90deg, var(--cy-period), var(--ux-fill))", color: "var(--ux-on-brand)" }}>
              <Icons.Pencil className="h-4 w-4" aria-hidden />
              {st.checked_in ? "Update Today" : "Log Today"}
            </span>
          </div>
          <CycleRing value={Math.min(st.cycle_day ?? 0, st.avg_cycle)} max={st.avg_cycle} size={96} stroke={11}>
            <RingSeed size={42} />
          </CycleRing>
        </div>
        <div className="mt-4 grid grid-cols-7 text-center" aria-label={tr("schedule.thisWeek")}>
          {state.week.map((c) => {
            const period = c.marks.includes("period");
            const predicted = c.marks.includes("predicted");
            const fertile = c.marks.includes("fertile") || c.marks.includes("ovulation");
            const today = c.date === state.today;
            return (
              <span key={c.date} className="flex flex-col items-center gap-1.5">
                <span className="text-[12px]" style={{ color: today ? "var(--ux-ink)" : "var(--ux-muted)", fontWeight: today ? 600 : 400 }}>
                  {dow(c.date).charAt(0)}
                </span>
                <span className="rounded-full" style={{
                  width: today ? 10 : 7, height: today ? 10 : 7,
                  background: period ? "var(--cy-period)" : predicted ? "var(--cy-predicted-ink)" : fertile ? "var(--cy-ovulation)" : "var(--ux-line-strong)",
                  opacity: period || today ? 1 : 0.7,
                }} />
              </span>
            );
          })}
        </div>
      </Link>

      <div className="mt-3 grid grid-cols-4 gap-2.5">
        {QUICK.map((q) => (
          <Link key={q.label} href={q.href} className="ux-press flex flex-col items-center gap-1.5 rounded-[16px] py-3"
                style={{ background: "var(--ux-surface)", border: "1px solid var(--ux-line)" }}>
            <span className="grid h-[40px] w-[40px] place-items-center rounded-full" style={{ background: `var(${q.tint})` }}>
              <Icon name={q.icon} className="h-5 w-5" style={{ color: `var(${q.ink})` }} />
            </span>
            <span className="text-[12px] font-semibold" style={{ color: "var(--ux-ink-2)" }}>{q.label}</span>
          </Link>
        ))}
      </div>

      <QuoteCard className="mt-3" text={quoteFor(state.log?.mood, state.today)} />

      <h2 className="mb-2.5 mt-5 text-[17px] font-semibold" style={{ color: "var(--ux-ink)" }}>{tr("homeCycleCard.forYouToday")}</h2>
      <Link href="/app/health/cycle/today" className="ux-press flex items-center gap-3 rounded-[16px] p-3.5"
            style={{ background: "var(--ux-surface)", border: "1px solid var(--ux-line)" }}>
        <span className="grid h-[44px] w-[44px] shrink-0 place-items-center rounded-[12px]" style={{ background: `var(${tip.tint})` }}>
          <Icon name={tip.icon} className="h-5 w-5" style={{ color: "var(--ux-ink-2)" }} />
        </span>
        <span className="min-w-0 flex-1">
          <b className="block text-[15px] font-semibold" style={{ color: "var(--ux-ink)" }}>{tip.title}</b>
          <span className="block text-[13px]" style={{ color: "var(--ux-muted)" }}>
            Because you&apos;re in your {PHASE_COPY[st.on_period ? "menstrual" : phase].name.toLowerCase()} phase
          </span>
        </span>
        <Icons.ChevronRight className="h-[18px] w-[18px] shrink-0" style={{ color: "var(--ux-faint)" }} aria-hidden />
      </Link>
    </div>
  );
}
