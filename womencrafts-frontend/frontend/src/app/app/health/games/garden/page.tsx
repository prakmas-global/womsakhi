"use client";

import { useEffect, useRef, useState } from "react";

import { Btn } from "@/components/ux/kit";
import { Picks } from "@/components/ux/kit/form";
import { GameFrame } from "@/components/ux/games/GameFrame";
import s from "@/components/ux/games/games.module.css";

/**
 * Mindful Garden — a calm garden, a sun that breathes, and flowers she plants.
 *
 * The sun grows as she breathes in, rests, and shrinks as she breathes out
 * (4–2–6). A gentle prompt changes each breath. Tapping the grass plants a
 * flower where she tapped. When the time she chose is up, the how-do-you-feel
 * sheet opens. Every colour is a design-system token.
 */
const LENGTHS: Record<string, number> = { "1 minute": 60, "2 minutes": 120, "3 minutes": 180, "5 minutes": 300 };
const PHASES: [string, number][] = [["Breathe in", 4], ["Hold", 2], ["Breathe out", 6]];
const PROMPTS = [
  "Notice the air on your skin.",
  "Plant a flower for something you're grateful for.",
  "Let your shoulders drop.",
  "Listen for the quietest sound around you.",
  "Soften your jaw and your hands.",
  "Each flower is a breath you gave yourself.",
];
const PETALS = ["var(--ux-brand)", "var(--ux-violet)", "var(--ux-rib-2)", "var(--ux-rib-4)", "var(--ux-orange)"];
const W = 600, H = 340, GROUND = 222;

type Flower = { id: number; x: number; y: number; c: string; r: number };

export default function MindfulGardenPage() {
  const [length, setLength] = useState("2 minutes");
  const [left, setLeft] = useState(LENGTHS["2 minutes"]);
  const [running, setRunning] = useState(false);
  const [tick, setTick] = useState(0);              // seconds into the session
  const [flowers, setFlowers] = useState<Flower[]>([]);
  const [feel, setFeel] = useState(false);
  const nextId = useRef(1);

  useEffect(() => {
    if (!running) return;
    const t = window.setInterval(() => { setTick((x) => x + 1); setLeft((l) => l - 1); }, 1000);
    return () => window.clearInterval(t);
  }, [running]);

  useEffect(() => {
    if (!running || left > 0) return;
    const t = window.setTimeout(() => { setRunning(false); setFeel(true); }, 0);
    return () => window.clearTimeout(t);
  }, [left, running]);

  const cycle = PHASES.reduce((a, p) => a + p[1], 0);
  const at = tick % cycle;
  let acc = 0, phase = PHASES[0], into = 0;
  for (const p of PHASES) { if (at < acc + p[1]) { phase = p; into = at - acc; break; } acc += p[1]; }
  const breaths = Math.floor(tick / cycle);
  const big = phase[0] === "Breathe in" ? true : phase[0] === "Hold";
  const prompt = PROMPTS[breaths % PROMPTS.length];

  const plant = (e: React.MouseEvent<SVGSVGElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - box.left) / box.width) * W;
    const y = ((e.clientY - box.top) / box.height) * H;
    if (y < GROUND - 6) return;
    const id = nextId.current++;
    setFlowers((f) => [...f.slice(-59), { id, x, y: Math.min(H - 10, y), c: PETALS[id % PETALS.length], r: 7 + (id % 3) * 1.5 }]);
    if (!running && left > 0) setRunning(true);
  };

  const reset = (len = length) => { setRunning(false); setLeft(LENGTHS[len]); setTick(0); setFlowers([]); };
  const mm = `${Math.floor(Math.max(0, left) / 60)}:${String(Math.max(0, left) % 60).padStart(2, "0")}`;

  return (
    <GameFrame title="Mindful Garden" sub="Breathe with the sun. Tap the grass to plant a flower."
               feel={feel} setFeel={(v) => { if (v) setRunning(false); setFeel(v); }} again={() => reset()} game="garden"
               result={() => ({ score: flowers.length, scoreLabel: `${flowers.length} ${flowers.length === 1 ? "flower" : "flowers"} planted` })}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <Picks options={Object.keys(LENGTHS)} value={length} onPick={(l) => { setLength(l); reset(l); }} label="How long" />
        <div className="flex items-center gap-2">
          <span className="min-w-[66px] rounded-[10px] px-2.5 py-1 text-center text-lg font-extrabold tabular-nums"
                style={{ background: "var(--ux-surface-2)", color: "var(--ux-ink)" }} data-timer>{mm}</span>
          {left > 0 && <Btn icon={running ? "Pause" : "Play"} onClick={() => setRunning((r) => !r)}>{running ? "Pause" : tick ? "Resume" : "Start"}</Btn>}
        </div>
      </div>

      <section className={`${s.stage} p-3 sm:p-4`}>
        <p className="mb-1 text-center text-[22px] font-bold" style={{ color: "var(--ux-ink)" }} aria-live="polite">
          {left <= 0 ? "Well done." : running ? `${phase[0]}… ${phase[1] - into}` : "Press start, then breathe with the sun"}
        </p>
        <p className="mb-3 min-h-[1.5em] text-center text-sm" style={{ color: "var(--ux-muted)" }}>{running ? prompt : "Tap the grass any time to plant a flower."}</p>
        <svg viewBox={`0 0 ${W} ${H}`} className={s.garden} onClick={plant} role="img" data-garden
             aria-label={`A garden with ${flowers.length} ${flowers.length === 1 ? "flower" : "flowers"}. Tap the grass to plant one.`}>
          <defs>
            <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" style={{ stopColor: "var(--ux-tint-blue)" }} />
              <stop offset="1" style={{ stopColor: "var(--ux-surface)" }} />
            </linearGradient>
          </defs>
          <rect width={W} height={H} fill="url(#sky)" />
          <g className={s.cloud} opacity=".85">
            <ellipse cx="120" cy="64" rx="46" ry="16" fill="var(--ux-surface)" />
            <ellipse cx="150" cy="56" rx="30" ry="16" fill="var(--ux-surface)" />
          </g>
          <g className={s.cloud} opacity=".7" style={{ animationDelay: "-12s" }}>
            <ellipse cx="420" cy="88" rx="40" ry="13" fill="var(--ux-surface)" />
            <ellipse cx="446" cy="80" rx="24" ry="13" fill="var(--ux-surface)" />
          </g>
          <circle cx="470" cy="110" r="44" className={s.sun}
                  style={{ fill: "var(--ux-rib-5)", opacity: 0.9, transform: `scale(${big ? 1.18 : 0.72})`, transitionDuration: `${running ? phase[1] : 0.6}s` }} />
          <path d={`M0 ${GROUND + 14} Q 150 ${GROUND - 40} 300 ${GROUND + 6} T ${W} ${GROUND - 4} V ${H} H 0 Z`} fill="var(--ux-tint-green)" />
          <path d={`M0 ${GROUND + 34} Q 200 ${GROUND + 4} 380 ${GROUND + 30} T ${W} ${GROUND + 22} V ${H} H 0 Z`} fill="var(--ux-green-ink)" opacity=".22" />
          {flowers.map((f) => (
            <g key={f.id} className={s.flower}>
              <line x1={f.x} y1={f.y} x2={f.x} y2={f.y - 26} stroke="var(--ux-green-ink)" strokeWidth="2.5" strokeLinecap="round" />
              <ellipse cx={f.x + 6} cy={f.y - 12} rx="6" ry="2.6" fill="var(--ux-green-ink)" opacity=".75" transform={`rotate(-30 ${f.x + 6} ${f.y - 12})`} />
              {[0, 72, 144, 216, 288].map((a) => (
                <circle key={a} cx={f.x + Math.cos((a * Math.PI) / 180) * f.r} cy={f.y - 26 + Math.sin((a * Math.PI) / 180) * f.r} r={f.r * 0.8} fill={f.c} />
              ))}
              <circle cx={f.x} cy={f.y - 26} r={f.r * 0.55} fill="var(--ux-rib-5)" />
            </g>
          ))}
        </svg>
        <p className="mt-3 text-center text-xsm font-semibold" style={{ color: "var(--ux-muted)" }}>
          {flowers.length} {flowers.length === 1 ? "flower" : "flowers"} · {breaths} {breaths === 1 ? "breath" : "breaths"}
        </p>
      </section>
    </GameFrame>
  );
}
