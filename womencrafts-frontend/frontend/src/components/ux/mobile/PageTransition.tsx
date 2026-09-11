"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { usePathname } from "next/navigation";

/**
 * Screens arrive from a direction instead of blinking into place.
 *
 * ── The View Transitions API is not used here, and must not be ──────────────
 * It was, once, in `TransitionLink`, and it cost **4,263ms of frozen screen per
 * click** — measured. `document.startViewTransition()` render-blocks the
 * document between its two snapshots, and `requestAnimationFrame` does not fire
 * while it is blocked, so the callback that waited for the new route to exist
 * deadlocked until the browser's own timeout. Even written correctly it freezes
 * the whole document — the rail included — for the length of the animation, so
 * there is no version of it worth having here. This file uses a plain CSS
 * keyframe on live content: it captures nothing, blocks nothing, and the router
 * never learns it exists.
 *
 * ── How the direction is known ──────────────────────────────────────────────
 * Each history entry is stamped with a counter in `history.state`, and the
 * arriving screen is compared against the one before it: a lower number is a
 * Back, a higher one a Forward, and no number at all is an entry the router
 * has only just pushed. `useSlideDirection` below has the full account,
 * including the two models that were tried first and what measuring them in a
 * browser showed. It is not a depth-of-URL heuristic, which would get
 * /app/learn → /app/work wrong in both directions.
 *
 * ── Why it is a custom property and not a class ─────────────────────────────
 * The direction is written to `--ux-page-dx` on <html>. It could have been an
 * attribute selected on with `[data-dir]`, but that changes `animation-name`,
 * and changing `animation-name` on a still-mounted element restarts the
 * animation: on a route that suspends, the page she is LEAVING would slide in
 * again just before the new one arrived. A custom property inside the keyframe
 * changes the distance without changing the animation, so nothing re-triggers.
 *
 * ── What it decorates, and what it must not touch ───────────────────────────
 * The animation rides on the element the router inserts — `.ux-swap > *`, the
 * same hook `tokens.css` already fades on desktop — so it starts when the new
 * screen is painted and cannot delay it. There is no state, no timer and no
 * `onClick`: nothing here sits between the tap and `next/link`. Scroll is
 * likewise untouched — a transform does not move a scroll position, and this
 * file never reads or writes one. Measured with the animation on and with it
 * off, a tab tap lands the next screen at the same offset both times.
 *
 * ── What it costs ───────────────────────────────────────────────────────────
 * Tap to the destination being in the DOM and painted on the next frame, at
 * 390x844 against `next dev`. Absolute numbers on this machine move with
 * whatever else is compiling, so the honest measurement is the one that runs
 * BOTH arms in a single session, alternating blocks, with
 * `prefers-reduced-motion` switching the transition off and on — that arm is a
 * true no-transition baseline, because `reduce` disables the fade in
 * tokens.css as well.
 *
 *   before this file existed, quiet machine, 40 taps   median 132ms, floor 90ms
 *   this file, transition OFF, 40 taps                 median 199ms, floor 114ms
 *   this file, transition ON, same session, 24 taps    median 173ms, floor 114ms
 *
 * The transition arm is not slower than the no-transition arm beside it — it
 * came out 26ms faster at the median and identical at the floor, which is
 * noise in both directions. Two further interleaved runs put the difference at
 * the floor at -48ms and +33ms. The slide costs nothing measurable; the gap
 * between the first row and the rest is the dev server, not this code.
 *
 * ── Careful with backticks in the CSS below ─────────────────────────────────
 * It is a template literal. A stray backtick in a comment inside it ends the
 * string, and the file then fails to parse — which took the whole app to a 500
 * once already, because `Shell.tsx` imports this.
 */

/** How far the arriving screen travels. Material's shared-axis is 30dp; 26px
 *  reads as directional on a 390px screen without the content ever looking
 *  like it started off-screen. */
const DX = 26;

const CSS = `
@keyframes ux-page-in {
  from { opacity: 0; transform: translate3d(var(--ux-page-dx, 0px), 0, 0); }
  to   { opacity: 1; transform: translate3d(0, 0, 0); }
}

@media (max-width: 1023px) {
  /* Two classes, so this beats the plain fade in tokens.css whichever order
     the sheets land in. Above lg nothing here applies and that fade stands. */
  .ux .ux-swap > * {
    animation: ux-page-in 280ms cubic-bezier(0.32, 0.72, 0, 1) both;
  }

  /*
    A screen that starts 26px to the right is 26px wider than the scroller for
    as long as it takes to arrive, and a scroller with somewhere to go
    horizontally can be dragged there. Measured mid-slide: scrollWidth 416
    against a 390px viewport, and setting scrollLeft to 999 really did land on
    26.

    Written as clip, and worth knowing that it does not stay clip: the cascade
    coerces clip to hidden whenever the other axis scrolls, and overflow-y here
    is auto, so the computed value really is overflow-x: hidden. Measured, not
    assumed. That is still the right answer and it is what the old value
    already was in practice — before this rule overflow-x computed to auto,
    because an axis next to a scrolling one can never stay visible.

    It is a no-op for the content itself. On every screen measured (/app,
    /app/learn, /app/earn, /app/work, /app/circle, /app/opportunities,
    /app/wallet) this scroller's scrollWidth already equals its clientWidth:
    the carousels that DO scroll sideways each have their own container inside
    this one, and clipping an ancestor does not touch them.
  */
  .ux #ux-scroll { overflow-x: clip; }
}

@media (prefers-reduced-motion: reduce) {
  /* Nothing at all — the same answer tokens.css already gives for .ux-swap,
     and this rule exists only because the one above outranks it. */
  .ux .ux-swap > * { animation: none; }
}
`;

/** `useLayoutEffect` warns when it is rendered on the server; `useEffect` runs
 *  a frame too late to set the direction before the animation starts. */
const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/**
 * The counter this file stamps onto each history entry.
 *
 * It goes in `history.state` beside Next's own keys (`__NA` and
 * `__PRIVATE_NEXTJS_INTERNALS_TREE`), which are spread through untouched —
 * replacing that object rather than extending it would take the router's tree
 * with it.
 */
const IDX = "__uxNavIdx";

function stamp(n: number): void {
  try {
    const prev = (window.history.state ?? {}) as Record<string, unknown>;
    // The href is passed explicitly so this changes nothing but the state.
    window.history.replaceState({ ...prev, [IDX]: n }, "", window.location.href);
  } catch {
    /* A sandboxed frame refuses replaceState. The transition then reads every
       navigation as forward, which is wrong in one direction and harmless. */
  }
}

function indexOfCurrentEntry(): number | null {
  const st = window.history.state as Record<string, unknown> | null;
  return st && typeof st[IDX] === "number" ? (st[IDX] as number) : null;
}

/**
 * Which way the screen that just arrived was travelling.
 *
 * ── Two wrong answers came before this one, both caught in a browser ────────
 *
 * **A stack of visited paths.** It cannot tell a push apart from a Back when
 * the destination happens to be where you just were. Bouncing Learn → Earn →
 * Learn, the third tap arrives at the entry behind the cursor, so it was read
 * as a Back and the Learn screen slid in from the left on a forward tap.
 *
 * **Watching for `popstate`.** The obvious repair: the browser fires it for
 * Back and Forward and never for a `<Link>`. Measured, it does not work here —
 * `window.__uxPop` recorded the right path every time and the effect still saw
 * `null`, because in this router the listener runs AFTER React has committed
 * the new route. Every reading was one navigation stale. Nothing about
 * listener ORDER can be relied on for this.
 *
 * ── What is reliable ────────────────────────────────────────────────────────
 * `history.state`. The browser swaps it in synchronously as part of the
 * traversal, before any listener and before any render, so by the time this
 * effect runs it is already the destination entry's own state — no ordering to
 * lose. Each entry gets a number; an entry arriving without one is an entry
 * the router has only just pushed.
 */
function useSlideDirection() {
  const pathname = usePathname();
  /** The index of the entry the last committed screen belonged to. */
  const last = useRef<number | null>(null);
  /**
   * Which screen that index was for.
   *
   * Guards against the effect running twice for one screen, which it does on
   * mount under Strict Mode: React tears the effect down and sets it up again
   * while keeping the refs, so the second pass saw its own stamp, read it as a
   * push and slid the very first screen in — measured as `entry#1 dx=26px` on
   * a fresh load, where nothing had arrived from anywhere.
   */
  const lastPath = useRef<string | null>(null);

  useIsomorphicLayoutEffect(() => {
    if (lastPath.current === pathname) return;
    const first = lastPath.current === null;
    lastPath.current = pathname;

    if (first || last.current === null) {
      // First render. The initial screen is not arriving from anywhere, so it
      // gets the fade alone — `--ux-page-dx` stays at its 0px default. A
      // reload lands on an entry that may already carry a number from before
      // it, and keeping that number is what makes the FIRST Back after a
      // reload still go the right way.
      const here = indexOfCurrentEntry();
      if (here === null) stamp(0);
      last.current = here ?? 0;
      return;
    }

    const here = indexOfCurrentEntry();
    let dx: number;

    if (here === null || here === last.current) {
      // No number, or the previous screen's number carried over: the router
      // pushed a new entry. A push is forward, always.
      const next = last.current + 1;
      stamp(next);
      last.current = next;
      dx = DX;
    } else {
      // A traversal. Lower is behind us.
      dx = here < last.current ? -DX : DX;
      last.current = here;
    }

    document.documentElement.style.setProperty("--ux-page-dx", `${dx}px`);
  }, [pathname]);
}

export function PageTransition({ children }: { children: React.ReactNode }) {
  useSlideDirection();

  return (
    <>
      {children}
      {/* After the children on purpose. React hoists this into <head>, but if
          it ever did not, a style element rendered first would become
          `.ux-swap > *:first-child` and the checks that read the arriving
          screen off `#content` would find a stylesheet. */}
      <style href="ux-page-transition" precedence="ux-mobile">
        {CSS}
      </style>
    </>
  );
}
