"use client";

import { memo } from "react";

import type { Design, Seg } from "./rangoli-designs";
import type { Fills } from "./rangoli-store";
import s from "./games.module.css";

export const BLANK = "#ffffff";
export const LINE = "#d9c5cf";
export const PAPER = "#fffaf3";

/** Pieces she has coloured in this design. */
export const countOf = (d: Design, f: Fills = {}) => d.segs.filter((g) => f[g.id] && f[g.id] !== BLANK).length;

function Piece({ g, fill, onTap, width }: { g: Seg; fill: string; onTap?: (g: Seg) => void; width: number }) {
  const common = {
    className: onTap ? s.seg : undefined, fill, stroke: LINE, strokeWidth: width, transform: g.tf,
    onClick: onTap ? () => onTap(g) : undefined,
  };
  return g.circle ? <circle cx={g.circle.cx} cy={g.circle.cy} r={g.circle.r} {...common} /> : <path d={g.d} {...common} />;
}

/**
 * A rangoli drawn as SVG. With `onTap` it is the colouring page (every piece
 * a tap target); without, a thumbnail (thicker lines so they show when small).
 */
export const RangoliArt = memo(function RangoliArt({ design, fills, onTap, className, label }: {
  design: Design; fills: Fills; onTap?: (g: Seg) => void; className?: string; label?: string;
}) {
  const width = onTap ? 1.5 : 3;
  return (
    <svg viewBox="-210 -210 420 420" className={className} role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <rect x="-210" y="-210" width="420" height="420" rx={onTap ? 24 : 0} fill={PAPER} />
      {design.segs.map((g) => <Piece key={g.id} g={g} fill={fills[g.id] ?? BLANK} onTap={onTap} width={width} />)}
    </svg>
  );
});
