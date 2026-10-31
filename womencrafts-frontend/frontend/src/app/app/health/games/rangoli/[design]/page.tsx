"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";

import * as Icons from "@/components/ux/icons";
import { Btn, Card } from "@/components/ux/kit";
import { HomeShell } from "@/components/ux/home/HomeShell";
import { GameFrame } from "@/components/ux/games/GameFrame";
import { BLANK, LINE, PAPER, RangoliArt, countOf } from "@/components/ux/games/RangoliArt";
import { designOf, levelOf, segMarkup, type Design, type Seg } from "@/components/ux/games/rangoli-designs";
import { addSaved, listSaved, loadFills, storeFills, type Fills } from "@/components/ux/games/rangoli-store";
import { toast } from "@/components/ux/mobile/Toast";
import s from "@/components/ux/games/games.module.css";

/**
 * Colour one rangoli — pick a colour, tap a piece to fill it.
 *
 * Every tap is kept at once (rangoli-store), so "Back to designs" and coming
 * back later lose nothing. Undo and Redo walk this visit's taps; Reset puts the
 * design back the way it was when she opened it; Clear all empties it (and
 * Undo brings it back). "Save design" keeps a copy under My rangolis on the
 * designs page; "Download" makes a PNG. ?saved=<id> opens a kept copy.
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
  { name: "Rose", hex: "#F29BBF" },
  { name: "Lavender", hex: "#9B7FD4" },
  { name: "Sky", hex: "#6FC3E6" },
  { name: "Rice white", hex: "#FFF3DC" },
];
const BASE = "/app/health/games/rangoli";
const DESIGNS_LINK = { to: BASE, label: "Rangoli designs" };

/** The drawing as SVG text — the same shapes as on screen, for the PNG. */
function markup(d: Design, fills: Fills) {
  const parts = d.segs.map((g) => segMarkup(g, fills[g.id] ?? BLANK, LINE)).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-210 -210 420 420" width="1000" height="1000"><rect x="-210" y="-210" width="420" height="420" fill="${PAPER}"/>${parts}</svg>`;
}

export default function ColourRangoli() {
  const { design: id } = useParams<{ design: string }>();
  const design = designOf(id);
  if (!design) {
    return (
      <HomeShell active="/app/health/games">
        <div className="mx-auto mt-10 flex max-w-[420px] flex-col items-center gap-3 text-center">
          <Icons.Palette className="h-8 w-8" style={{ color: "var(--ux-muted)" }} />
          <h1 className="text-xl font-extrabold" style={{ color: "var(--ux-ink)" }}>That design isn&apos;t here</h1>
          <p className="text-sm" style={{ color: "var(--ux-muted)" }}>The link may be cut short. Pick another — there are plenty to colour.</p>
          <Btn variant="primary" icon="ArrowLeft" href={BASE}>Back to designs</Btn>
        </div>
      </HomeShell>
    );
  }
  return <Colouring key={design.id} design={design} />;
}

function Colouring({ design }: { design: Design }) {
  const [colour, setColour] = useState(PALETTE[0].hex);
  const [fills, setFills] = useState<Fills>({});
  const [past, setPast] = useState<Fills[]>([]);
  const [future, setFuture] = useState<Fills[]>([]);
  /** How the design was when she opened it — what Reset goes back to. */
  const [opened, setOpened] = useState<Fills>({});
  const [whole, setWhole] = useState(false);
  const [feel, setFeel] = useState(false);
  const [note, setNote] = useState("");

  // Her colouring of this design (or a copy she saved), read after the first paint.
  useEffect(() => {
    const t = window.setTimeout(() => {
      const kept = loadFills(design.id);
      const sid = new URLSearchParams(window.location.search).get("saved");
      const copy = sid ? listSaved().find((x) => x.sid === sid && x.id === design.id) : undefined;
      setOpened(kept);
      setFills(kept);
      if (copy) {
        // Opening a saved copy is one step she can undo, back to where this design was.
        setPast([kept]);
        setFills(copy.fills);
        storeFills(design.id, copy.fills);
      }
    }, 0);
    return () => window.clearTimeout(t);
  }, [design.id]);

  const commit = useCallback((next: Fills) => {
    setPast((p) => [...p.slice(-60), fills]);
    setFuture([]);
    setFills(next);
    setNote("");
    storeFills(design.id, next);
  }, [design.id, fills]);

  const paint = (g: Seg) => {
    const ids = whole ? design.segs.filter((x) => x.ring === g.ring).map((x) => x.id) : [g.id];
    if (ids.every((pid) => fills[pid] === colour)) return;
    commit({ ...fills, ...Object.fromEntries(ids.map((pid) => [pid, colour])) });
  };

  const undo = useCallback(() => {
    if (!past.length) return;
    const prev = past[past.length - 1];
    setPast((p) => p.slice(0, -1));
    setFuture((f) => [fills, ...f].slice(0, 60));
    setFills(prev);
    storeFills(design.id, prev);
  }, [past, fills, design.id]);

  const redo = useCallback(() => {
    if (!future.length) return;
    const next = future[0];
    setFuture((f) => f.slice(1));
    setPast((p) => [...p, fills]);
    setFills(next);
    storeFills(design.id, next);
  }, [future, fills, design.id]);

  // Ctrl/⌘+Z undoes, Ctrl/⌘+Shift+Z or Ctrl+Y redoes.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || (e.target as HTMLElement)?.closest("input, textarea")) return;
      const k = e.key.toLowerCase();
      if (k === "z" && !e.shiftKey) { e.preventDefault(); undo(); }
      else if ((k === "z" && e.shiftKey) || k === "y") { e.preventDefault(); redo(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);

  const same = (a: Fills, b: Fills) => JSON.stringify(a) === JSON.stringify(b);
  const reset = () => { if (!same(fills, opened)) commit({ ...opened }); };
  const clearAll = () => { if (Object.keys(fills).length) commit({}); };
  const inspire = () => {
    const rings = [...new Set(design.segs.map((g) => g.ring))];
    const pool = [...PALETTE].sort(() => Math.random() - 0.5);
    const byRing = Object.fromEntries(rings.map((r, i) => [r, pool[i % pool.length].hex]));
    commit(Object.fromEntries(design.segs.map((g) => [g.id, byRing[g.ring]])));
  };
  const saveDesign = () => {
    addSaved(design.id, fills);
    toast("Saved to My rangolis", { tone: "success", action: { label: "See it", onPress: () => { window.location.href = `${BASE}#rg-saved`; } } });
  };
  const download = () => {
    const url = URL.createObjectURL(new Blob([markup(design, fills)], { type: "image/svg+xml" }));
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
        const name = `my-rangoli-${design.id}.png`;
        a.href = URL.createObjectURL(png);
        a.download = name;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 2000);
        setNote(`Downloaded as ${name}`);
      }, "image/png");
    };
    img.src = url;
  };

  const filled = countOf(design, fills);
  const total = design.segs.length;
  const done = filled === total;

  return (
    <GameFrame title={design.name} sub={`${levelOf(design)} · ${total} pieces · ${design.note}. Pick a colour, then tap a piece. There is no wrong way.`}
               back={DESIGNS_LINK} game="rangoli"
               result={() => ({ score: filled, scoreLabel: `${filled} of ${total} · ${design.name}` })}
               feel={feel} setFeel={setFeel} again={clearAll}>
      <div className="grid gap-[16px] lg:grid-cols-[minmax(0,1fr)_300px]">
        <section className={`${s.stage} p-3 sm:p-5`}>
          <RangoliArt design={design} fills={fills} onTap={paint} className={s.paper} label={`${design.name} rangoli to colour`} />
          <p className="mt-2 text-center text-xs tabular-nums" style={{ color: done ? "var(--ux-green-ink)" : "var(--ux-muted)" }} aria-live="polite" data-rangoli-status>
            {done ? `Beautiful — all ${total} pieces are coloured. Save it, or pick another design.` : `${filled} of ${total} pieces coloured`}
          </p>
          <div className="mx-auto mt-2 h-[6px] max-w-[520px] overflow-hidden rounded-full" style={{ background: "var(--ux-tint-pink)" }} aria-hidden>
            <i className="block h-full rounded-full transition-[width] duration-300" style={{ width: `${(filled / total) * 100}%`, background: "var(--ux-brand)" }} />
          </div>
        </section>

        <Card>
          <p className="text-xsm font-bold" style={{ color: "var(--ux-ink)" }}>Colours</p>
          <div className="mt-3 grid grid-cols-4 gap-2.5" role="radiogroup" aria-label="Colours">
            {PALETTE.map((p) => {
              const on = colour === p.hex;
              return (
                <button key={p.hex} type="button" role="radio" onClick={() => setColour(p.hex)} aria-checked={on} aria-label={p.name} title={p.name}
                        className="ux-press grid aspect-square place-items-center rounded-[14px]"
                        style={{ background: p.hex, boxShadow: on ? "0 0 0 3px var(--ux-surface), 0 0 0 6px var(--ux-brand)" : "inset 0 0 0 1px rgba(0,0,0,.08)" }}>
                  {on && <Icons.Check className="h-5 w-5 drop-shadow" style={{ color: p.hex === "#FFF3DC" ? "var(--ux-ink)" : "#fff" }} />}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-xs" style={{ color: "var(--ux-muted)" }}>{PALETTE.find((p) => p.hex === colour)?.name}</p>

          <button type="button" role="switch" aria-checked={whole} onClick={() => setWhole(!whole)} data-rangoli-whole
                  className="ux-press mt-3 flex w-full items-center gap-3 rounded-[12px] border-[1.5px] p-2.5 text-start"
                  style={{ borderColor: whole ? "var(--ux-brand)" : "var(--ux-line)", background: whole ? "var(--ux-tint-pink)" : "var(--ux-surface)" }}>
            <span className="relative h-6 w-10 shrink-0 rounded-full transition-colors" style={{ background: whole ? "var(--ux-brand)" : "var(--ux-line-strong)" }} aria-hidden>
              <span className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-[left]" style={{ left: whole ? 18 : 2 }} />
            </span>
            <span className="min-w-0">
              <b className="block text-[13px]" style={{ color: "var(--ux-ink)" }}>Colour the whole ring</b>
              <span className="text-[11.5px]" style={{ color: "var(--ux-muted)" }}>One tap fills every matching piece</span>
            </span>
          </button>

          <div className="mt-4 grid grid-cols-2 gap-2" data-rangoli-tools>
            <Btn variant="outline" icon="Undo2" onClick={undo} disabled={!past.length}>Undo</Btn>
            <Btn variant="outline" icon="Redo2" onClick={redo} disabled={!future.length}>Redo</Btn>
            <Btn variant="ghost" icon="RotateCcw" onClick={reset} disabled={same(fills, opened)}>Reset</Btn>
            <Btn variant="ghost" icon="Eraser" onClick={clearAll} disabled={!filled}>Clear all</Btn>
          </div>
          <div className="mt-2 flex flex-col gap-2">
            <Btn variant="primary" icon="Heart" full onClick={saveDesign} disabled={!filled}>Save design</Btn>
            <div className="grid grid-cols-2 gap-2">
              <Btn variant="outline" icon="Sparkles" onClick={inspire}>Inspire me</Btn>
              <Btn variant="outline" icon="Download" onClick={download} disabled={!filled}>Download</Btn>
            </div>
            <Btn variant="ghost" icon="LayoutGrid" full href={BASE}>Back to designs</Btn>
          </div>
          {note && <p className="mt-2 text-xs" style={{ color: "var(--ux-green-ink)" }}>{note}</p>}
          <p className="mt-4 text-xs leading-relaxed" style={{ color: "var(--ux-muted)" }}>
            Every tap is kept on this phone. Reset takes the design back to how it was when you opened it; Undo brings back anything you clear.
          </p>
        </Card>
      </div>
    </GameFrame>
  );
}
