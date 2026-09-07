"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

import type { SizeBucket } from "@/layout-engine";

import { useChartTheme } from "./useChartTheme";
import type { TrendDatum } from "./AreaTrend";

/**
 * The recharts half of {@link AreaTrend}. Loaded on demand — see the note in
 * AreaTrend.tsx for why the split is here and not at the call sites.
 *
 * It receives the measurement rather than taking one: the frame has already
 * measured, and measuring twice would mean two different answers during the
 * frame the chart swaps in.
 */
export default function AreaTrendCanvas({
  data,
  color,
  gradId,
  bucket,
  width,
  showAxis,
}: {
  data: TrendDatum[];
  color: string;
  gradId: string;
  bucket: SizeBucket;
  width: number;
  showAxis: boolean;
}) {
  const ct = useChartTheme();

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
}
