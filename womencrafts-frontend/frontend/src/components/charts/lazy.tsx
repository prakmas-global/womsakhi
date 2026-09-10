"use client";

/**
 * Why the chart components are split in two.
 *
 * `recharts` is 269 KB of JavaScript, and it was landing in the *initial* load
 * of every route that imported a chart — 17 screens, and because the dashboard
 * is split across route groups the library was emitted three times over, about
 * 807 KB of first-paint JS for pixels that cannot be drawn until the browser
 * has measured a container anyway.
 *
 * So each chart is now two modules:
 *
 *   `Foo.tsx`        the shell — props, sizing, the frame, the centre label.
 *                    Cheap, and eagerly loaded, because it is what decides how
 *                    much room the chart gets.
 *   `FooCanvas.tsx`  the recharts drawing surface, pulled in by `next/dynamic`
 *                    the first time a chart actually renders.
 *
 * The seam is inside the components rather than at the 17 call sites, so every
 * screen keeps `<AreaTrend … />` exactly as it was.
 *
 * Two properties make this invisible:
 *
 * 1. **No layout shift.** The shell owns the box — a fixed height, a
 *    `ResizableBox`, or an explicit `width`/`height` for a ring — and the
 *    canvas fills it at 100%/100%. {@link ChartSkeleton} fills the same 100%,
 *    so the swap changes nothing about the geometry.
 * 2. **No theme break.** `useChartTheme` returns `var(--chart-*)` strings, not
 *    resolved colours, so the canvas reads the same CSS variables whenever it
 *    arrives and both modes resolve on their own.
 *
 * `ssr: false` is correct here and safe: all 17 pages are Client Components
 * (`ssr: false` in a Server Component is an error in this version), and the
 * charts render nothing on the server regardless — `useContainerSize` reports
 * `measuring` until the first client measurement, and `ResponsiveContainer`
 * has no size to work with until then.
 */
export function ChartSkeleton() {
  // Blank on purpose. A shimmer would be a visual change; this is exactly what
  // the frame already shows during its own first measurement.
  //
  // `data-chart-skeleton` is the hook the layout check uses: it blocks the
  // canvas chunk, records this box, then lets it load and compares against the
  // box recharts ends up with. Same numbers, or the swap moves the page.
  return <div data-chart-skeleton className="h-full w-full" aria-hidden />;
}
