"use client";

import { memo } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useChartTheme } from "./useChartTheme";
import ChartFrame from "./ChartFrame";

export type TrendDatum = { label: string; value: number };

/**
 * Gradient area chart that sheds detail as its container shrinks.
 *
 *   lg / md   grid, both axes — the full reading
 *   sm        X axis only; Y labels would eat a third of a narrow card
 *   xs        a bare sparkline — shape and direction, which is all that is
 *             legible at that size anyway
 *
 * Ticks are also thinned by width, because recharts will happily render twelve
 * overlapping date labels rather than drop any.
 */
function AreaTrend({
  data,
  color = "var(--color-violet-500)",
  height = 240,
  id,
  chartLabel,
  fill = false,
  showAxis = true,
}: {
  data: TrendDatum[];
  color?: string;
  height?: number;
  /** Set this to let the user drag the chart taller or shorter. */
  id?: string;
  chartLabel?: string;
  /** Fill the parent rather than claiming a fixed height. */
  fill?: boolean;
  showAxis?: boolean;
}) {
  // The id has to be a valid CSS identifier, because it is referenced as
  // `url(#id)`. Colours are now CSS variables like `var(--color-violet-500)`,
  // and the parentheses in that made the reference unparseable — so the fill
  // silently fell back to BLACK. That is why themed area charts rendered as a
  // grey slab instead of the theme colour.
  const gradId = `area-${color.replace(/[^a-zA-Z0-9]/g, "")}`;
  const ct = useChartTheme();
  return (
    <ChartFrame height={height} id={id} label={chartLabel} fill={fill}>
      {({ bucket, width }) => {
        // Author intent wins: a caller that turned axes off keeps them off.
        const axes = showAxis && bucket !== "xs";
        const yAxis = axes && bucket !== "sm";
        const grid = bucket !== "xs";
        // Roughly 64px per label before they start colliding.
        const every = Math.max(
          0,
          Math.ceil(data.length / Math.max(1, Math.floor(width / 64))) - 1,
        );

        return (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={data}
              margin={
                bucket === "xs"
                  ? { top: 2, right: 2, left: 2, bottom: 2 }
                  : { top: 10, right: axes ? 16 : 8, left: yAxis ? -18 : 16, bottom: 0 }
              }
            >
              <defs>
                <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.28} />
                  <stop offset="100%" stopColor={color} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              {grid && (
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke={ct.grid}
                  vertical={false}
                />
              )}
              {axes && (
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: ct.tick, fontSize: bucket === "sm" ? 10 : 12 }}
                  interval={every}
                  dy={8}
                />
              )}
              {yAxis && (
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: ct.tick, fontSize: 12 }}
                  width={44}
                />
              )}
              <Tooltip
                cursor={{ stroke: color, strokeOpacity: 0.2 }}
                allowEscapeViewBox={{ x: false, y: true }}
                wrapperStyle={{ zIndex: 60, outline: "none" }}
                contentStyle={{
                  borderRadius: 12,
                  ...ct.tooltip,
                  boxShadow: "var(--wc-shadow-overlay)",
                  fontSize: 12,
                }}
                itemStyle={ct.itemStyle}
                labelStyle={ct.labelStyle}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke={color}
                strokeWidth={bucket === "xs" ? 2 : 2.5}
                fill={`url(#${gradId})`}
                // Dots on a sparkline are noise, and on a dense series they merge
                // into a dotted line that reads as a second data series.
                dot={
                  bucket === "lg" && data.length <= 12
                    ? { r: 3, fill: color, strokeWidth: 0 }
                    : false
                }
                activeDot={{ r: 5 }}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        );
      }}
    </ChartFrame>
  );
}

export default memo(AreaTrend);
