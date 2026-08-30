"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Play } from "lucide-react";

/**
 * The WomSakhi mark, animating itself into being — two women joining hands to
 * form the monogram, then the wordmark.
 *
 * ── Why it keeps its own dark ground ────────────────────────────────────────
 * The animation was authored with a glow around the mark, and a glow only
 * exists against something dark. Keying the ground away and dropping it onto
 * the panel's light gradient turned that glow into a grey haze around the
 * letters — the artwork fighting the background it was pasted onto. So the
 * ground stays, framed deliberately as a dark tile. It reads as a lit sign
 * beside the form rather than a video embedded in a page.
 *
 * ── It introduces itself once, then gets out of the way ─────────────────────
 * The first time someone reaches this screen the reveal plays on its own —
 * that is the whole point of having one, and it is the deliberate choice here
 * even when the browser asks for reduced motion. After that first showing the
 * decision is theirs: it holds on the finished lockup with a play control, and
 * runs again only if asked. Remembered per browser, so it is once per person
 * rather than once per page load.
 *
 * An earlier version swapped the whole tile for a still image under
 * `prefers-reduced-motion`, leaving anyone with that setting — on by default on
 * plenty of machines — staring at a frozen tile with nothing to click and no
 * way to know it had ever been a video. Whatever the autoplay rule is, the
 * video element and its control are always present. Every path lands somewhere:
 *
 *   first visit        it plays on its own, once
 *   returning          it waits on the lockup, one click from playing
 *   autoplay refused   same — visible, and one click from playing
 *   video unsupported  the poster is the frame it would have ended on
 *
 * ── Why it plays once ───────────────────────────────────────────────────────
 * Looping a brand reveal turns an arrival into a GIF. It plays through and
 * holds on the finished lockup, and clicking replays it.
 *
 * Muted, always: a sign-in screen must never make noise by itself. The source
 * clip's audio track is stripped at build time rather than trusted to `muted`.
 */
const SEEN = "womsakhi.reveal.seen";

export default function BrandReveal({ className = "" }: { className?: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [ended, setEnded] = useState(false);

  const start = useCallback(() => {
    const v = ref.current;
    if (!v) return;
    if (v.ended || v.currentTime >= v.duration - 0.05) v.currentTime = 0;
    void v.play().catch(() => setPlaying(false));
  }, []);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;

    // Autoplay is decided here rather than with the `autoPlay` attribute. The
    // attribute is evaluated once, often before the file is ready — and a
    // browser that quietly declines leaves the poster up, which looks exactly
    // like a video that is broken.
    //
    // Storage can throw outright (Safari in private mode, site data blocked),
    // and a brand animation is not worth breaking a sign-in screen over. If it
    // cannot be read, treat this as a first visit and play.
    let firstVisit = true;
    try {
      firstVisit = !window.localStorage.getItem(SEEN);
    } catch { /* no storage — introduce her anyway */ }
    if (!firstVisit) return;
    try {
      window.localStorage.setItem(SEEN, "1");
    } catch { /* it will simply introduce itself again next time */ }

    let cancelled = false;
    const attempt = () => { if (!cancelled) start(); };
    attempt();
    v.addEventListener("loadeddata", attempt);
    v.addEventListener("canplay", attempt);
    return () => {
      cancelled = true;
      v.removeEventListener("loadeddata", attempt);
      v.removeEventListener("canplay", attempt);
    };
  }, [start]);

  // Once it has run its course the control fades back, so the finished lockup
  // is not permanently wearing a button. It returns on hover.
  const showControl = !playing && (!ended ? "opacity-100" : "opacity-0 group-hover:opacity-100");

  return (
    <div
      className={`group relative aspect-square w-full overflow-hidden rounded-[2rem] shadow-[0_24px_60px_-26px_rgba(90,50,140,0.55)] ring-1 ring-white/10 ${className}`}
      style={{ backgroundColor: "var(--ux-media-bed, #121724)" }}
    >
      <video
        ref={ref}
        src="/womsakhi-reveal.mp4"
        poster="/womsakhi-reveal.jpg"
        muted
        playsInline
        preload="auto"
        aria-label="WomSakhi"
        className="h-full w-full object-cover"
        onPlay={() => { setPlaying(true); setEnded(false); }}
        onPause={() => setPlaying(false)}
        onEnded={() => { setPlaying(false); setEnded(true); }}
      />

      <button
        type="button"
        onClick={() => (playing ? ref.current?.pause() : start())}
        aria-label={playing ? "Pause the WomSakhi animation" : "Play the WomSakhi animation"}
        className="absolute inset-0 grid place-items-center focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-400"
      >
        <span
          className={`grid h-14 w-14 place-items-center rounded-full bg-black/50 text-white shadow-lg backdrop-blur transition-opacity duration-300 ${
            playing ? "opacity-0" : showControl
          }`}
        >
          <Play className="h-6 w-6 translate-x-0.5" fill="currentColor" />
        </span>
      </button>
    </div>
  );
}
