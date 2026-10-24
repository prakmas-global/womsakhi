"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

import { GameFrame, SoundToggle } from "@/components/ux/games/GameFrame";
import { buzz, pop } from "@/components/ux/games/sound";
import s from "@/components/ux/games/games.module.css";

/**
 * Pop the bubbles — tap them as they float up.
 *
 * No timer, no score to beat, no way to lose: a bubble she misses simply
 * floats away. The rising is a CSS animation on each bubble (no per-frame
 * JavaScript), at most 25 on screen, and everything pauses while the tab is
 * hidden so a phone in a pocket does no work.
 */
const COLOURS = ["#f8c8dc", "#d9c8f6", "#c6e7f5", "#c9efd9", "#fde3b8", "#f7c6c0"];
const MAX = 25;

type Bubble = { id: number; left: number; size: number; colour: string; dur: number };
type Burst = { id: number; x: number; y: number; size: number; colour: string };

function useHidden() {
  return useSyncExternalStore(
    (cb) => { document.addEventListener("visibilitychange", cb); return () => document.removeEventListener("visibilitychange", cb); },
    () => document.hidden,
    () => false,
  );
}

export default function BubblesPage() {
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [bursts, setBursts] = useState<Burst[]>([]);
  const [popped, setPopped] = useState(0);
  const [sound, setSound] = useState(false);
  const [feel, setFeel] = useState(false);
  const hidden = useHidden();
  const paused = hidden || feel;
  const next = useRef(1);
  const pond = useRef<HTMLDivElement | null>(null);

  // A new bubble every so often, while she is here.
  useEffect(() => {
    if (paused) return;
    const id = window.setInterval(() => {
      setBubbles((list) => list.length >= MAX ? list : [...list, {
        id: next.current++,
        left: 4 + Math.random() * 84,
        size: 52 + Math.random() * 46,
        colour: COLOURS[Math.floor(Math.random() * COLOURS.length)],
        dur: 7 + Math.random() * 6,
      }]);
    }, 650);
    return () => window.clearInterval(id);
  }, [paused]);

  const gone = useCallback((id: number) => setBubbles((list) => list.filter((b) => b.id !== id)), []);

  const burst = (b: Bubble, el: HTMLElement) => {
    const box = el.getBoundingClientRect();
    const host = pond.current?.getBoundingClientRect();
    if (!host) return;
    const at: Burst = { id: b.id, x: box.left - host.left, y: box.top - host.top, size: box.width, colour: b.colour };
    setBursts((list) => [...list, at]);
    window.setTimeout(() => setBursts((list) => list.filter((x) => x.id !== at.id)), 480);
    gone(b.id);
    setPopped((n) => n + 1);
    if (sound) pop();
    buzz(12);
  };

  return (
    <GameFrame title="Pop the bubbles" sub="Tap them as they float up. Miss as many as you like."
               feel={feel} setFeel={setFeel}
               again={() => { setBubbles([]); setPopped(0); }}
               tools={<SoundToggle on={sound} onChange={setSound} />}>
      <div ref={pond} className={`${s.stage} ${s.pond} ${paused ? s.paused : ""}`} role="application"
           aria-label="Bubbles floating up. Tap a bubble to pop it.">
        <p className="pointer-events-none absolute start-4 top-3 z-[1] rounded-full px-3 py-1 text-xs font-semibold tabular-nums"
           style={{ background: "var(--ux-surface)", color: "var(--ux-muted)", border: "1px solid var(--ux-line)" }}>
          popped: {popped}
        </p>
        {bubbles.length === 0 && !paused && (
          <p className="pointer-events-none absolute inset-0 grid place-items-center text-sm" style={{ color: "var(--ux-muted)" }}>
            Bubbles are coming…
          </p>
        )}
        {bubbles.map((b) => (
          <button key={b.id} type="button" aria-label="Pop" className={s.bubble}
                  onPointerDown={(e) => burst(b, e.currentTarget)}
                  onAnimationEnd={(e) => { if (e.animationName.includes("rise")) gone(b.id); }}
                  style={{ left: `${b.left}%`, width: b.size, height: b.size,
                           ["--b" as string]: b.colour, ["--d" as string]: `${b.dur}s` }} />
        ))}
        {bursts.map((x) => (
          <span key={x.id} className={s.burst}
                style={{ left: x.x, top: x.y, width: x.size, height: x.size, ["--b" as string]: x.colour }} />
        ))}
      </div>
      <p className="mt-3 text-center text-xs" style={{ color: "var(--ux-muted)" }}>
        Take your time. When you are ready, tap &ldquo;I&apos;m done&rdquo;.
      </p>
    </GameFrame>
  );
}
