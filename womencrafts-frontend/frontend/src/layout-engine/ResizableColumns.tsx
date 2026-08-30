"use client";

import { Children, Fragment } from "react";
import { Group, Panel, Separator, type Layout as PanelLayout } from "react-resizable-panels";
import { GripVertical } from "lucide-react";

import { useLayoutEngine } from "./LayoutEngineProvider";
import { LIMITS } from "./types";

/**
 * Any number of side-by-side columns, each divider draggable and remembered.
 *
 * Most dashboard screens are built the same way — a wide column of content and
 * one or two narrower ones beside it, written as a grid:
 *
 *     <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
 *       <MainThing />
 *       <SideThing />
 *     </div>
 *
 * [[SplitPane]] does this for exactly two halves, but takes them as `list` and
 * `detail` props. Converting two dozen signed-off layouts into prop position
 * would be a lot of edits for no behaviour change, and every edit a chance to
 * move something. This takes the columns as ordinary **children** instead, so a
 * screen adopts the engine by renaming its wrapper and nothing else moves:
 *
 *     <ResizableColumns id="reports">
 *       <MainThing />
 *       <SideThing />
 *     </ResizableColumns>
 *
 * ── Why N columns and not just two ──────────────────────────────────────────
 * `/dashboard/appointments` and `/dashboard/messages` are three-column. Adding
 * a separate three-panel primitive would mean two components with the same
 * behaviour drifting apart, so this one handles however many children it is
 * given. Each column's fraction is stored under its own key
 * (`<id>:col<n>`), which is what lets a three-column screen remember all of
 * its dividers rather than just the first.
 *
 * ── Why it stacks on a phone ────────────────────────────────────────────────
 * Three columns on a 390px screen is ~120px each, narrower than a readable line
 * of text in any of them. Below the tablet breakpoint the columns stack — and
 * because the stored fractions are untouched, the arrangement reappears intact
 * the moment there is room for it again.
 */
export default function ResizableColumns({
  id,
  children,
  defaultSize = 0.74,
  defaultSizes,
  className = "",
}: {
  /** Screen id. Fractions are stored as "<id>:col0", "<id>:col1", … */
  id: string;
  children: React.ReactNode;
  /** Two-column shorthand: the fraction given to the FIRST column. */
  defaultSize?: number;
  /** Explicit fraction per column. Wins over `defaultSize` when given. */
  defaultSizes?: number[];
  className?: string;
}) {
  const { paneSize, setPaneSize, breakpoint, features } = useLayoutEngine();
  const columns = Children.toArray(children);

  // One column is not a split, and rendering a Group around it would add a
  // separator with nothing on the other side.
  if (columns.length < 2) {
    return <div className={className}>{children}</div>;
  }

  const fallback =
    defaultSizes && defaultSizes.length === columns.length
      ? defaultSizes
      : columns.length === 2
        ? [defaultSize, 1 - defaultSize]
        : columns.map(() => 1 / columns.length);

  // With three columns a 20%/80% band is unsatisfiable — one panel at its
  // maximum leaves 10% each for the other two, below their own minimum. Scale
  // the floor to the column count and let the ceiling follow from it.
  const minSize = columns.length > 2 ? LIMITS.pane.min / (columns.length - 1) : LIMITS.pane.min;
  const maxSize = 1 - minSize * (columns.length - 1);

  const key = (i: number) => `${id}:col${i}`;
  const sizes = columns.map((_, i) => paneSize(key(i), fallback[i]));

  if (breakpoint === "mobile") {
    return (
      <div className={`flex flex-col gap-4 ${className}`}>
        {columns.map((column, i) => (
          <div key={i}>{column}</div>
        ))}
      </div>
    );
  }

  function handleLayoutChanged(next: PanelLayout, meta: { isUserInteraction: boolean }) {
    // Only persist a deliberate drag. This also fires on mount, on constraint
    // recomputation and on window resize; saving those would quietly overwrite
    // a choice with an accident.
    if (!meta.isUserInteraction) return;
    const total = Object.values(next).reduce((sum, v) => sum + v, 0);
    if (!total) return;
    columns.forEach((_, i) => {
      const value = next[`${id}-col${i}`];
      // Derived as a share of the total rather than read as a unit, so this
      // holds whether the library reports pixels or percentages.
      if (typeof value === "number") setPaneSize(key(i), value / total);
    });
  }

  return (
    <Group orientation="horizontal" className={className} onLayoutChanged={handleLayoutChanged}>
      {columns.map((column, i) => (
        <Fragment key={i}>
          {i > 0 && (
            <Separator
              disabled={!features["layout.resize"]}
              // The library gives this role="separator" and wires arrow keys,
              // Home, End and Enter itself. That is why it was chosen: a
              // divider you can only drag would exclude the people most likely
              // to want a custom layout in the first place.
              aria-label="Resize panels"
              className="group relative mx-1 flex w-1.5 shrink-0 items-center justify-center rounded-full transition hover:bg-brand-500/20 data-[state=drag]:bg-brand-500/40"
            >
              <span className="pointer-events-none absolute flex h-8 w-3.5 items-center justify-center rounded-full border border-[color:var(--wc-border-subtle)] bg-[color:var(--surface)] opacity-0 shadow-sm transition group-hover:opacity-100 group-focus-visible:opacity-100">
                <GripVertical className="h-3 w-3 text-ink-subtle" aria-hidden />
              </span>
            </Separator>
          )}
          <Panel
            id={`${id}-col${i}`}
            defaultSize={`${sizes[i] * 100}`}
            minSize={`${minSize * 100}`}
            maxSize={`${maxSize * 100}`}
            className="min-w-0"
          >
            {column}
          </Panel>
        </Fragment>
      ))}
    </Group>
  );
}
