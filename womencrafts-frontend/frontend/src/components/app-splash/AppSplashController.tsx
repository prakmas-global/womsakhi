"use client";

import { useEffect } from "react";

import { AWAY_KEY, AWAY_MINUTES, SPLASH_ATTR } from "./open-check";

/** A video that cannot play (blocked, failed) still gives the logo a moment. */
const FALLBACK_MS = 2500;
/** The reveal is 6 s; this only catches a video that stalls. */
const MAX_MS = 8000;
/** A beat on the last frame, so the logo lands before the fade. */
const HOLD_MS = 300;
const FADE_MS = 320;

/**
 * Runs the splash the inline check switched on, and switches it on again when
 * she comes back to an app left open in the background for AWAY_MINUTES.
 * Renders nothing; it works on the markup AppSplash already put in the page.
 */
export default function AppSplashController() {
  useEffect(() => {
    const root = document.documentElement;
    const video = document.getElementById("app-splash-video") as HTMLVideoElement | null;
    let timers: number[] = [];
    const clear = () => { timers.forEach((t) => window.clearTimeout(t)); timers = []; };
    const later = (fn: () => void, ms: number) => timers.push(window.setTimeout(fn, ms));

    const close = () => {
      if (root.getAttribute(SPLASH_ATTR) !== "on") return;
      clear();
      root.setAttribute(SPLASH_ATTR, "leaving");
      later(() => {
        root.removeAttribute(SPLASH_ATTR);
        video?.pause();
      }, FADE_MS);
    };

    const run = () => {
      clear();
      later(close, MAX_MS);
      if (!video) { later(close, FALLBACK_MS); return; }
      if (video.ended) { later(close, HOLD_MS); return; }
      const p = video.play();
      p?.catch(() => later(close, FALLBACK_MS));
    };

    const onEnded = () => later(close, HOLD_MS);
    const onError = () => later(close, FALLBACK_MS);
    video?.addEventListener("ended", onEnded);
    video?.addEventListener("error", onError);

    if (root.getAttribute(SPLASH_ATTR) === "on") run();

    // Back to an app that stayed open in the background: an open, if she was
    // away long enough.
    const onVisibility = () => {
      try {
        if (document.visibilityState === "hidden") {
          window.localStorage.setItem(AWAY_KEY, String(Date.now()));
          return;
        }
        const since = Number(window.localStorage.getItem(AWAY_KEY) || 0);
        window.localStorage.removeItem(AWAY_KEY);
        if (!since || Date.now() - since < AWAY_MINUTES * 60_000) return;
        if (window.location.pathname.startsWith("/dev/")) return;
      } catch {
        return;
      }
      if (video) video.currentTime = 0;
      root.setAttribute(SPLASH_ATTR, "on");
      run();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      clear();
      video?.removeEventListener("ended", onEnded);
      video?.removeEventListener("error", onError);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return null;
}
