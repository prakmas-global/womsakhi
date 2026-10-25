"use client";

import { useState } from "react";

import { addDays, daysBetween, fmtDay } from "@/lib/health-api";
import type { Phase } from "@/lib/cycle-api";

/**
 * Her cycle as a wheel, not a line: one segment per day, coloured by phase,
 * the days already lived solid and the ones to come soft, the fertile window
 * as a dotted arc inside, ovulation as a star and today as a glowing marker.
 * Tap or hover any day and the centre says what that day is; tap a phase in
 * the legend and the wheel lights only that part. Every date is an estimate
 * and the screen around it says so.
 */

type PhaseRange = { key: Phase; label: string; from: number; to: number };

const TONE: Record<Phase, string> = {
  menstrual: "var(--cy-period)",
  follicular: "var(--cy-mood-calm)",
  ovulation: "var(--cy-ovulation)",
  luteal: "var(--cy-mood-tired)",
};
const SAY: Record<Phase, string> = {
  menstrual: "Period", follicular: "Follicular phase", ovulation: "Ovulation", luteal: "Luteal phase",
};

const C = 160;          // centre of the 320 × 320 drawing
const R = 128;          // the day ring
const W = 20;           // its thickness
const RF = 104;         // the fertile arc, just inside

const polar = (r: number, a: number) => [C + r * Math.cos(a), C + r * Math.sin(a)] as const;
/** An arc from angle a0 to a1 (radians, 0 = 3 o'clock, clockwise). */
function arc(r: number, a0: number, a1: number) {
  const [x0, y0] = polar(r, a0), [x1, y1] = polar(r, a1);
  return `M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${r} ${r} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
}

export function CycleWheel({ phases, day, length, today, fertileStart, fertileEnd, ovulation, nextStart, daysUntil, onPeriod, periodDay }: {
  phases: PhaseRange[];
  /** Today's cycle day (1-based). */
  day: number;
  length: number;
  today: string;
  fertileStart?: string | null;
  fertileEnd?: string | null;
  ovulation?: string | null;
  nextStart?: string | null;
  daysUntil?: number | null;
  onPeriod?: boolean;
  periodDay?: number | null;
}) {
  const [pick, setPick] = useState<number | null>(null);
  const [focus, setFocus] = useState<Phase | null>(null);
  const L = Math.max(length, day);
  const start = addDays(today, -(day - 1));                       // day 1 of this cycle
  const dayOf = (iso?: string | null) => (iso ? daysBetween(iso, start) + 1 : 0);
  const fs = dayOf(fertileStart), fe = dayOf(fertileEnd), ov = dayOf(ovulation);
  const phaseOf = (d: number) => phases.find((p) => d >= p.from && d <= p.to)?.key ?? (d > (phases.at(-1)?.to ?? L) ? "luteal" : "follicular");

  const step = (2 * Math.PI) / L;
  const top = -Math.PI / 2;
  const gap = Math.min(0.035, step * 0.18);
  const angle = (d: number) => top + (d - 0.5) * step;              // the middle of a day

  const shown = pick ?? day;
  const shownPhase = phaseOf(shown);
  const shownDate = addDays(start, shown - 1);
  const fertile = fs > 0 && shown >= fs && shown <= fe;
  const [mx, my] = polar(R, angle(day));
  const labels = [1, ...Array.from({ length: Math.floor(L / 7) }, (_, i) => (i + 1) * 7)].filter((d, i, a) => d <= L && a.indexOf(d) === i);

  return (
    <div className="flex flex-col items-center gap-4" data-cycle-wheel>
      <div className="relative w-full max-w-[340px]">
        <svg viewBox="0 0 320 320" className="block h-auto w-full" role="group" aria-label={`Cycle wheel: day ${day} of about ${length}`}>
          <defs>
            <filter id="cw-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="4" result="b" />
              <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>
          {/* soft track behind the days */}
          <circle cx={C} cy={C} r={R} fill="none" stroke="var(--ux-surface-2)" strokeWidth={W + 8} />
          {/* one segment a day */}
          {Array.from({ length: L }, (_, i) => {
            const d = i + 1;
            const p = phaseOf(d);
            const past = d < day;
            const isToday = d === day;
            const dim = focus && focus !== p;
            const a0 = top + i * step + gap / 2, a1 = top + (i + 1) * step - gap / 2;
            return (
              <path key={d} d={arc(R, a0, a1)} fill="none" stroke={TONE[p]} strokeLinecap="butt"
                    strokeWidth={isToday ? W + 8 : pick === d ? W + 5 : W}
                    opacity={dim ? 0.15 : past || isToday ? 1 : 0.42}
                    role="button" tabIndex={0} aria-label={`Day ${d}, ${fmtDay(addDays(start, d - 1), { weekday: "short", day: "numeric", month: "short" })}, ${SAY[p]}`}
                    onMouseEnter={() => setPick(d)} onMouseLeave={() => setPick(null)} onFocus={() => setPick(d)} onBlur={() => setPick(null)}
                    onClick={() => setPick(pick === d ? null : d)}
                    style={{ cursor: "pointer", transition: "stroke-width .2s, opacity .25s" }} />
            );
          })}
          {/* fertile window, a dotted arc inside the ring */}
          {fs > 0 && fe >= fs && fe <= L && (
            <path d={arc(RF, top + (fs - 1) * step, top + fe * step)} fill="none" stroke="var(--cy-ovulation)" strokeWidth="5"
                  strokeDasharray="1 7" strokeLinecap="round" opacity={focus && focus !== "ovulation" ? 0.2 : 0.9} />
          )}
          {/* ovulation star */}
          {ov > 0 && ov <= L && (() => {
            const [x, y] = polar(RF, angle(ov));
            return <text x={x} y={y + 5} textAnchor="middle" fontSize="15" fill="var(--cy-ovulation)" aria-hidden>★</text>;
          })()}
          {/* day numbers round the outside */}
          {labels.map((d) => {
            const [x, y] = polar(R + W / 2 + 14, angle(d));
            return <text key={d} x={x} y={y + 4} textAnchor="middle" fontSize="11" fontWeight="700" fill="var(--ux-muted)">{d}</text>;
          })}
          {/* today */}
          <circle cx={mx} cy={my} r="13" fill="var(--cy-mood-happy)" opacity="0.45" filter="url(#cw-glow)">
            <animate attributeName="r" values="11;16;11" dur="2.4s" repeatCount="indefinite" />
          </circle>
          <circle cx={mx} cy={my} r="9" fill="var(--cy-mood-happy)" stroke="var(--ux-surface)" strokeWidth="3" />
        </svg>

        {/* the centre: today, or the day she points at */}
        <div className="pointer-events-none absolute inset-[24%] flex flex-col items-center justify-center rounded-full text-center"
             style={{ background: "var(--ux-surface)", boxShadow: "0 10px 30px -18px var(--cy-period)" }} aria-live="polite">
          <span className="text-[11px] font-extrabold uppercase tracking-[0.1em]" style={{ color: TONE[shownPhase] }}>
            {pick ? fmtDay(shownDate, { weekday: "short", day: "numeric", month: "short" }) : "Today"}
          </span>
          <span className="text-[40px] font-extrabold leading-none tabular-nums" style={{ color: "var(--ux-ink)" }}>Day {shown}</span>
          <span className="text-xs" style={{ color: "var(--ux-muted)" }}>of about {length}</span>
          <span className="mt-1.5 rounded-full px-2.5 py-0.5 text-[11.5px] font-bold" style={{ background: "var(--cy-predicted)", color: "var(--cy-predicted-ink)" }}>
            {SAY[shownPhase]}{fertile ? " · fertile" : ""}{shown === ov ? " · ovulation" : ""}
          </span>
          {!pick && (onPeriod && periodDay
            ? <span className="mt-1 text-[11.5px] font-semibold" style={{ color: "var(--ux-ink-2)" }}>Period day {periodDay}</span>
            : daysUntil != null && nextStart
              ? <span className="mt-1 text-[11.5px] font-semibold" style={{ color: "var(--ux-ink-2)" }}>
                  {daysUntil < 0 ? "Period is late" : daysUntil === 0 ? "Period expected today" : `Next period in ${daysUntil} ${daysUntil === 1 ? "day" : "days"}`}
                </span>
              : null)}
        </div>
      </div>

      {/* phases: tap to light that part of the wheel */}
      <div className="grid w-full grid-cols-2 gap-2 sm:grid-cols-4" role="group" aria-label="Phases">
        {phases.map((p) => {
          const on = focus === p.key;
          return (
            <button key={p.key} type="button" aria-pressed={on} onClick={() => setFocus(on ? null : p.key)}
                    className="ux-press flex flex-col items-start gap-0.5 rounded-[14px] border-[1.5px] p-2.5 text-start"
                    style={{ borderColor: on ? TONE[p.key] : "var(--ux-line)", background: "var(--ux-surface)" }}>
              <span className="flex items-center gap-1.5 text-[13px] font-bold" style={{ color: "var(--ux-ink)" }}>
                <i className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: TONE[p.key] }} />{p.label}
              </span>
              <span className="text-[11.5px] tabular-nums" style={{ color: "var(--ux-muted)" }}>
                Days {p.from}–{p.to} · {fmtDay(addDays(start, p.from - 1))}–{fmtDay(addDays(start, p.to - 1))}
              </span>
            </button>
          );
        })}
      </div>
      <p className="text-center text-xs" style={{ color: "var(--ux-muted)" }}>
        Solid days have passed; soft days are estimates. <span style={{ color: "var(--cy-ovulation)" }}>Dotted arc</span> = fertile window, ★ = ovulation.
      </p>
    </div>
  );
}
