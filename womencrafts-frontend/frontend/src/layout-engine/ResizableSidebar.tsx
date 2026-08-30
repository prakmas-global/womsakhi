"use client";

import { useState } from "react";

import ResizeHandle from "./ResizeHandle";
import { useLayoutEngine } from "./LayoutEngineProvider";
import { LIMITS } from "./types";

/**
 * The navigation rail, draggable to any width between an icon-only 64px and
 * 420px.
 *
 * ── Why pixels here and fractions everywhere else ───────────────────────────
 * A rail's useful width is absolute: it has to fit "Support fund" without
 * wrapping, and text does not get wider on a bigger monitor. A proportional
 * sidebar would be a useless sliver on a laptop and a canyon on an ultrawide.
 * Panes hold reflowing content, so they're proportional. This doesn't.
 *
 * ── Why the minimum is 64 and not 0 ─────────────────────────────────────────
 * At 0 the rail is gone, and with it the handle that brings it back. 64px keeps
 * an icon rail on screen — still navigable, still draggable. Nobody can drag
 * themselves into a state they can't drag out of.
 */
export default function ResizableSidebar({
  app,
  children,
  className = "",
}: {
  /** "member" or "staff" — the two rails are remembered separately. */
  app: string;
  children: React.ReactNode;
  className?: string;
}) {
  const { sidebarWidth, setSidebarWidth, features, navFor, toggleCollapsed } = useLayoutEngine();
  const collapsed = navFor(app).collapsed;

  // Local width so a drag renders every frame without waiting on the debounce.
  const [live, setLive] = useState<number | null>(null);
  const width = collapsed ? LIMITS.sidebar.min : live ?? sidebarWidth;

  return (
    <div className="relative flex shrink-0" style={{ width }}>
      <div className={`min-w-0 flex-1 overflow-hidden ${className}`} data-collapsed={collapsed || undefined}>
        {children}
      </div>

      <ResizeHandle
        label="Sidebar width"
        value={width}
        min={LIMITS.sidebar.min}
        max={LIMITS.sidebar.max}
        disabled={!features["layout.resize"]}
        onChange={(next) => {
          // Dragging a collapsed rail wider is the most natural way to expand
          // it, so let that gesture also undo the collapse.
          if (collapsed && next > LIMITS.sidebar.min + 16) toggleCollapsed(app);
          setLive(next);
        }}
        onCommit={(next) => {
          setLive(null);
          setSidebarWidth(next);
        }}
        className="absolute right-0 top-0 z-20 h-full w-2 -translate-x-1/2"
      >
        <span
          className="block h-full w-px bg-transparent transition group-hover:bg-brand-500/40 group-focus-visible:bg-brand-500 group-data-[dragging]:bg-brand-500"
          aria-hidden
        />
      </ResizeHandle>
    </div>
  );
}
