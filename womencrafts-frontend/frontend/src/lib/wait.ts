"use client";

import { useEffect, useRef, useState } from "react";

/**
 * When to say "wait", how long to keep saying it, and when to admit it is slow.
 *
 * ── Why these four numbers and not others ───────────────────────────────────
 * Miller (1968) and Card et al. (1991) give the three response-time limits that
 * Nielsen has restated for thirty years: 0.1s reads as instant, 1s is the edge
 * of an uninterrupted train of thought, and 10s is where attention leaves. Two
 * useful rules fall out of them, and both are about NOT showing a loader:
 *
 *   `SHOW_AFTER` — a loader that appears and vanishes inside a few frames does
 *   not read as loading, it reads as the screen glitching. Oracle's APEX docs
 *   put the cost plainly: a flash "the user may not have time to fully
 *   perceive… at worse the user wonders if something is wrong or if they missed
 *   something important". So nothing is shown for the first 400ms; anything
 *   that finishes inside that window simply finishes. (Same reasoning as the
 *   `animation-delay` on ScreenSkeleton, expressed for things that are not
 *   skeletons.)
 *
 *   `MIN_ON` — once it IS on screen it stays for at least 600ms, because a
 *   loader that flashes for 80ms is a flicker, and a flicker on a page is read
 *   as a fault.
 *
 * The other two are about honesty on a bad connection, which is the connection
 * this app is actually used on — Google's own build-for-billions guidance opens
 * with "over half of all users worldwide will experience your app over a 2G
 * connection":
 *
 *   `SLOW_AFTER` — past six seconds the app should stop pretending this is
 *   normal and say so. "Still going, your connection is slow" is worth more
 *   than a spinner that looks identical at second two and second twenty, and it
 *   is the difference between "wait" and "this is broken, put the phone down".
 *
 *   `STUCK_AFTER` — past fifteen seconds she needs a way out that is not the
 *   back button or force-quitting the browser.
 *
 * Exported rather than inlined so `checks/waiting.mjs` reads the same numbers
 * the app does.
 */
export const SHOW_AFTER = 400;
export const MIN_ON = 600;
export const SLOW_AFTER = 6000;
export const STUCK_AFTER = 15000;

export interface WaitState {
  /** Put the loader on screen. Respects both thresholds above. */
  shown: boolean;
  /** Long enough that she deserves to be told it is slow. */
  slow: boolean;
  /** Long enough that she needs a way out. */
  stuck: boolean;
  /**
   * 0-100, decelerating. A number to draw a bar with — NOT a measurement, and
   * never handed to `aria-valuenow`: see the note in WaitScreen.
   */
  pct: number;
}

/**
 * The shape of every wait in this app.
 *
 * `active` is the truth — a request is in flight. Everything this returns is
 * about how to *present* that truth over time, which is a different question
 * and one that every screen was previously answering for itself.
 *
 * ── Why nothing here calls setState in an effect body ───────────────────────
 * Every value below is either derived during render from `active`, or written
 * by a timer. That is not style: a synchronous setState in an effect cascades a
 * second render, and this hook runs inside a provider that wraps the whole app.
 */
export function useWaitState(
  active: boolean,
  {
    showAfter = SHOW_AFTER,
    minOn = MIN_ON,
    slowAfter = SLOW_AFTER,
    stuckAfter = STUCK_AFTER,
  }: { showAfter?: number; minOn?: number; slowAfter?: number; stuckAfter?: number } = {},
): WaitState {
  // Held up by the timer, and held there until `minOn` has been served.
  const [held, setHeld] = useState(false);
  /** 0 normal · 1 slow · 2 stuck. */
  const [phase, setPhase] = useState(0);
  const [pct, setPct] = useState(0);
  const shownAt = useRef(0);

  /**
   * A caller that already knows the screen behind it is blank — the sign-out
   * hand-off is the case — asks for the loader on this very frame. Waiting
   * 400ms there buys a flash of nothing, which is the fault being fixed. It is
   * derived rather than set, so it is true in the same render that asked.
   */
  const immediate = active && showAfter <= 0;

  // ── on screen, and off it ────────────────────────────────────────────────
  useEffect(() => {
    if (active) {
      const t = setTimeout(() => {
        shownAt.current = Date.now();
        setHeld(true);
      }, Math.max(0, showAfter));
      return () => clearTimeout(t);
    }
    // Never went up: nothing to take down, and no minimum to serve.
    if (!shownAt.current) return;
    // Never yanked away mid-blink. If it went up 80ms ago it owes the eye
    // another 520ms before it is allowed to leave.
    const left = Math.max(0, minOn - (Date.now() - shownAt.current));
    const t = setTimeout(() => {
      shownAt.current = 0;
      setHeld(false);
    }, left);
    return () => clearTimeout(t);
  }, [active, showAfter, minOn]);

  // ── slow, then stuck ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!active) return;
    // Reset on the next tick rather than in this body, so a second wait does
    // not inherit the first one's "your connection is slow".
    const zero = setTimeout(() => setPhase(0), 0);
    const a = setTimeout(() => setPhase(1), slowAfter);
    const b = setTimeout(() => setPhase(2), stuckAfter);
    return () => {
      clearTimeout(zero);
      clearTimeout(a);
      clearTimeout(b);
    };
  }, [active, slowAfter, stuckAfter]);

  // ── the bar ──────────────────────────────────────────────────────────────
  //
  // Harrison et al. (UIST 2007, "Rethinking the Progress Bar") tested nine
  // progress functions at a fixed 5.5s and found two things that decide the
  // shape of this: bars that PAUSE are perceived as slower, and both effects
  // are exaggerated towards the end. So this decelerates but never stalls, and
  // it never sits at a number.
  //
  // There is no real percentage to report — the browser will not say how far
  // through a fetch it is — so it stops at 92 and only reaches 100 when the
  // work actually finishes, which is the one moment it can be truthful about.
  useEffect(() => {
    if (!active) {
      const t = setTimeout(() => setPct(0), MIN_ON);
      return () => clearTimeout(t);
    }
    const first = setTimeout(() => setPct(6), 0);
    const id = setInterval(() => {
      setPct((p) => {
        if (p >= 92) return p;
        const step = p < 30 ? 7 : p < 60 ? 3.5 : p < 80 ? 1.4 : 0.4;
        return Math.min(92, p + step);
      });
    }, 180);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [active]);

  return {
    shown: immediate || held,
    slow: active && phase >= 1,
    stuck: active && phase >= 2,
    // A bar that vanishes at 60% is read as a failure, so it finishes the
    // journey on the way out.
    pct: active ? pct : pct > 0 ? 100 : 0,
  };
}
