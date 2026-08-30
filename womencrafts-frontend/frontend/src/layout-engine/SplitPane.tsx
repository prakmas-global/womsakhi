"use client";

import { Group, Panel, Separator, type Layout as PanelLayout } from "react-resizable-panels";
import { GripVertical } from "lucide-react";

import { useLayoutEngine } from "./LayoutEngineProvider";
import { LIMITS } from "./types";

/**
 * A list↔detail split whose divider the user can drag, remembered per
 * breakpoint.
 *
 * Used on the screens that show a list beside a detail view. Opting one in is
 * a single line:
 *
 *     <SplitPane id="members" list={<MemberList />} detail={<MemberDetail />} />
 *
 * ── Why it stacks on mobile ─────────────────────────────────────────────────
 * A split on a 390px phone gives two columns of ~180px, narrower than a
 * readable line of text in either. Below the tablet breakpoint the panels stack
 * instead — and because the saved fraction is untouched, it reappears intact
 * the moment there's room for it again.
 *
 * ── Why sizes are percentages ───────────────────────────────────────────────
 * The library accepts numbers as pixels and unitless strings as percentages.
 * We pass strings: the store holds a fraction of the row precisely so a layout
 * survives moving between screens. Passing pixels would defeat that.
 */
export default function SplitPane({
  id,
  list,
  detail,
  defaultSize = 0.38,
  className = "",
  minSize = LIMITS.pane.min,
  maxSize = LIMITS.pane.max,
}: {
  /** Screen id. Stored as "<id>:split". */
  id: string;
  list: React.ReactNode;
  detail: React.ReactNode;
  /** Fraction of the row given to the list before anyone drags it. */
  defaultSize?: number;
  className?: string;
  minSize?: number;
  maxSize?: number;
}) {
  const { paneSize, setPaneSize, breakpoint, features } = useLayoutEngine();
  const key = `${id}:split`;
  const size = paneSize(key, defaultSize);
  const listPanelId = `${id}-list`;

  if (breakpoint === "mobile") {
    return (
      <div className={`flex flex-col gap-4 ${className}`}>
        <div>{list}</div>
        <div>{detail}</div>
      </div>
    );
  }

  function handleLayoutChanged(next: PanelLayout, meta: { isUserInteraction: boolean }) {
    // Only persist when the user actually moved the divider. The callback also
    // fires on mount, on constraint recomputation and on window resize — saving
    // those would overwrite a deliberate choice with an incidental one.
    if (!meta.isUserInteraction) return;

    const total = Object.values(next).reduce((sum, v) => sum + v, 0);
    const listSize = next[listPanelId];
    if (!total || typeof listSize !== "number") return;

    // Derived as a share of the total rather than read as a unit, so this holds
    // whether the library reports pixels or percentages.
    setPaneSize(key, listSize / total);
  }

  return (
    <Group
      orientation="horizontal"
      className={className}
      onLayoutChanged={handleLayoutChanged}
    >
      <Panel
        id={listPanelId}
        defaultSize={`${size * 100}`}
        minSize={`${minSize * 100}`}
        maxSize={`${maxSize * 100}`}
        className="min-w-0"
      >
        {list}
      </Panel>

      <Separator
        disabled={!features["layout.resize"]}
        // The library gives this role="separator" and wires arrow keys, Home,
        // End and Enter itself. That is why it was chosen: a divider operable
        // only by dragging would exclude the people most likely to want a
        // custom layout.
        aria-label="Resize panels"
        className="group relative mx-1 flex w-1.5 shrink-0 items-center justify-center rounded-full transition hover:bg-brand-500/20 data-[state=drag]:bg-brand-500/40"
      >
        <span className="pointer-events-none absolute flex h-8 w-3.5 items-center justify-center rounded-full border border-[color:var(--wc-border-subtle)] bg-[color:var(--surface)] opacity-0 shadow-sm transition group-hover:opacity-100 group-focus-visible:opacity-100">
          <GripVertical className="h-3 w-3 text-ink-subtle" aria-hidden />
        </span>
      </Separator>

      <Panel id={`${id}-detail`} className="min-w-0">
        {detail}
      </Panel>
    </Group>
  );
}
