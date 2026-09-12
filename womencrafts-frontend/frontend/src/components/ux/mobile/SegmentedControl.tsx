"use client";

import { useCallback, useEffect, useId, useRef, type KeyboardEvent as ReactKeyboardEvent } from "react";

import * as Icons from "@/components/ux/icons";

/**
 * The iOS segmented control.
 *
 * ── Why the indicator is measured, not calculated ───────────────────────────
 * The obvious implementation gives every segment `100 / n` percent and slides
 * the thumb by `index * 100%`. It is wrong twice. Translated labels are not
 * the same length — "All" beside "Ausstehende Zahlungen" — so equal thirds
 * leave one segment crowded and two empty. And `translateX` is a physical
 * transform: in an RTL locale (this app ships Arabic and Urdu) the thumb
 * slides away from the segment it is supposed to be under.
 *
 * So the thumb reads the active button's own `offsetLeft` and `offsetWidth`.
 * Those are physical pixels from the container's start edge in BOTH
 * directions, which makes one line of arithmetic correct in every locale and
 * at every label length, and it re-measures when the container resizes.
 *
 * ── Written to the DOM, not held in state ───────────────────────────────────
 * The thumb's position is not information; nothing else in the app needs to
 * know it. Keeping it in React state would re-render every segment on every
 * resize tick for a value only the browser reads. It is set imperatively, the
 * same way `usePointer` in `kit/motion.tsx` does.
 *
 * ── Keyboard ────────────────────────────────────────────────────────────────
 * A roving tabindex, per the WAI-ARIA tabs pattern: one Tab stop for the whole
 * control, arrows to move between segments, Home/End for the ends. Selection
 * follows focus, which is what a segmented control does — there is no separate
 * "activate" step on a native one either.
 */

export type Segment<T extends string> = {
  value: T;
  label: string;
  /** A name from `@/components/ux/icons`. */
  icon?: string;
  /** The id of the region this segment reveals, if there is one. */
  controls?: string;
};

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  label,
  className = "",
}: {
  options: Segment<T>[];
  value: T;
  onChange: (next: T) => void;
  /** Names the control for a screen reader — "View", "Period", "Filter". */
  label: string;
  className?: string;
}) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const thumbRef = useRef<HTMLSpanElement | null>(null);
  const placed = useRef(false);
  const baseId = useId();

  const place = useCallback(() => {
    const track = trackRef.current;
    const thumb = thumbRef.current;
    if (!track || !thumb) return;
    const active = track.querySelector<HTMLElement>('[data-ux-seg-active="true"]');
    if (!active) return;
    // The first placement must not animate: a thumb sliding in from the left
    // edge on page load reads as a loading artefact, not as a control.
    if (!placed.current) {
      thumb.style.transition = "none";
      placed.current = true;
      requestAnimationFrame(() => {
        thumb.style.transition = "";
      });
    }
    thumb.style.width = `${active.offsetWidth}px`;
    thumb.style.transform = `translateX(${active.offsetLeft}px)`;
    thumb.style.opacity = "1";
  }, []);

  useEffect(() => {
    place();
    const track = trackRef.current;
    if (!track || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(place);
    ro.observe(track);
    return () => ro.disconnect();
  }, [place, value, options]);

  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const i = options.findIndex((o) => o.value === value);
    if (i < 0) return;
    const last = options.length - 1;
    let next = -1;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") next = i === last ? 0 : i + 1;
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = i === 0 ? last : i - 1;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = last;
    if (next < 0) return;
    e.preventDefault();
    onChange(options[next].value);
    // Focus follows selection, so the next arrow press continues from here.
    trackRef.current
      ?.querySelectorAll<HTMLElement>('[role="tab"]')
      [next]?.focus();
  };

  return (
    <div
      ref={trackRef}
      role="tablist"
      aria-label={label}
      onKeyDown={onKeyDown}
      className={`relative isolate flex w-full items-stretch rounded-[var(--ux-r-pill)] p-[3px] ${className}`}
      style={{ background: "var(--ux-surface-2)", border: "1px solid var(--ux-line)" }}
    >
      {/* The thumb, behind the labels. `opacity: 0` until it has been measured
          so it is never seen at the wrong size for a frame. */}
      <span
        ref={thumbRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-[3px] left-0 -z-10 rounded-[var(--ux-r-pill)]
                   transition-[transform,width] duration-[280ms] motion-reduce:transition-none"
        style={{
          opacity: 0,
          background: "var(--ux-surface)",
          boxShadow: "var(--ux-shadow-sm)",
          transitionTimingFunction: "cubic-bezier(0.32, 0.72, 0, 1)",
        }}
      />

      {options.map((o) => {
        const active = o.value === value;
        const Ico = o.icon
          ? (Icons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[o.icon]
          : undefined;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            id={`${baseId}-${o.value}`}
            aria-selected={active}
            aria-controls={o.controls}
            tabIndex={active ? 0 : -1}
            data-ux-seg-active={active}
            onClick={() => onChange(o.value)}
            className="ux-tap-exempt flex min-h-[44px] flex-1 items-center justify-center gap-1.5
                       rounded-[var(--ux-r-pill)] px-3 text-[14px] font-semibold
                       transition-colors duration-200 motion-reduce:transition-none"
            style={{
              // The thumb is what moves. A segment that also scaled itself on
              // press (mobile.css) would slide out from under it.
              transform: "none",
              color: active ? "var(--ux-ink)" : "var(--ux-muted)",
            }}
          >
            {Ico && <Ico className="h-[15px] w-[15px]" aria-hidden="true" />}
            <span className="truncate">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}
