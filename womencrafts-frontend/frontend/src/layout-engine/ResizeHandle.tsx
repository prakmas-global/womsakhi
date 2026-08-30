"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { clamp } from "./types";

/**
 * A drag handle for anything sized in pixels — the sidebar, a chart, a column.
 *
 * `react-resizable-panels` covers proportional splits; this covers the absolute
 * ones. Written by hand rather than pulled in, because the requirements are
 * small and specific:
 *
 * ── It must work from the keyboard ──────────────────────────────────────────
 * Arrow keys nudge, Shift+arrow moves in bigger steps, Home/End jump to the
 * limits, Enter/Escape end the interaction. A resize control that only responds
 * to dragging is unusable for exactly the people most likely to want a resized
 * layout — which would make an accessibility feature inaccessible.
 *
 * ── It must not fight the page ──────────────────────────────────────────────
 * During a drag, text selection and touch scrolling are suppressed on <body>
 * and restored afterwards, including if the component unmounts mid-drag.
 */
export default function ResizeHandle({
  value,
  min,
  max,
  onChange,
  onCommit,
  orientation = "vertical",
  label,
  step = 8,
  bigStep = 48,
  disabled = false,
  className = "",
  children,
}: {
  value: number;
  min: number;
  max: number;
  /** Fires continuously during a drag — render every frame. */
  onChange: (next: number) => void;
  /** Fires once when the interaction ends. Persist here. */
  onCommit?: (next: number) => void;
  orientation?: "vertical" | "horizontal";
  label: string;
  step?: number;
  bigStep?: number;
  disabled?: boolean;
  className?: string;
  children?: React.ReactNode;
}) {
  const [dragging, setDragging] = useState(false);
  const start = useRef({ pointer: 0, value: 0 });
  const latest = useRef(value);
  latest.current = value;

  const horizontal = orientation === "horizontal";

  const stop = useCallback(() => {
    setDragging(false);
    onCommit?.(latest.current);
  }, [onCommit]);

  useEffect(() => {
    if (!dragging) return;

    const move = (e: PointerEvent) => {
      const delta = (horizontal ? e.clientY : e.clientX) - start.current.pointer;
      onChange(clamp(start.current.value + delta, min, max));
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);

    // Without this, dragging selects the text either side of the handle.
    const body = document.body;
    const prev = { userSelect: body.style.userSelect, cursor: body.style.cursor };
    body.style.userSelect = "none";
    body.style.cursor = horizontal ? "row-resize" : "col-resize";

    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
      // Restored in cleanup rather than in `stop`, so an unmount mid-drag can't
      // leave the whole page unselectable with a resize cursor.
      body.style.userSelect = prev.userSelect;
      body.style.cursor = prev.cursor;
    };
  }, [dragging, horizontal, max, min, onChange, stop]);

  function onKeyDown(e: React.KeyboardEvent) {
    if (disabled) return;
    const decrease = horizontal ? "ArrowUp" : "ArrowLeft";
    const increase = horizontal ? "ArrowDown" : "ArrowRight";
    const amount = e.shiftKey ? bigStep : step;

    let next: number | null = null;
    if (e.key === decrease) next = value - amount;
    else if (e.key === increase) next = value + amount;
    else if (e.key === "Home") next = min;
    else if (e.key === "End") next = max;
    else if (e.key === "Enter" || e.key === "Escape") {
      onCommit?.(value);
      (e.currentTarget as HTMLElement).blur();
      return;
    }

    if (next === null) return;
    e.preventDefault();
    const clamped = clamp(next, min, max);
    onChange(clamped);
    onCommit?.(clamped);
  }

  return (
    <div
      role="separator"
      aria-label={label}
      aria-orientation={horizontal ? "horizontal" : "vertical"}
      aria-valuenow={Math.round(value)}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-disabled={disabled || undefined}
      tabIndex={disabled ? -1 : 0}
      onKeyDown={onKeyDown}
      onPointerDown={(e) => {
        if (disabled) return;
        e.preventDefault();
        start.current = { pointer: horizontal ? e.clientY : e.clientX, value };
        setDragging(true);
      }}
      className={`group touch-none outline-none ${
        disabled ? "cursor-default" : horizontal ? "cursor-row-resize" : "cursor-col-resize"
      } ${className}`}
      data-dragging={dragging || undefined}
    >
      {children}
    </div>
  );
}
