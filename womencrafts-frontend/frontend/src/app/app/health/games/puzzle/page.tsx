"use client";

import { useEffect, useState } from "react";

import * as Icons from "@/components/ux/icons";
import { Btn } from "@/components/ux/kit";
import { Picks } from "@/components/ux/kit/form";
import { GameFrame } from "@/components/ux/games/GameFrame";
import s from "@/components/ux/games/games.module.css";

/**
 * Slide Puzzle — slide the numbered tiles back into order.
 *
 * Shuffled by making random legal moves from the solved board, so every board
 * can be solved. Tiles that can move are drawn a shade stronger; there is no
 * clock. Moves are counted only so she can see what she did.
 */
const LEVELS: Record<string, number> = { "Easy · 3×3": 3, "Hard · 4×4": 4 };

function solved(n: number) { return [...Array.from({ length: n * n - 1 }, (_, i) => i + 1), 0]; }

function neighbours(i: number, n: number) {
  const r = Math.floor(i / n), c = i % n, out: number[] = [];
  if (r > 0) out.push(i - n);
  if (r < n - 1) out.push(i + n);
  if (c > 0) out.push(i - 1);
  if (c < n - 1) out.push(i + 1);
  return out;
}

function shuffled(n: number): number[] {
  const b = solved(n);
  let blank = b.length - 1, prev = -1;
  for (let k = 0; k < n * n * 30; k++) {
    const opts = neighbours(blank, n).filter((x) => x !== prev);
    const pick = opts[Math.floor(Math.random() * opts.length)];
    [b[blank], b[pick]] = [b[pick], b[blank]];
    prev = blank; blank = pick;
  }
  return b.join() === solved(n).join() ? shuffled(n) : b;
}

export default function SlidePuzzlePage() {
  const [level, setLevel] = useState("Easy · 3×3");
  const n = LEVELS[level];
  const [board, setBoard] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [feel, setFeel] = useState(false);

  // Shuffled in the browser only, so the server and the first render agree.
  useEffect(() => { const t = window.setTimeout(() => setBoard(shuffled(3)), 0); return () => window.clearTimeout(t); }, []);
  const fresh = (lv = level) => { setBoard(shuffled(LEVELS[lv])); setMoves(0); };

  const blank = board.indexOf(0);
  const movable = new Set(blank >= 0 ? neighbours(blank, n) : []);
  const done = board.length === n * n && board.join() === solved(n).join();

  const slide = (i: number) => {
    if (done || !movable.has(i)) return;
    const next = [...board];
    [next[blank], next[i]] = [next[i], next[blank]];
    setBoard(next);
    setMoves((m) => m + 1);
    if (next.join() === solved(n).join()) window.setTimeout(() => setFeel(true), 900);
  };

  return (
    <GameFrame title="Slide Puzzle" sub="Tap a tile next to the empty space to slide it. Put the numbers in order."
               feel={feel} setFeel={setFeel} again={() => fresh()} game="puzzle"
               result={() => ({ score: moves, scoreLabel: done ? `Solved ${n}×${n} in ${moves} moves` : `${moves} moves` })}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <Picks options={Object.keys(LEVELS)} value={level} onPick={(l) => { setLevel(l); fresh(l); }} label="Board size" />
        <p className="text-xsm font-semibold tabular-nums" style={{ color: "var(--ux-muted)" }}>{moves} {moves === 1 ? "move" : "moves"}</p>
      </div>
      <section className={`${s.stage} p-4 sm:p-6`}>
        {done && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-[14px] p-4"
               style={{ background: "var(--ux-tint-green)", color: "var(--ux-green-ink)" }}>
            <p className="flex items-center gap-2 text-sm font-bold"><Icons.Sparkles className="h-4 w-4" /> Solved in {moves} moves. Well done.</p>
            <Btn icon="RefreshCw" onClick={() => fresh()}>New board</Btn>
          </div>
        )}
        <div className="mx-auto grid max-w-[400px] gap-2" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }} data-puzzle>
          {board.map((v, i) => v === 0 ? (
            <span key="blank" aria-hidden className="aspect-square rounded-[12px] border-[1.5px] border-dashed" style={{ borderColor: "var(--ux-line-strong)" }} />
          ) : (
            <button key={v} type="button" onClick={() => slide(i)} disabled={done}
                    aria-label={movable.has(i) ? `Slide ${v}` : `${v}`}
                    className="ux-press grid aspect-square place-items-center rounded-[12px] border-[1.5px] text-[clamp(20px,5vw,30px)] font-extrabold tabular-nums transition-colors"
                    style={{
                      background: movable.has(i) ? "var(--ux-tint-violet)" : "var(--ux-surface)",
                      borderColor: movable.has(i) ? "var(--ux-violet-ink)" : "var(--ux-line-strong)",
                      color: "var(--ux-ink)",
                      cursor: movable.has(i) ? "pointer" : "default",
                    }}>
              {v}
            </button>
          ))}
        </div>
      </section>
    </GameFrame>
  );
}
