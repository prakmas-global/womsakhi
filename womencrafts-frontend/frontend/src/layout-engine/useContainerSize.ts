"use client";

import type { RefCallback } from "react";

import { useResizeObserver } from "use-resize-observer";

/**
 * How big a component actually is — not how big the window is.
 *
 * This is the difference between a layout that survives being resized and one
 * that just gets cropped. A media query asks "how wide is the browser?", which
 * is the wrong question for a card the user has dragged down to a quarter of a
 * row: the window is still 1920 and the chart inside still renders at full
 * size, so it spills out and gets clipped.
 *
 * A container query asks "how wide am I?", which is the question that matters.
 *
 * ── CSS or JavaScript ───────────────────────────────────────────────────────
 * Both, for different jobs.
 *
 * Tailwind v4 ships container queries in core, so `@container` plus `@sm:`,
 * `@md:` handles everything CSS can express — padding, type scale, hiding a
 * legend. Use that first; it costs nothing and never flashes.
 *
 * This hook is for what CSS cannot do: **changing what is rendered.** A donut
 * chart at 180px wide should not be a smaller donut, it should be a stacked
 * bar. At 120px it should be a number. Deciding that needs the measurement in
 * JavaScript.
 *
 * Built on `use-resize-observer` rather than a hand-rolled ResizeObserver: it
 * batches through requestAnimationFrame, which is what stops the browser
 * throwing "ResizeObserver loop completed with undelivered notifications" when
 * a measured element's own resize changes its size again.
 */

export type SizeBucket = "xs" | "sm" | "md" | "lg";

/**
 * Thresholds in pixels, chosen from what the content needs rather than from
 * device sizes — these describe a card, not a screen.
 *
 *   lg  a chart with axes, plus a legend beside it
 *   md  a chart with axes; the legend has to go
 *   sm  no room for axes — the shape is still readable
 *   xs  no room for a shape at all; show the number
 */
export const BUCKET_WIDTH: Record<Exclude<SizeBucket, "xs">, number> = {
  lg: 460,
  md: 300,
  sm: 200,
};

/** Below this, height is the binding constraint however wide the card is. */
export const SHORT_HEIGHT = 170;

/**
 * Below this, nothing with structure fits — not even a labelled strip.
 *
 * Width alone is not enough to decide. A 400×70 box is wide, but it cannot hold
 * a bar plus its legend rows; without this floor it would try, and the labels
 * would spill out the bottom. Which is the cropping this is all here to stop.
 */
export const TINY_HEIGHT = 110;

export function bucketFor(width: number, height: number): SizeBucket {
  if (height > 0 && height < TINY_HEIGHT) return "xs";
  if (width >= BUCKET_WIDTH.lg && height >= 240) return "lg";
  if (width >= BUCKET_WIDTH.md && height >= SHORT_HEIGHT) return "md";
  if (width >= BUCKET_WIDTH.sm) return "sm";
  return "xs";
}

export interface ContainerSize {
  ref: RefCallback<HTMLElement>;
  width: number;
  height: number;
  bucket: SizeBucket;
  /** True until the first measurement, so nothing renders at a guessed size. */
  measuring: boolean;
}

export function useContainerSize(): ContainerSize {
  const { ref, width = 0, height = 0 } = useResizeObserver<HTMLElement>();

  return {
    ref,
    width,
    height,
    bucket: bucketFor(width, height),
    measuring: width === 0 && height === 0,
  };
}
