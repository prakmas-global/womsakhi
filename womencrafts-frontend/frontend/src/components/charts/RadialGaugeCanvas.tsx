"use client";

import { RadialBarChart, RadialBar, PolarAngleAxis, ResponsiveContainer } from "recharts";

import { useChartTheme } from "./useChartTheme";

/**
 * The recharts half of {@link RadialGauge} — the arc alone. Loaded on demand;
 * see `./lazy.tsx`. The score in the middle stays in the shell so it paints
 * immediately.
 */
export default function RadialGaugeCanvas({
  value,
  max,
  color,
  size,
  thickness,
}: {
  value: number;
  max: number;
  color: string;
  size: number;
  thickness: number;
}) {
  const ct = useChartTheme();

  return (
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
  );
}
