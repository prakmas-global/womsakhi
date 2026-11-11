"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

import css from "./water-buddy.module.css";

/**
 * Water, shown as drops that hold a litre each — half a litre fills half a
 * drop — and Boondi, the little drop who comes to ask whether it is time for
 * a glass. "Yes" makes her happy and she walks on; "Later" makes her sad and
 * she steps back, to ask again in ten minutes.
 */

const LITRE = 1000;
/** One glass, what "Yes" adds. */
export const BUDDY_GLASS = 250;

/* ── the meter ───────────────────────────────────────────────────────────── */

const DROP = "M20 2 C20 2 4 22 4 33 A16 16 0 0 0 36 33 C36 22 20 2 20 2 Z";

/**
 * One drop per litre, each filled as far as she has drunk into it. Her goal's
 * drops are always there; drink past the goal and new drops appear, one per
 * litre more (2.75 L of 2 L → a third drop, three-quarters full).
 */
export function DropMeter({ ml, goalMl }: { ml: number; goalMl: number }) {
  const id = useId().replace(/:/g, "");
  const fmt = (n: number) => `${(n / LITRE).toFixed(2).replace(/0$/, "")} L`;
  // Each drop is a stretch of litres. The goal's last drop holds only what is
  // left of it (a 2.5 L goal → a half-litre drop); drops past the goal hold a litre.
  const segs: { from: number; to: number; extra: boolean }[] = [];
  let at = 0;
  while (at < goalMl || !segs.length) { const to = Math.min(at + LITRE, Math.max(goalMl, LITRE)); segs.push({ from: at, to, extra: false }); at = to; }
  while (at < ml) { segs.push({ from: at, to: at + LITRE, extra: true }); at += LITRE; }
  const over = ml - goalMl;
  return (
    <ul className={css.meter} role="img" data-water-meter
        aria-label={`${fmt(ml)} of ${fmt(goalMl)} today${over > 0 ? `, ${fmt(over)} more than your goal` : ""}. Each drop is one litre.`}>
      {segs.map(({ from, to, extra }, i) => {
        const fill = Math.max(0, Math.min(1, (ml - from) / (to - from)));
        const y = 2 + 47 * (1 - fill); // the drop runs from y=2 to y=49
        return (
          <li key={i} className={css.drop} data-full={fill >= 1 || undefined} data-extra={extra || undefined}
              title={extra ? "More than your goal" : undefined}>
            <svg viewBox="0 0 40 51" aria-hidden>
              <defs>
                <clipPath id={`${id}-c${i}`}><path d={DROP} /></clipPath>
                <linearGradient id={`${id}-g${i}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#6ec3ff" /><stop offset="1" stopColor="#1f6fd6" />
                </linearGradient>
              </defs>
              <path d={DROP} className={css.dropBack} />
              <g clipPath={`url(#${id}-c${i})`}>
                {/* the water, with a wave on its surface */}
                <g className={css.level} style={{ transform: `translateY(${y}px)` }}>
                  <path className={css.wave} fill={`url(#${id}-g${i})`}
                        d="M-40 2 q5 -3 10 0 t10 0 t10 0 t10 0 t10 0 t10 0 t10 0 t10 0 t10 0 t10 0 t10 0 t10 0 V60 H-40 Z" />
                </g>
              </g>
              <path d={DROP} className={css.dropLine} />
              <ellipse cx="13" cy="28" rx="2.2" ry="5" className={css.shine} transform="rotate(20 13 28)" />
            </svg>
            <small>{fmt(to).replace(".0 L", " L")}</small>
          </li>
        );
      })}
    </ul>
  );
}

/* ── Boondi, the drop who asks ───────────────────────────────────────────── */

type Mood = "ask" | "happy" | "sad";

function Boondi({ mood }: { mood: Mood }) {
  const g = useId().replace(/:/g, "");
  const ink = "#1b2a52";
  return (
    <svg viewBox="0 0 100 126" className={css.boondi} aria-hidden>
      <defs>
        <linearGradient id={`${g}-b`} x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0" stopColor="#8fd3ff" /><stop offset="1" stopColor="#2b7be4" />
        </linearGradient>
      </defs>
      {/* feet */}
      <g className={css.feet}>
        <ellipse className={css.footL} cx="39" cy="118" rx="8" ry="4.5" fill="#1f5fb8" />
        <ellipse className={css.footR} cx="61" cy="118" rx="8" ry="4.5" fill="#1f5fb8" />
      </g>
      {/* arms */}
      <g stroke="#2b7be4" strokeWidth="5" strokeLinecap="round" fill="none">
        {mood === "ask" && <><path d="M17 86 L7 96" /><path className={css.wave1} d="M83 82 L95 68" /></>}
        {mood === "happy" && <><path d="M17 82 L5 66" /><path d="M83 82 L95 66" /></>}
        {mood === "sad" && <><path d="M18 90 L12 104" /><path d="M82 90 L88 104" /></>}
      </g>
      {/* body */}
      <path d="M50 4 C50 4 14 50 14 78 A36 36 0 0 0 86 78 C86 50 50 4 50 4 Z" fill={`url(#${g}-b)`} />
      <ellipse cx="33" cy="54" rx="5" ry="11" fill="#fff" opacity=".55" transform="rotate(24 33 54)" />
      {/* cheeks */}
      <ellipse cx="30" cy="88" rx="6" ry="3.4" fill="#ff8fb8" opacity={mood === "sad" ? 0.25 : 0.65} />
      <ellipse cx="70" cy="88" rx="6" ry="3.4" fill="#ff8fb8" opacity={mood === "sad" ? 0.25 : 0.65} />
      {/* eyes */}
      {mood === "happy" ? (
        <g stroke={ink} strokeWidth="3.6" strokeLinecap="round" fill="none">
          <path d="M32 79 Q38 71 44 79" /><path d="M56 79 Q62 71 68 79" />
        </g>
      ) : (
        <g className={mood === "ask" ? css.blink : undefined}>
          <circle cx="38" cy={mood === "sad" ? 80 : 77} r="5.2" fill={ink} />
          <circle cx="62" cy={mood === "sad" ? 80 : 77} r="5.2" fill={ink} />
          <circle cx="39.8" cy={mood === "sad" ? 78.2 : 75.2} r="1.7" fill="#fff" />
          <circle cx="63.8" cy={mood === "sad" ? 78.2 : 75.2} r="1.7" fill="#fff" />
        </g>
      )}
      {mood === "sad" && (
        <g stroke={ink} strokeWidth="2.6" strokeLinecap="round">
          <path d="M30 72 L44 67" /><path d="M70 72 L56 67" />
        </g>
      )}
      {/* mouth */}
      {mood === "ask" && <path d="M43 89 Q50 95 57 89" stroke={ink} strokeWidth="3" strokeLinecap="round" fill="none" />}
      {mood === "happy" && (
        <g>
          <path d="M39 87 Q50 104 61 87 Z" fill={ink} />
          <path d="M45 95 Q50 99 55 95 Q50 92 45 95 Z" fill="#ff7aa8" />
        </g>
      )}
      {mood === "sad" && <path d="M42 97 Q50 89 58 97" stroke={ink} strokeWidth="3" strokeLinecap="round" fill="none" />}
      {mood === "sad" && <path className={css.tear} d="M67 86 C67 86 63 92 63 94.5 A4 4 0 0 0 71 94.5 C71 92 67 86 67 86 Z" fill="#bfe6ff" />}
      {mood === "happy" && (
        <g className={css.sparks} fill="#ffc83d">
          <path d="M8 30 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2 Z" />
          <path d="M90 20 l1.6 4 4 1.6 -4 1.6 -1.6 4 -1.6 -4 -4 -1.6 4 -1.6 Z" />
          <path d="M94 50 l1.2 3 3 1.2 -3 1.2 -1.2 3 -1.2 -3 -3 -1.2 3 -1.2 Z" />
        </g>
      )}
    </svg>
  );
}

/* ── when to ask ─────────────────────────────────────────────────────────── */

const LATER_KEY = "ws-water-later-until";
/** Ask every ten minutes: ten minutes after her last
 * water, or after a "Yes" or "Later". */
const REMIND_EVERY_MIN = 10;

/** The server's times are UTC but may come without a zone ("…T15:05:41.332"); read them as UTC, not local time. */
const parseUtc = (iso: string) => Date.parse(/(Z|[+-]\d\d:?\d\d)$/i.test(iso) ? iso : `${iso}Z`);

const readLater = () => { try { return Number(localStorage.getItem(LATER_KEY)) || 0; } catch { return 0; } };
const writeLater = (until: number) => { try { localStorage.setItem(LATER_KEY, String(until)); } catch { /* private mode: ask again next visit */ } };

const TEXT: Record<Mood, { head: string; body: string }> = {
  ask: { head: "It's time for water!", body: "Shall we drink a glass now?" },
  happy: { head: "Yay! Well done!", body: "Water added. Let's keep going!" },
  sad: { head: "Oh… okay.", body: `I'll come back in ${REMIND_EVERY_MIN} minutes.` },
};

/**
 * Boondi comes in from the corner when she is due a glass: she is under
 * her goal, and nothing has been logged, and
 * no "Yes" or "Later" given, in the last ten minutes.
 */
export function WaterBuddy({ ready, ml, goalMl, lastAt, onDrink }: {
  /** The day's water has loaded — never ask on a guess. */
  ready: boolean;
  ml: number;
  goalMl: number;
  /** When she last logged water today (ISO), if she has. */
  lastAt?: string;
  /** "Yes": add one glass. */
  onDrink: (ml: number) => Promise<unknown>;
}) {
  const [mood, setMood] = useState<Mood | null>(null);
  const [now, setNow] = useState(0);
  const acted = useRef(false);
  const headId = useId();

  // The clock, every half minute, so she is asked on time without a reload.
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 1200); // a moment after the page settles, so she "comes in"
    const every = setInterval(tick, 30_000);
    return () => { clearTimeout(first); clearInterval(every); };
  }, []);

  const due = (() => {
    if (!ready || !now || ml >= goalMl) return false;
    if (lastAt && now - parseUtc(lastAt) < REMIND_EVERY_MIN * 60_000) return false;
    return now >= readLater();
  })();

  useEffect(() => {
    if (due && mood === null && !acted.current) {
      const t = setTimeout(() => setMood("ask"), 0);
      return () => clearTimeout(t);
    }
  }, [due, mood]);

  // She drank another way (the ½ L or 1 L buttons) while being asked: that is a yes too.
  const askedAt = useRef(-1);
  useEffect(() => {
    if (mood !== "ask") return;
    if (askedAt.current < 0) { askedAt.current = ml; return; }
    if (ml > askedAt.current) {
      acted.current = true;
      const t = setTimeout(() => setMood("happy"), 0);
      return () => clearTimeout(t);
    }
  }, [mood, ml]);
  useEffect(() => { if (mood === null) askedAt.current = -1; }, [mood]);

  // After her reaction plays out, she is gone; the next visit or tick may bring her back.
  useEffect(() => {
    if (mood !== "happy" && mood !== "sad") return;
    const t = setTimeout(() => { setMood(null); acted.current = false; }, 2900);
    return () => clearTimeout(t);
  }, [mood]);

  const yes = useCallback(() => {
    acted.current = true;
    writeLater(Date.now() + REMIND_EVERY_MIN * 60_000); // a failed save should not bring her straight back
    setMood("happy");
    void onDrink(BUDDY_GLASS);
  }, [onDrink]);
  const later = useCallback(() => {
    acted.current = true;
    writeLater(Date.now() + REMIND_EVERY_MIN * 60_000);
    setMood("sad");
  }, []);

  if (!mood) return null;
  const text = TEXT[mood];
  return createPortal(
    <section className={css.dock} data-mood={mood} aria-labelledby={headId} aria-live="polite" data-water-buddy>
      <div className={css.stage}>
        <div className={css.bubble}>
          <b id={headId}>{text.head}</b>
          <span>{text.body}</span>
        </div>
        <div className={css.walker}><Boondi mood={mood} /></div>
        <i className={css.ground} aria-hidden />
      </div>
      <div className={css.actions}>
        <button type="button" className={css.yes} onClick={yes} disabled={mood !== "ask"}>Yes, I&apos;ll drink</button>
        <button type="button" className={css.later} onClick={later} disabled={mood !== "ask"}>Later</button>
      </div>
    </section>,
    // Inside the app shell, where the theme lives (as the sheets do).
    document.querySelector(".ux") ?? document.body,
  );
}
