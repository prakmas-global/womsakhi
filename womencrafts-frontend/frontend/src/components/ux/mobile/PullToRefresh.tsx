"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";

import * as Icons from "@/components/ux/icons";

/**
 * Pull down past the top to refresh.
 *
 * ── The three ways this goes wrong ──────────────────────────────────────────
 * 1. **It engages mid-list.** If the gesture starts anywhere other than
 *    `scrollTop === 0` it steals a scroll, and the list becomes unusable. The
 *    check is made when the finger LANDS, not when it moves: by the time a
 *    fast upward flick has decelerated to the top, `scrollTop` reads 0 and a
 *    naive implementation fires a refresh she never asked for.
 *
 * 2. **It fights the browser.** Chrome on Android has its own pull-to-refresh,
 *    and iOS rubber-bands the page. Both are suppressed here — the scroller
 *    carries `overscroll-behavior-y: contain`, which stops the gesture
 *    chaining to the document, and while a pull is actually in progress the
 *    default touch behaviour is prevented so the browser's indicator never
 *    appears behind ours. Two indicators for one gesture is the clearest
 *    possible sign that this is a web page.
 *
 * 3. **It has no ceiling.** A pull that tracks the finger 1:1 forever drags
 *    the list halfway off the screen. Real ones resist: a little under half
 *    the finger's travel up to the threshold, and a quarter of that after it,
 *    so crossing the line is something she feels rather than reads.
 *
 * ── Why there is also a button ──────────────────────────────────────────────
 * A gesture is not an interface for someone using a keyboard or a switch. The
 * same refresh is a real button at the top of the region, visually hidden
 * until it takes focus — so "refresh this list" is reachable by Tab, and
 * announced, without adding anything to the screen for everyone else.
 */

/** Pointer travel before the pull is treated as a pull and not as a tap. */
const SLOP = 6;

export function PullToRefresh({
  onRefresh,
  children,
  threshold = 64,
  className = "",
  label = "Refresh",
  refreshingLabel = "Refreshing",
}: {
  /** Awaited. The indicator spins until it settles, however long that takes. */
  onRefresh: () => void | Promise<unknown>;
  children: ReactNode;
  /** How far she has to pull. 64px is roughly a thumb's length of travel. */
  threshold?: number;
  className?: string;
  label?: string;
  refreshingLabel?: string;
}) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const iconRef = useRef<HTMLSpanElement | null>(null);
  const pull = useRef<{ id: number; startY: number; active: boolean; dist: number } | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  /**
   * The browser's own overscroll, suppressed for the length of a pull only.
   *
   * This is the one place a touch listener is unavoidable: `touch-action` is
   * decided when the gesture starts, and Pointer Events cannot cancel a scroll
   * the compositor has already taken over. The listener does not drive
   * anything — every decision below is made from pointer events — it only says
   * "not this one" to the default behaviour while a pull is live.
   */
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const block = (e: TouchEvent) => {
      if (pull.current?.active) e.preventDefault();
    };
    el.addEventListener("touchmove", block, { passive: false });
    return () => el.removeEventListener("touchmove", block);
  }, []);

  /** Finger travel in, pixels of movement out. */
  const resist = (dy: number) => {
    const d = dy * 0.55;
    return d <= threshold ? d : threshold + (d - threshold) * 0.25;
  };

  const paint = (dist: number) => {
    const el = scrollerRef.current;
    if (el) el.style.transform = `translate3d(0, ${dist}px, 0)`;
    const icon = iconRef.current;
    if (!icon) return;
    const p = Math.min(1, dist / threshold);
    icon.style.opacity = String(Math.min(1, p * 1.4));
    icon.style.transform = `translateY(${Math.min(dist, threshold) * 0.5}px) rotate(${p * 300}deg) scale(${0.6 + p * 0.4})`;
    // Past the line the ring goes brand-coloured — the visual "let go now".
    icon.style.color = p >= 1 ? "var(--ux-brand)" : "var(--ux-faint)";
  };

  const release = (to: number) => {
    const el = scrollerRef.current;
    if (el) {
      el.style.transition = "";
      el.style.transform = to ? `translate3d(0, ${to}px, 0)` : "";
    }
    const icon = iconRef.current;
    if (icon && !to) {
      icon.style.transition = "";
      icon.style.opacity = "0";
    }
  };

  const onDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (refreshing || e.button !== 0) return;
    const el = scrollerRef.current;
    // Armed only if she is already at the top when the finger lands.
    if (!el || el.scrollTop > 0) return;
    pull.current = { id: e.pointerId, startY: e.clientY, active: false, dist: 0 };
  };

  const onMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const p = pull.current;
    const el = scrollerRef.current;
    if (!p || !el || e.pointerId !== p.id) return;
    const dy = e.clientY - p.startY;

    if (!p.active) {
      // Moving up, or the list scrolled away from the top — this is a scroll.
      if (dy < 0 || el.scrollTop > 0) {
        pull.current = null;
        return;
      }
      if (dy < SLOP) return;
      p.active = true;
      el.style.transition = "none";
      if (iconRef.current) iconRef.current.style.transition = "none";
      e.currentTarget.setPointerCapture(e.pointerId);
    }

    p.dist = Math.max(0, resist(dy));
    paint(p.dist);
  };

  const finish = async (p: { dist: number }) => {
    if (p.dist < threshold) {
      release(0);
      return;
    }
    // Hold at the threshold while the work happens, then let go.
    setRefreshing(true);
    release(threshold);
    if (iconRef.current) {
      iconRef.current.style.transition = "";
      iconRef.current.style.opacity = "1";
      iconRef.current.style.transform = `translateY(${threshold * 0.5}px)`;
      iconRef.current.style.color = "var(--ux-brand)";
    }
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
      release(0);
    }
  };

  const onUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const p = pull.current;
    if (!p || e.pointerId !== p.id) return;
    pull.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    if (!p.active) return;
    void finish(p);
  };

  const onCancel = (e: ReactPointerEvent<HTMLDivElement>) => {
    const p = pull.current;
    if (!p) return;
    pull.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    release(0);
  };

  const runFromButton = () => {
    if (refreshing) return;
    void finish({ dist: threshold });
  };

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {/* The indicator lives behind the scroller and is revealed as it moves. */}
      <span
        ref={iconRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 z-0 flex h-[46px] items-center justify-center
                   transition-[opacity,transform] duration-300 motion-reduce:transition-none"
        style={{ opacity: 0, color: "var(--ux-faint)" }}
      >
        <span
          className="grid h-[30px] w-[30px] place-items-center rounded-full"
          style={{ background: "var(--ux-surface)", boxShadow: "var(--ux-shadow-sm)" }}
        >
          <Icons.RefreshCw
            className={`h-[16px] w-[16px] ${refreshing ? "animate-spin motion-reduce:animate-none" : ""}`}
          />
        </span>
      </span>

      {/* Announced, not drawn: a screen reader hears the refresh finish. */}
      <span role="status" aria-live="polite" className="sr-only">
        {refreshing ? refreshingLabel : ""}
      </span>

      <div
        ref={scrollerRef}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onCancel}
        className="ux-scroll-y relative z-[1] h-full overflow-y-auto
                   transition-transform duration-300 motion-reduce:transition-none"
        style={{
          // `contain` stops the gesture chaining into the document — without
          // it, pulling here also pulls Chrome's own refresh spinner down.
          overscrollBehaviorY: "contain",
          touchAction: "pan-y",
          transitionTimingFunction: "cubic-bezier(0.32, 0.72, 0, 1)",
          background: "var(--ux-canvas)",
        }}
      >
        <button
          type="button"
          onClick={runFromButton}
          disabled={refreshing}
          className="sr-only focus:not-sr-only focus:mx-auto focus:my-2 focus:block focus:rounded-[var(--ux-r-pill)] focus:px-4 focus:py-2 focus:text-[13px] focus:font-semibold"
          style={{ background: "var(--ux-brand-tint)", color: "var(--ux-brand)" }}
        >
          {label}
        </button>
        {children}
      </div>
    </div>
  );
}
