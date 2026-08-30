"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

import ResizeFrame from "./ResizeFrame";
import SortableList from "./SortableList";
import { useLayoutEngine } from "./LayoutEngineProvider";
import { LIMITS, type WidgetPlacement } from "./types";

export interface WidgetDef extends WidgetPlacement {
  /** Shown in the customise controls and announced while dragging. */
  title: string;
  render: () => React.ReactNode;
}

/**
 * A dashboard whose cards are dragged by their corners and edges.
 *
 * Grab any corner and the card follows the pointer: width snaps to whole
 * columns as you cross each boundary, height is free pixels. See
 * `ResizeFrame.tsx` for why width snaps — briefly, a card dragged to an
 * arbitrary pixel width is wrong on every screen that isn't the one it was
 * dragged on.
 *
 * ── Why hidden widgets stay listed ──────────────────────────────────────────
 * Hiding is reversible, and the control that reverses it has to live somewhere
 * findable. Hidden cards collapse to a labelled stub while arranging, and
 * disappear entirely once you're done.
 */
export default function WidgetGrid({
  screen,
  widgets,
  columns = 4,
  className = "",
}: {
  screen: string;
  widgets: WidgetDef[];
  /**
   * How many columns this dashboard uses. Spans are clamped to it, so a screen
   * designed as thirds keeps its proportions instead of being forced into
   * quarters — adding customisation should not silently redesign a layout.
   */
  columns?: 2 | 3 | 4;
  className?: string;
}) {
  const { widgetsFor, setWidgets, customising, features, breakpoint } = useLayoutEngine();

  // Live size during a drag, so the card tracks the pointer at frame rate
  // without a round trip through the debounced save.
  const [live, setLive] = useState<Record<string, { span?: number; height?: number }>>({});

  const placements = widgetsFor(
    screen,
    widgets.map(({ id, span, hidden, height }) => ({ id, span, hidden, height })),
  );
  const byId = new Map(widgets.map((w) => [w.id, w]));
  const ordered = placements
    .map((p) => ({ ...byId.get(p.id)!, ...p }))
    .filter((w) => w.render)
    .map((w) => ({ ...w, ...(live[w.id] ?? {}) }));

  const commit = (next: typeof ordered) =>
    setWidgets(
      screen,
      next.map(({ id, span, hidden, height }) => ({ id, span, hidden, height })),
    );

  const update = (id: string, patch: Partial<WidgetPlacement>) =>
    commit(ordered.map((w) => (w.id === id ? { ...w, ...patch } : w)));

  // Spans only apply where there is room. Below desktop every card is full
  // width, so a 1-of-4 card doesn't become an unreadable sliver.
  const spanClass = (span: number) => {
    if (breakpoint !== "desktop") return "col-span-1";
    return (
      { 1: "col-span-1", 2: "col-span-2", 3: "col-span-3", 4: "col-span-4" }[
        Math.min(columns, Math.max(1, span))
      ] ?? "col-span-1"
    );
  };

  // Written out rather than interpolated: Tailwind scans source text, so
  // `xl:grid-cols-${columns}` would never be generated.
  const gridClass =
    { 2: "lg:grid-cols-2", 3: "lg:grid-cols-2 xl:grid-cols-3", 4: "lg:grid-cols-2 xl:grid-cols-4" }[
      columns
    ] ?? "lg:grid-cols-2 xl:grid-cols-4";

  if (!customising) {
    return (
      <div className={`grid auto-rows-fr items-stretch gap-6 ${gridClass} ${className}`}>
        {ordered
          .filter((w) => !w.hidden)
          .map((w) => (
            <div
              key={w.id}
              // `@container` makes this card a query context: everything inside
              // can respond to the CARD's size instead of the window's — the
              // difference between adapting and being cropped.
              //
              // `overflow-hidden` is the backstop. Content inside a card should
              // adapt on its own, but if anything ever fails to, it must be
              // clipped rather than painted on top of the cards below. An
              // overlapping dashboard looks broken in a way a clipped card
              // never does.
              className={`@container min-w-0 overflow-hidden ${spanClass(w.span)}`}
              // A height set by dragging applies all the time, not only while
              // arranging — otherwise the card springs back the moment she
              // finishes and the resize looks discarded.
              style={w.height ? { height: w.height } : undefined}
            >
              <div className="h-full min-h-0">{w.render()}</div>
            </div>
          ))}
      </div>
    );
  }

  return (
    <SortableList
      items={ordered}
      onReorder={commit}
      disabled={!features["layout.widgets"]}
      className={`grid auto-rows-fr items-stretch gap-6 ${gridClass} ${className}`}
      renderItem={(w, handle) => (
        <div className={`group/frame @container min-w-0 ${spanClass(w.span)}`}>
          <ResizeFrame
            label={w.title}
            span={w.span}
            columns={columns}
            onSpanChange={(span) => setLive((l) => ({ ...l, [w.id]: { ...l[w.id], span } }))}
            height={w.height ?? 260}
            minHeight={LIMITS.widgetHeight.min}
            maxHeight={LIMITS.widgetHeight.max}
            onHeightChange={(height) => setLive((l) => ({ ...l, [w.id]: { ...l[w.id], height } }))}
            onCommit={(next) => {
              setLive((l) => {
                const rest = { ...l };
                delete rest[w.id];
                return rest;
              });
              update(w.id, next);
            }}
            active={features["layout.widgets"] && !w.hidden}
            className="rounded-2xl border-2 border-dashed border-brand-300 p-1 dark:border-brand-500/40"
          >
            <div className="flex h-full flex-col">
              <div className="mb-1 flex shrink-0 items-center gap-1 px-1">
                {handle}
                <span className="flex-1 truncate text-xs font-semibold text-ink-muted">
                  {w.title}
                </span>
                <span className="rounded bg-[color:var(--surface-inset)] px-1.5 py-0.5 text-3xs font-semibold tabular-nums text-ink-subtle">
                  {w.span}×{Math.round(w.height ?? 260)}
                </span>
                <button
                  onClick={() => update(w.id, { hidden: !w.hidden })}
                  aria-label={w.hidden ? `Show ${w.title}` : `Hide ${w.title}`}
                  aria-pressed={w.hidden}
                  className="rounded p-1 text-ink-subtle transition hover:text-ink-muted"
                >
                  {w.hidden ? (
                    <EyeOff className="h-3.5 w-3.5" aria-hidden />
                  ) : (
                    <Eye className="h-3.5 w-3.5" aria-hidden />
                  )}
                </button>
              </div>

              {w.hidden ? (
                <p className="rounded-xl bg-[color:var(--surface-inset)] px-3 py-6 text-center text-xs text-ink-subtle">
                  Hidden
                </p>
              ) : (
                // Pointer events off so a drag that crosses the card doesn't
                // get swallowed by a link inside it.
                <div className="pointer-events-none min-h-0 flex-1 overflow-hidden opacity-90">
                  {w.render()}
                </div>
              )}
            </div>
          </ResizeFrame>
        </div>
      )}
    />
  );
}
