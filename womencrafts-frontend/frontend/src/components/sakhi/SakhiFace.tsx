"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Sakhi's face, animated from a mouth track.
 *
 * ── Why her own mouth is warped, and not replaced ───────────────────────────
 * Two approaches were built and measured. Painting her mouth out and drawing a
 * vector one over the gap gives perfect control — including true closure, which
 * a warp cannot do — but the patch leaves a visible smudge on a shaded render
 * and a drawn mouth does not match the rendering of the artwork around it. It
 * looked worse than doing nothing.
 *
 * So her real mouth moves, with her own shading, highlights and lip colour. The
 * change that made it READ is the crop: the image is cropped to her face, so
 * the mouth is roughly three times the size it was and the movement is visible
 * rather than sub-pixel.
 *
 * The known limit is closure. A stretched photograph of an open smile never
 * fully seals, so p/b/m are approximated by squeezing to the floor and fading a
 * lip-coloured seal over the teeth. Truly perfect closure needs mouth shapes
 * drawn by an illustrator in her style — the engine already accepts them.
 *
 * ── What else keeps her from looking frozen ─────────────────────────────────
 * A still face with a moving mouth is uncanny on its own. She also blinks at
 * irregular intervals, breathes with a slow scale, and drifts her head very
 * slightly while speaking. None of it is noticed individually; together they
 * are the difference between a person and a portrait.
 */

/** The mouth box, measured inside sakhi-face.webp (484×489). */
const MOUTH = { left: 0.4277, top: 0.6953, right: 0.6591, bottom: 0.8303 };
const MOUTH_W = MOUTH.right - MOUTH.left;
const MOUTH_H = MOUTH.bottom - MOUTH.top;

export interface MouthFrame {
  at: number;
  open: number;
  wide: number;
  round: number;
}

function sample(track: MouthFrame[], ms: number): MouthFrame {
  if (track.length === 0) return { at: 0, open: 0, wide: 0.35, round: 0 };
  if (ms <= track[0].at) return track[0];
  for (let i = 1; i < track.length; i++) {
    if (ms <= track[i].at) {
      const a = track[i - 1];
      const b = track[i];
      // Ease between shapes. A real mouth passes through the positions between
      // two sounds; snapping between them reads as a flicker.
      const raw = (ms - a.at) / Math.max(1, b.at - a.at);
      const t = raw * raw * (3 - 2 * raw);
      return {
        at: ms,
        open: a.open + (b.open - a.open) * t,
        wide: a.wide + (b.wide - a.wide) * t,
        round: a.round + (b.round - a.round) * t,
      };
    }
  }
  return track[track.length - 1];
}

export default function SakhiFace({
  track,
  playing,
  startedAt,
  size = 260,
  className = "",
}: {
  track: MouthFrame[];
  playing: boolean;
  startedAt: number;
  size?: number;
  className?: string;
}) {
  const [blink, setBlink] = useState(false);
  const mouthRef = useRef<HTMLDivElement>(null);
  const sealRef = useRef<HTMLDivElement>(null);
  const headRef = useRef<HTMLDivElement>(null);
  const raf = useRef(0);

  // Irregular blinking. A metronome blink is its own kind of uncanny.
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const loop = () => {
      setBlink(true);
      setTimeout(() => setBlink(false), 120);
      t = setTimeout(loop, 2400 + Math.random() * 4200);
    };
    t = setTimeout(loop, 1500);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const mouth = mouthRef.current;
    const seal = sealRef.current;
    if (!playing) {
      if (mouth) mouth.style.transform = "translate(-50%, -50%) scale(1,1)";
      if (seal) seal.style.opacity = "0";
      if (headRef.current) headRef.current.style.transform = "translate(0,0) rotate(0deg)";
      return;
    }
    const tick = () => {
      const ms = performance.now() - startedAt;
      const { open, wide, round } = sample(track, ms);
      if (mouth) {
        // The jaw drops downward from the top of the mouth, the way a real one
        // does. Scaling about the centre lifts the upper lip into the nose.
        const scaleY = 1 + open * 1.15;
        const scaleX = 1 + (wide - 0.35) * 0.34 - round * 0.38;
        const drop = open * 26;
        mouth.style.transform =
          `translate(-50%, calc(-50% + ${drop}%)) scale(${scaleX.toFixed(3)}, ${scaleY.toFixed(3)})`;
      }
      if (seal) seal.style.opacity = String(Math.max(0, 1 - open * 7));
      // A slow drift while she talks — nobody holds their head perfectly still.
      if (headRef.current) {
        const s = ms / 1000;
        const x = Math.sin(s * 0.9) * 1.6;
        const y = Math.sin(s * 1.35 + 1) * 1.1;
        const r = Math.sin(s * 0.65) * 0.5;
        headRef.current.style.transform = `translate(${x}px, ${y}px) rotate(${r}deg)`;
      }
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [playing, startedAt, track]);

  return (
    <div
      className={`relative select-none ${className}`}
      style={{ width: size, height: size * (489 / 484) }}
      aria-hidden
    >
      <div
        ref={headRef}
        className="absolute inset-0 will-change-transform"
        style={{ transition: playing ? "none" : "transform 600ms ease-out" }}
      >
        {/* her face, with the original mouth painted out */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/sakhi-face.webp"
          alt=""
          draggable={false}
          className={`absolute inset-0 h-full w-full object-contain transition-transform duration-[2600ms] ease-in-out ${
            playing ? "scale-[1.004]" : "scale-100"
          }`}
        />

        {/* her own mouth, transformed */}
        <div
          ref={mouthRef}
          className="pointer-events-none absolute origin-top will-change-transform"
          style={{
            left: `${((MOUTH.left + MOUTH.right) / 2) * 100}%`,
            top: `${((MOUTH.top + MOUTH.bottom) / 2) * 100}%`,
            width: `${MOUTH_W * size}px`,
            height: `${MOUTH_H * size * (489 / 484)}px`,
            transform: "translate(-50%, -50%)",
            backgroundImage: "url(/sakhi-face.webp)",
            backgroundSize: `${size}px ${size * (489 / 484)}px`,
            backgroundPosition: `-${MOUTH.left * size}px -${MOUTH.top * size * (489 / 484)}px`,
          }}
        >
          {/* lip-coloured seal for p/b/m and silence — the one shape a warp
              cannot make on its own */}
          <div
            ref={sealRef}
            className="absolute left-1/2 top-1/2"
            style={{
              width: "80%",
              height: "36%",
              transform: "translate(-50%, -44%) rotate(-4deg)",
              borderRadius: "50%",
              background:
                "radial-gradient(ellipse at 50% 32%, #E2596B 0%, #C4526B 58%, #A8425A 100%)",
              boxShadow: "0 1px 3px rgba(120,40,60,.5)",
              opacity: 0,
              transition: "opacity 40ms linear",
            }}
          />
        </div>

        {/* eyelids */}
        {[0.335, 0.545].map((x) => (
          <div
            key={x}
            className="pointer-events-none absolute transition-transform duration-100 ease-out"
            style={{
              left: `${x * 100}%`,
              top: "40.5%",
              width: "12.5%",
              height: "4.4%",
              background: "linear-gradient(#F6B48F, #EFA075)",
              borderRadius: "50% 50% 45% 45%",
              transformOrigin: "top center",
              transform: `scaleY(${blink ? 1 : 0})`,
            }}
          />
        ))}
      </div>
    </div>
  );
}
