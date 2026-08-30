"use client";

import { memo } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

import { useContainerSize } from "@/layout-engine";
import { useChartTheme } from "./useChartTheme";

export type DonutDatum = { name: string; value: number; color: string };

/**
 * A proportion chart that changes what it *is* as its container shrinks.
 *
 * This is the difference between responsive and merely clipped. A donut scaled
 * down to 150px is a ring of unreadable slivers with a number crushed in the
 * middle; a donut scaled to 100px is a dot. Neither communicates anything, so
 * neither is the right answer — the right answer is a different chart.
 *
 *   lg   donut + full legend with values and percentages
 *   md   donut + the centre total; the legend has no room
 *   sm   a horizontal stacked bar — still shows proportion, needs no radius
 *   xs   the dominant share as a number, because nothing else fits honestly
 *
 * Each step keeps the *question the chart answers* ("how is this split?") and
 * drops only the precision the space can no longer carry. It never crops.
 *
 * Sizing comes from the container, not the viewport: a card dragged narrow on a
 * 1920 monitor must adapt exactly as if the window had shrunk.
 */
function DonutChart({
  data,
  centerValue,
  centerLabel,
  size,
  thickness = 22,
  showTooltip = true,
  /** Renders the legend at `lg`. Off for callers that draw their own. */
  legend = false,
}: {
  data: DonutDatum[];
  centerValue: string;
  centerLabel?: string;
  /** Fixed px size. Omit to fill and adapt to whatever space there is. */
  size?: number;
  thickness?: number;
  showTooltip?: boolean;
  legend?: boolean;
}) {
  const { ref, width, height, bucket, measuring } = useContainerSize();
  const ct = useChartTheme();
  const total = data.reduce((s, d) => s + d.value, 0) || 1;

  // A caller that passes an explicit size is asking for exactly that size.
  const fixed = typeof size === "number";
  const effective = fixed ? "lg" : bucket;

  const sortedForBox = [...data].sort((a, b) => b.value - a.value);
  const willShowLegend = legend && !fixed && bucket === "lg";

  // The ring fits the SHORTER side, or a wide flat card renders a donut taller
  // than its container and the top and bottom get cut off. When a legend sits
  // beside it, the ring only gets part of the width.
  const box = fixed
    ? size!
    : Math.max(0, Math.min(willShowLegend ? width * 0.45 : width, height));
  const ringThickness = Math.max(8, Math.min(thickness, box * 0.16));
  const outer = box / 2;
  const inner = outer - ringThickness;

  const sorted = sortedForBox;
  const top = sorted[0];

  const wrap = (children: React.ReactNode, extra = "") => (
    <div
      ref={ref}
      className={`relative min-h-0 min-w-0 ${fixed ? "" : "h-full w-full"} ${extra}`}
      style={fixed ? { width: size, height: size } : undefined}
    >
      {children}
    </div>
  );

  // Nothing is drawn at a guessed size — a first paint at the wrong size is a
  // visible jump, which is exactly the flicker this whole approach avoids.
  if (measuring && !fixed) return wrap(null);

  // ── xs — no room for a shape. Give the headline instead. ──────────────────
  if (effective === "xs") {
    return wrap(
      <div className="flex h-full flex-col items-center justify-center gap-0.5 px-2 text-center">
        <span className="font-display text-2xl font-bold leading-none text-ink">{centerValue}</span>
        {centerLabel && <span className="truncate text-2xs text-ink-subtle">{centerLabel}</span>}
        {top && (
          <span className="mt-1 flex items-center gap-1 truncate text-2xs font-medium text-ink-subtle">
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ background: top.color }}
              aria-hidden
            />
            {top.name} {Math.round((top.value / total) * 100)}%
          </span>
        )}
      </div>,
    );
  }

  // ── sm — a stacked bar. Proportion without needing a radius. ──────────────
  if (effective === "sm") {
    return wrap(
      <div className="flex h-full flex-col justify-center gap-2 px-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="font-display text-lg font-bold leading-none text-ink">{centerValue}</span>
          {centerLabel && (
            <span className="truncate text-2xs text-ink-subtle">{centerLabel}</span>
          )}
        </div>
        <div
          className="flex h-3 w-full overflow-hidden rounded-full bg-[color:var(--surface-inset)]"
          role="img"
          aria-label={sorted.map((d) => `${d.name} ${Math.round((d.value / total) * 100)}%`).join(", ")}
        >
          {sorted.map((d) => (
            <span
              key={d.name}
              title={`${d.name}: ${d.value}`}
              style={{ width: `${(d.value / total) * 100}%`, background: d.color }}
            />
          ))}
        </div>
        <ul className="flex flex-wrap gap-x-3 gap-y-0.5">
          {sorted.slice(0, 3).map((d) => (
            <li key={d.name} className="flex items-center gap-1 text-2xs text-ink-subtle">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ background: d.color }}
                aria-hidden
              />
              <span className="truncate">{d.name}</span>
              <span className="tabular-nums text-ink-subtle">
                {Math.round((d.value / total) * 100)}%
              </span>
            </li>
          ))}
        </ul>
      </div>,
    );
  }

  // Explicit width AND height. `flex-1` inside an `items-center` parent
  // resolves to a height of zero, and ResponsiveContainer at height="100%" of
  // zero draws nothing at all — which is a blank card, not a small chart.
  const ring = (
    <div className="relative shrink-0" style={{ width: box, height: box }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={Math.max(0, inner - 2)}
            outerRadius={Math.max(1, outer - 2)}
            paddingAngle={2}
            startAngle={90}
            endAngle={-270}
            stroke="none"
            isAnimationActive={false}
          >
            {data.map((d) => (
              <Cell key={d.name} fill={d.color} />
            ))}
          </Pie>
          {showTooltip && (
            <Tooltip
              allowEscapeViewBox={{ x: true, y: true }}
              wrapperStyle={{ zIndex: 60, outline: "none" }}
              formatter={(value, name) => {
                const v = typeof value === "number" ? value : Number(value);
                return [
                  `${v.toLocaleString()} (${((v / total) * 100).toFixed(1)}%)`,
                  name as string,
                ];
              }}
              contentStyle={{
                borderRadius: 10,
                ...ct.tooltip,
                boxShadow: "var(--wc-shadow-overlay)",
                fontSize: 12,
                padding: "6px 10px",
                whiteSpace: "nowrap",
              }}
              itemStyle={ct.itemStyle}
              labelStyle={ct.labelStyle}
            />
          )}
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span
          className="font-display font-bold leading-none text-ink"
          // Scales with the ring so the total never outgrows the hole it sits in.
          style={{ fontSize: Math.max(14, Math.min(28, box * 0.16)) }}
        >
          {centerValue}
        </span>
        {centerLabel && box > 120 && (
          <span className="text-xs text-ink-subtle">{centerLabel}</span>
        )}
      </div>
    </div>
  );

  // ── lg — room for the legend beside the ring. ─────────────────────────────
  if (willShowLegend) {
    return wrap(
      <div className="flex h-full items-center gap-4">
        {ring}
        <ul className="min-w-0 flex-1 space-y-1.5">
          {sorted.map((d) => (
            <li key={d.name} className="flex items-center justify-between gap-2 text-sm">
              <span className="flex min-w-0 items-center gap-2 text-ink-muted">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ background: d.color }}
                  aria-hidden
                />
                <span className="truncate">{d.name}</span>
              </span>
              <span className="shrink-0 tabular-nums text-ink-subtle">
                {d.value} ({((d.value / total) * 100).toFixed(1)}%)
              </span>
            </li>
          ))}
        </ul>
      </div>,
      "items-center",
    );
  }

  // ── md — the ring alone, centred. ─────────────────────────────────────────
  return wrap(<div className="flex h-full items-center justify-center">{ring}</div>);
}

export default memo(DonutChart);
