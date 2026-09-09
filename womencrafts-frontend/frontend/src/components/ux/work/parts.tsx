"use client";

import Link from "next/link";
import * as Icons from "@/components/ux/icons";
import { matchFor, matchTone } from "@/services/job-match";

import { Btn, I, IconTile, Pill, Progress, SectionHead, Card } from "../kit";
import { usePointer } from "../kit/motion";
import { payLabel, type Job } from "./data";

/* ── the row that appears everywhere work is listed ───────────────────── */

/**
 * How well a job fits her, as a ring rather than a number in a sentence.
 *
 * A ring because the comparison she is making is between eight jobs on one
 * screen, and "92%" next to "66%" is a reading task while two rings is a
 * glance. The number stays inside it for anyone who wants the exact figure.
 */
export function MatchRing({ pct, size = 44 }: { pct: number; size?: number }) {
  const r = (size - 6) / 2;
  const c = 2 * Math.PI * r;
  const tone = pct >= 80 ? "--ux-green" : pct >= 60 ? "--ux-amber" : "--ux-muted";
  return (
    <span className="relative grid shrink-0 place-items-center" style={{ width: size, height: size }}
          title={`${pct}% match with your profile`}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--ux-track)" strokeWidth="3" />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={`var(${tone})`} strokeWidth="3"
          strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)}
          style={{ transition: "stroke-dashoffset var(--ux-t-slow) var(--ux-ease-out)" }}
        />
      </svg>
      <span className="absolute text-2xs font-bold tabular-nums" style={{ color: `var(${tone})` }}>
        {pct}
      </span>
    </span>
  );
}

export function JobRow({
  job, i, saved, onSave,
}: { job: Job; i: number; saved: boolean; onSave: (id: string) => void }) {
  const point = usePointer<HTMLDivElement>();
  // Computed from her skills against the ones the listing asks for, rather than
  // read from a `match` field that live listings never populate.
  const fit = matchFor(job.skills);
  return (
    <div ref={point}
         className="ux-i ux-sq ux-spot ux-onscroll relative rounded-[12px] border p-[16px]"
         style={{ borderColor: "var(--ux-line)", background: "var(--ux-surface)", ["--i" as string]: i }}>
      <div className="flex items-start gap-3.5">
        <IconTile icon={job.icon} tint={job.logoTint} ink={job.logoInk} size={46} radius={12} />

        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2">
            <h3 className="min-w-0 flex-1 truncate text-sm font-semibold" style={{ color: "var(--ux-ink)" }}>
              {/* -my-1 py-1: a bare text link is 17px tall, which is under the
                  24px anything clickable should be. The padding is negative on
                  the outside so nothing moves. */}
              <Link href={`/app/opportunities/${job.id}`} className="-my-1 inline-block py-1 hover:underline">
                {job.title}
              </Link>
            </h3>
            {job.verified && (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-[2px] text-2xs font-semibold"
                    style={{ background: "var(--ux-tint-green)", color: "var(--ux-green-ink)" }}>
                <Icons.ShieldCheck className="h-3 w-3" /> Verified
              </span>
            )}
            {job.womenLed && (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-[2px] text-2xs font-semibold"
                    style={{ background: "var(--ux-tint-pink)", color: "var(--ux-pink-ink)" }}>
                Women-led
              </span>
            )}
          </div>

          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs" style={{ color: "var(--ux-muted)" }}>
            <span className="inline-flex items-center gap-1"><Icons.Building2 className="h-3.5 w-3.5" /> {job.org}</span>
            <span className="inline-flex items-center gap-1"><Icons.MapPin className="h-3.5 w-3.5" /> {job.place}</span>
            <span className="inline-flex items-center gap-1"><Icons.Clock className="h-3.5 w-3.5" /> {job.posted}</span>
          </p>

          <p className="mt-2 text-xsm font-semibold" style={{ color: "var(--ux-ink)" }}>{payLabel(job)}</p>

          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            <Pill tone="brand" size="sm">{job.kind}</Pill>
            <Pill tone="neutral" size="sm">{job.mode}</Pill>
            {job.skills.map((s) => (
              <span key={s} className="ux-sq rounded-[8px] border px-2 py-[3px] text-2xs"
                    style={{ borderColor: "var(--ux-line-strong)", color: "var(--ux-muted)" }}>{s}</span>
            ))}
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-2.5">
          {/* The match ring is drawn only when there is a score to draw.
              `toJob` hardcodes `match: 0` — nothing compares a listing against
              her profile — so this rendered a "0" ring on every row, in a dial
              that looks measured. A score of zero is not a low match; it is no
              match having been calculated. */}
          {fit.pct !== null && <MatchRing pct={fit.pct} />}
          <button
            onClick={() => onSave(job.id)}
            aria-pressed={saved}
            aria-label={saved ? "Saved" : "Save this"}
            className="ux-press ux-hov ux-sq grid h-[30px] w-[30px] place-items-center rounded-[8px]"
            style={{ background: saved ? "var(--ux-brand-tint)" : "transparent" }}
          >
            <Icons.Bookmark
              className="ux-ico h-[17px] w-[17px]"
              fill={saved ? "var(--ux-brand)" : "none"}
              style={{ color: saved ? "var(--ux-brand)" : "var(--ux-faint)" }}
              strokeWidth={1.9}
            />
          </button>
        </div>
      </div>

      {/* Why it fits. A percentage on its own tells her nothing she can act on;
          "you have 4 of the 5, the one you are missing is Analytics" tells her
          whether to apply anyway and what to learn if she does not. */}
      {fit.because && (
        <p className="mt-3 flex items-start gap-2 rounded-[8px] px-3 py-2.5 text-xs leading-snug"
           style={{ background: "var(--ux-surface-2)", color: "var(--ux-ink-2)" }}>
          <Icons.Sparkles className="mt-[2px] h-[0.8125rem] w-[0.8125rem] shrink-0"
                          style={{ color: `var(${matchTone(fit.pct).ink})` }} />
          <span>
            <b style={{ color: "var(--ux-ink)" }}>{matchTone(fit.pct).label}.</b> {fit.because}
          </span>
        </p>
      )}

      <div className="mt-3 flex items-center justify-between gap-3 border-t pt-3" style={{ borderColor: "var(--ux-line)" }}>
        <span className="text-xs" style={{ color: "var(--ux-faint)" }}>
          {job.applicants} {job.applicants === 1 ? "woman has" : "women have"} applied
        </span>
        <span className="flex items-center gap-2">
          <Btn href={`/app/opportunities/${job.id}`} variant="outline" size="sm">Read more</Btn>
          <Btn href={`/app/opportunities/${job.id}`} variant="primary" size="sm" iconEnd="ArrowRight">Apply</Btn>
        </span>
      </div>
    </div>
  );
}

/* ── where an application has got to ──────────────────────────────────── */

/**
 * The four stages, drawn as a track rather than as a word.
 *
 * "Shortlisted" on its own does not tell her whether that is close to the end
 * or barely started. Four dots with two filled does.
 */
export function StageTrack({ step, stages }: { step: number; stages: readonly string[] }) {
  const dead = step === 0;
  return (
    <div className="flex items-center gap-1.5">
      {stages.map((s, i) => {
        const on = !dead && i < step;
        return (
          <span key={s} className="flex items-center gap-1.5">
            <span
              className="ux-pop grid h-[18px] w-[18px] place-items-center rounded-full"
              style={{
                background: on ? "var(--ux-brand-600)" : "var(--ux-track)",
                ["--i" as string]: i,
              }}
              title={s}
            >
              {on && <Icons.Check className="h-[11px] w-[11px] text-white" strokeWidth={3.2} />}
            </span>
            {i < stages.length - 1 && (
              <span className="h-[2px] w-[18px] rounded-full"
                    style={{ background: !dead && i < step - 1 ? "var(--ux-brand-600)" : "var(--ux-track)" }} />
            )}
          </span>
        );
      })}
    </div>
  );
}

/* ── a small figure with a label, used across the rail ────────────────── */

export function RailStat({ value, label, icon, tint, ink, sub }: {
  value: string | number; label: string; icon: string; tint: string; ink: string; sub?: string;
}) {
  return (
    <div className="ux-hov flex items-center gap-3">
      <IconTile icon={icon} tint={tint} ink={ink} size={38} />
      <div className="min-w-0">
        <p className="text-lg font-bold leading-none tabular-nums" style={{ color: "var(--ux-ink)" }}>{value}</p>
        <p className="mt-1 truncate text-xs" style={{ color: "var(--ux-muted)" }}>{label}</p>
      </div>
      {sub && <span className="ms-auto shrink-0 text-2xs" style={{ color: "var(--ux-faint)" }}>{sub}</span>}
    </div>
  );
}

export { Card, SectionHead, Progress, I };
