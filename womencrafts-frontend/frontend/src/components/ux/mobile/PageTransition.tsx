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
 * A history model, not a guess. Every path the app has visited is kept in
 * order with a cursor; the arriving path is either the one behind the cursor
 * (Back — from the browser gesture, the hardware key, or a Back control), the
 * one ahead of it (Forward), or new (Forward, and the tail is dropped, exactly
 * as a real history stack does). That is what makes Back slide in from the left
 * where a depth-of-URL heuristic would get it wrong: /app/learn → /app/work is
 * the same depth, and going back from either is still a back.
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

    clip, not hidden: hidden would make this a horizontal scroll container as
    well, which changes what scrollLeft, scroll anchoring and scrollIntoView do
    to a scroller the whole shell measures itself against. clip only stops the
    paint. It is also a no-op for the content itself — on every screen measured
    (/app, /app/learn, /app/earn, /app/work, /app/circle, /app/opportunities,
    /app/wallet) this scroller's scrollWidth already equals its clientWidth,
    because the carousels that DO scroll sideways each have their own container
    inside this one, and clipping an ancestor does not touch them.
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

function useSlideDirection() {
  const pathname = usePathname();
  const visited = useRef<string[]>([]);
  const cursor = useRef(0);

  useIsomorphicLayoutEffect(() => {
    const stack = visited.current;

    // First render. The initial screen is not arriving from anywhere, so it
    // gets the fade alone — `--ux-page-dx` stays at its 0px default.
    if (stack.length === 0) {
      stack.push(pathname);
      cursor.current = 0;
      return;
    }
    if (stack[cursor.current] === pathname) return;

    let dx: number;
    if (stack[cursor.current - 1] === pathname) {
      cursor.current -= 1;
      dx = -DX; // back: in from the left
    } else if (stack[cursor.current + 1] === pathname) {
      cursor.current += 1;
      dx = DX; // forward again, through history
    } else {
      // Somewhere new. Everything ahead of the cursor is unreachable now.
      stack.length = cursor.current + 1;
      stack.push(pathname);
      cursor.current = stack.length - 1;
      dx = DX;
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
