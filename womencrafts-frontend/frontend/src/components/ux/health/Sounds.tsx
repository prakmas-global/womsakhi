"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { toast } from "@/components/ux/mobile/Toast";
import { Btn } from "@/components/ux/kit";
import { Chips, HUE, I, Panel, type Hue } from "./kit";

/**
 * Sleep and calming sounds, made in the browser with Web Audio — nothing is
 * downloaded and nothing is saved. One sound plays at a time; a timer fades
 * it out so she can fall asleep to it. Used in Sleep (Sounds & stories) and
 * Mental Wellness (Meditate & listen).
 */

export const SOUNDS = [
  { id: "rain", label: "Gentle rain", icon: "CloudRain" },
  { id: "waves", label: "Ocean waves", icon: "Waves" },
  { id: "birds", label: "Forest birds", icon: "Sprout" },
  { id: "bowl", label: "Singing bowl", icon: "Bell" },
  { id: "brown", label: "Soft brown noise", icon: "AudioLines" },
] as const;
export type SoundId = (typeof SOUNDS)[number]["id"];

const TIMERS = [{ value: "0", label: "No timer" }, { value: "15", label: "15 min" }, { value: "30", label: "30 min" }, { value: "60", label: "1 hour" }];
const FADE = 1.2;

type Engine = { ctx: AudioContext; master: GainNode; stop: () => void };

function noiseBuffer(ctx: AudioContext, kind: "pink" | "brown") {
  const len = ctx.sampleRate * 8;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    if (kind === "brown") {
      last = (last + 0.02 * w) / 1.02;
      d[i] = last * 3.5;
    } else {
      b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852;
      b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
      d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
      b6 = w * 0.115926;
    }
  }
  return buf;
}

function loop(ctx: AudioContext, buf: AudioBuffer, out: AudioNode, filters: BiquadFilterNode[] = [], gain = 1) {
  const src = ctx.createBufferSource();
  src.buffer = buf; src.loop = true;
  const g = ctx.createGain(); g.gain.value = gain;
  let node: AudioNode = src;
  for (const f of filters) { node.connect(f); node = f; }
  node.connect(g); g.connect(out);
  src.start();
  return { src, g };
}

const filter = (ctx: AudioContext, type: BiquadFilterType, freq: number) => {
  const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; return f;
};

function start(id: SoundId, volume: number): Engine {
  const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new Ctx();
  const master = ctx.createGain();
  master.gain.setValueAtTime(0, ctx.currentTime);
  master.gain.linearRampToValueAtTime(volume, ctx.currentTime + FADE);
  master.connect(ctx.destination);
  const timers: number[] = [];
  const sources: AudioScheduledSourceNode[] = [];

  if (id === "rain") {
    sources.push(loop(ctx, noiseBuffer(ctx, "pink"), master, [filter(ctx, "highpass", 400), filter(ctx, "lowpass", 6500)], 0.9).src);
  } else if (id === "brown") {
    sources.push(loop(ctx, noiseBuffer(ctx, "brown"), master, [filter(ctx, "lowpass", 500)], 0.7).src);
  } else if (id === "waves") {
    const { src, g } = loop(ctx, noiseBuffer(ctx, "brown"), master, [filter(ctx, "lowpass", 900)], 0.35);
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.09;
    const depth = ctx.createGain(); depth.gain.value = 0.3;
    lfo.connect(depth); depth.connect(g.gain); lfo.start();
    sources.push(src, lfo);
  } else if (id === "birds") {
    sources.push(loop(ctx, noiseBuffer(ctx, "pink"), master, [filter(ctx, "lowpass", 2500)], 0.12).src);
    const chirp = () => {
      const t0 = ctx.currentTime + 0.05;
      const n = 2 + Math.floor(Math.random() * 3);
      const base = 2400 + Math.random() * 1400;
      for (let k = 0; k < n; k++) {
        const t = t0 + k * 0.16;
        const o = ctx.createOscillator(); const e = ctx.createGain();
        o.type = "sine";
        o.frequency.setValueAtTime(base, t);
        o.frequency.exponentialRampToValueAtTime(base * 1.5, t + 0.1);
        e.gain.setValueAtTime(0, t);
        e.gain.linearRampToValueAtTime(0.12, t + 0.02);
        e.gain.exponentialRampToValueAtTime(0.0001, t + 0.13);
        o.connect(e); e.connect(master); o.start(t); o.stop(t + 0.15);
      }
      timers.push(window.setTimeout(chirp, 1500 + Math.random() * 3500));
    };
    chirp();
  } else if (id === "bowl") {
    const strike = () => {
      const t = ctx.currentTime + 0.05;
      for (const [mult, amp] of [[1, 0.35], [2.76, 0.18], [5.4, 0.08], [8.9, 0.04]] as const) {
        const o = ctx.createOscillator(); const e = ctx.createGain();
        o.frequency.value = 196 * mult;
        e.gain.setValueAtTime(0, t);
        e.gain.linearRampToValueAtTime(amp, t + 0.02);
        e.gain.exponentialRampToValueAtTime(0.0001, t + 7);
        o.connect(e); e.connect(master); o.start(t); o.stop(t + 7.2);
      }
      timers.push(window.setTimeout(strike, 7000));
    };
    strike();
  }

  return {
    ctx, master,
    stop: () => {
      timers.forEach((x) => window.clearTimeout(x));
      const now = ctx.currentTime;
      master.gain.cancelScheduledValues(now);
      master.gain.setValueAtTime(master.gain.value, now);
      master.gain.linearRampToValueAtTime(0, now + FADE);
      window.setTimeout(() => { sources.forEach((s) => { try { s.stop(); } catch { /* A stopped audio source needs no further cleanup. */ } }); void ctx.close(); }, FADE * 1000 + 50);
    },
  };
}

const clock = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;

export function Sounds({ hue, title, sub, defaultTimer = "30" }: { hue: Hue; title: string; sub?: string; defaultTimer?: string }) {
  const engine = useRef<Engine | null>(null);
  const [playing, setPlaying] = useState<SoundId | null>(null);
  const [volume, setVolume] = useState(0.6);
  const [timer, setTimer] = useState(defaultTimer);
  const [left, setLeft] = useState(0);
  const h = HUE[hue];

  const stop = useCallback(() => {
    engine.current?.stop();
    engine.current = null;
    setPlaying(null);
    setLeft(0);
  }, []);

  const play = (id: SoundId) => {
    if (playing === id) return stop();
    engine.current?.stop();
    try {
      engine.current = start(id, volume);
      setPlaying(id);
      setLeft(Number(timer) * 60);
    } catch {
      engine.current = null;
      setPlaying(null);
      setLeft(0);
      toast("Could not play this sound. Check that audio is allowed and try again.", { tone: "error" });
    }
  };

  // The timer counts down once a second and fades the sound out at zero.
  useEffect(() => {
    if (!playing || !left) return;
    const t = window.setTimeout(() => (left <= 1 ? stop() : setLeft(left - 1)), 1000);
    return () => window.clearTimeout(t);
  }, [playing, left, stop]);

  useEffect(() => {
    const e = engine.current;
    if (e) e.master.gain.setTargetAtTime(volume, e.ctx.currentTime, 0.1);
  }, [volume]);

  useEffect(() => () => engine.current?.stop(), []);

  const now = SOUNDS.find((s) => s.id === playing);
  return (
    <Panel title={title} sub={sub ?? "Made on your phone. Nothing downloads, nothing is saved."}>
      <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))" }}>
        {SOUNDS.map((s) => {
          const on = playing === s.id;
          return (
            <button key={s.id} type="button" aria-pressed={on} onClick={() => play(s.id)}
                    className="ux-press flex min-h-[64px] items-center gap-2.5 rounded-[14px] border-[1.5px] p-2.5 text-start text-[13px] font-bold"
                    style={on ? { borderColor: h.ink, background: h.tint, color: "var(--ux-ink)" }
                              : { borderColor: "var(--ux-line)", background: "var(--ux-surface)", color: "var(--ux-ink)" }}>
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px]" style={{ background: h.tint, color: h.ink }}>
                <I name={on ? "Pause" : s.icon} className="h-[18px] w-[18px]" />
              </span>
              {s.label}
            </button>
          );
        })}
      </div>
      {now && (
        <div className="flex flex-wrap items-center gap-3 rounded-[14px] p-3" style={{ background: h.tint }} role="status">
          <span className="grid h-9 w-9 place-items-center rounded-full" style={{ background: "var(--ux-surface)", color: h.ink }}>
            <I name="Volume2" className="h-[18px] w-[18px]" />
          </span>
          <span className="min-w-0 flex-1 text-sm" style={{ color: "var(--ux-ink)" }}>
            <b>{now.label}</b>{left ? <> · stops in <span className="tabular-nums">{clock(left)}</span></> : " · plays until you stop it"}
          </span>
          <Btn size="sm" variant="outline" icon="Square" onClick={stop}>Stop</Btn>
        </div>
      )}
      <label className="flex items-center gap-3 text-sm font-semibold" style={{ color: "var(--ux-ink-2)" }}>
        <I name="Volume2" className="h-4 w-4" />
        <span className="shrink-0">Volume</span>
        <input type="range" min={0} max={1} step={0.05} value={volume} onChange={(e) => setVolume(Number(e.target.value))}
               aria-label="Volume" className="w-full" style={{ accentColor: h.ink }} />
      </label>
      <Chips label="Stop after" hue={hue} value={timer} options={TIMERS}
             onChange={(v) => { setTimer(v); if (playing) setLeft(Number(v) * 60); }} />
    </Panel>
  );
}
