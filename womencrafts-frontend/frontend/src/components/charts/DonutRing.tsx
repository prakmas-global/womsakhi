"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

import { useChartTheme } from "./useChartTheme";
import type { DonutDatum } from "./DonutChart";

/**
 * The recharts half of {@link DonutChart} — the ring itself, and nothing else.
 * Loaded on demand; see `./lazy.tsx`.
 *
 * The centre total stays in the shell rather than moving here, so the number a
 * reader actually looks for is painted immediately and does not wait on 269 KB
 * of charting library.
 *
 * Radii are handed down already computed. The shell measured the container to
 * decide them, and re-deriving them here would be a second answer to a question
 * that already has one.
 */
export default function DonutRing({
  data,
  total,
  inner,
  outer,
  showTooltip,
}: {
  data: DonutDatum[];
  total: number;
  inner: number;
  outer: number;
  showTooltip: boolean;
}) {
  const ct = useChartTheme();

  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          innerRadius={Math.max(0, inner - 2)}
          outerRadius={Math.max(1, outer - 2)}
          paddingAngle={2}
          startAngle={90}
          endAngle={-270}
          stroke="none"
          isAnimationActive={false}
        >
          {data.map((d) => (
            <Cell key={d.name} fill={d.color} />
          ))}
        </Pie>
        {showTooltip && (
          <Tooltip
            allowEscapeViewBox={{ x: true, y: true }}
            wrapperStyle={{ zIndex: 60, outline: "none" }}
            formatter={(value, name) => {
              const v = typeof value === "number" ? value : Number(value);
              return [
                `${v.toLocaleString()} (${((v / total) * 100).toFixed(1)}%)`,
                name as string,
              ];
            }}
            contentStyle={{
              borderRadius: 10,
              ...ct.tooltip,
              boxShadow: "var(--wc-shadow-overlay)",
              fontSize: 12,
              padding: "6px 10px",
              whiteSpace: "nowrap",
            }}
            itemStyle={ct.itemStyle}
            labelStyle={ct.labelStyle}
          />
        )}
      </PieChart>
    </ResponsiveContainer>
  );
}
