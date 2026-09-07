"use client";

import { memo } from "react";
import dynamic from "next/dynamic";

import { ChartSkeleton } from "./lazy";

/** The recharts half, fetched on first render. See `./lazy.tsx`. */
const RadialGaugeCanvas = dynamic(() => import("./canvas").then((m) => m.RadialGaugeCanvas), {
  ssr: false,
  loading: ChartSkeleton,
});

/** Circular score gauge (value out of max) with a rounded colored arc. */
function RadialGauge({
  value,
  max = 100,
  color = "var(--status-ok-solid)",
  size = 140,
  thickness = 12,
  centerValue,
  centerLabel,
}: {
  value: number;
  max?: number;
  color?: string;
  size?: number;
  thickness?: number;
  centerValue?: string;
  centerLabel?: string;
}) {
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <RadialGaugeCanvas
        value={value}
        max={max}
        color={color}
        size={size}
        thickness={thickness}
      />
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-2xl font-bold text-ink">
          {centerValue ?? value}
        </span>
        {centerLabel && <span className="text-2xs text-ink-subtle">{centerLabel}</span>}
      </div>
    </div>
  );
}

export default memo(RadialGauge);
