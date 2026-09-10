"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Loader2 } from "@/components/ux/icons";

import { useT } from "@/i18n";
import { SLOW_AFTER } from "@/lib/wait";

/**
 * App-wide top navigation progress bar (brand gradient + glow).
 * Starts the instant an internal link is clicked (or back/forward is used) and
 * completes when the route finishes changing — giving immediate click feedback
 * without any external dependency. Dependency-free so it stays compatible with
 * this customised Next.js build.
 *
 * ── Why it also has words now ───────────────────────────────────────────────
 * A 3px line across the very top of the window is a good answer to "did my tap
 * register?" and no answer at all to "is this working, or has it died?". On a
 * phone that line sits beside the notch, above where anyone is looking, and it
 * is the ONLY feedback a route change gets for its first second and a half —
 * on this app's connections, plenty of route changes last eight.
 *
 * So past `WORDS_AFTER` the bar grows a label in the middle of the screen that
 * says, in her language, that something is opening. Past `SLOW_AFTER` the
 * label says the connection is slow, which is the difference between "wait"
 * and "this is broken, put the phone down".
 *
 * Neither threshold shows anything on a fast navigation: a label that appears
 * and vanishes inside a few frames reads as a fault, not as progress.
 */

/**
 * Nielsen's second limit is one second — the edge of an uninterrupted train of
 * thought. A little past it is where a person stops assuming and starts
 * wondering, and that is the moment worth spending words on.
 */
const WORDS_AFTER = 1400;

export default function RouteProgress() {
  const pathname = usePathname();
  const tr = useT();
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  /** 0 nothing, 1 "Opening…", 2 "Still opening — your connection is slow." */
  const [say, setSay] = useState(0);

  const trickle = useRef<ReturnType<typeof setInterval> | null>(null);
  const hide = useRef<ReturnType<typeof setTimeout> | null>(null);
  const failsafe = useRef<ReturnType<typeof setTimeout> | null>(null);
  const words = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = () => {
    if (trickle.current) { clearInterval(trickle.current); trickle.current = null; }
    if (failsafe.current) { clearTimeout(failsafe.current); failsafe.current = null; }
    words.current.forEach(clearTimeout);
    words.current = [];
  };

  const start = () => {
    if (hide.current) { clearTimeout(hide.current); hide.current = null; }
    clearTimers();
    setVisible(true);
    setSay(0);
    words.current = [
      setTimeout(() => setSay(1), WORDS_AFTER),
      setTimeout(() => setSay(2), SLOW_AFTER),
    ];
    setProgress(8);
    trickle.current = setInterval(() => {
      setProgress((p) => {
        if (p >= 90) return p;
        const step = p < 35 ? 9 : p < 65 ? 4.5 : p < 80 ? 2 : 0.6;
        return Math.min(90, p + step);
      });
    }, 170);
    // never leave the bar stuck if a navigation is cancelled
    failsafe.current = setTimeout(() => done(), 8000);
  };

  const done = () => {
    clearTimers();
    setProgress(100);
    setSay(0);
    hide.current = setTimeout(() => {
      setVisible(false);
      setProgress(0);
    }, 280);
  };

  // complete whenever the resolved route changes
  useEffect(() => {
    done();
    return clearTimers;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // begin on internal link clicks + browser back/forward
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const anchor = (e.target as HTMLElement)?.closest?.("a");
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (
        !href ||
        anchor.getAttribute("target") === "_blank" ||
        anchor.hasAttribute("download") ||
        href.startsWith("#") ||
        href.startsWith("mailto:") ||
        href.startsWith("tel:")
      )
        return;
      let url: URL;
      try {
        url = new URL((anchor as HTMLAnchorElement).href, window.location.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return;
      // same page (ignoring hash) → nothing to load
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      start();
    };
    const onPop = () => start();
    document.addEventListener("click", onClick, true);
    window.addEventListener("popstate", onPop);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", onPop);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <div
        aria-hidden
        className={`pointer-events-none fixed inset-x-0 top-0 z-[200] h-[3px] transition-opacity duration-200 ${
          visible ? "opacity-100" : "opacity-0"
        }`}
      >
        <div
          className="h-full rounded-r-full bg-linear-to-r from-brand-600 via-brand-500 to-violet-500 shadow-[0_0_10px_var(--color-brand-600),0_0_5px_var(--color-violet-500)] transition-[width] duration-200 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/*
        The label. `ux` on the wrapper because every colour it uses is declared
        on that class and this component is mounted in the root layout, outside
        the member app's wrapper — see the note at the top of WaitScreen.tsx.
        `.ux-loadword` puts the background back to transparent, so the class
        contributes its variables and not its canvas.

        `role="status"` and polite: a route change is something she asked for,
        so it waits its turn rather than interrupting whatever is being read.
      */}
      {visible && say > 0 && (
        <div className="ux-loadword ux" role="status" aria-live="polite" aria-atomic="true">
          <span className="text-xs font-semibold">
            <Loader2 className="ux-turn h-4 w-4 shrink-0" aria-hidden />
            <span className="truncate">{say > 1 ? tr("wait.openingSlow") : tr("wait.opening")}</span>
          </span>
        </div>
      )}
    </>
  );
}
