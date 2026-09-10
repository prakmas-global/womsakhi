"use client";

import { useMemo } from "react";

/**
 * A short buzz under the finger.
 *
 * ── Read this before you rely on it ─────────────────────────────────────────
 * **iOS Safari does not implement the Vibration API at all.** Not behind a
 * flag, not behind a permission prompt, not in "add to home screen" mode:
 * `navigator.vibrate` is simply `undefined` on every iPhone, in Safari and in
 * every other iOS browser, because they are all WebKit. There is no polyfill —
 * the Taptic Engine is not exposed to the web at all. So nothing in this file
 * will ever fire on an iPhone, and anyone reading the call sites should assume
 * **Android-only**.
 *
 * That is why every call here decorates feedback that is already visible
 * somewhere else. A tab press changes the pill, the label weight and the
 * indicator above it (`TabBar.tsx`); `mobile.css` scales the control under the
 * finger. A woman on an iPhone gets the same answer from the app as a woman on
 * an Android — she just does not feel it.
 *
 * ── Reduced motion ──────────────────────────────────────────────────────────
 * `prefers-reduced-motion: reduce` is not literally about vibration, but it is
 * the only signal a browser gives us for "I want this thing to do less to me",
 * and on Android it is what a vestibular-sensitive user has actually set. It is
 * read at call time rather than cached, because she can change it mid-session
 * from the system settings and nothing here re-renders when she does.
 */

/** Durations in ms. A pattern alternates buzz, pause, buzz. */
const PATTERN = {
  /** A tab, a chip, a toggle. Short enough to read as a tick, not a buzz. */
  light: 8,
  /** A commit — sending, paying, confirming. */
  medium: 18,
  /** It worked: two quick taps. */
  success: [10, 45, 18],
  /** Something needs her attention: three, slower. */
  warning: [22, 70, 22, 70, 22],
} as const;

function buzz(pattern: number | readonly number[]): void {
  // Server render, or a runtime with no navigator at all.
  if (typeof window === "undefined" || typeof navigator === "undefined") return;
  try {
    // The whole of iOS lands here and returns.
    if (typeof navigator.vibrate !== "function") return;
    // "Do less to me."
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    navigator.vibrate(pattern as number | number[]);
  } catch {
    /*
     * Chrome throws rather than returning false in a cross-origin iframe, and
     * a `Permissions-Policy` that omits `vibrate` does the same. A buzz that
     * cannot happen must never take the tap down with it.
     */
  }
}

export interface Haptics {
  /** A tap acknowledged — tab change, selection, chip. */
  light: () => void;
  /** A commitment — submit, pay, confirm. */
  medium: () => void;
  /** It worked. */
  success: () => void;
  /** Look at this. */
  warning: () => void;
}

export function useHaptics(): Haptics {
  // Stable identity so it can sit in a dependency array without re-running
  // whatever it is a dependency of.
  return useMemo<Haptics>(
    () => ({
      light: () => buzz(PATTERN.light),
      medium: () => buzz(PATTERN.medium),
      success: () => buzz(PATTERN.success),
      warning: () => buzz(PATTERN.warning),
    }),
    [],
  );
}
