"use client";

import { memo } from "react";
import dynamic from "next/dynamic";

import ChartFrame from "./ChartFrame";
import { ChartSkeleton } from "./lazy";

export type Series = { key: string; color: string };

/** The recharts half, fetched on first render. See `./lazy.tsx`. */
const MultiLineCanvas = dynamic(() => import("./canvas").then((m) => m.MultiLineCanvas), {
  ssr: false,
  loading: ChartSkeleton,
});

/** Interactive multi-series line chart (e.g. segment growth). */
function MultiLine({
  data,
  series,
  height = 240,
  id,
  chartLabel,
  fill = false,
}: {
  data: Record<string, number | string>[];
  series: Series[];
  height?: number;
  /** Set this to let the user drag the chart taller or shorter. */
  id?: string;
  chartLabel?: string;
  /** Fill the parent rather than claiming a fixed height. */
  fill?: boolean;
}) {
  return (
    <ChartFrame height={height} id={id} label={chartLabel} fill={fill}>
      {({ bucket, width }) => (
        <MultiLineCanvas data={data} series={series} bucket={bucket} width={width} />
      )}
    </ChartFrame>
  );
}

export default memo(MultiLine);
