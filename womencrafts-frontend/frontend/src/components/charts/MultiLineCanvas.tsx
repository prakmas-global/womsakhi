"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

import type { SizeBucket } from "@/layout-engine";

import { useChartTheme } from "./useChartTheme";
import type { Series } from "./MultiLine";

/** The recharts half of {@link MultiLine}, loaded on demand. See `./lazy.tsx`. */
export default function MultiLineCanvas({
  data,
  series,
  bucket,
  width,
}: {
  data: Record<string, number | string>[];
  series: Series[];
  bucket: SizeBucket;
  width: number;
}) {
  const ct = useChartTheme();

  const axes = bucket !== "xs";
  const yAxis = bucket === "lg" || bucket === "md";
  const every = Math.max(
    0,
    Math.ceil(data.length / Math.max(1, Math.floor(width / 64))) - 1,
  );

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart
        data={data}
        margin={
          bucket === "xs"
            ? { top: 2, right: 2, left: 2, bottom: 2 }
            : { top: 10, right: axes ? 16 : 8, left: yAxis ? -18 : 16, bottom: 0 }
        }
      >
        {bucket !== "xs" && (
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
            tick={{ fill: ct.tick, fontSize: bucket === "sm" ? 10 : 11 }}
            interval={every}
            dy={6}
          />
        )}
        {yAxis && (
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={{ fill: ct.tick, fontSize: 11 }}
            width={40}
          />
        )}
        <Tooltip
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
        {series.map((s) => (
          <Line
            key={s.key}
            type="monotone"
            dataKey={s.key}
            stroke={s.color}
            strokeWidth={bucket === "xs" ? 2 : 2.5}
            // With several series, dots at small sizes merge into a smear.
            dot={
              bucket === "lg" && data.length <= 12
                ? { r: 3, fill: s.color, strokeWidth: 0 }
                : false
            }
            activeDot={{ r: 5 }}
            isAnimationActive={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
