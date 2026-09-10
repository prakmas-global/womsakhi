"use client";

import { useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";

import * as Icons from "@/components/ux/icons";

/**
 * Swipe a row aside to reveal what you can do to it.
 *
 * ── The gesture is the shortcut, not the interface ──────────────────────────
 * Every action here is a real `<button>` that sits in the DOM whether or not
 * anybody has swiped. Focus one with the keyboard and the row opens itself so
 * the button is visible before it is pressed — focus landing on something
 * hidden underneath a row is the same bug as focus landing behind a modal.
 *
 * The alternative, and the reason this is worth spelling out: the common
 * implementation renders the buttons only once a drag is in progress. That
 * makes deleting a row impossible with a keyboard, a switch, or VoiceOver, and
 * it is invisible in every screenshot — the feature looks finished and is
 * simply missing for the people who most need a non-gesture path.
 *
 * ── touch-action: pan-y ─────────────────────────────────────────────────────
 * The row is inside a scrolling list. `pan-y` hands vertical movement straight
 * back to the list and keeps horizontal movement here, so a slightly diagonal
 * swipe still scrolls rather than half-opening six rows on the way past.
 *
 * ── Why a full swipe is opt-in ──────────────────────────────────────────────
 * iOS lets a long swipe fire the first action outright. It is fast, and it is
 * also how a message gets deleted by accident on a bus. `fullSwipe` defaults
 * to off, and is worth turning on only where the action is undoable — which is
 * what `toast(..., { action: { label: "Undo" } })` is for.
 */

export type SwipeActionSpec = {
  label: string;
  /** A name from `@/components/ux/icons`. */
  icon?: string;
  onPress: () => void;
  /** Red. For delete, leave, block. */
  destructive?: boolean;
};

/** Movement before a horizontal drag is claimed from the list's scroll. */
const SLOP = 8;
/** Fraction of the revealed width that has to be crossed to stay open. */
const OPEN_AT = 0.45;
/** Fast enough to open (or close) regardless of distance, px per ms. */
const FLICK = 0.4;
/** Each action is this wide. */
const ACTION_W = 84;

export function SwipeAction({
  children,
  actions,
  fullSwipe = false,
  className = "",
  actionsLabel = "Row actions",
}: {
  children: ReactNode;
  /** Shown end-side, in order. Two is the practical maximum on a phone. */
  actions: SwipeActionSpec[];
  /** Let a long swipe fire the first action without lifting a finger. */
  fullSwipe?: boolean;
  className?: string;
  actionsLabel?: string;
}) {
  const faceRef = useRef<HTMLDivElement | null>(null);
  const drag = useRef<{ id: number; startX: number; startY: number; lastX: number; lastT: number; v: number; base: number; claimed: boolean } | null>(null);
  const offset = useRef(0);
  const [open, setOpen] = useState(false);

  const width = actions.length * ACTION_W;

  const paint = (x: number) => {
    const el = faceRef.current;
    if (!el) return;
    // Positive `x` is how far the face has moved off the end edge. Past the
    // full reveal it resists, so the row cannot be dragged clean off screen.
    const capped = x <= width ? x : width + (x - width) * 0.3;
    const shown = Math.max(0, capped);
    // `insetInlineStart` on a negative translate would be wrong in RTL, so the
    // face is moved with a logical margin instead of a physical transform.
    el.style.transform = `translateX(${shown}px)`;
  };

  const settle = (to: number) => {
    offset.current = to;
    const el = faceRef.current;
    if (el) {
      el.style.transition = "";
      el.style.transform = to ? `translateX(${to}px)` : "";
    }
    setOpen(to > 0);
  };

  const onDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    drag.current = {
      id: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      lastX: e.clientX,
      lastT: e.timeStamp,
      v: 0,
      base: offset.current,
      claimed: false,
    };
  };

  const onMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || e.pointerId !== d.id) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;

    if (!d.claimed) {
      // Vertical wins: this is the list scrolling, not a swipe.
      if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > SLOP) {
        drag.current = null;
        return;
      }
      if (Math.abs(dx) < SLOP) return;
      d.claimed = true;
      if (faceRef.current) faceRef.current.style.transition = "none";
      e.currentTarget.setPointerCapture(e.pointerId);
    }

    // `e.timeStamp`, not `performance.now()`: it is when the event happened
    // rather than when this handler got around to running, which is the
    // difference between a measured flick and a measurement of frame jitter.
    const now = e.timeStamp;
    const dt = now > d.lastT ? now - d.lastT : 16;
    d.v = ((e.clientX - d.lastX) / dt) * 0.7 + d.v * 0.3;
    d.lastX = e.clientX;
    d.lastT = now;

    // A swipe towards the start edge opens the end-side actions, so the face
    // moves the opposite way to the finger's sign.
    paint(d.base - dx);
  };

  const onUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || e.pointerId !== d.id) return;
    drag.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    if (!d.claimed) return;

    const x = d.base - (e.clientX - d.startX);
    // Velocity is measured on the finger; opening is movement towards start.
    const opening = -d.v;

    if (fullSwipe && x > width * 1.6 && actions[0]) {
      settle(0);
      actions[0].onPress();
      return;
    }
    if (opening > FLICK) return settle(width);
    if (opening < -FLICK) return settle(0);
    settle(x > width * OPEN_AT ? width : 0);
  };

  const onCancel = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    drag.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    settle(offset.current);
  };

  return (
    <div className={`relative isolate overflow-hidden ${className}`} data-ux-swipe data-ux-swipe-open={open}>
      {/* The actions, always in the DOM and always reachable. */}
      <div
        aria-label={actionsLabel}
        role="group"
        className="absolute inset-y-0 end-0 z-0 flex"
        style={{ width: `${width}px` }}
      >
        {actions.map((a) => {
          const Ico = a.icon
            ? (Icons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[a.icon]
            : undefined;
          return (
            <button
              key={a.label}
              type="button"
              onClick={() => {
                settle(0);
                a.onPress();
              }}
              // Focus opens the row, so nothing is ever pressed while hidden.
              onFocus={() => settle(width)}
              onBlur={(e) => {
                if (!e.currentTarget.parentElement?.contains(e.relatedTarget as Node)) settle(0);
              }}
              className="ux-tap-exempt flex flex-1 flex-col items-center justify-center gap-1 text-[12px] font-semibold"
              style={{
                background: a.destructive ? "var(--ux-danger-solid)" : "var(--ux-fill-2)",
                color: "var(--ux-on-brand)",
                transform: "none",
              }}
            >
              {Ico && <Ico className="h-[18px] w-[18px]" aria-hidden="true" />}
              {a.label}
            </button>
          );
        })}
      </div>

      {/* The row itself. */}
      <div
        ref={faceRef}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onCancel}
        className="relative z-[1] transition-transform duration-300 motion-reduce:transition-none"
        style={{
          touchAction: "pan-y",
          background: "var(--ux-surface)",
          transitionTimingFunction: "cubic-bezier(0.32, 0.72, 0, 1)",
        }}
      >
        {children}
      </div>
    </div>
  );
}
