"use client";

import { useCallback, useMemo, useState } from "react";

import { HomeShell } from "@/components/ux/home/HomeShell";
import { Btn, Card, I, Pill, SectionHead, v } from "@/components/ux/kit";
import { formatRupees } from "@/components/ux/kit";
import { NextStepCard } from "@/components/ux/journey/NextStepCard";
import { readJourneyState } from "@/services/me.repository";
import { STAGES, journeyPct, nextStep, stageFor } from "@/services/journey";

/**
 * My Journey — Skill to Income, drawn as a route she is walking.
 *
 * ── Why a route and not a progress bar ──────────────────────────────────────
 * "65% complete" is a number about a course. This is a claim about her life:
 * a skill becomes income by a path, the path has seven places on it, and she
 * is standing at one of them. Drawn vertically because a journey has a
 * direction and a horizontal bar does not — and because the evidence under
 * each stage needs room to be read.
 *
 * ── Evidence, not self-assessment ───────────────────────────────────────────
 * Each completed stage shows what she actually did to clear it — orders
 * finished, money received, circles joined. Nothing here is a survey answer,
 * because a woman asked to rate herself will rate herself low, and this
 * product exists partly to correct that.
 *
 * ── Nothing ahead is locked ─────────────────────────────────────────────────
 * Later stages are dimmed, never gated. A woman who already sells but has
 * never taken a course is not "not ready" for the earning stage — she is
 * already there, and a lock would be the app telling her she is wrong about
 * her own life.
 */
export default function JourneyPage() {
  const state = useMemo(() => readJourneyState(), []);
  const stage = useMemo(() => stageFor(state), [state]);
  const step = useMemo(() => nextStep(state), [state]);
  const pct = useMemo(() => journeyPct(state), [state]);
  const at = STAGES.findIndex((s) => s.id === stage);

  const [dismissed, setDismissed] = useState(false);
  const dismiss = useCallback(() => setDismissed(true), []);

  /** What she actually did, per stage. Empty means nothing to show yet. */
  const evidence: Record<string, string[]> = {
    skill: state.skills > 0 ? [`${state.skills} skills named`] : [],
    learn: state.coursesDone > 0 ? [`${state.coursesDone} of ${state.coursesDone + state.coursesInProgress} courses finished`] : [],
    practice: state.ordersDone > 0 ? [`${state.ordersDone} orders finished`] : [],
    build: state.hasPortfolio ? ["Proof of your work is ready"] : [],
    opportunity: state.productsListed > 0 ? [`${state.productsListed} things listed in your shop`] : [],
    earn: state.earnedMinor > 0 ? [`${formatRupees(state.earnedMinor)} has reached your bank`] : [],
    grow: state.circles > 0 ? [`${state.circles} circles`, `${state.monthsActive} months with earnings`] : [],
  };

  return (
    <HomeShell active="/app/journey">
      <div className="flex flex-col gap-5">

        <header>
          <p className="text-[0.6875rem] font-extrabold uppercase tracking-[0.2em]" style={{ color: v("--ux-brand") }}>
            My journey
          </p>
          <h1 className="mt-2 text-[clamp(1.5rem,3.2vw,2.125rem)] font-extrabold leading-[1.1] tracking-[-0.035em]"
              style={{ color: v("--ux-ink") }}>
            From what you can do, to what you earn
          </h1>
          <p className="mt-1.5 max-w-[58ch] text-[0.875rem] leading-relaxed" style={{ color: v("--ux-muted") }}>
            Seven steps, and you are on step {at + 1}. Nothing below is locked — if you are already
            further along than this says, go straight there.
          </p>
        </header>

        {!dismissed && <NextStepCard step={step} at={stage} onDismiss={dismiss} />}

        <Card pad={20}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[0.75rem] font-semibold uppercase tracking-[0.1em]" style={{ color: v("--ux-muted") }}>
                Where you are
              </p>
              <p className="mt-1 text-[1.25rem] font-extrabold" style={{ color: v("--ux-ink") }}>
                {STAGES[at].label}
              </p>
            </div>
            <p className="text-[1.75rem] font-extrabold tabular-nums" style={{ color: v("--ux-brand") }}>
              {pct}%
            </p>
          </div>
          <div className="mt-3 h-[6px] w-full overflow-hidden rounded-full" style={{ background: v("--ux-line") }}>
            <div className="h-full rounded-full"
                 style={{ width: `${pct}%`, background: v("--ux-fill"), transition: "width var(--ux-t-slow) var(--ux-ease)" }} />
          </div>
        </Card>

        {/* The route itself */}
        <div>
          <SectionHead title="The seven steps" sub="What each one means, and what you have already done" icon="Route" />
          <Card pad={0} style={{ overflow: "hidden" }}>
            <ol className="px-5 py-2 sm:px-7">
              {STAGES.map((s, i) => {
                const done = i < at;
                const here = i === at;
                const rows = evidence[s.id] ?? [];
                return (
                  <li key={s.id} className="relative flex gap-4 py-5">
                    {i < STAGES.length - 1 && (
                      <span className="absolute left-[1.0625rem] top-[2.25rem] bottom-0 w-[2px]"
                            style={{ background: v(done ? "--ux-green-ink" : "--ux-line") }} />
                    )}
                    <span className="relative z-[1] grid h-[2.125rem] w-[2.125rem] shrink-0 place-items-center rounded-full border-2"
                          style={{
                            background: v(done ? "--ux-green-ink" : here ? "--ux-fill" : "--ux-surface"),
                            borderColor: v(done ? "--ux-green-ink" : here ? "--ux-fill" : "--ux-line-strong"),
                            color: v(done || here ? "--ux-on-brand" : "--ux-muted"),
                          }}>
                      {done ? <I name="Check" className="h-[1rem] w-[1rem]" sw={3} />
                            : <span className="text-[0.8125rem] font-extrabold tabular-nums">{i + 1}</span>}
                    </span>

                    <div className="min-w-0 flex-1 pt-0.5" style={{ opacity: !done && !here ? 0.55 : 1 }}>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-[1rem] font-bold" style={{ color: v("--ux-ink") }}>{s.label}</p>
                        {here && <Pill tone="brand" size="sm">You are here</Pill>}
                      </div>
                      <p className="mt-0.5 text-[0.8125rem]" style={{ color: v("--ux-muted") }}>{s.verb}</p>

                      {rows.length > 0 && (
                        <ul className="mt-2 flex flex-wrap gap-1.5">
                          {rows.map((r) => (
                            <li key={r} className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.6875rem] font-semibold"
                                style={{ background: v("--ux-tint-green"), color: v("--ux-green-ink") }}>
                              <I name="Check" className="h-[0.6875rem] w-[0.6875rem]" sw={3} />{r}
                            </li>
                          ))}
                        </ul>
                      )}

                      {here && (
                        <div className="mt-3">
                          <Btn size="sm" href={step.href} icon={step.icon}>{step.cta}</Btn>
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          </Card>
        </div>

        <Card pad={16} style={{ background: v("--ux-surface-2"), borderColor: "transparent" }}>
          <div className="flex items-start gap-3">
            <I name="Info" className="mt-[2px] h-[1rem] w-[1rem] shrink-0" style={{ color: v("--ux-muted") }} />
            <p className="text-[0.8125rem] leading-relaxed" style={{ color: v("--ux-ink-2") }}>
              Every green mark above is something you did, not something you told us. Nothing here is
              locked — if you already sell but never took a course, you are further along than this
              shows, and you should go straight to the step that helps.
            </p>
          </div>
        </Card>
      </div>
    </HomeShell>
  );
}
