"use client";

import { memo } from "react";
import dynamic from "next/dynamic";

import ChartFrame from "./ChartFrame";
import { ChartSkeleton } from "./lazy";

export type TrendDatum = { label: string; value: number };

/** The recharts half, fetched on first render. See `./lazy.tsx`. */
const AreaTrendCanvas = dynamic(() => import("./canvas").then((m) => m.AreaTrendCanvas), {
  ssr: false,
  loading: ChartSkeleton,
});

/**
 * Gradient area chart that sheds detail as its container shrinks.
 *
 *   lg / md   grid, both axes — the full reading
 *   sm        X axis only; Y labels would eat a third of a narrow card
 *   xs        a bare sparkline — shape and direction, which is all that is
 *             legible at that size anyway
 *
 * Ticks are also thinned by width, because recharts will happily render twelve
 * overlapping date labels rather than drop any. That logic lives in
 * `AreaTrendCanvas`, which is loaded lazily; this shell only sizes the box.
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
  return (
    <ChartFrame height={height} id={id} label={chartLabel} fill={fill}>
      {({ bucket, width }) => (
        <AreaTrendCanvas
          data={data}
          color={color}
          gradId={gradId}
          bucket={bucket}
          width={width}
          showAxis={showAxis}
        />
      )}
    </ChartFrame>
  );
}

export default memo(AreaTrend);
