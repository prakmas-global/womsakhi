"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { clamp } from "./types";

/**
 * Eight-handle resizing — four corners and four edges — like dragging an image.
 *
 * ── The decision that makes this responsive ─────────────────────────────────
 * Dragging a corner to an arbitrary pixel width is what an image editor does,
 * and it is exactly wrong for an app: a card dragged to 437px on a 1920 monitor
 * is 437px on a 1280 laptop too, where it no longer fits beside its neighbour.
 * The layout would look hand-made on one screen and broken on every other.
 *
 * So the corner FOLLOWS THE POINTER LIVE but LANDS ON GRID UNITS. Width snaps
 * to whole columns as you drag — you see the card jump to the next column the
 * moment you cross the halfway point, which reads as direct manipulation while
 * staying expressible at every breakpoint. Height is free pixels, because rows
 * have no grid to fight with.
 *
 * This is how Grafana and Figma's dashboard grids behave, and it is why their
 * layouts survive a window resize when a free-pixel one does not.
 *
 * ── Why north and west handles exist at all ─────────────────────────────────
 * They resize the same box; they just grow it in the opposite direction. In a
 * flow layout the card cannot actually move up or left, so those handles are
 * offered only when `anchor` allows it — otherwise a user drags the top edge,
 * nothing appears to happen where they are looking, and the control feels
 * broken even though the size changed.
 */

export type Handle = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

export const ALL_HANDLES: Handle[] = ["n", "s", "e", "w", "ne", "nw", "se", "sw"];
/** Corners plus the two edges that do something in a top-anchored flow layout. */
export const FLOW_HANDLES: Handle[] = ["s", "e", "se", "sw", "ne"];

const CURSOR: Record<Handle, string> = {
  n: "ns-resize", s: "ns-resize", e: "ew-resize", w: "ew-resize",
  ne: "nesw-resize", sw: "nesw-resize", nw: "nwse-resize", se: "nwse-resize",
};

const POSITION: Record<Handle, string> = {
  n: "top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 h-3 w-10",
  s: "bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 h-3 w-10",
  e: "right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-3 h-10",
  w: "left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-10",
  ne: "top-0 right-0 -translate-y-1/2 translate-x-1/2 h-4 w-4",
  nw: "top-0 left-0 -translate-y-1/2 -translate-x-1/2 h-4 w-4",
  se: "bottom-0 right-0 translate-y-1/2 translate-x-1/2 h-4 w-4",
  sw: "bottom-0 left-0 translate-y-1/2 -translate-x-1/2 h-4 w-4",
};

const isCorner = (h: Handle) => h.length === 2;
const affectsWidth = (h: Handle) => h.includes("e") || h.includes("w");
const affectsHeight = (h: Handle) => h.includes("n") || h.includes("s");
/** West and north grow the box when the pointer moves in the negative direction. */
const inverted = (h: Handle) => ({ x: h.includes("w"), y: h.includes("n") });

export interface ResizeFrameProps {
  children: React.ReactNode;
  /** Current column span. Omit to make this height-only. */
  span?: number;
  columns?: number;
  onSpanChange?: (span: number) => void;
  /** Current height in px. Omit to make this width-only. */
  height?: number;
  minHeight?: number;
  maxHeight?: number;
  onHeightChange?: (height: number) => void;
  /** Fires once when the drag ends — persist here, not on every frame. */
  onCommit?: (next: { span?: number; height?: number }) => void;
  handles?: Handle[];
  /** Human name, for the screen-reader labels on eight otherwise identical grips. */
  label: string;
  active?: boolean;
  className?: string;
}

export default function ResizeFrame({
  children,
  span,
  columns = 4,
  onSpanChange,
  height,
  minHeight = 120,
  maxHeight = 1200,
  onHeightChange,
  onCommit,
  handles = FLOW_HANDLES,
  label,
  active = true,
  className = "",
}: ResizeFrameProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<Handle | null>(null);
  const start = useRef({ x: 0, y: 0, width: 0, height: 0, span: 1, unit: 1 });
  const latest = useRef<{ span?: number; height?: number }>({});

  const canWidth = typeof span === "number" && !!onSpanChange;
  const canHeight = typeof height === "number" && !!onHeightChange;

  const begin = useCallback(
    (handle: Handle, e: React.PointerEvent) => {
      if (!active) return;
      e.preventDefault();
      e.stopPropagation();
      const rect = boxRef.current?.getBoundingClientRect();
      if (!rect) return;

      // Width of one column INCLUDING the gap between columns. Derived from
      // this card's own measured width rather than read from the grid, so the
      // frame works inside any grid without being told its geometry.
      const gap = 24; // Tailwind gap-6
      const currentSpan = span ?? 1;
      const unit = (rect.width + gap) / currentSpan;

      start.current = {
        x: e.clientX, y: e.clientY,
        width: rect.width, height: rect.height,
        span: currentSpan, unit,
      };
      latest.current = { span, height };
      setDragging(handle);
    },
    [active, height, span],
  );

  useEffect(() => {
    if (!dragging) return;
    const handle = dragging;
    const inv = inverted(handle);

    const move = (e: PointerEvent) => {
      const dx = (e.clientX - start.current.x) * (inv.x ? -1 : 1);
      const dy = (e.clientY - start.current.y) * (inv.y ? -1 : 1);

      if (canWidth && affectsWidth(handle)) {
        const gap = 24;
        // Snap live: the card jumps to the next column as the pointer crosses
        // the halfway point, which is what makes this feel like direct
        // manipulation rather than a slider.
        const next = Math.round((start.current.width + dx + gap) / start.current.unit);
        const snapped = clamp(next, 1, columns);
        if (snapped !== latest.current.span) {
          latest.current.span = snapped;
          onSpanChange?.(snapped);
        }
      }

      if (canHeight && affectsHeight(handle)) {
        const next = Math.round(clamp(start.current.height + dy, minHeight, maxHeight));
        if (next !== latest.current.height) {
          latest.current.height = next;
          onHeightChange?.(next);
        }
      }
    };

    const end = () => {
      setDragging(null);
      onCommit?.(latest.current);
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);

    const body = document.body;
    const prev = { userSelect: body.style.userSelect, cursor: body.style.cursor };
    body.style.userSelect = "none";
    body.style.cursor = CURSOR[handle];

    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
      // Restored here rather than in `end`, so unmounting mid-drag can't leave
      // the page unselectable with a resize cursor stuck on it.
      body.style.userSelect = prev.userSelect;
      body.style.cursor = prev.cursor;
    };
  }, [canHeight, canWidth, columns, dragging, maxHeight, minHeight, onCommit, onHeightChange, onSpanChange]);

  function onKeyDown(handle: Handle, e: React.KeyboardEvent) {
    const step = e.shiftKey ? 48 : 16;
    let changed = false;
    const next: { span?: number; height?: number } = {};

    if (canWidth && affectsWidth(handle)) {
      if (e.key === "ArrowRight") { next.span = clamp((span ?? 1) + 1, 1, columns); changed = true; }
      if (e.key === "ArrowLeft") { next.span = clamp((span ?? 1) - 1, 1, columns); changed = true; }
    }
    if (canHeight && affectsHeight(handle)) {
      if (e.key === "ArrowDown") { next.height = clamp((height ?? 0) + step, minHeight, maxHeight); changed = true; }
      if (e.key === "ArrowUp") { next.height = clamp((height ?? 0) - step, minHeight, maxHeight); changed = true; }
    }
    if (!changed) return;

    e.preventDefault();
    e.stopPropagation();
    if (next.span !== undefined) onSpanChange?.(next.span);
    if (next.height !== undefined) onHeightChange?.(next.height);
    onCommit?.(next);
  }

  return (
    <div
      ref={boxRef}
      className={`relative ${className}`}
      data-resizing={dragging || undefined}
      style={canHeight ? { height } : undefined}
    >
      {children}

      {active &&
        handles
          .filter((h) => (affectsWidth(h) && canWidth) || (affectsHeight(h) && canHeight))
          .map((h) => (
            <div
              key={h}
              role="slider"
              tabIndex={0}
              aria-label={`Resize ${label} from the ${NAMES[h]}`}
              aria-valuenow={affectsWidth(h) ? span : height}
              aria-valuemin={affectsWidth(h) ? 1 : minHeight}
              aria-valuemax={affectsWidth(h) ? columns : maxHeight}
              onPointerDown={(e) => begin(h, e)}
              onKeyDown={(e) => onKeyDown(h, e)}
              style={{ cursor: CURSOR[h] }}
              className={`absolute z-30 touch-none rounded-full outline-none transition ${POSITION[h]} ${
                isCorner(h)
                  ? "border-2 border-brand-500 bg-[color:var(--surface)] opacity-0 group-hover/frame:opacity-100 focus-visible:opacity-100"
                  : "bg-brand-500/0 group-hover/frame:bg-brand-500/50 focus-visible:bg-brand-500"
              } ${dragging === h ? "!opacity-100 !bg-brand-500" : ""}`}
            />
          ))}
    </div>
  );
}

const NAMES: Record<Handle, string> = {
  n: "top", s: "bottom", e: "right", w: "left",
  ne: "top right", nw: "top left", se: "bottom right", sw: "bottom left",
};
