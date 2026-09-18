"use client";

import { useEffect, useId, useRef, type KeyboardEvent as ReactKeyboardEvent } from "react";

import * as Icons from "@/components/ux/icons";

/**
 * − / + on a quantity.
 *
 * ── Press and hold ──────────────────────────────────────────────────────────
 * A native stepper repeats while the finger stays down. Without it, ordering
 * twelve of something is twelve separate taps, and on a phone that is the
 * moment somebody gives up and types a number into a field that does not
 * exist. It waits 400ms first, so a single tap is still a single tap.
 *
 * The repeat counts from the value captured when the finger landed rather than
 * reading the current one each tick. A timer closure holds whatever `value`
 * was on the render that created it — the classic stale-prop bug — and the
 * symptom is a stepper that repeats forever between 3 and 4.
 *
 * ── Why it is a spinbutton and the buttons are still real buttons ───────────
 * `role="spinbutton"` is what makes this adjustable to a screen reader: on
 * iOS, VoiceOver's swipe-up / swipe-down then works, which is how somebody who
 * cannot see the two targets actually changes the number.
 *
 * The − and + stay focusable and labelled rather than being hidden from
 * assistive tech as decoration. That costs one extra Tab stop each and it
 * means every visible control is also a reachable one, which is the trade this
 * codebase makes every time.
 *
 * `aria-live` on the value is the other half: pressing + moves focus nowhere,
 * so without it the number changes in silence. It can double-announce when
 * focus is already on the spinbutton itself — an annoyance, against a change
 * nobody hears at all.
 *
 * ── Why the buttons commit twice over, from two different events ────────────
 * `onPointerDown` is what makes the press feel immediate on a phone: waiting
 * for the click means waiting for the finger to lift. But Enter and Space on a
 * focused button produce a `click` and NO pointer event at all, so a stepper
 * wired only to pointers is a stepper the keyboard cannot use — and it looks
 * completely fine in a screenshot. This was caught by driving it: focus landed
 * on +, Enter was pressed, and the value stayed at 2.
 *
 * `event.detail` separates them. A click synthesised from a key press reports
 * `detail === 0`; a click that came from a real pointer reports 1 or more. So
 * the pointer path commits on pointer-down and the keyboard path commits on
 * the click, and neither fires twice.
 */

/** Held-down repeat: the pause before it starts, then the gap between ticks. */
const HOLD_DELAY = 400;
const HOLD_TICK = 90;

export function Stepper({
  value,
  onChange,
  min = 0,
  max = 99,
  step = 1,
  label,
  formatValue,
  disabled = false,
  decreaseLabel,
  increaseLabel,
}: {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  step?: number;
  /** What is being counted — "Quantity", "Guests". Names the whole control. */
  label: string;
  /** For units: `(n) => `${n} kg``. Becomes `aria-valuetext` too. */
  formatValue?: (n: number) => string;
  disabled?: boolean;
  decreaseLabel?: string;
  increaseLabel?: string;
}) {
  const timers = useRef<{ delay?: number; tick?: number }>({});
  const valueId = useId();

  const clamp = (n: number) => Math.min(max, Math.max(min, n));
  const commit = (n: number) => {
    const next = clamp(n);
    if (next !== value) onChange(next);
  };

  const stopHold = () => {
    if (timers.current.delay) window.clearTimeout(timers.current.delay);
    if (timers.current.tick) window.clearInterval(timers.current.tick);
    timers.current = {};
  };

  // A finger lifted outside the button, or the tab hidden mid-hold, must not
  // leave an interval running for the rest of the session.
  useEffect(() => stopHold, []);

  const startHold = (dir: 1 | -1) => {
    stopHold();
    const from = value;
    let n = 1;
    commit(from + dir * step);
    timers.current.delay = window.setTimeout(() => {
      timers.current.tick = window.setInterval(() => {
        n += 1;
        const next = clamp(from + dir * step * n);
        onChange(next);
        if (next === (dir > 0 ? max : min)) stopHold();
      }, HOLD_TICK);
    }, HOLD_DELAY);
  };

  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const map: Record<string, number> = {
      ArrowUp: step,
      ArrowRight: step,
      ArrowDown: -step,
      ArrowLeft: -step,
      PageUp: step * 10,
      PageDown: -step * 10,
    };
    if (e.key in map) {
      e.preventDefault();
      commit(value + map[e.key]);
    } else if (e.key === "Home") {
      e.preventDefault();
      commit(min);
    } else if (e.key === "End") {
      e.preventDefault();
      commit(max);
    }
  };

  const text = formatValue ? formatValue(value) : String(value);
  const atMin = disabled || value <= min;
  const atMax = disabled || value >= max;

  const btn =
    "grid h-[44px] w-[44px] shrink-0 place-items-center rounded-full transition-colors duration-150 " +
    "motion-reduce:transition-none disabled:opacity-35";

  return (
    <div
      className="inline-flex items-center gap-1 rounded-[var(--ux-r-pill)] p-1"
      style={{ background: "var(--ux-surface-2)", border: "1px solid var(--ux-line)" }}
    >
      <button
        type="button"
        aria-label={decreaseLabel ?? `Decrease ${label}`}
        aria-controls={valueId}
        disabled={atMin}
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          startHold(-1);
        }}
        onPointerUp={stopHold}
        onPointerCancel={stopHold}
        onLostPointerCapture={stopHold}
        // Keyboard only — a pointer click has already been handled above.
        onClick={(e) => {
          if (e.detail === 0) commit(value - step);
        }}
        className={btn}
        style={{ background: "var(--ux-surface)", color: "var(--ux-ink)" }}
      >
        <Icons.Minus className="h-[18px] w-[18px]" aria-hidden="true" />
      </button>

      <div
        id={valueId}
        role="spinbutton"
        tabIndex={disabled ? -1 : 0}
        aria-label={label}
        aria-valuenow={value}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuetext={formatValue ? text : undefined}
        aria-disabled={disabled || undefined}
        aria-live="polite"
        onKeyDown={onKeyDown}
        className="min-w-[48px] select-none px-1 text-center text-[17px] font-bold tabular-nums"
        style={{ color: "var(--ux-ink)" }}
      >
        {text}
      </div>

      <button
        type="button"
        aria-label={increaseLabel ?? `Increase ${label}`}
        aria-controls={valueId}
        disabled={atMax}
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          startHold(1);
        }}
        onPointerUp={stopHold}
        onPointerCancel={stopHold}
        onLostPointerCapture={stopHold}
        // Keyboard only — a pointer click has already been handled above.
        onClick={(e) => {
          if (e.detail === 0) commit(value + step);
        }}
        className={btn}
        style={{ background: "var(--ux-surface)", color: "var(--ux-ink)" }}
      >
        <Icons.Plus className="h-[18px] w-[18px]" aria-hidden="true" />
      </button>
    </div>
  );
}
