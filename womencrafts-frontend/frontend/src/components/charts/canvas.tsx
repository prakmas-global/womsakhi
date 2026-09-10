"use client";

/**
 * The single lazy entry point for everything that touches `recharts`.
 *
 * Every chart shell imports its drawing surface *through this module*, and that
 * indirection is the whole point. Pointing five `next/dynamic` calls at five
 * different files gives the bundler five independent async entry points, and
 * each one is self-contained: measured on a production build, that emitted
 * **five** copies of the 269 KB recharts core (1,378 KB) instead of the three
 * the eager version had. Recharts was off the initial load, and the app had
 * grown by 1.8 MB.
 *
 * One entry point is one async chunk group, so the library is emitted once per
 * route group and shared by all five charts. A screen that draws only a donut
 * also downloads the line-chart wrapper — a couple of KB — because recharts
 * itself is bundled whole regardless of which chart types are used.
 *
 * The `*Canvas` files stay separate so each chart's drawing code still lives
 * next to the shell that sizes it; this module only decides where the seam is.
 */

export { default as AreaTrendCanvas } from "./AreaTrendCanvas";
export { default as BarTrendCanvas } from "./BarTrendCanvas";
export { default as DonutRing } from "./DonutRing";
export { default as MultiLineCanvas } from "./MultiLineCanvas";
export { default as RadialGaugeCanvas } from "./RadialGaugeCanvas";
