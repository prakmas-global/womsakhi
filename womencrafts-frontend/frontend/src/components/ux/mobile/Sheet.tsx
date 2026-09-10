"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

import * as Icons from "@/components/ux/icons";
import { useDialogBehaviour } from "@/lib/use-dialog";

/**
 * The bottom sheet — the one control that decides whether this reads as an app.
 *
 * ── What makes a sheet feel real ────────────────────────────────────────────
 * Not the slide-up. Every web modal slides. What a phone user recognises,
 * without being able to name it, is that the panel is **attached to her
 * finger**: it moves with the drag, it resists when pushed the wrong way, and
 * — the tell that no CSS-only sheet has — a fast flick throws it away even
 * though the finger barely travelled. A sheet that only dismisses past a
 * distance threshold feels stuck, because on a real phone she flicks 30px and
 * expects it gone.
 *
 * So the release rule below is ordered deliberately: **velocity first,
 * distance second**. A downward flick over 0.45 px/ms (~450 px/s) dismisses
 * from anywhere. Only a slow, deliberate drag is judged on how far it went.
 *
 * ── What is borrowed rather than rebuilt ────────────────────────────────────
 * `.ux-sheet` already carries the surface, the border, the shadow (tokens.css)
 * and the entry animation on the iOS presentation curve (mobile.css). This
 * component does not re-declare any of it. The only thing it adds is what CSS
 * cannot express: where the panel sits while a finger is on it.
 *
 * `useDialogBehaviour` already implements the Tab wrap, Escape, the body
 * scroll lock and returning focus to whatever opened the dialog — correctly,
 * and in one place. The drawer, the modal and this sheet all call it, which is
 * the only way all three keep behaving the same a year from now.
 *
 * ── touch-action, and the mistake it prevents ───────────────────────────────
 * `touch-action: none` is set on the drag zone (the grab bar and the header)
 * and NOWHERE else. Put it on the panel and the browser stops sending scroll
 * gestures to the body, so a sheet full of content becomes a sheet you cannot
 * read — which looks like a layout bug and is a gesture bug.
 */

/** The curve iOS presents modals on. Named once; `.ux-sheet` uses the same one. */
const IOS_CURVE = "cubic-bezier(0.32, 0.72, 0, 1)";

/** How long the panel takes to leave. Matches the settle transition below. */
const EXIT_MS = 280;

/**
 * The flick threshold, in px per millisecond. 0.45 ≈ 450 px/s, which is about
 * a third of a comfortable swipe on a 6" phone — deliberately low, because the
 * failure everyone notices is a sheet that refuses to go, not one that goes
 * too easily. She can always reopen it.
 */
const DISMISS_VELOCITY = 0.45;

/** A slow drag has to cross this much of the panel's height to count. */
const DISMISS_FRACTION = 0.35;

/**
 * Rubber band strength when the sheet is dragged ABOVE its resting top.
 * `0.55` is the constant UIScrollView uses; the curve `(x·c·d)/(d + c·x)` gives
 * roughly 0.55x for a small overshoot and asymptotes, so the panel never
 * detaches from the top of the screen no matter how hard she pulls.
 */
const RUBBER = 0.55;

/** How far ahead the release velocity is projected when choosing a detent. */
const PROJECT_MS = 120;

export type SheetDetent = "half" | "full";

/** How much of the panel each detent leaves on screen. */
const DETENT_VISIBLE: Record<SheetDetent, number> = { half: 0.5, full: 1 };

const RM_QUERY = "(prefers-reduced-motion: reduce)";
/** Stable, so React never resubscribes. */
const subscribeMotion = (cb: () => void) => {
  const m = window.matchMedia(RM_QUERY);
  m.addEventListener("change", cb);
  return () => m.removeEventListener("change", cb);
};

/**
 * Does this person want motion held still?
 *
 * Exported because every component in this folder needs the same answer and a
 * second copy would drift. Anything that can express the preference in CSS
 * uses Tailwind's `motion-reduce:` variant instead — this is for the decisions
 * JavaScript has to make, like whether to wait for a transition that will
 * never run.
 */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeMotion,
    () => window.matchMedia(RM_QUERY).matches,
    () => false,
  );
}

/** "Are we in the browser yet" — a portal needs a real node, and SSR has none. */
const NEVER_CHANGES = () => () => {};

/**
 * Where an overlay is portalled to.
 *
 * `.ux` and NOT `document.body`: every colour token in this design system is
 * declared on `.ux`, so a sheet portalled to the body renders with each
 * `var(--ux-surface)` unresolved — no panel, no dim, just floating text over
 * the page. Learned the hard way; see `kit/sheet.tsx`.
 */
export const overlayRoot = () =>
  (typeof document === "undefined" ? null : document.querySelector(".ux")) ?? document.body;

const rubberBand = (over: number, dim: number) => (over * RUBBER * dim) / (dim + RUBBER * over);

type Drag = {
  id: number;
  startY: number;
  lastY: number;
  lastT: number;
  /** px per ms, positive downward, smoothed so one stuttering frame cannot decide. */
  v: number;
  /** Where the panel sat when the finger landed. */
  base: number;
  /** Panel height at drag start — every threshold is a fraction of it. */
  h: number;
  moved: number;
};

export function Sheet({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  detents = ["full"],
  initialDetent,
  closeLabel = "Close",
  showClose = true,
}: {
  open: boolean;
  onClose: () => void;
  /** Required: it is what `aria-labelledby` points at. */
  title: string;
  description?: string;
  children: ReactNode;
  /** A sticky action row. Sits below the scrolling body, above the safe area. */
  footer?: ReactNode;
  /** Resting positions, smallest first. `["half", "full"]` gives a two-stop sheet. */
  detents?: SheetDetent[];
  /** Which one it opens at. Defaults to the largest. */
  initialDetent?: SheetDetent;
  closeLabel?: string;
  /** The header X. Off for a sheet that must be answered rather than dismissed. */
  showClose?: boolean;
}) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const scrimRef = useRef<HTMLButtonElement | null>(null);
  const drag = useRef<Drag | null>(null);
  /** The committed offset in px. 0 is fully open; larger is further down. */
  const offsetRef = useRef(0);
  const [dragging, setDragging] = useState(false);
  const titleId = useId();
  const descId = useId();
  const reduced = useReducedMotion();

  const onClient = useSyncExternalStore(NEVER_CHANGES, () => true, () => false);

  /**
   * Kept mounted through the exit so the panel has something to animate.
   *
   * Adjusted during render rather than in an effect, on purpose: an effect
   * would mount the panel one commit late, and `useDialogBehaviour` would have
   * already looked for something to focus and found an empty ref. Focus would
   * silently stay on the page behind — the exact failure this component exists
   * to avoid.
   */
  const [mounted, setMounted] = useState(open);
  if (open && !mounted) setMounted(true);

  const largest = detents[detents.length - 1] ?? "full";
  const opensAt = initialDetent ?? largest;

  /** Detent offsets in px, given a measured panel height. Ascending = higher. */
  const offsetsFor = useCallback(
    (h: number) => detents.map((d) => h * (1 - DETENT_VISIBLE[d])).sort((a, b) => a - b),
    [detents],
  );

  const paint = useCallback((y: number, h: number) => {
    const el = panelRef.current;
    if (!el) return;
    // Above the top detent the panel resists rather than sliding off screen.
    const shown = y < 0 ? -rubberBand(-y, h) : y;
    el.style.transform = `translate3d(0, ${shown}px, 0)`;
    // The dim thins out as the panel leaves — the page behind coming back is
    // half of what makes the drag feel like it is moving something real.
    if (scrimRef.current) {
      scrimRef.current.style.opacity = String(Math.max(0.15, 1 - Math.max(0, shown) / h));
    }
  }, []);

  /**
   * First attach. A sheet that opens at a partial detent cannot use the
   * `.ux-sheet` keyframes — a running animation outranks an inline transform,
   * so the panel would rise to full, sit there for 340ms and then jump down.
   * In that one case the entry is driven by the same curve as a transition
   * instead. The common full-height sheet keeps the CSS animation untouched.
   */
  const attach = useCallback(
    (el: HTMLDivElement | null) => {
      panelRef.current = el;
      if (!el) return;
      const h = el.getBoundingClientRect().height;
      const target = h * (1 - DETENT_VISIBLE[opensAt]);
      offsetRef.current = target;
      if (target <= 0.5) return;
      el.style.animation = "none";
      el.style.transition = "none";
      el.style.transform = "translate3d(0, 100%, 0)";
      requestAnimationFrame(() => {
        el.style.transition = "";
        el.style.transform = `translate3d(0, ${target}px, 0)`;
      });
    },
    [opensAt],
  );

  /** Leaving: slide down from wherever the finger left it, then unmount. */
  useEffect(() => {
    if (open || !mounted) return;
    const el = panelRef.current;
    if (el) {
      el.style.animation = "none";
      el.style.transform = "translate3d(0, 100%, 0)";
      if (scrimRef.current) scrimRef.current.style.opacity = "0";
    }
    const t = setTimeout(() => setMounted(false), reduced ? 0 : EXIT_MS);
    return () => clearTimeout(t);
  }, [open, mounted, reduced]);

  /** Reopened before the exit finished — the same element is still here. */
  useEffect(() => {
    if (!open) return;
    const el = panelRef.current;
    if (!el) return;
    const h = el.getBoundingClientRect().height;
    offsetRef.current = h * (1 - DETENT_VISIBLE[opensAt]);
    if (scrimRef.current) scrimRef.current.style.opacity = "";
    if (el.style.transform === "translate3d(0, 100%, 0)") {
      el.style.transition = "";
      paint(offsetRef.current, h);
    }
  }, [open, opensAt, paint]);

  useDialogBehaviour(open, panelRef, onClose);

  const onDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    const el = panelRef.current;
    if (!el || e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    el.style.animation = "none";
    // Inline beats the class for the length of the drag; cleared on release so
    // the settle transition (and `motion-reduce:`) comes back.
    el.style.transition = "none";
    drag.current = {
      id: e.pointerId,
      startY: e.clientY,
      lastY: e.clientY,
      lastT: e.timeStamp,
      v: 0,
      base: offsetRef.current,
      h: el.getBoundingClientRect().height,
      moved: 0,
    };
    setDragging(true);
  };

  const onMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || e.pointerId !== d.id) return;
    // `e.timeStamp`, not `performance.now()`: it is when the event happened
    // rather than when this handler got around to running, which is the
    // difference between a measured flick and a measurement of frame jitter.
    const now = e.timeStamp;
    const dt = now > d.lastT ? now - d.lastT : 16;
    // Weighted towards the newest sample: a flick is decided by its last few
    // milliseconds, and averaging the whole gesture flattens it into a drag.
    d.v = ((e.clientY - d.lastY) / dt) * 0.7 + d.v * 0.3;
    d.lastY = e.clientY;
    d.lastT = now;
    d.moved = Math.max(d.moved, Math.abs(e.clientY - d.startY));
    paint(d.base + (e.clientY - d.startY), d.h);
  };

  const settle = (o: number, h: number) => {
    offsetRef.current = o;
    const el = panelRef.current;
    if (!el) return;
    el.style.transition = "";
    paint(o, h);
  };

  const onUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || e.pointerId !== d.id) return;
    drag.current = null;
    setDragging(false);
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    const el = panelRef.current;
    if (!el) return;
    el.style.transition = "";

    const y = d.base + (e.clientY - d.startY);
    const stops = offsetsFor(d.h);
    const lowest = stops[stops.length - 1];

    // Velocity first. This is the whole point of the component.
    if (d.v > DISMISS_VELOCITY) return onClose();
    if (d.v < -DISMISS_VELOCITY) return settle(stops[0], d.h);
    // Then distance, measured from the lowest resting stop.
    if (y - lowest > d.h * DISMISS_FRACTION) return onClose();

    const projected = y + d.v * PROJECT_MS;
    const nearest = stops.reduce((best, o) =>
      Math.abs(o - projected) < Math.abs(best - projected) ? o : best,
    );
    settle(nearest, d.h);
  };

  const onCancel = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    drag.current = null;
    setDragging(false);
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    settle(d.base, d.h);
  };

  if (!mounted || !onClient) return null;

  return createPortal(
    <div className="fixed inset-0 z-[var(--ux-z-modal)]" data-ux-sheet-root>
      {/* The dim, and the largest possible "close" target. `transform: none`
          inline because mobile.css scales every button on :active, and a
          full-screen button shrinking 3% flashes the page in at the edges. */}
      <button
        type="button"
        aria-label={closeLabel}
        onClick={onClose}
        data-ux-scrim
        ref={scrimRef}
        className="ux-scrim ux-tap-exempt absolute inset-0 transition-opacity duration-200 motion-reduce:transition-none"
        style={{
          background: "color-mix(in srgb, var(--ux-ink) 42%, transparent)",
          transform: "none",
        }}
      />

      <div
        ref={attach}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        data-ux-sheet
        className={`ux-sheet absolute inset-x-0 bottom-0 flex max-h-[88dvh] flex-col overflow-hidden
                    rounded-t-[var(--ux-r-xl)] will-change-transform
                    transition-transform duration-300 motion-reduce:transition-none`}
        style={{ transitionTimingFunction: IOS_CURVE }}
      >
        {/* The drag zone: the grab bar and the header, and nothing below them.
            `touch-action: none` lives here so the body underneath keeps its
            own scrolling. */}
        <div
          data-ux-drag-handle
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onCancel}
          style={{ touchAction: "none", userSelect: "none", WebkitUserSelect: "none" }}
          className="shrink-0"
        >
          {/* A real button, not a decorative bar: one-handed, it is the most
              forgiving way to close this, and a keyboard can reach it. */}
          <button
            type="button"
            aria-label={closeLabel}
            className="ux-tap-exempt mx-auto flex h-[26px] w-full max-w-[140px] items-center justify-center"
            onClick={() => {
              // A drag ends in a click too. Only a real tap should close.
              if ((drag.current?.moved ?? 0) > 6) return;
              onClose();
            }}
          >
            <span
              className="h-[5px] w-[38px] rounded-full transition-colors duration-150 motion-reduce:transition-none"
              style={{
                background: dragging ? "var(--ux-muted)" : "var(--ux-line-strong)",
              }}
            />
          </button>

          <div className="flex items-start gap-3 px-4 pb-3 pt-1">
            <div className="min-w-0 flex-1">
              <h2
                id={titleId}
                className="text-[17px] font-bold leading-tight tracking-[-0.01em]"
                style={{ color: "var(--ux-ink)" }}
              >
                {title}
              </h2>
              {description && (
                <p id={descId} className="mt-0.5 text-[13px] leading-snug" style={{ color: "var(--ux-muted)" }}>
                  {description}
                </p>
              )}
            </div>
            {showClose && (
              <button
                type="button"
                aria-label={closeLabel}
                onClick={onClose}
                // Without this the header drag would start on the X and the
                // tap would be read as a 0px drag instead of a press.
                onPointerDown={(e) => e.stopPropagation()}
                className="ux-press -mr-1 -mt-1 grid h-[36px] w-[36px] shrink-0 place-items-center rounded-full"
                style={{ background: "var(--ux-surface-2)", color: "var(--ux-muted)" }}
              >
                <Icons.X className="h-[17px] w-[17px]" aria-hidden="true" />
              </button>
            )}
          </div>
          <div className="h-px w-full" style={{ background: "var(--ux-line)" }} />
        </div>

        {/* The body. No touch-action here — this is the part that scrolls. */}
        <div className="ux-sheet-body min-h-0 flex-1 overflow-y-auto px-4 py-4" data-ux-sheet-body>
          {children}
        </div>

        {footer && (
          <div
            className="shrink-0 border-t px-4 py-3"
            style={{ borderColor: "var(--ux-line)", background: "var(--ux-surface)" }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>,
    overlayRoot(),
  );
}
