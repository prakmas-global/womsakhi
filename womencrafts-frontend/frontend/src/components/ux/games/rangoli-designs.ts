/**
 * The rangoli designs she can colour, all drawn in code.
 *
 * Every design sits in the same 420 × 420 box centred on 0,0 and is a list of
 * pieces drawn back to front. A piece is a path or a circle with an optional
 * SVG transform, and belongs to a `ring`: the pieces that repeat round the
 * design, so "Colour the whole ring" can fill a ring in one tap.
 *
 * Piece ids are what her colouring is saved under, so never rename them in a
 * shipped design. The first design keeps the exact ids of the original game.
 */

export type Seg = {
  id: string;
  ring: string;
  d?: string;
  circle?: { cx: number; cy: number; r: number };
  tf?: string;
};

export type Design = {
  id: string;
  name: string;
  /** One line about it, shown under the name. */
  note: string;
  segs: Seg[];
};

const r1 = (n: number) => Math.round(n * 10) / 10;
const rad = (deg: number) => (deg * Math.PI) / 180;
const at = (r: number, deg: number): [number, number] => [r1(r * Math.cos(rad(deg))), r1(r * Math.sin(rad(deg)))];

/** A petal pointing right, from radius a to b, w wide. */
export function petal(a: number, b: number, w: number) {
  const p = a + (b - a) * 0.3, q = a + (b - a) * 0.82;
  return `M ${a} 0 C ${p} ${w}, ${q} ${w * 0.9}, ${b} 0 C ${q} ${-w * 0.9}, ${p} ${-w}, ${a} 0 Z`;
}

/** A diamond pointing right, from a to b, w half-wide. */
const diamond = (a: number, b: number, w: number) => `M ${a} 0 L ${r1((a + b) / 2)} ${w} L ${b} 0 L ${r1((a + b) / 2)} ${-w} Z`;

const poly = (pts: [number, number][]) => `M ${pts.map((p) => p.join(" ")).join(" L ")} Z`;

/** n copies of one shape, turned evenly round the centre. */
function around(out: Seg[], ring: string, n: number, d: string, offset = 0) {
  for (let k = 0; k < n; k++) out.push({ id: `${ring}${k}`, ring, d, tf: `rotate(${r1(offset + (k * 360) / n)})` });
}

/** n dots on a circle of radius `dist`. */
function dots(out: Seg[], ring: string, n: number, dist: number, r: number, offset = 0) {
  for (let k = 0; k < n; k++) {
    const [cx, cy] = at(dist, offset + (k * 360) / n);
    out.push({ id: `${ring}${k}`, ring, circle: { cx, cy, r } });
  }
}

const disc = (id: string, r: number): Seg => ({ id, ring: id, circle: { cx: 0, cy: 0, r } });

/* ── the designs ─────────────────────────────────────────────────────── */

/** The original doorstep rangoli: eight-fold petals, 58 pieces. */
function marigold(): Seg[] {
  const out: Seg[] = [disc("band", 160)];
  around(out, "d", 8, petal(125, 192, 40), 22.5);
  around(out, "b", 8, petal(48, 124, 30), 22.5);
  around(out, "c", 16, petal(118, 152, 13));
  around(out, "a", 8, petal(22, 88, 26));
  dots(out, "e", 16, 172, 7, 11.25);
  out.push(disc("core", 22));
  return out;
}

/** A twenty-petal sunflower with a seeded centre. Few, big pieces. */
function sunflower(): Seg[] {
  const out: Seg[] = [];
  around(out, "o", 20, petal(66, 186, 24));
  around(out, "i", 20, petal(60, 146, 19), 9);
  out.push(disc("core", 70));
  dots(out, "s", 12, 50, 10);
  dots(out, "t", 6, 26, 9, 30);
  out.push(disc("c", 11));
  return out;
}

/** A lotus opening: wide outer petals, then narrower ones, layer on layer. */
function lotus(): Seg[] {
  const out: Seg[] = [disc("band", 166)];
  around(out, "o", 12, petal(86, 196, 44));
  dots(out, "e", 12, 180, 7, 15);
  around(out, "m", 12, petal(58, 150, 32), 15);
  around(out, "i", 8, petal(30, 106, 28));
  around(out, "t", 8, petal(30, 74, 13), 22.5);
  out.push(disc("core", 30), disc("core2", 13));
  return out;
}

/** A Diwali diya in the middle, with its flame, rays and a frame of petals. */
function diya(): Seg[] {
  const out: Seg[] = [disc("band", 150)];
  around(out, "f", 16, petal(148, 198, 20));
  out.push(disc("disc", 122));
  dots(out, "e", 16, 136, 6, 11.25);
  around(out, "r", 12, petal(74, 118, 11), 15);
  out.push(
    { id: "base", ring: "base", d: "M -32 76 L -46 98 L 46 98 L 32 76 Z" },
    { id: "bowl", ring: "bowl", d: "M -84 14 C -76 66, -40 84, 0 84 C 40 84, 76 66, 84 14 Z" },
    { id: "rim", ring: "rim", d: "M -90 14 C -50 -6, 50 -6, 90 14 C 50 30, -50 30, -90 14 Z" },
  );
  for (const [k, x, y] of [[0, -44, 46], [1, 0, 58], [2, 44, 46]] as const) {
    out.push({ id: `bd${k}`, ring: "bd", circle: { cx: x, cy: y, r: 8 } });
  }
  out.push(
    { id: "flame", ring: "flame", d: "M 0 -96 C 24 -62, 28 -30, 0 -4 C -28 -30, -24 -62, 0 -96 Z" },
    { id: "flame2", ring: "flame2", d: "M 0 -64 C 11 -46, 13 -30, 0 -16 C -13 -30, -11 -46, 0 -64 Z" },
  );
  return out;
}

/** An eight-pointed kolam star: two squares crossed, an octagon inside. */
function star(): Seg[] {
  const out: Seg[] = [disc("band", 192)];
  const tip = 184, notch = 140.7;
  for (let k = 0; k < 8; k++) {
    out.push({ id: `p${k}`, ring: "p", d: poly([at(notch, k * 45 - 22.5), at(tip, k * 45), at(notch, k * 45 + 22.5)]) });
  }
  dots(out, "e", 8, 166, 12, 22.5);
  out.push({ id: "oct", ring: "oct", d: poly(Array.from({ length: 8 }, (_, k) => at(notch, 22.5 + k * 45))) });
  around(out, "b", 8, petal(36, 126, 22), 22.5);
  around(out, "dm", 8, diamond(60, 124, 13));
  out.push(disc("ring", 36), disc("core", 14));
  return out;
}

/** Eight mango (paisley) motifs round a small flower. */
function paisley(): Seg[] {
  const out: Seg[] = [disc("band", 184)];
  around(out, "c", 24, petal(158, 196, 9), 7.5);
  // A mango: a round end at the origin, tapering to a tip that bends to one side.
  const mango = "M 0 30 C -26 30, -34 6, -26 -14 C -18 -34, 4 -46, 30 -60 C 24 -42, 30 -24, 26 -4 C 22 18, 14 30, 0 30 Z";
  for (let k = 0; k < 8; k++) {
    const tf = `rotate(${k * 45}) translate(118 0) rotate(-20)`;
    out.push({ id: `m${k}`, ring: "m", d: mango, tf });
    out.push({ id: `mi${k}`, ring: "mi", circle: { cx: -2, cy: 8, r: 11 }, tf });
  }
  dots(out, "e", 8, 82, 8, 22.5);
  around(out, "a", 8, petal(20, 66, 20));
  out.push(disc("core", 20));
  return out;
}

/** A pulli kolam: a grid of dots joined by loops, set as a diamond. */
function kolam(): Seg[] {
  const out: Seg[] = [{ id: "bg", ring: "bg", d: "M -140 -140 H 140 V 140 H -140 Z", tf: "rotate(45)" }];
  const g = 60, lens = petal(-21, 21, 12);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
    out.push({ id: `cell${i}-${j}`, ring: "cell", d: diamond(-15, 15, 15), tf: `rotate(45) translate(${(i - 1.5) * g} ${(j - 1.5) * g}) rotate(45)` });
  }
  for (let i = 0; i < 4; i++) for (let j = 0; j < 5; j++) {
    out.push({ id: `lh${i}-${j}`, ring: "lh", d: lens, tf: `rotate(45) translate(${(i - 1.5) * g} ${(j - 2) * g})` });
    out.push({ id: `lv${i}-${j}`, ring: "lv", d: lens, tf: `rotate(45) translate(${(j - 2) * g} ${(i - 1.5) * g}) rotate(90)` });
  }
  for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) {
    out.push({ id: `pd${i}-${j}`, ring: "pd", circle: { cx: (i - 2) * g, cy: (j - 2) * g, r: 9 }, tf: "rotate(45)" });
  }
  return out;
}

/** A simple six-petal flower: a short, easy break. */
function bloom(): Seg[] {
  const out: Seg[] = [];
  around(out, "t", 6, petal(150, 192, 16));
  dots(out, "e", 6, 168, 13, 30);
  around(out, "p", 6, petal(30, 152, 58));
  around(out, "q", 6, petal(30, 112, 28), 30);
  out.push(disc("core", 34), disc("core2", 14));
  return out;
}

export const DESIGNS: Design[] = [
  { id: "classic", name: "Marigold", note: "The doorstep classic", segs: marigold() },
  { id: "bloom", name: "Simple bloom", note: "A short, easy break", segs: bloom() },
  { id: "sunflower", name: "Sunflower", note: "Big petals, sunny centre", segs: sunflower() },
  { id: "lotus", name: "Lotus", note: "Layer on layer of petals", segs: lotus() },
  { id: "diya", name: "Diwali diya", note: "A lamp, a flame, a glow", segs: diya() },
  { id: "star", name: "Kolam star", note: "Two squares, eight points", segs: star() },
  { id: "paisley", name: "Mango paisley", note: "Eight mangoes in a ring", segs: paisley() },
  { id: "kolam", name: "Pulli kolam", note: "Dots and loops, for slow hands", segs: kolam() },
];

/** Easy, calm or detailed, from how many pieces it has. */
export const levelOf = (d: Design) => (d.segs.length <= 30 ? "Easy" : d.segs.length <= 60 ? "Calm" : "Detailed");

/** One piece as SVG text, for saving a picture. */
export function segMarkup(g: Seg, fill: string, line: string, width = 1.5) {
  const tf = g.tf ? ` transform="${g.tf}"` : "";
  return g.circle
    ? `<circle cx="${g.circle.cx}" cy="${g.circle.cy}" r="${g.circle.r}"${tf} fill="${fill}" stroke="${line}" stroke-width="${width}"/>`
    : `<path d="${g.d}"${tf} fill="${fill}" stroke="${line}" stroke-width="${width}"/>`;
}

/* ── designs made in the app ─────────────────────────────────────────────
 *
 * A generated design is rebuilt from its seed, so its id (`g` + the seed in
 * base 36) is all that is stored or linked: the same id always draws the same
 * rangoli, on any phone. Each one is rings of one motif with n-fold symmetry,
 * every ring in its own band with a gap around it, so no two pieces overlap
 * except a backdrop disc drawn behind them — every piece is a clear region to
 * tap. Never change what a seed draws once shipped: colouring is saved by
 * piece id.
 */

/** Seeds stay under 36^6, so an id is at most "g" + six characters. */
const SEED_SPACE = 2176782336;

/** A small seeded random number generator (mulberry32). */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A drop: a point at a, a round end at b. */
const drop = (a: number, b: number, w: number) => {
  const m = r1(a + (b - a) * 0.55);
  return `M ${a} 0 C ${m} ${r1(w * 0.45)}, ${b} ${w}, ${b} 0 C ${b} ${-w}, ${m} ${r1(-w * 0.45)}, ${a} 0 Z`;
};

const FIRST = ["Champa", "Jasmine", "Lotus", "Marigold", "Peacock", "Mango", "Tulsi", "Kumkum", "Pongal", "Onam", "Utsav", "Shanti", "Chandni", "Kesar", "Mehendi", "Gulab", "Diya", "Kamal"];
const SECOND = ["wheel", "bloom", "mandala", "star", "garden", "circle", "sun", "glow", "chakra", "festival"];
type Motif = "petal" | "diamond" | "drop" | "dots" | "eye";
const MOTIFS: Motif[] = ["petal", "petal", "diamond", "drop", "dots", "eye"];

export function generate(seed: number): Design {
  const R = rng(seed);
  const pick = <T,>(xs: T[]) => xs[Math.floor(R() * xs.length)];
  const n = pick([6, 8, 8, 10, 12, 12, 16]);
  const layers = 2 + Math.floor(R() * 3);          // two rings make the easy ones
  const border = R() < 0.55;
  const core = r1(16 + R() * 10);
  const gap = 3;
  const weights = Array.from({ length: layers }, () => 0.7 + R() * 0.6);
  const room = (border ? 182 : 196) - core - gap * layers;
  const sum = weights.reduce((x, y) => x + y, 0);

  const bands: { a: number; b: number }[] = [];
  let r = core;
  for (const w of weights) {
    const a = r + gap, b = a + (room * w) / sum;
    bands.push({ a: r1(a), b: r1(b) });
    r = b;
  }

  const out: Seg[] = [];
  // Backdrop discs behind the rings, biggest first, so each shows as a band of its own
  // and the motifs sit on something: that is what makes it read as one rangoli.
  const backs = bands.map((bd, i) => ({ i, r: r1(bd.b - (bd.b - bd.a) * 0.25) })).filter(() => R() < 0.6);
  if (!backs.length) backs.push({ i: layers - 2, r: r1(bands[layers - 2].b - (bands[layers - 2].b - bands[layers - 2].a) * 0.25) });
  for (const bk of [...backs].reverse()) out.push({ id: `bd${bk.i}`, ring: `bd${bk.i}`, circle: { cx: 0, cy: 0, r: bk.r } });

  bands.forEach(({ a, b }, i) => {
    const t = b - a, mid = (a + b) / 2;
    const last = i === layers - 1;
    // the outer ring is always petals or drops, for a scalloped edge; the first never dots
    let kind = last ? pick<Motif>(["petal", "drop", "eye"]) : pick(MOTIFS);
    if (i === 0 && kind === "dots") kind = "petal";
    const count = n <= 8 && mid > 90 && R() < 0.5 ? n * 2 : n;
    const s = (2 * Math.PI * mid) / count;            // room per motif along the ring
    const offset = i % 2 ? 180 / count : 0;
    const ring = `L${i}`;
    if (kind === "dots") {
      dots(out, ring, count, r1(mid), r1(Math.max(6, Math.min(t * 0.42, s * 0.4))), offset);
      return;
    }
    const d = kind === "diamond" ? diamond(a, b, r1(Math.min(s * 0.48, t * 0.4)))
      : kind === "drop" ? drop(a, b, r1(Math.min(s * 0.45, t * 0.45)))
      : petal(a, b, r1(Math.min(s * 0.62, t * 0.55)));
    around(out, ring, count, d, offset);
    if (kind === "eye") {
      // a dot inside each petal, at its widest
      const at = a + t * 0.56, rr = Math.max(4, Math.min(t * 0.14, s * 0.16));
      dots(out, `${ring}x`, count, r1(at), r1(rr), offset);
    }
  });
  out.push(disc("core", core));
  if (R() < 0.5) out.push(disc("core2", r1(core * 0.45)));
  if (border) dots(out, "rim", n * 2, 190, 5, 90 / n);

  return {
    id: `g${seed.toString(36)}`,
    name: `${pick(FIRST)} ${pick(SECOND)}`,
    note: `${n}-fold · made in the app`,
    segs: out,
  };
}

/** The i-th design in the app's own endless list — the same on every phone. */
export const seedAt = (i: number) => (Math.imul(i + 1, 2654435761) >>> 0) % SEED_SPACE;
/** A fresh seed for "Make a new design". */
export const randomSeed = () => Math.floor(Math.random() * SEED_SPACE);

const made = new Map<string, Design>();
/** Any design by id: a hand-made one, or a generated one rebuilt from its seed. */
export function designOf(id: string): Design | null {
  const fixed = DESIGNS.find((d) => d.id === id);
  if (fixed) return fixed;
  if (!/^g[0-9a-z]{1,6}$/.test(id)) return null;
  const seed = parseInt(id.slice(1), 36);
  if (!Number.isFinite(seed) || seed >= SEED_SPACE) return null;
  let d = made.get(id);
  if (!d) { d = generate(seed); made.set(id, d); }
  return d;
}
