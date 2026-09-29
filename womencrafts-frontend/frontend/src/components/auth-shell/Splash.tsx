"use client";

import { useCallback, useEffect, useState } from "react";

import { SPLASH_KEY } from "./splash-key";

/**
 * S1 / S1b — the opening moment, once per browser session.
 *
 * Switch the owner's choice here: "video" is S1 (the logo reveal on its own
 * night-blue, the rose-gold tagline, a thin loader); "light" is S1b (the full
 * logo on #fffafd with the animated lotus under it).
 */
export const SPLASH_VARIANT: "video" | "light" = "video";


const SHOW_MS = 2500;
const REDUCED_MS = 600;
const FADE_MS = 320;

/**
 * Set once the splash has run (or was found already seen) in this page's
 * lifetime, so a client-side move from /signin to /signup never re-mounts it
 * for a frame. False during hydration, which keeps the first client render
 * identical to the server's.
 */
let settled = false;

/**
 * Whether this session had already seen it when the page loaded — read (and
 * the flag written) exactly once, so an effect that runs twice (React's
 * development double-invoke) cannot see its own write and skip the splash.
 */
let seenAtLoad: boolean | null = null;
function readSeenOnce(): boolean {
  if (seenAtLoad === null) {
    try {
      seenAtLoad = !!window.sessionStorage.getItem(SPLASH_KEY);
      window.sessionStorage.setItem(SPLASH_KEY, "1");
    } catch {
      seenAtLoad = false; // storage blocked: show it, it is only 2.5 s
    }
  }
  return seenAtLoad;
}

/**
 * Fails open three ways:
 *  - the server HTML carries it, but a CSS animation fades it out after 2.5 s
 *    (0.6 s with reduced motion) even if JavaScript never arrives;
 *  - the inline script in the (auth) layout hides it before first paint when
 *    this session has already seen it;
 *  - storage that throws (private mode, blocked site data) just means it shows.
 * A tap, a click or Esc skips it.
 */
export function Splash() {
  const [phase, setPhase] = useState<"on" | "leaving" | "off">(() => (settled ? "off" : "on"));

  const leave = useCallback(() => {
    settled = true;
    setPhase((p) => (p === "on" ? "leaving" : p));
  }, []);

  useEffect(() => {
    if (phase === "off") return;
    if (phase === "leaving") {
      const t = window.setTimeout(() => setPhase("off"), FADE_MS);
      return () => window.clearTimeout(t);
    }
    const seen = readSeenOnce();
    settled = true;
    if (seen) {
      const t = window.setTimeout(() => setPhase("off"));
      return () => window.clearTimeout(t);
    }
    let reduced = false;
    try {
      reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch {
      /* old engines */
    }
    const t = window.setTimeout(leave, reduced ? REDUCED_MS : SHOW_MS);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") leave();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("keydown", onKey);
    };
  }, [phase, leave]);

  if (phase === "off") return null;

  return (
    <div
      className={`wsa-splash wsa-splash-${SPLASH_VARIANT}${phase === "leaving" ? " is-leaving" : ""}`}
      aria-hidden
      onClick={leave}
    >
      {SPLASH_VARIANT === "video" ? (
        <>
          <div className="wsa-splash-vid">
            <video
              // The clip is 6 s and its wordmark fades in at 3.2–4.0 s; starting
              // at 1.8 s lands the whole logo ~2 s in, inside the 2.5 s splash.
              src="/womsakhi-reveal.mp4#t=1.8"
              poster="/womsakhi-reveal.jpg"
              muted
              autoPlay
              playsInline
              preload="auto"
              disablePictureInPicture
              tabIndex={-1}
            />
          </div>
          <div className="wsa-splash-foot">
            <div className="wsa-tagline">Stronger women · Brighter tomorrows</div>
            <div className="wsa-loader" />
          </div>
        </>
      ) : (
        <div className="wsa-splash-stack">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/ux/auth/logo.webp" alt="" className="wsa-splash-lock" width={800} height={817} />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/womsakhi-lotus-airflow.gif" alt="" className="wsa-splash-gif" width={455} height={92} />
        </div>
      )}
    </div>
  );
}

export default Splash;
