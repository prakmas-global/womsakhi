"use client";

/**
 * Sakhi herself — a free-standing figure, not a portrait in a frame.
 *
 * She is deliberately NOT inside the conversation panel. A face inside the
 * window is a chat app with an avatar on it; a woman standing on the page with
 * a window beside her is someone who came over to help. That distinction is the
 * entire brief, and it is why there is no card, no circle and no border here.
 *
 * ── Why animated WebP and not video ─────────────────────────────────────────
 * Standing on the page means standing on whatever is behind her, so she needs a
 * real cut-out. Video cannot carry transparency, and this machine's ffmpeg
 * reports VP9 alpha support while silently writing none. WebP does carry alpha,
 * plays in a plain <img>, and needs no canvas keying at runtime. The cut is done
 * once, offline, by scratchpad/cutout.py.
 *
 * ── Talking vs waiting ──────────────────────────────────────────────────────
 * An animated WebP cannot be paused, so the two states are two files and the
 * `src` swaps between them. Waiting currently falls back to a still frame plus
 * a slow float, which keeps her from reading as a dead image — an idle clip
 * drops into `idleSrc` and is strictly better.
 */

export interface MouthFrame {
  at: number;
  open: number;
  wide: number;
  round: number;
}

export default function SakhiAvatar({
  playing,
  size,
  className = "",
  talkingSrc = "/sakhi-talking-160.png",
  stillSrc = "/sakhi-still.webp",
  idleSrc,
}: {
  /** Mouth track — accepted for API compatibility; the clip carries its own. */
  track?: MouthFrame[];
  playing: boolean;
  startedAt?: number;
  /** Fixed pixel size. Omit and she fills her parent as a square. */
  size?: number;
  greeting?: boolean;
  className?: string;
  talkingSrc?: string;
  stillSrc?: string;
  /** A looping clip of her listening. Used instead of the still when present. */
  idleSrc?: string;
}) {
  const src = playing ? talkingSrc : (idleSrc ?? stillSrc);

  return (
    <div
      className={`pointer-events-none relative select-none ${size ? "" : "aspect-square w-full"} ${className}`}
      style={size ? { width: size, height: size } : undefined}
      aria-hidden
    >
      {/* Warmth on the floor behind her, stronger while she is talking. Sits
          behind her and blurred, so it never reads as an outline. */}
      <div
        className="absolute inset-0 -z-10 rounded-full transition-opacity duration-700"
        style={{
          background: "radial-gradient(circle at 50% 58%, #D21F7C4D, #7440A600 68%)",
          filter: "blur(26px)",
          opacity: playing ? 0.9 : 0.4,
          transform: "scale(1.15)",
        }}
      />

      <img
        // Swapping the file restarts the animation, which is what we want —
        // she should begin each sentence from the top, not mid-gesture.
        key={src}
        src={src}
        alt=""
        draggable={false}
        className={`h-full w-full object-contain ${playing ? "" : "sakhi-float"}`}
        style={{ filter: "drop-shadow(0 14px 20px rgba(0,0,0,0.28))" }}
      />
    </div>
  );
}
