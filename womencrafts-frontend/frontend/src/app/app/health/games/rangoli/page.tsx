"use client";

import { useEffect, useState } from "react";

import * as Icons from "@/components/ux/icons";
import { Btn, Card } from "@/components/ux/kit";
import { GameFrame } from "@/components/ux/games/GameFrame";
import s from "@/components/ux/games/games.module.css";

/**
 * Colour the rangoli — tap a petal, it fills with the colour she picked.
 *
 * The pattern is drawn in code: rings of petals with eight-fold symmetry, the
 * shape of a doorstep rangoli. 58 pieces, each one tap. Her colouring is kept
 * on this phone so she can come back to it, and "Save picture" turns it into
 * a PNG she can keep or share.
 */
const PALETTE = [
  { name: "Marigold", hex: "#F6A21E" },
  { name: "Vermillion", hex: "#E2453C" },
  { name: "Rani pink", hex: "#D6246E" },
  { name: "Turmeric", hex: "#F2CF3A" },
  { name: "Peacock", hex: "#0E7C86" },
  { name: "Turquoise", hex: "#2BB3A3" },
  { name: "Leaf", hex: "#59A845" },
  { name: "Indigo", hex: "#3D4DB7" },
];
const BLANK = "#ffffff";
const LINE = "#d9c5cf";
const KEY = "womsakhi.rangoli.v1";

type Seg = { id: string; d?: string; circle?: { cx: number; cy: number; r: number }; rot?: number };

/** A petal pointing right, from radius r1 to r2, w wide; rotated into place. */
function petal(r1: number, r2: number, w: number) {
  const a = r1 + (r2 - r1) * 0.3, b = r1 + (r2 - r1) * 0.82;
  return `M ${r1} 0 C ${a} ${w}, ${b} ${w * 0.9}, ${r2} 0 C ${b} ${-w * 0.9}, ${a} ${-w}, ${r1} 0 Z`;
}

/** Drawn back to front: the band, the big outer petals, then inward. */
const SEGMENTS: Seg[] = (() => {
  const out: Seg[] = [{ id: "band", circle: { cx: 0, cy: 0, r: 160 } }];
  for (let k = 0; k < 8; k++) out.push({ id: `d${k}`, d: petal(125, 192, 40), rot: k * 45 + 22.5 });
  for (let k = 0; k < 8; k++) out.push({ id: `b${k}`, d: petal(48, 124, 30), rot: k * 45 + 22.5 });
  for (let k = 0; k < 16; k++) out.push({ id: `c${k}`, d: petal(118, 152, 13), rot: k * 22.5 });
  for (let k = 0; k < 8; k++) out.push({ id: `a${k}`, d: petal(22, 88, 26), rot: k * 45 });
  for (let k = 0; k < 16; k++) {
    const t = ((k * 22.5 + 11.25) * Math.PI) / 180;
    out.push({ id: `e${k}`, circle: { cx: Math.round(Math.cos(t) * 172 * 10) / 10, cy: Math.round(Math.sin(t) * 172 * 10) / 10, r: 7 } });
  }
  out.push({ id: "core", circle: { cx: 0, cy: 0, r: 22 } });
  return out;
})();

/** The drawing as SVG text — the same shapes as on screen, for saving. */
function markup(fills: Record<string, string>) {
  const parts = SEGMENTS.map((g) => {
    const fill = fills[g.id] ?? BLANK;
    return g.circle
      ? `<circle cx="${g.circle.cx}" cy="${g.circle.cy}" r="${g.circle.r}" fill="${fill}" stroke="${LINE}" stroke-width="1.5"/>`
      : `<path d="${g.d}" transform="rotate(${g.rot ?? 0})" fill="${fill}" stroke="${LINE}" stroke-width="1.5"/>`;
  }).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-210 -210 420 420" width="1000" height="1000"><rect x="-210" y="-210" width="420" height="420" fill="#fffaf3"/>${parts}</svg>`;
}

export default function RangoliPage() {
  const [colour, setColour] = useState(PALETTE[0].hex);
  const [fills, setFills] = useState<Record<string, string>>({});
  const [history, setHistory] = useState<Record<string, string>[]>([]);
  const [feel, setFeel] = useState(false);
  const [saved, setSaved] = useState("");

  // Her drawing from last time, read after the first paint (browser only).
  useEffect(() => {
    const t = window.setTimeout(() => {
      try {
        const raw = localStorage.getItem(KEY);
        if (raw) setFills(JSON.parse(raw) as Record<string, string>);
      } catch { /* no storage — start fresh */ }
    }, 0);
    return () => window.clearTimeout(t);
  }, []);

  const keep = (next: Record<string, string>) => {
    setHistory((h) => [...h.slice(-40), fills]);
    setFills(next);
    setSaved("");
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* fine */ }
  };

  const paint = (id: string) => {
    if (fills[id] === colour) return;
    keep({ ...fills, [id]: colour });
  };
  const undo = () => {
    const prev = history[history.length - 1];
    if (!prev) return;
    setHistory((h) => h.slice(0, -1));
    setFills(prev);
    try { localStorage.setItem(KEY, JSON.stringify(prev)); } catch { /* fine */ }
  };
  const clear = () => { if (Object.keys(fills).length) keep({}); };

  const save = () => {
    const blob = new Blob([markup(fills)], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 1000; canvas.height = 1000;
      const g = canvas.getContext("2d");
      if (!g) { URL.revokeObjectURL(url); return; }
      g.drawImage(img, 0, 0, 1000, 1000);
      URL.revokeObjectURL(url);
      canvas.toBlob((png) => {
        if (!png) return;
        const a = document.createElement("a");
        a.href = URL.createObjectURL(png);
        a.download = "my-rangoli.png";
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 2000);
        setSaved("Saved to your phone as my-rangoli.png");
      }, "image/png");
    };
    img.src = url;
  };

  const filled = SEGMENTS.filter((g) => fills[g.id] && fills[g.id] !== BLANK).length;

  return (
    <GameFrame title="Colour the rangoli" sub="Pick a colour, then tap the petals. There is no wrong way."
               feel={feel} setFeel={setFeel} again={() => { setHistory([]); keep({}); }}>
      <div className="grid gap-[16px] lg:grid-cols-[minmax(0,1fr)_300px]">
        <section className={`${s.stage} p-3 sm:p-5`}>
          <svg viewBox="-210 -210 420 420" className={s.paper} role="img" aria-label="A rangoli to colour">
            <rect x="-210" y="-210" width="420" height="420" rx="24" fill="#fffaf3" />
            {SEGMENTS.map((g) => {
              const common = {
                className: s.seg, fill: fills[g.id] ?? BLANK, stroke: LINE, strokeWidth: 1.5,
                onClick: () => paint(g.id),
              };
              return g.circle
                ? <circle key={g.id} cx={g.circle.cx} cy={g.circle.cy} r={g.circle.r} {...common} />
                : <path key={g.id} d={g.d} transform={`rotate(${g.rot ?? 0})`} {...common} />;
            })}
          </svg>
          <p className="mt-2 text-center text-xs tabular-nums" style={{ color: "var(--ux-muted)" }}>
            {filled} of {SEGMENTS.length} pieces coloured
          </p>
        </section>

        <Card>
          <p className="text-xsm font-bold" style={{ color: "var(--ux-ink)" }}>Colours</p>
          <div className="mt-3 grid grid-cols-4 gap-2.5">
            {PALETTE.map((p) => {
              const on = colour === p.hex;
              return (
                <button key={p.hex} type="button" onClick={() => setColour(p.hex)} aria-pressed={on} aria-label={p.name}
                        title={p.name}
                        className="ux-press grid aspect-square place-items-center rounded-[14px]"
                        style={{ background: p.hex, boxShadow: on ? "0 0 0 3px var(--ux-surface), 0 0 0 6px var(--ux-brand)" : "inset 0 0 0 1px rgba(0,0,0,.08)" }}>
                  {on && <Icons.Check className="h-5 w-5 text-white drop-shadow" />}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-xs" style={{ color: "var(--ux-muted)" }}>
            {PALETTE.find((p) => p.hex === colour)?.name}
          </p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Btn variant="outline" icon="Undo2" onClick={undo} disabled={!history.length}>Undo</Btn>
            <Btn variant="ghost" icon="RefreshCw" onClick={clear} disabled={!filled}>Clear</Btn>
          </div>
          <div className="mt-2">
            <Btn variant="primary" icon="Download" full onClick={save} disabled={!filled}>Save picture</Btn>
          </div>
          {saved && <p className="mt-2 text-xs" style={{ color: "var(--ux-green-ink)" }}>{saved}</p>}
          <p className="mt-4 text-xs leading-relaxed" style={{ color: "var(--ux-muted)" }}>
            Your colouring stays on this phone, so you can come back and finish it later.
          </p>
        </Card>
      </div>
    </GameFrame>
  );
}
