"use client";

import { memo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  ResponsiveContainer,
  LabelList,
} from "recharts";
import { useChartTheme } from "./useChartTheme";
import ChartFrame from "./ChartFrame";

export type BarDatum = { label: string; value: number; color?: string };

/** Interactive vertical bar chart with hover + optional value labels. */
function BarTrend({
  data,
  color = "var(--color-violet-500)",
  height = 240,
  id,
  chartLabel,
  fill = false,
  showLabels = false,
  radius = 6,
}: {
  data: BarDatum[];
  color?: string;
  height?: number;
  /** Set this to let the user drag the chart taller or shorter. */
  id?: string;
  chartLabel?: string;
  /** Fill the parent rather than claiming a fixed height. */
  fill?: boolean;
  showLabels?: boolean;
  radius?: number;
}) {
  const ct = useChartTheme();
  return (
    <ChartFrame height={height} id={id} label={chartLabel} fill={fill}>
      {({ bucket, width }) => {
        const axes = bucket !== "xs";
        const yAxis = bucket === "lg" || bucket === "md";
        // Value labels on top of every bar collide long before the bars do.
        const labels =
          showLabels &&
          bucket !== "xs" &&
          width / Math.max(1, data.length) > 44;
        const every = Math.max(
          0,
          Math.ceil(data.length / Math.max(1, Math.floor(width / 56))) - 1,
        );

        return (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              margin={
                bucket === "xs"
                  ? { top: 2, right: 2, left: 2, bottom: 2 }
                  : {
                      top: labels ? 18 : 8,
                      right: 8,
                      left: yAxis ? -18 : 0,
                      bottom: 0,
                    }
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
                cursor={{ fill: "color-mix(in srgb, var(--color-brand-600) 8%, transparent)" }}
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
              <Bar
                dataKey="value"
                radius={[radius, radius, 0, 0]}
                maxBarSize={44}
                isAnimationActive={false}
              >
                {labels && (
                  <LabelList
                    dataKey="value"
                    position="top"
                    fill="var(--color-ink-muted)"
                    fontSize={11}
                    fontWeight={600}
                  />
                )}
                {data.map((d, i) => (
                  <Cell key={i} fill={d.color ?? color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        );
      }}
    </ChartFrame>
  );
}

export default memo(BarTrend);
