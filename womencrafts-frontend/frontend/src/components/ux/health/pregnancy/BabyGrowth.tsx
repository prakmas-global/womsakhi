"use client";

import { useEffect, useId, useRef, useState } from "react";

import { Disclaimer, HUE, I, Panel } from "@/components/ux/health/kit";
import { illSrc } from "@/components/ux/health/art";
import { GROWTH, MILESTONES, bodyFor, growthFor, type PregInfo } from "@/components/ux/health/pregnancy-data";
import { addDays, fmtDay } from "@/lib/health-api";
import css from "./growth.module.css";

/**
 * Baby Growth: every week from 4 to 40. Baby's picture grows week by week,
 * with what she is about the size of, the length, the weight and when that week falls for her;
 * a slider with the milestones on it, play to watch baby grow, a strip of
 * weeks to tap, and the growth curve to scrub along. All general information.
 */

const FIRST = 4, LAST = 40, SPAN = LAST - FIRST;
const TRI_NAME = ["", "1st", "2nd", "3rd"] as const;
const triOf = (w: number) => (w < 14 ? 1 : w < 28 ? 2 : 3);
const SHORT: Record<number, string> = { 12: "1st trimester ends", 20: "Halfway", 28: "3rd trimester", 37: "Full term", 40: "Due date" };
const STEP_MS = 1300;

const grams = (g: number) => (g < 1 ? "Under 1 g" : g < 1000 ? `${g} g` : `${(g / 1000).toFixed(2).replace(/0$/, "")} kg`);
const pct = (w: number) => (w - FIRST) / SPAN;
const day = (d: string) => fmtDay(d, { day: "numeric", month: "short" });

// The trimester bands on the slider: lilac to week 13, magenta to 27, gold to 40.
const TRACK = `linear-gradient(90deg, var(--ux-lilac-ink) 0 ${(pct(13.5) * 100).toFixed(1)}%, var(--ux-brand) 0 ${(pct(27.5) * 100).toFixed(1)}%, var(--ws-gold) 0)`;

export function BabyGrowth({ info }: { info: PregInfo }) {
  const mine = Math.min(LAST, Math.max(FIRST, info.week));
  const [week, setWeek] = useState(mine);
  const [playing, setPlaying] = useState(false);
  const [metric, setMetric] = useState<"g" | "cm">("g");
  const stepsLeft = useRef(0);
  const strip = useRef<HTMLOListElement>(null);

  const go = (w: number) => { setPlaying(false); setWeek(Math.min(LAST, Math.max(FIRST, w))); };

  // Play: one week every STEP_MS until 40.
  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => {
      setWeek((w) => Math.min(LAST, w + 1));
      stepsLeft.current -= 1;
      if (stepsLeft.current <= 0) setPlaying(false);
    }, STEP_MS);
    return () => window.clearInterval(id);
  }, [playing]);

  function play() {
    if (playing) { setPlaying(false); return; }
    const from = week >= LAST ? FIRST : week;
    setWeek(from);
    stepsLeft.current = LAST - from;
    setPlaying(true);
  }

  // Keep the chosen week in view in the strip, without moving the page.
  useEffect(() => {
    const box = strip.current;
    const el = box?.querySelector<HTMLElement>(`[data-w="${week}"]`);
    if (!box || !el) return;
    const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    box.scrollTo({ left: el.offsetLeft - box.clientWidth / 2 + el.clientWidth / 2, behavior: smooth ? "smooth" : "auto" });
  }, [week]);

  const g = growthFor(week);
  const exploring = week !== mine;
  const ahead = week - info.week;
  const starts = addDays(info.lmp, week * 7);
  const when = ahead === 0 ? `${info.day} day${info.day === 1 ? "" : "s"} in` : ahead < 0 ? "You reached it" : `In ${ahead} week${ahead === 1 ? "" : "s"}`;
  // Baby's picture grows with her length.
  const babyScale = (0.4 + 0.6 * Math.sqrt(g.cm / 51.2)).toFixed(2);

  return (
    <Panel title="Baby's journey, week by week" sub="General information with approximate sizes. Every pregnancy and every baby is different.">
      <div className={css.wrap} data-baby-explore>
        <div className={css.stage}>
          <div className={css.scene}>
            <span className={css.bubble} aria-hidden>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={illSrc("baby")} alt="" style={{ transform: `scale(${babyScale})` }} />
            </span>
            <p key={`c${week}`} className={`${css.caption} ${css.pop}`}>
              About the size of {g.size}
              <span>{week < 20 ? "Crown to rump" : "Head to heel"} · approximate</span>
            </p>
          </div>

          <div className={css.info} aria-live="polite">
            <p className={css.kicker}>{exploring ? "Exploring" : "Your week"} · {TRI_NAME[triOf(week)]} trimester{SHORT[week] ? ` · ${SHORT[week]}` : ""}</p>
            <div className={css.weekRow}>
              <h3 data-baby-week>Week {week}</h3>
              <span>{week === LAST ? "Estimated due date" : `${LAST - week} week${LAST - week === 1 ? "" : "s"} before the due date`}</span>
            </div>
            <div className={css.stats}>
              <div className={css.stat}><strong>{g.cm < 1 ? `${(g.cm * 10).toFixed(0)} mm` : `${g.cm} cm`}</strong><small>Length</small></div>
              <div className={css.stat}><strong>{grams(g.g)}</strong><small>Weight</small></div>
              <div className={css.stat}><strong>{day(starts)}</strong><small>{when}</small></div>
            </div>
            <div className={css.notes}>
              <div className={css.note} style={{ "--ink": HUE.pink.ink } as React.CSSProperties}>
                <span><I name="Baby" className="h-4 w-4" /></span>
                <p><b>Baby</b>{g.dev}</p>
              </div>
              <div className={css.note} style={{ "--ink": HUE.lilac.ink } as React.CSSProperties}>
                <span><I name="HeartPulse" className="h-4 w-4" /></span>
                <p><b>Your body</b>{bodyFor(week)}</p>
              </div>
            </div>
          </div>
        </div>

        <div className={css.controls}>
          <button type="button" className={css.ctl} onClick={() => go(week - 1)} disabled={week <= FIRST} aria-label="Previous week"><I name="ChevronLeft" className="h-4 w-4" /></button>
          <button type="button" className={css.ctl} data-main onClick={play} aria-pressed={playing} data-baby-play>
            <I name={playing ? "Pause" : "Play"} className="h-4 w-4" />{playing ? "Pause" : week >= LAST ? "Play from week 4" : "Watch baby grow"}
          </button>
          <button type="button" className={css.ctl} onClick={() => go(week + 1)} disabled={week >= LAST} aria-label="Next week"><I name="ChevronRight" className="h-4 w-4" /></button>
          {exploring && <button type="button" className={css.mine} onClick={() => go(mine)}>Back to my week ({mine})</button>}
        </div>

        <div className={css.track}>
          <input className={css.range} type="range" min={FIRST} max={LAST} step={1} value={week}
                 onChange={(e) => go(Number(e.target.value))} aria-label="Week" aria-valuetext={`Week ${week}, about the size of ${g.size}`}
                 style={{ "--track": TRACK } as React.CSSProperties} />
          <div className={css.marks}>
            <span className={css.you} style={{ left: `${pct(mine) * 100}%` }} aria-hidden>You</span>
            {MILESTONES.map(([w]) => (
              <button key={w} type="button" className={css.mark} style={{ left: `${pct(w) * 100}%` }} aria-pressed={week === w}
                      data-end={w === LAST ? "" : undefined} data-near={w === 37 ? "" : undefined} onClick={() => go(w)} aria-label={`Week ${w}: ${SHORT[w]}`}>
                {w}{w !== 37 && <span className={css.markLong}> · {SHORT[w]}</span>}
              </button>
            ))}
          </div>
        </div>

        <ol className={css.strip} ref={strip} aria-label="Weeks 4 to 40">
          {GROWTH.map((r) => (
            <li key={r.week}>
              <button type="button" className={css.chip} data-w={r.week} aria-pressed={r.week === week}
                      data-past={r.week < mine ? "" : undefined} onClick={() => go(r.week)} aria-label={`Week ${r.week}: ${r.size}`}>
                {/* a dot that grows with baby, in the colour of the trimester */}
                <span className={css.dot} aria-hidden>
                  <i style={{ width: `${(5 + 17 * Math.sqrt(r.cm / 51.2)).toFixed(1)}px`, height: `${(5 + 17 * Math.sqrt(r.cm / 51.2)).toFixed(1)}px`,
                              background: ["", "var(--ux-lilac-ink)", "var(--ux-brand)", "var(--ws-gold)"][triOf(r.week)] }} />
                </span>
                <b>{r.week}</b>
                {r.week === mine && <small>You</small>}
              </button>
            </li>
          ))}
        </ol>

        <GrowthCurve week={week} mine={mine} metric={metric} onMetric={setMetric} onWeek={go} />
        <Disclaimer><b>These are averages.</b> Your baby&apos;s own size is measured on your scans; ask your doctor what your numbers mean.</Disclaimer>
      </div>
    </Panel>
  );
}

/* ── the growth curve ───────────────────────────────────────────────────── */

const H = 220, L = 44, R = 14, T = 26, B = 26;

function GrowthCurve({ week, mine, metric, onMetric, onWeek }: {
  week: number; mine: number; metric: "g" | "cm"; onMetric: (m: "g" | "cm") => void; onWeek: (w: number) => void;
}) {
  const gid = useId().replace(/:/g, "");
  // Drawn at its real width, so the words and dots stay the same size on a phone and a wide screen.
  const box = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(640);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(280, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const xOf = (w: number) => L + pct(w) * (W - L - R);
  const max = metric === "g" ? 3600 : 54;
  const yOf = (v: number) => T + (1 - v / max) * (H - T - B);
  const val = (w: number) => growthFor(w)[metric];
  const line = GROWTH.map((r, i) => `${i ? "L" : "M"}${xOf(r.week).toFixed(1)} ${yOf(r[metric]).toFixed(1)}`).join(" ");
  const area = `${line} L${xOf(LAST)} ${H - B} L${xOf(FIRST)} ${H - B} Z`;
  const ticks = metric === "g" ? [0, 1000, 2000, 3000] : [0, 20, 40];
  const label = (v: number) => (metric === "g" ? (v ? `${v / 1000} kg` : "0") : `${v} cm`);
  const cx = xOf(week), cy = yOf(val(week));
  const shown = metric === "g" ? grams(val(week)) : `${growthFor(week).cm} cm`;

  function pick(e: React.PointerEvent<SVGSVGElement>) {
    const box = e.currentTarget.getBoundingClientRect();
    const vx = ((e.clientX - box.left) / box.width) * W;
    onWeek(Math.round(FIRST + ((vx - L) / (W - L - R)) * SPAN));
  }

  return (
    <div ref={box} className="flex flex-col gap-2" data-baby-curve>
      <div className={css.chartHead}>
        <h3>How baby grows</h3>
        <div className={css.seg} role="group" aria-label="Show">
          <button type="button" aria-pressed={metric === "g"} onClick={() => onMetric("g")}>Weight</button>
          <button type="button" aria-pressed={metric === "cm"} onClick={() => onMetric("cm")}>Length</button>
        </div>
      </div>
      <svg className={css.chart} viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img"
           aria-label={`Baby's ${metric === "g" ? "weight" : "length"} by week. Week ${week}: ${shown}.`}
           onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); pick(e); }}
           onPointerMove={(e) => { if (e.buttons) pick(e); }}>
        <defs>
          <linearGradient id={`${gid}-a`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--ux-lilac-ink)" stopOpacity=".28" />
            <stop offset="1" stopColor="var(--ux-lilac-ink)" stopOpacity="0" />
          </linearGradient>
          <linearGradient id={`${gid}-l`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="var(--ux-lilac-ink)" />
            <stop offset=".6" stopColor="var(--ux-brand)" />
            <stop offset="1" stopColor="var(--ws-gold)" />
          </linearGradient>
        </defs>
        {ticks.map((v) => (
          <g key={v}>
            <line x1={L} x2={W - R} y1={yOf(v)} y2={yOf(v)} stroke="var(--ux-line)" strokeDasharray={v ? "3 4" : undefined} />
            <text className={css.axis} x={L - 6} y={yOf(v)} textAnchor="end" dominantBaseline="central">{label(v)}</text>
          </g>
        ))}
        {(W < 420 ? [4, 12, 20, 28, 40] : [4, 8, 12, 16, 20, 24, 28, 32, 36, 40]).map((w) => (
          <text key={w} className={css.axis} x={xOf(w)} y={H - 8} textAnchor="middle">{w === 4 ? "wk 4" : w}</text>
        ))}
        <path d={area} fill={`url(#${gid}-a)`} />
        <path d={line} fill="none" stroke={`url(#${gid}-l)`} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
        <line x1={xOf(mine)} x2={xOf(mine)} y1={T - 8} y2={H - B} stroke="var(--ux-brand)" strokeDasharray="4 4" strokeWidth="1.5" />
        <text className={css.axis} x={xOf(mine)} y={T - 12} textAnchor="middle" style={{ fill: "var(--ux-brand)" }}>You</text>
        <line x1={cx} x2={cx} y1={cy} y2={H - B} stroke="var(--ux-lilac-ink)" strokeWidth="1.5" />
        <circle cx={cx} cy={cy} r="7" fill="var(--ux-surface)" stroke="var(--ux-lilac-ink)" strokeWidth="3.5" />
        <g transform={`translate(${Math.min(W - R - 46, Math.max(L + 46, cx))} ${Math.max(T + 4, cy - 22)})`}>
          <rect x="-44" y="-12" width="88" height="22" rx="11" fill="var(--ux-lilac-ink)" />
          <text x="0" y="0" textAnchor="middle" dominantBaseline="central" style={{ fill: "#fff", fontSize: 11.5, fontWeight: 800 }}>{shown}</text>
        </g>
      </svg>
      {metric === "cm" && <p className={css.chartNote}>Length is measured crown to rump until week 19, then head to heel, so the line jumps at week 20.</p>}
    </div>
  );
}
