"use client";

import { useState } from "react";

import ResizeHandle from "./ResizeHandle";
import { useLayoutEngine } from "./LayoutEngineProvider";
import { LIMITS } from "./types";

/**
 * Anything with a user-adjustable height — charts, map panels, log views.
 *
 *     <ResizableBox screen="dashboard" id="growth" defaultHeight={280}>
 *       <GrowthChart />
 *     </ResizableBox>
 *
 * The grip only appears on hover or keyboard focus. A resize affordance visible
 * at all times on every chart turns a dashboard into a workshop — the controls
 * end up competing with the data they're meant to frame.
 */
export default function ResizableBox({
  screen,
  id,
  children,
  defaultHeight = 280,
  min = LIMITS.chart.min,
  max = LIMITS.chart.max,
  className = "",
  label,
}: {
  screen: string;
  id: string;
  children: React.ReactNode;
  defaultHeight?: number;
  min?: number;
  max?: number;
  className?: string;
  /** Describes what's being resized, for screen readers. */
  label?: string;
}) {
  const { chartHeight, setChartHeight, features } = useLayoutEngine();
  const key = `${screen}:${id}`;
  const saved = chartHeight(key, defaultHeight);

  const [live, setLive] = useState<number | null>(null);
  const height = live ?? saved;

  return (
    <div className={`relative ${className}`}>
      <div style={{ height }} className="min-h-0 overflow-hidden">
        {children}
      </div>

      {features["layout.resize"] && (
        <ResizeHandle
          orientation="horizontal"
          label={label ? `${label} height` : "Panel height"}
          value={height}
          min={min}
          max={max}
          step={16}
          bigStep={64}
          onChange={setLive}
          onCommit={(next) => {
            setLive(null);
            setChartHeight(key, next);
          }}
          className="absolute inset-x-0 bottom-0 z-10 flex h-3 translate-y-1/2 items-center justify-center"
        >
          <span
            className="h-1 w-10 rounded-full bg-line-strong/0 transition group-hover:bg-line-strong group-focus-visible:bg-brand-500 group-data-[dragging]:bg-brand-500 dark:group-hover:bg-white/20"
            aria-hidden
          />
        </ResizeHandle>
      )}
    </div>
  );
}
