"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import { Btn, Card } from "@/components/ux/kit";
import { Label, Picks } from "@/components/ux/kit/form";
import { GameFrame, SoundToggle } from "@/components/ux/games/GameFrame";
import { buzz, tone } from "@/components/ux/games/sound";
import s from "@/components/ux/games/games.module.css";

/**
 * Breathe with me — a soft circle to follow.
 *
 * It grows while she breathes in, rests while she holds, shrinks while she
 * breathes out. Three patterns, three lengths, all one tap. A gentle tone at
 * each change (off unless she turns it on) and a light buzz on phones that
 * have one. With reduced motion the circle stays still and a quiet count
 * takes its place.
 */
type Step = { kind: "in" | "hold" | "out"; secs: number };
const PATTERNS: Record<string, { label: string; steps: Step[]; note: string }> = {
  Calm: { label: "Calm", note: "In 4 · out 4", steps: [{ kind: "in", secs: 4 }, { kind: "out", secs: 4 }] },
  Box: { label: "Box", note: "In 4 · hold 4 · out 4 · hold 4",
         steps: [{ kind: "in", secs: 4 }, { kind: "hold", secs: 4 }, { kind: "out", secs: 4 }, { kind: "hold", secs: 4 }] },
  Sleep: { label: "Sleep", note: "In 4 · hold 7 · out 8",
           steps: [{ kind: "in", secs: 4 }, { kind: "hold", secs: 7 }, { kind: "out", secs: 8 }] },
};
const LENGTHS = ["1 minute", "3 minutes", "5 minutes"];
const WORD = { in: "Breathe in…", hold: "Hold…", out: "Breathe out…" } as const;
const TONE = { in: 392, hold: 440, out: 330 } as const;

function useReducedMotion() {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia("(prefers-reduced-motion: reduce)");
      m.addEventListener("change", cb);
      return () => m.removeEventListener("change", cb);
    },
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );
}

/** Where in the pattern `ms` falls: the step, its index, and seconds left in it. */
function locate(steps: Step[], ms: number) {
  const cycle = steps.reduce((n, st) => n + st.secs, 0) * 1000;
  let t = ms % cycle;
  for (let i = 0; i < steps.length; i++) {
    const len = steps[i].secs * 1000;
    if (t < len) return { i, step: steps[i], left: Math.ceil((len - t) / 1000), round: Math.floor(ms / cycle) };
    t -= len;
  }
  return { i: 0, step: steps[0], left: steps[0].secs, round: 0 };
}

export default function BreathePage() {
  const [pattern, setPattern] = useState("Calm");
  const [length, setLength] = useState("3 minutes");
  const [running, setRunning] = useState(false);
  const [base, setBase] = useState(0);          // ms done before this run
  const [runStart, setRunStart] = useState(0);  // when this run began
  const [now, setNow] = useState(0);
  const [sound, setSound] = useState(false);
  const [feel, setFeel] = useState(false);
  const still = useReducedMotion();
  const lastKey = useRef("");

  const steps = PATTERNS[pattern].steps;
  const total = parseInt(length, 10) * 60_000;
  const elapsed = base + (running ? Math.max(0, now - runStart) : 0);
  const started = elapsed > 0 || running;
  const at = locate(steps, elapsed);

  // The clock — runs only while she is breathing.
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      const t = Date.now();
      setNow(t);
      const done = base + (t - runStart);
      if (done >= total) {
        setRunning(false);
        setBase(total);
        setFeel(true);
        return;
      }
      const here = locate(steps, done);
      const key = `${here.round}:${here.i}`;
      if (key !== lastKey.current) {
        lastKey.current = key;
        if (sound) tone(TONE[here.step.kind]);
        buzz(here.step.kind === "hold" ? 15 : 35);
      }
    }, 200);
    return () => window.clearInterval(id);
  }, [running, base, runStart, total, steps, sound]);

  const start = () => {
    const t = Date.now();
    if (base >= total) setBase(0);
    lastKey.current = "";
    setRunStart(t); setNow(t); setRunning(true);
    if (sound) tone(TONE.in);
  };
  const pause = () => { setBase(elapsed); setRunning(false); };
  const reset = () => { setRunning(false); setBase(0); setNow(0); lastKey.current = ""; };

  // Big on breathe-in, small on breathe-out; a hold keeps whatever came before.
  const prev = steps[(at.i - 1 + steps.length) % steps.length];
  const big = at.step.kind === "in" ? true : at.step.kind === "out" ? false : prev.kind === "in";
  const scale = !started ? 0.7 : big ? 1 : 0.55;
  const left = Math.max(0, Math.ceil((total - elapsed) / 1000));

  return (
    <GameFrame title="Breathe with me" sub="Follow the circle. Let your shoulders drop."
               game="breathe" result={() => ({ scoreLabel: `${pattern} breathing` })}
               feel={feel} setFeel={setFeel} again={() => { reset(); setTimeout(start, 50); }}
               tools={<SoundToggle on={sound} onChange={setSound} />}>
      <div className="ux-split-lg grid gap-[16px] lg:grid-cols-[minmax(0,1fr)_300px]">
        <section className={s.stage}>
          <div className={s.breathWrap}>
            <div className={s.breathRing}>
              <span aria-hidden className={s.breathGlow}
                    style={{ transform: `scale(${still ? 0.8 : scale})`,
                             transitionDuration: running && at.step.kind !== "hold" ? `${at.step.secs}s` : "0.6s" }} />
              <div className={s.breathWord} aria-live="polite">
                <p className="text-[26px] font-extrabold leading-tight lg:text-[30px]">
                  {started ? WORD[at.step.kind] : "Ready when you are"}
                </p>
                {started && <p className="mt-2 text-[40px] font-bold tabular-nums" style={{ color: "var(--ux-brand)" }}>{at.left}</p>}
              </div>
            </div>
            <p className="mt-6 text-xsm tabular-nums" style={{ color: "var(--ux-muted)" }}>
              {Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")} left
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {!running
                ? <Btn variant="primary" size="lg" icon="Play" onClick={start}>{started && elapsed < total ? "Carry on" : "Start"}</Btn>
                : <Btn variant="outline" size="lg" icon="Pause" onClick={pause}>Pause</Btn>}
              {started && !running && <Btn variant="ghost" icon="RefreshCw" onClick={reset}>Start over</Btn>}
            </div>
          </div>
        </section>

        <Card>
          <Label>Way of breathing</Label>
          <Picks options={Object.keys(PATTERNS)} value={pattern} onPick={(p) => { reset(); setPattern(p); }} label="Way of breathing" />
          <p className="mt-2 text-xs" style={{ color: "var(--ux-muted)" }}>{PATTERNS[pattern].note}</p>
          <div className="mt-5">
            <Label>How long</Label>
            <Picks options={LENGTHS} value={length} onPick={(l) => { reset(); setLength(l); }} label="How long" />
          </div>
          <p className="mt-5 rounded-[12px] p-3 text-xs leading-relaxed" style={{ background: "var(--ux-surface-2)", color: "var(--ux-ink-2)" }}>
            Sit comfortably. Breathe through your nose if you can. If you feel dizzy, stop and breathe normally.
          </p>
        </Card>
      </div>
    </GameFrame>
  );
}
