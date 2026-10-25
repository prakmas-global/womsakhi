"use client";

import { useEffect, useState } from "react";

import { Btn } from "@/components/ux/kit";
import { Picks } from "@/components/ux/kit/form";
import { GameFrame } from "@/components/ux/games/GameFrame";
import s from "@/components/ux/games/games.module.css";

/**
 * Number Path — tap the numbers in order. A gentle way to settle attention.
 *
 * She picks a board and how long to play. Finish a board and a new one
 * appears; when the time is up, the how-do-you-feel sheet opens. A wrong tap
 * only gives a small shake — no buzzer, no penalty.
 */
const LEVELS: Record<string, number> = { "Easy · 1–9": 3, "Medium · 1–16": 4, "Hard · 1–25": 5 };
const LENGTHS: Record<string, number> = { "1 minute": 60, "2 minutes": 120, "3 minutes": 180 };

function board(n: number) {
  const a = Array.from({ length: n * n }, (_, i) => i + 1);
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

export default function NumberPathPage() {
  const [level, setLevel] = useState("Easy · 1–9");
  const [length, setLength] = useState("2 minutes");
  const n = LEVELS[level];
  const [tiles, setTiles] = useState<number[]>([]);
  const [next, setNext] = useState(1);
  const [boards, setBoards] = useState(0);
  const [left, setLeft] = useState(LENGTHS["2 minutes"]);
  const [running, setRunning] = useState(false);
  const [shake, setShake] = useState<number | null>(null);
  const [feel, setFeel] = useState(false);

  useEffect(() => { const t = window.setTimeout(() => setTiles(board(3)), 0); return () => window.clearTimeout(t); }, []);

  useEffect(() => {
    if (!running) return;
    const t = window.setInterval(() => setLeft((l) => l - 1), 1000);
    return () => window.clearInterval(t);
  }, [running]);

  useEffect(() => {
    if (!running || left > 0) return;
    const t = window.setTimeout(() => { setRunning(false); setFeel(true); }, 0);
    return () => window.clearTimeout(t);
  }, [left, running]);

  const reset = (lv = level, len = length) => {
    setTiles(board(LEVELS[lv])); setNext(1); setBoards(0); setLeft(LENGTHS[len]); setRunning(false);
  };

  const tap = (v: number) => {
    if (left <= 0) return;
    if (!running) setRunning(true);
    if (v !== next) { setShake(v); window.setTimeout(() => setShake(null), 350); return; }
    if (v === n * n) {
      setBoards((b) => b + 1);
      setTiles(board(n)); setNext(1);
    } else {
      setNext(v + 1);
    }
  };

  const mm = `${Math.floor(Math.max(0, left) / 60)}:${String(Math.max(0, left) % 60).padStart(2, "0")}`;

  return (
    <GameFrame title="Number Path" sub="Tap the numbers from 1 upwards. Finish a board and a new one appears."
               feel={feel} setFeel={(v) => { if (v) setRunning(false); setFeel(v); }} again={() => reset()} game="numbers"
               result={() => ({ score: boards, scoreLabel: `${boards} ${boards === 1 ? "board" : "boards"} · 1–${n * n}` })}>
      <div className="mb-3 flex flex-col gap-3">
        <Picks options={Object.keys(LEVELS)} value={level} onPick={(l) => { setLevel(l); reset(l); }} label="Board" />
        <Picks options={Object.keys(LENGTHS)} value={length} onPick={(l) => { setLength(l); reset(level, l); }} label="How long" />
      </div>
      <section className={`${s.stage} p-4 sm:p-6`}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-[19px] font-bold" style={{ color: "var(--ux-ink)" }} aria-live="polite">
            {left <= 0 ? "Time's up — well done." : <>Next: <span className="tabular-nums" style={{ color: "var(--ux-orange-ink)" }}>{next}</span></>}
          </p>
          <div className="flex items-center gap-3">
            <span className="text-xsm font-semibold" style={{ color: "var(--ux-muted)" }}>{boards} {boards === 1 ? "board" : "boards"}</span>
            <span className="min-w-[66px] rounded-[10px] px-2.5 py-1 text-center text-lg font-extrabold tabular-nums"
                  style={{ background: "var(--ux-surface-2)", color: "var(--ux-ink)" }} data-timer>{mm}</span>
          </div>
        </div>
        <div className="mx-auto grid max-w-[400px] gap-2" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }} data-numbers>
          {tiles.map((v) => {
            const gone = v < next;
            return (
              <button key={`${boards}-${v}`} type="button" onClick={() => tap(v)} disabled={gone || left <= 0}
                      aria-label={gone ? `${v}, done` : `${v}`}
                      className="ux-press grid aspect-square place-items-center rounded-[12px] border-[1.5px] text-[clamp(18px,5vw,28px)] font-extrabold tabular-nums transition-transform"
                      style={{
                        background: gone ? "transparent" : "var(--ux-tint-orange)",
                        borderColor: gone ? "var(--ux-line)" : "var(--ux-orange-ink)",
                        color: gone ? "var(--ux-faint)" : "var(--ux-ink)",
                        opacity: gone ? 0.35 : 1,
                        transform: shake === v ? "translateX(3px)" : undefined,
                      }}>
                {v}
              </button>
            );
          })}
        </div>
        {left <= 0 && (
          <div className="mt-4 flex justify-center"><Btn icon="RefreshCw" onClick={() => reset()}>Play again</Btn></div>
        )}
        {!running && left > 0 && next === 1 && (
          <p className="mt-4 text-center text-sm" style={{ color: "var(--ux-muted)" }}>The clock starts with your first tap.</p>
        )}
      </section>
    </GameFrame>
  );
}
