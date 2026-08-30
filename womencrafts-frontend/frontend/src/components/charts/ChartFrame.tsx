"use client";

import { usePathname } from "next/navigation";

import { ResizableBox, useContainerSize, type SizeBucket } from "@/layout-engine";

/**
 * Gives a chart its height, and tells it how much room it actually has.
 *
 * Two jobs, both about the same thing: a chart should never be cropped, and it
 * should never render detail the space cannot carry.
 *
 * 1. **Height** — fixed, or user-adjustable when given an `id`.
 * 2. **Measurement** — the render prop receives the live size bucket, so the
 *    chart can drop its axes, its grid, or its labels before they collide.
 *
 * It sits inside the chart components rather than around them, so a screen opts
 * a chart in by adding `id="growth"` and nothing else. Seventeen screens use
 * these charts; wrapping each at the call site would be seventeen chances to
 * forget and seventeen slightly different ids.
 */

/**
 * A stable key for the current screen.
 *
 * Record ids are stripped, so resizing a chart on one member's page resizes it
 * on every member's page. Without that a saved height would apply to exactly
 * one record and look broken everywhere else.
 */
function screenKey(pathname: string): string {
  const parts = pathname
    .split("/")
    .filter(Boolean)
    .filter((segment) => {
      if (/^[0-9a-f]{24}$/i.test(segment)) return false; // Mongo ObjectId
      if (/^\d+$/.test(segment)) return false; // numeric id
      if (/^WC-\d+$/i.test(segment)) return false; // member code
      return true;
    });
  // Dots would be read as nested paths by the Mongo `$set` that stores this.
  return parts.join("-").replace(/\./g, "-") || "root";
}

export default function ChartFrame({
  id,
  height,
  label,
  fill = false,
  children,
}: {
  /** Unique within its screen. Omit to keep the chart a fixed height. */
  id?: string;
  height: number;
  label?: string;
  /**
   * Fill the parent instead of claiming a fixed height.
   *
   * Set this whenever the chart sits inside something the user can resize — a
   * dashboard card, a split pane. A fixed-height chart in a card the user has
   * dragged shorter does not shrink; it overflows, and the overflow paints on
   * top of whatever is below. That is the difference between a card that adapts
   * and a card that spills onto its neighbours.
   *
   * The container owns the height in this mode, so the drag handle goes with it.
   */
  fill?: boolean;
  /** Receives the measured bucket so the chart can shed detail as it shrinks. */
  children: (size: { bucket: SizeBucket; width: number; height: number }) => React.ReactNode;
}) {
  const pathname = usePathname();
  const { ref, width, height: measured, bucket, measuring } = useContainerSize();

  const inner = (
    // `min-h-0` matters: without it a flex child refuses to shrink below its
    // content, so the chart pushes the card open instead of adapting to it.
    <div ref={ref} className="h-full min-h-0 w-full min-w-0">
      {measuring ? null : children({ bucket, width, height: measured })}
    </div>
  );

  // The parent decides the height; the chart just fills it.
  if (fill) return <div className="h-full min-h-0 w-full">{inner}</div>;

  if (!id) return <div style={{ height }}>{inner}</div>;

  return (
    <ResizableBox screen={screenKey(pathname)} id={id} defaultHeight={height} label={label}>
      {inner}
    </ResizableBox>
  );
}
