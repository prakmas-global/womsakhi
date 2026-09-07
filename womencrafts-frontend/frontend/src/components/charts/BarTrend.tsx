"use client";

import { memo } from "react";
import dynamic from "next/dynamic";

import ChartFrame from "./ChartFrame";
import { ChartSkeleton } from "./lazy";

export type BarDatum = { label: string; value: number; color?: string };

/** The recharts half, fetched on first render. See `./lazy.tsx`. */
const BarTrendCanvas = dynamic(() => import("./canvas").then((m) => m.BarTrendCanvas), {
  ssr: false,
  loading: ChartSkeleton,
});

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
  return (
    <ChartFrame height={height} id={id} label={chartLabel} fill={fill}>
      {({ bucket, width }) => (
        <BarTrendCanvas
          data={data}
          color={color}
          bucket={bucket}
          width={width}
          showLabels={showLabels}
          radius={radius}
        />
      )}
    </ChartFrame>
  );
}

export default memo(BarTrend);
