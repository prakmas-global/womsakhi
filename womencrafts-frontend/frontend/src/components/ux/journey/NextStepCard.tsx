"use client";

import Link from "next/link";

import { I, v } from "@/components/ux/kit";
import { STAGES, type NextStep, type StageId } from "@/services/journey";

/**
 * The one thing to do next.
 *
 * ── Why it is the loudest thing on the page ─────────────────────────────────
 * Home was a wall of roughly eighteen equally-weighted cards, which asks a
 * woman with twenty minutes to audit her own life and choose. This card answers
 * instead of asking. It is the only element on Home allowed to use the brand
 * fill — giving two things that treatment recreates the problem.
 *
 * ── Why the reason line is not optional ─────────────────────────────────────
 * "Build your portfolio" is an instruction. "You have finished 8 courses — a
 * certificate says you learned it, work you can show says you can do it" is a
 * reason. The first is a nag from an app; the second is what a person who knows
 * her would say. `because` is required by the type for exactly that reason.
 *
 * ── Dismissal ───────────────────────────────────────────────────────────────
 * She can put it aside. A step that cannot be dismissed becomes something to
 * scroll past — and then everything beside it becomes something to scroll past.
 */
export function NextStepCard({ step, at, onDismiss, compact = false }: {
  step: NextStep;
  /** Where she actually is. Used only to notice when the step comes from behind her. */
  at?: StageId;
  onDismiss?: () => void;
  /** Inside Learn or Work, where Home's framing would repeat itself. */
  compact?: boolean;
}) {
  const stage = STAGES.find((s) => s.id === step.stage);
  const stepIdx = STAGES.findIndex((s) => s.id === step.stage);
  const atIdx = at ? STAGES.findIndex((s) => s.id === at) : stepIdx;
  const isBehind = atIdx > stepIdx;

  return (
    <section aria-labelledby="next-step-title"
             className="relative overflow-hidden rounded-[20px]"
             style={{ background: v("--ux-fill") }}>
      <div className={compact ? "p-5" : "px-6 py-7 sm:px-8"}>
        <div className="flex items-start justify-between gap-4">
          <p className="text-[0.6875rem] font-extrabold uppercase tracking-[0.18em]"
             style={{ color: v("--ux-on-brand"), opacity: 0.72 }}>
            Your next step
          </p>
          {onDismiss && (
            <button type="button" onClick={onDismiss} aria-label="Put this aside for now"
                    className="ux-press ux-sq shrink-0 rounded-full p-1"
                    style={{ color: v("--ux-on-brand"), opacity: 0.65 }}>
              <I name="X" className="h-[1rem] w-[1rem]" />
            </button>
          )}
        </div>

        <h2 id="next-step-title"
            className={`mt-2.5 max-w-[20ch] font-extrabold leading-[1.12] tracking-[-0.03em] ${
              compact ? "text-[1.25rem]" : "text-[clamp(1.375rem,3vw,1.875rem)]"}`}
            style={{ color: v("--ux-on-brand") }}>
          {step.title}
        </h2>

        <p className="mt-2.5 max-w-[46ch] text-[0.875rem] leading-relaxed"
           style={{ color: v("--ux-on-brand"), opacity: 0.88 }}>
          {step.because}
        </p>

        {/* She is further along than this step. Say so, rather than letting the
            journey track and this card quietly disagree. */}
        {isBehind && stage && (
          <p className="mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[0.6875rem] font-semibold"
             style={{ background: "rgba(255,255,255,0.16)", color: v("--ux-on-brand") }}>
            <I name="CornerUpLeft" className="h-[0.75rem] w-[0.75rem]" />
            You are past this — it is one thing from &ldquo;{stage.label}&rdquo; still worth doing
          </p>
        )}

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Link href={step.href}
                className="ux-press ux-sq inline-flex items-center gap-2 rounded-[12px] px-4 py-3 text-[0.875rem] font-bold"
                style={{ background: v("--ux-on-brand-btn"), color: v("--ux-on-brand-btn-ink") }}>
            <I name={step.icon} className="h-[1rem] w-[1rem]" />
            {step.cta}
          </Link>
          {step.mins !== undefined && (
            <span className="inline-flex items-center gap-1.5 text-[0.75rem] font-semibold"
                  style={{ color: v("--ux-on-brand"), opacity: 0.8 }}>
              <I name="Clock" className="h-[0.8125rem] w-[0.8125rem]" />
              about {step.mins} min
            </span>
          )}
        </div>
      </div>
    </section>
  );
}

/**
 * The seven stages, drawn.
 *
 * A progress bar says "65%". This says *where she is* — which is the thing the
 * percentage was standing in for, and the reason the journey is the product's
 * spine rather than a statistic.
 */
export function JourneyTrack({ current, compact = false }: { current: StageId; compact?: boolean }) {
  const at = STAGES.findIndex((s) => s.id === current);

  return (
    <ol className="flex items-stretch gap-1.5 overflow-x-auto pb-1" aria-label="Your journey">
      {STAGES.map((s, i) => {
        const done = i < at;
        const here = i === at;
        return (
          <li key={s.id} className="min-w-[76px] flex-1">
            <div className="h-[5px] rounded-full"
                 style={{ background: v(done ? "--ux-green-ink" : here ? "--ux-fill" : "--ux-line") }} />
            <p className="mt-2 text-[0.6875rem] font-bold leading-tight"
               style={{ color: v(here ? "--ux-ink" : done ? "--ux-green-ink" : "--ux-faint") }}>
              {s.label}
            </p>
            {here && !compact && (
              <p className="mt-0.5 text-[0.6875rem] leading-tight" style={{ color: v("--ux-muted") }}>
                {s.verb}
              </p>
            )}
          </li>
        );
      })}
    </ol>
  );
}
