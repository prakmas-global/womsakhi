/**
 * How to draw a rangoli on the floor — where every guide dot goes.
 *
 * Worked out from the design itself, so every one of the hundred designs gets
 * a plan without anyone writing it by hand. Each ring of repeated pieces
 * becomes "put n dots evenly round a circle R from the centre": a dot at the
 * tip of every petal or point, or where every round dot of colour sits. Discs
 * round the centre become guide circles drawn with a string, and a pulli
 * kolam's dots become a grid. Distances are in the design's own units (the
 * design is 400 across); `cmOf` turns them into centimetres for her size.
 */

import type { Design, Seg } from "./rangoli-designs";

export type Pt = { x: number; y: number };

export type GuideStep = {
  kind: "centre" | "circles" | "grid" | "ring" | "outline" | "shapes" | "join" | "colour";
  title: string;
  /** The words, for her chosen size: `cm` turns design units into "12 cm". */
  body: (cm: (u: number) => string) => string;
  tip?: string;
  /** Dots this step adds. */
  dots: Pt[];
  /** Guide circles (radii) this step draws. */
  guides: number[];
  /** The pieces this step is about, to show what the dots are for. */
  rings: string[];
};

export type Guide = { steps: GuideStep[]; totalDots: number };

/** The design's width, edge to edge, in its own units. */
export const DESIGN_WIDTH = 400;

/** Design units → centimetres for a rangoli `widthCm` across, to the half centimetre. */
export function cmOf(widthCm: number) {
  return (u: number) => {
    const v = Math.round(((u * widthCm) / DESIGN_WIDTH) * 2) / 2;
    return `${v % 1 ? v.toFixed(1) : v} cm`;
  };
}

/* ── geometry ───────────────────────────────────────────────────────────── */

type M = [number, number, number, number, number, number]; // a b c d e f

const mul = (p: M, q: M): M => [
  p[0] * q[0] + p[2] * q[1], p[1] * q[0] + p[3] * q[1],
  p[0] * q[2] + p[2] * q[3], p[1] * q[2] + p[3] * q[3],
  p[0] * q[4] + p[2] * q[5] + p[4], p[1] * q[4] + p[3] * q[5] + p[5],
];

/** The SVG transforms the designs use: rotate(a) and translate(x y). */
function matrixOf(tf?: string): M {
  let m: M = [1, 0, 0, 1, 0, 0];
  if (!tf) return m;
  for (const [, fn, args] of tf.matchAll(/(rotate|translate)\(([^)]*)\)/g)) {
    const n = args.split(/[\s,]+/).filter(Boolean).map(Number);
    if (fn === "rotate") {
      const r = (n[0] * Math.PI) / 180, c = Math.cos(r), s = Math.sin(r);
      m = mul(m, [c, s, -s, c, 0, 0]);
    } else {
      m = mul(m, [1, 0, 0, 1, n[0] || 0, n[1] || 0]);
    }
  }
  return m;
}
const apply = (m: M, p: Pt): Pt => ({ x: m[0] * p.x + m[2] * p.y + m[4], y: m[1] * p.x + m[3] * p.y + m[5] });

/** The points a path passes through (not its curve handles): M, L, H, V and C, all absolute. */
function corners(d: string): Pt[] {
  const out: Pt[] = [];
  let cur: Pt = { x: 0, y: 0 };
  for (const [, cmd, rest] of d.matchAll(/([MLHVCZ])([^MLHVCZ]*)/gi)) {
    const n = rest.trim() ? rest.trim().split(/[\s,]+/).map(Number) : [];
    const C = cmd.toUpperCase();
    if (C === "M" || C === "L") for (let i = 0; i + 1 < n.length; i += 2) { cur = { x: n[i], y: n[i + 1] }; out.push(cur); }
    else if (C === "H") for (const x of n) { cur = { x, y: cur.y }; out.push(cur); }
    else if (C === "V") for (const y of n) { cur = { x: cur.x, y }; out.push(cur); }
    else if (C === "C") for (let i = 0; i + 5 < n.length; i += 6) { cur = { x: n[i + 4], y: n[i + 5] }; out.push(cur); }
  }
  // A closed path ends where it began: count that corner once.
  const uniq: Pt[] = [];
  for (const p of out) if (!uniq.some((q) => Math.hypot(p.x - q.x, p.y - q.y) < 0.5)) uniq.push(p);
  return uniq;
}

const dist = (p: Pt) => Math.hypot(p.x, p.y);
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / (xs.length || 1);

type Piece = { seg: Seg; centre?: Pt; r?: number; pts: Pt[] };

function pieceOf(seg: Seg): Piece {
  const m = matrixOf(seg.tf);
  if (seg.circle) return { seg, centre: apply(m, { x: seg.circle.cx, y: seg.circle.cy }), r: seg.circle.r, pts: [] };
  return { seg, pts: corners(seg.d ?? "").map((p) => apply(m, p)) };
}

/** Where the dot for a piece goes: a round piece's centre, else its tip (the corner farthest out). */
const anchorOf = (p: Piece): Pt => p.centre ?? p.pts.reduce((a, b) => (dist(b) > dist(a) ? b : a), p.pts[0] ?? { x: 0, y: 0 });

/** The order round the circle, from 12 o'clock going clockwise, so the numbers read like a clock. */
const clockwise = (pts: Pt[]) => [...pts].sort((a, b) => ang(a) - ang(b));
const ang = (p: Pt) => { const a = Math.atan2(p.x, -p.y); return a < -1e-6 ? a + 2 * Math.PI : a; };

/** Help spacing n dots evenly by eye. */
function spacingTip(n: number): string | undefined {
  if (n === 12) return "Think of a clock face: one dot at every hour.";
  if (n === 6) return "Think of a clock face: dots at 12, 2, 4, 6, 8 and 10.";
  if (n === 24) return "Think of a clock face: one dot at every hour, then one halfway between each.";
  if (n === 4) return "Like a clock: at 12, 3, 6 and 9.";
  if (n === 8) return "Put four first, at 12, 3, 6 and 9 o'clock, then one halfway between each.";
  if (n === 16) return "Put four first, at 12, 3, 6 and 9 o'clock. Then halve the gaps, and halve them again.";
  if (n === 32) return "Put four at 12, 3, 6 and 9 o'clock, then keep halving the gaps until there are 32.";
  if (n === 20 || n === 10) return `Put ${n === 20 ? "four" : "two"} first, opposite each other, then step round, keeping the gaps the same.`;
  return undefined;
}

const andList = (xs: string[]) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/* ── the plan ───────────────────────────────────────────────────────────── */

export function guideFor(design: Design): Guide {
  const byRing = new Map<string, Piece[]>();
  for (const g of design.segs) {
    const list = byRing.get(g.ring) ?? [];
    list.push(pieceOf(g));
    byRing.set(g.ring, list);
  }

  const discs: number[] = [];
  type Plan = { at: number; order: number; step: GuideStep };
  const plans: Plan[] = [];
  const loose: string[] = []; // one-off shapes with no dots of their own (the diya's lamp)

  for (const [ring, pieces] of byRing) {
    const n = pieces.length;
    const round = pieces.every((p) => p.centre);
    // A disc round the centre: a guide circle, drawn with the string.
    if (round && n === 1 && dist(pieces[0].centre!) < 1) { discs.push(pieces[0].r!); continue; }

    if (n === 1 && !round) {
      const pts = pieces[0].pts, rs = pts.map(dist), R = mean(rs);
      // A shape whose corners all sit on one circle: an outline, dot to dot (the star's octagon, the kolam's square).
      if (!/C/i.test(pieces[0].seg.d ?? "") && pts.length >= 3 && pts.length <= 12 && Math.max(...rs) - Math.min(...rs) < R * 0.06) {
        const k = pts.length;
        plans.push({ at: R, order: 1, step: {
          kind: "outline", title: `Mark ${plural(k, "corner")}`, rings: [ring], guides: [R], dots: clockwise(pts),
          body: (cm) => `Put ${k} dots evenly round a circle ${cm(R)} from the centre, ${cm(2 * R * Math.sin(Math.PI / k))} apart. Join them with straight lines.`,
          tip: spacingTip(k),
        } });
      } else loose.push(ring);
      continue;
    }

    const anchors = pieces.map(anchorOf), rs = anchors.map(dist), R = mean(rs);
    const even = Math.max(...rs) - Math.min(...rs) < Math.max(4, R * 0.08) && R > 1;

    if (even) {
      const base = round ? 0 : mean(pieces.map((p) => Math.min(...p.pts.map(dist))));
      const gap = 2 * R * Math.sin(Math.PI / n);
      const what = round ? "a round dot of colour" : pieces[0].pts.length <= 4 && !/C/i.test(pieces[0].seg.d ?? "") ? "a point" : "a petal";
      plans.push({ at: R, order: 2, step: {
        kind: "ring", title: `${n} dots in a circle`, rings: [ring], guides: [R], dots: clockwise(anchors),
        body: (cm) => `Draw a light circle ${cm(R)} from the centre. Put ${n} dots on it, evenly, about ${cm(gap)} apart. ` +
          (round ? `Each dot becomes ${what}.`
                 : base < 8 ? `Each dot is the tip of ${what} that starts at the centre.`
                            : `Each dot is the tip of ${what} that starts ${cm(base)} from the centre.`),
        tip: spacingTip(n),
      } });
      continue;
    }

    if (round && n >= 4) {
      // Dots that are not on one circle: a pulli kolam's grid.
      const pts = anchors;
      let s = Infinity;
      for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) s = Math.min(s, Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y));
      const side = Math.round(Math.sqrt(n));
      const square = side * side === n;
      // Turned on its corner when its nearest neighbours are not straight across or down.
      const a = pts[0], gapTo = (p: Pt) => Math.hypot(p.x - a.x, p.y - a.y);
      const b = pts.slice(1).reduce((best, p) => (gapTo(p) < gapTo(best) ? p : best));
      const diamond = Math.abs(a.x - b.x) > 1 && Math.abs(a.y - b.y) > 1;
      const rows = [...pts].sort((p, q) => (Math.round(p.y) - Math.round(q.y)) || (p.x - q.x));
      plans.push({ at: 0, order: 0, step: {
        kind: "grid", title: square ? `${side} rows of ${side} dots` : `${n} dots in a grid`, rings: [ring], guides: [], dots: rows,
        body: (cm) => square
          ? `Put ${n} dots in a square: ${side} rows of ${side}, every dot ${cm(s)} from the next.${diamond ? " Turn the square on its corner, so it stands like a diamond." : ""}`
          : `Put ${n} dots in a grid, ${cm(s)} apart, as shown.`,
        tip: "Mark the middle row first, then the rows either side, so the grid stays straight.",
      } });
      continue;
    }

    // Round dots of colour set here and there (the diya's beads).
    if (round) {
      plans.push({ at: R, order: 3, step: {
        kind: "shapes", title: `${n} dots of colour`, rings: [ring], guides: [], dots: [],
        body: () => `Put ${n} round dots of colour where they are shown.`,
      } });
    }
    // Other pieces between the dots (the kolam's loops) are drawn when she joins the dots.
  }

  const steps: GuideStep[] = [];
  const grid = plans.some((p) => p.step.kind === "grid");
  steps.push({
    kind: "centre", title: "Find the middle", rings: [], guides: [], dots: grid ? [] : [{ x: 0, y: 0 }],
    body: (cm) => `Clear a flat spot about ${cm(DESIGN_WIDTH)} across. ${grid ? "Mark its middle lightly" : "Put one dot right in the middle"}. Every other dot is measured from here.`,
    tip: "Chalk is easy to rub out. Use it for the dots, and keep the colour for last.",
  });
  if (discs.length) {
    const rs = [...new Set(discs.map((r) => Math.round(r)))].sort((a, b) => a - b);
    steps.push({
      kind: "circles", title: `${plural(rs.length, "guide circle")}`, rings: [...byRing.keys()].filter((k) => { const p = byRing.get(k)!; return p.length === 1 && p[0].centre && dist(p[0].centre) < 1; }),
      guides: rs, dots: [],
      body: (cm) => `Tie chalk to a piece of string. Hold the other end on the middle dot and draw ${rs.length === 1 ? "a circle" : `${rs.length} circles`}: ${andList(rs.map(cm))} from the middle.`,
      tip: "Keep the string tight and walk round slowly, the chalk upright.",
    });
  }
  // The grid first; then rings and outlines from the middle outwards; then shapes set between them.
  const band = (p: Plan) => (p.order === 0 ? 0 : p.order === 3 ? 2 : 1);
  plans.sort((a, b) => band(a) - band(b) || a.at - b.at);
  for (const p of plans) steps.push(p.step);
  if (loose.length) {
    steps.push({
      kind: "shapes", title: "The picture in the middle", rings: loose, guides: [], dots: [],
      body: () => `Draw the ${plural(loose.length, "shape")} in the middle by hand, as shown. Use the dots and circles around them to keep it in place.`,
    });
  }
  steps.push({
    kind: "join", title: "Join the dots", rings: [...byRing.keys()], guides: [], dots: [],
    body: () => grid
      ? "Now draw the loops and lines round the dots, as shown. Start in the middle and work outwards."
      : "Now draw the shapes. Start in the middle and work outwards: every petal or point reaches out to its dot.",
    tip: "Rub out a wobbly line with a dry cloth and draw it again.",
  });
  steps.push({
    kind: "colour", title: "Fill in the colour", rings: [...byRing.keys()], guides: [], dots: [],
    body: () => "Fill one ring at a time, from the middle outwards, so your hand never rests on colour you have just put down.",
    tip: "Try your colours here in the app first.",
  });

  return { steps, totalDots: steps.reduce((a, s) => a + s.dots.length, 0) };
}
