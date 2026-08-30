"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The moving parts.
 *
 * Motion here is meant to explain something — that a card is tappable, that a
 * number changed, that content arrived in an order. Nothing moves for
 * decoration, because on a screen a woman opens twenty times a day, decoration
 * becomes friction by the third visit.
 *
 * Every hook below is inert under prefers-reduced-motion rather than merely
 * faster: a counter that still counts is still motion.
 */

/* Read ONLY inside an effect, never in initial state.
   `matchMedia` does not exist on the server, so a hook that seeds its state
   from it renders one value on the server and a different one in the browser —
   which is a hydration mismatch, and React logs it on every affected screen.
   Initial state below is therefore identical in both places, and the reduced
   motion decision is made after mount. */
const still = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Reveal children as they scroll into view, once. */
export function useReveal<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || shown) return;
    if (still()) { setShown(true); return; }
    const io = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setShown(true); io.disconnect(); } },
      { rootMargin: "-40px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [shown]);
  return { ref, shown };
}

/** Count a number up when it first appears — for stats that changed. */
export function useCountUp(to: number, ms = 700) {
  const [n, setN] = useState(0);        // same on server and client
  useEffect(() => {
    if (still()) { setN(to); return; }
    let raf = 0; const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / ms);
      // ease-out cubic — fast first, settles rather than stopping dead
      setN(Math.round(to * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to, ms]);
  return n;
}

/** A progress bar that fills to its value instead of being drawn at it. */
export function useGrow(pct: number) {
  const [w, setW] = useState(0);        // same on server and client
  useEffect(() => {
    if (still()) { setW(pct); return; }
    const id = setTimeout(() => setW(pct), 80);
    return () => clearTimeout(id);
  }, [pct]);
  return w;
}

/** Wraps a grid so its children rise in sequence rather than all at once. */
export function Stagger({
  children, className = "", from = 0,
}: { children: React.ReactNode[]; className?: string; from?: number }) {
  return (
    <div className={className}>
      {children.map((c, i) => (
        <div key={i} className="ux-rise" style={{ ["--i" as string]: i + from }}>
          {c}
        </div>
      ))}
    </div>
  );
}

/* There was a second `Skeleton` here — a div, radius 8, no `aria-hidden` —
   beside the one in `state.tsx`, which is a span with radius 7 that hides
   itself from the screen reader. Nothing imported this one, so the only thing
   two definitions bought was the chance to fix a skeleton bug in the copy that
   was not being rendered. `state.tsx` owns the skeleton. */

/* ── Pointer-aware motion ──────────────────────────────────────────────────
   The CSS in tokens.css does all the moving. All these hooks do is write where
   the pointer is onto two custom properties, so nothing here re-renders React
   and nothing here decides what an effect looks like. */

/**
 * Track the pointer inside an element as `--px` / `--py`, each 0..1.
 *
 * Writes are batched to one per animation frame: `pointermove` can fire far
 * more often than the screen refreshes, and setting a custom property on every
 * event is how a tilt effect turns into a stuttering one.
 */
export function usePointer<T extends HTMLElement>() {
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // The pointer is a positioning input, not an animation — a tilt that is
    // switched off still wants sensible values, so this runs either way and the
    // reduced-motion rules in CSS decide whether anything moves.
    let frame = 0;
    let last: { x: number; y: number } | null = null;

    const write = () => {
      frame = 0;
      if (!last) return;
      el.style.setProperty("--px", last.x.toFixed(4));
      el.style.setProperty("--py", last.y.toFixed(4));
    };
    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) return;
      last = { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
      if (!frame) frame = requestAnimationFrame(write);
    };
    const onLeave = () => {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      // Back to the middle, so the element settles flat rather than holding
      // whatever angle the pointer happened to leave it at.
      el.style.setProperty("--px", "0.5");
      el.style.setProperty("--py", "0.5");
    };

    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", onLeave);
    return () => {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return ref;
}

/**
 * A ripple from the point of contact.
 *
 * The ink element is appended and removed by hand rather than held in state:
 * a ripple is not information, and putting it in React state would re-render a
 * card every time somebody presses it.
 */
export function useRipple<T extends HTMLElement>() {
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onDown = (e: PointerEvent) => {
      if (still()) return;
      const r = el.getBoundingClientRect();
      const ink = document.createElement("span");
      ink.className = "ux-ripple-ink";
      ink.style.setProperty("--rx", `${e.clientX - r.left}px`);
      ink.style.setProperty("--ry", `${e.clientY - r.top}px`);
      el.appendChild(ink);
      // Remove on the animation's own end rather than a matching timeout, so a
      // slow frame cannot leave a stack of dead ink behind.
      ink.addEventListener("animationend", () => ink.remove(), { once: true });
      window.setTimeout(() => ink.remove(), 1200);
    };
    el.addEventListener("pointerdown", onDown);
    return () => el.removeEventListener("pointerdown", onDown);
  }, []);

  return ref;
}

/**
 * Navigate with a View Transition when the browser has one.
 *
 * The fallback is not a degraded animation — it is simply the navigation,
 * which is what every browser did before this API existed.
 */
export function useViewTransition() {
  return (run: () => void) => {
    const d = document as Document & {
      startViewTransition?: (cb: () => void) => { finished: Promise<void> };
    };
    if (still() || !d.startViewTransition) { run(); return; }
    d.startViewTransition(run);
  };
}
