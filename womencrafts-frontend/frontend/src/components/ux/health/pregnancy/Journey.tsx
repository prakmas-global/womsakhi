"use client";

import { useId, useState } from "react";
import Link from "next/link";

import { Disclaimer, HUE, I, Panel } from "@/components/ux/health/kit";
import { illSrc } from "@/components/ux/health/art";
import {
  ANC_VISITS, JOURNEY, MILESTONES, babyFor, bodyFor, type PregInfo,
} from "@/components/ux/health/pregnancy-data";
import { addDays, fmtDay } from "@/lib/health-api";
import css from "./journey.module.css";

/**
 * The Pregnancy overview's centrepiece: her forty weeks as a dial she can
 * turn, what this week means for baby, for her body and for her care, and the
 * road ahead with real dates from her last period.
 *
 * Everything is an estimate from the date she entered and says so; the scans
 * and tests on the road are routine antenatal care, not her doctor's plan.
 */

const TRI_NAME = ["", "1st", "2nd", "3rd"] as const;
/** Weeks each trimester spans on the dial, and its colour (the brand's lilac, magenta and gold). */
const TRIS = [
  { n: 1, from: 1, to: 13, colour: "var(--ux-lilac-ink)" },
  { n: 2, from: 14, to: 27, colour: "var(--ux-brand)" },
  { n: 3, from: 28, to: 40, colour: "var(--ws-gold)" },
] as const;
const triOf = (w: number) => (w < 14 ? TRIS[0] : w < 28 ? TRIS[1] : TRIS[2]);

const WEEKS = Array.from({ length: 40 }, (_, i) => i + 1);

/* ── the dial ───────────────────────────────────────────────────────────── */

const C = 160, R = 126, STEP = 360 / 40, GAP = 1.7;
const at = (deg: number, r = R) => {
  const a = (deg * Math.PI) / 180;
  return [C + r * Math.sin(a), C - r * Math.cos(a)].map((n) => n.toFixed(2)).join(" ");
};
const arc = (w: number, r = R) => `M ${at((w - 1) * STEP + GAP / 2, r)} A ${r} ${r} 0 0 1 ${at(w * STEP - GAP / 2, r)}`;

function WeekDial({ info, week, onWeek }: { info: PregInfo; week: number; onWeek: (w: number) => void }) {
  const gid = useId().replace(/:/g, "");
  const mine = Math.min(40, Math.max(1, info.week));
  const exploring = week !== mine;
  const b = babyFor(week);
  // Baby's picture grows across the dial, from a speck at week 4 to full at 40.
  const grow = (0.42 + 0.58 * (Math.max(4, week) - 4) / 36).toFixed(2);
  const done = Math.min(1, info.ga / 280);

  function key(e: React.KeyboardEvent) {
    const to = { ArrowRight: week + 1, ArrowUp: week + 1, ArrowLeft: week - 1, ArrowDown: week - 1, Home: 1, End: 40 }[e.key];
    if (to === undefined) return;
    e.preventDefault();
    onWeek(Math.min(40, Math.max(1, to)));
  }

  return (
    <div className={css.dialWrap} role="slider" tabIndex={0} aria-label="Pregnancy week"
         aria-valuemin={1} aria-valuemax={40} aria-valuenow={week}
         aria-valuetext={`Week ${week}${exploring ? "" : ", your week"}: about the size of ${b[1]}`}
         onKeyDown={key} data-preg-dial>
      <svg className={css.dial} viewBox="0 0 320 320" aria-hidden>
        <defs>
          <linearGradient id={`${gid}-g`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="var(--ux-lilac-ink)" />
            <stop offset=".55" stopColor="var(--ux-brand)" />
            <stop offset="1" stopColor="var(--ws-gold)" />
          </linearGradient>
        </defs>
        {/* her days so far, a fine line inside the weeks */}
        <circle cx={C} cy={C} r={R - 22} fill="none" stroke="var(--ux-surface-2)" strokeWidth="4" />
        <circle cx={C} cy={C} r={R - 22} fill="none" stroke={`url(#${gid}-g)`} strokeWidth="4" strokeLinecap="round"
                strokeDasharray={`${(2 * Math.PI * (R - 22) * done).toFixed(1)} 9999`} transform={`rotate(-90 ${C} ${C})`} />
        {WEEKS.map((w) => {
          const t = triOf(w);
          const now = w === mine;
          return (
            <path key={w} d={arc(w)} fill="none" stroke={t.colour} strokeWidth={now ? 28 : w === week ? 26 : 20}
                  className={`${css.seg} ${now ? css.now : ""}`} style={{ color: t.colour, opacity: w <= mine ? 1 : w === week ? 0.75 : 0.22 }}
                  onClick={() => onWeek(w)}>
              <title>{`Week ${w}`}</title>
            </path>
          );
        })}
        {/* the week she is looking at, when it is not her own */}
        {exploring && <path d={arc(week, R + 19)} fill="none" stroke="var(--ux-ink)" strokeWidth="3" strokeLinecap="round" />}
        {MILESTONES.map(([w]) => {
          const [x, y] = at(w * STEP, R + 21).split(" ");
          return <text key={w} x={x} y={y} className={css.tick} textAnchor="middle" dominantBaseline="central">{w}</text>;
        })}
      </svg>
      <div className={css.centre}>
        <span className={css.centreTag}>{exploring ? `${TRI_NAME[triOf(week).n]} trimester` : "You are here"}</span>
        <span className={css.centreWeek}><small>Week</small><b data-preg-week>{week}</b>{!exploring && info.day ? <small>+{info.day}d</small> : null}</span>
        <span className={css.baby} aria-hidden>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className={css.babyImg} src={illSrc("baby")} alt="" style={{ transform: `scale(${grow})` }} />
        </span>
        <span className={css.centreSize}>About the size of {b[1]}</span>
        {exploring && <button type="button" className={css.back} onClick={() => onWeek(mine)}>Back to week {mine}</button>}
      </div>
    </div>
  );
}

/* ── this week ──────────────────────────────────────────────────────────── */

function careFor(week: number) {
  const now = ANC_VISITS.find((v) => week >= v.from && week <= v.to);
  if (now) return { lead: `${now.title} (${now.when})`, items: now.items.slice(0, 2) };
  const next = ANC_VISITS.find((v) => v.from > week);
  return next ? { lead: `Next: ${next.title.toLowerCase()} from week ${next.from}`, items: [] } : { lead: "Keep every check-up your doctor gives you.", items: [] };
}

export function JourneyPanel({ info }: { info: PregInfo }) {
  const mine = Math.min(40, Math.max(1, info.week));
  const [week, setWeek] = useState(mine);
  const b = babyFor(week);
  const care = careFor(week);
  const tri = triOf(mine);
  const triPct = Math.round(Math.min(1, (Math.min(info.ga / 7, 40) - (tri.from - 1)) / (tri.to - tri.from + 1)) * 100);
  const exploring = week !== mine;
  return (
    <Panel>
      <div className={css.journey} data-preg-journey>
        <div className={css.head}>
          <div>
            <p className={css.eyebrow}>Your pregnancy journey</p>
            <h2>Week {info.week}{info.day ? ` + ${info.day} day${info.day === 1 ? "" : "s"}` : ""}</h2>
            <p className={css.headSub}>
              {TRI_NAME[info.trimester]} trimester · {info.overdue ? "Due date has passed" : `${info.daysLeft} days to go`}
            </p>
          </div>
          <ul className={css.legend} aria-label="Trimesters">
            {TRIS.map((t) => (
              <li key={t.n} data-on={t.n === info.trimester ? "" : undefined} style={{ "--tri": t.colour } as React.CSSProperties}>
                <i aria-hidden />{TRI_NAME[t.n]} · wk {t.from}–{t.to}
              </li>
            ))}
          </ul>
        </div>

        <div className={css.grid}>
          <WeekDial info={info} week={week} onWeek={setWeek} />
          <div className={css.week} aria-live="polite">
            <p className={css.weekTitle}>{!exploring ? "This week" : week > mine ? `Looking ahead to week ${week}` : `Looking back at week ${week}`}</p>
            <div className={css.part} style={{ "--tint": HUE.pink.tint, "--ink": HUE.pink.ink } as React.CSSProperties}>
              <span><I name="Baby" /></span>
              <p><b>Baby</b>About the size of {b[1]}. {b[2]}</p>
            </div>
            <div className={css.part} style={{ "--tint": HUE.lilac.tint, "--ink": HUE.lilac.ink } as React.CSSProperties}>
              <span><I name="HeartPulse" /></span>
              <p><b>Your body</b>{bodyFor(week)}</p>
            </div>
            <div className={css.part} style={{ "--tint": HUE.green.tint, "--ink": HUE.green.ink } as React.CSSProperties}>
              <span><I name="Stethoscope" /></span>
              <p>
                <b>Your care</b>{care.lead}{care.items.length ? ` — ${care.items.join("; ")}.` : "."}{" "}
                <Link href="/app/health/pregnancy?tab=care">Care plan</Link>
              </p>
            </div>
            <div className={css.stats}>
              <div className={css.stat}>
                <strong>{fmtDay(info.due, { day: "numeric", month: "short" })}</strong>
                <small>Estimated due date</small>
              </div>
              <div className={css.stat}>
                <strong>{info.overdue ? "Passed" : Math.max(0, 40 - info.week)}</strong>
                <small>{info.overdue ? "Due date" : "Weeks to go"}</small>
              </div>
              <div className={css.stat} style={{ "--tri": tri.colour } as React.CSSProperties}>
                <strong>{triPct}%</strong>
                <small>Of {TRI_NAME[tri.n]} trimester</small>
                <span className={css.triBar} aria-hidden><i style={{ width: `${triPct}%` }} /></span>
              </div>
            </div>
          </div>
        </div>
        {info.overdue && <Disclaimer><b>Your estimated due date has passed.</b> Please see your doctor, and update your dates or end tracking.</Disclaimer>}
        <Disclaimer><b>Weeks and due date are estimates</b> based on the date you entered. Confirm your due date and care plan with your doctor or ANM.</Disclaimer>
      </div>
    </Panel>
  );
}

/* ── what's next ────────────────────────────────────────────────────────── */

export function WhatsNext({ info }: { info: PregInfo }) {
  const [showDone, setShowDone] = useState(false);
  const w = info.week;
  const stops = JOURNEY.map((j) => {
    const end = j.to ?? j.from;
    const state = w > end ? "done" : w >= j.from ? "now" : "later";
    return { ...j, end, state, start: addDays(info.lmp, j.from * 7), last: addDays(info.lmp, end * 7 + 6) };
  });
  const firstAhead = stops.findIndex((s) => s.state === "later");
  const done = stops.filter((s) => s.state === "done").length;
  const shown = stops
    .map((s, i) => ({ ...s, state: i === firstAhead && !stops.some((x) => x.state === "now") ? "next" : s.state }))
    .filter((s) => showDone || s.state !== "done");
  const day = (d: string) => fmtDay(d, { day: "numeric", month: "short" });
  return (
    <Panel title="What's next" sub="Routine scans, tests and moments, dated from your last period. Your doctor sets your own plan.">
      {shown.length ? (
        <div className={css.roadWrap}><ol className={css.road} data-preg-road>
          {shown.map((s) => {
            const badge = s.state === "done" ? "Done" : s.state === "now" ? "Now" : s.state === "next" ? "Next" : `In ${s.from - w} wk`;
            const inner = (
              <>
                <span className={css.cardTop}>
                  <span><I name={s.icon} className="h-4 w-4" /></span>
                  <span className={css.badge}>{badge}</span>
                </span>
                <h3>{s.title}</h3>
                <p>{s.note}</p>
                <p className={css.when}>Week {s.from}{s.to ? `–${s.to}` : ""} · {s.to ? `${day(s.start)} – ${day(s.last)}` : day(s.start)}</p>
              </>
            );
            return (
              <li key={s.title} className={css.stop} data-state={s.state}>
                {s.href ? <Link href={s.href} className={`${css.card} ux-tap-exempt`}>{inner}</Link> : <div className={css.card}>{inner}</div>}
              </li>
            );
          })}
        </ol></div>
      ) : (
        <p className="text-sm" style={{ color: "var(--ux-muted)" }}>Every stop on the road is behind you. Your baby could arrive any day.</p>
      )}
      {done > 0 && (
        <div className={css.roadFoot}>
          <span className="text-xs" style={{ color: "var(--ux-muted)" }}>{done} of {stops.length} behind you</span>
          <button type="button" className={css.toggle} aria-pressed={showDone} onClick={() => setShowDone(!showDone)}>
            {showDone ? "Hide what's done" : "Show what's done"}
          </button>
        </div>
      )}
    </Panel>
  );
}
