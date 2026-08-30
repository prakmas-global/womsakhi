"use client";

import { memo } from "react";
import { RadialBarChart, RadialBar, PolarAngleAxis, ResponsiveContainer } from "recharts";
import { useChartTheme } from "./useChartTheme";

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
  const ct = useChartTheme();
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <ResponsiveContainer width="100%" height="100%">
        <RadialBarChart
          innerRadius={size / 2 - thickness - 5}
          outerRadius={size / 2 - 5}
          barSize={thickness}
          data={[{ value }]}
          startAngle={90}
          endAngle={-270}
          margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
        >
          <PolarAngleAxis type="number" domain={[0, max]} tick={false} />
          <RadialBar
            dataKey="value"
            cornerRadius={thickness}
            fill={color}
            background={{ fill: ct.track }}
          />
        </RadialBarChart>
      </ResponsiveContainer>
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
