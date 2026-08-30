"use client";

/**
 * Neutral chart furniture — grid, ticks, tooltip.
 *
 * Reads the `--chart-*` tokens the theme engine already derives, rather than
 * branching on light/dark and returning hardcoded hex. Those hex values were
 * the last place in the app where a colour ignored the theme: chart gridlines
 * and tooltips stayed indigo-grey under every palette, which is exactly the
 * "only the buttons changed" effect the token work removes.
 *
 * No `useIsDark()` either. The tokens resolve per mode on their own, so this
 * needs no React state — which also means charts no longer re-render when the
 * mode flips; the CSS variable simply resolves to a different value.
 */
export function useChartTheme() {
  const text = "var(--chart-tt-text)";

  return {
    grid: "var(--chart-grid)",
    tick: "var(--chart-tick)",
    track: "var(--color-surface-inset)",
    // Spread into <Tooltip contentStyle> — styles the whole tooltip box.
    tooltip: {
      backgroundColor: "var(--chart-tt-bg)",
      border: "1px solid var(--chart-tt-border)",
      color: text,
      fontWeight: 600,
    },
    // Per-series value rows inside the tooltip.
    itemStyle: { color: text, fontWeight: 600 },
    // The tooltip heading (x-axis label / category).
    labelStyle: { color: text, fontWeight: 700 },
  };
}
