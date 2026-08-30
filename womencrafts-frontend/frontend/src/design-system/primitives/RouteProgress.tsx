"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

/**
 * App-wide top navigation progress bar (brand gradient + glow).
 * Starts the instant an internal link is clicked (or back/forward is used) and
 * completes when the route finishes changing — giving immediate click feedback
 * without any external dependency. Dependency-free so it stays compatible with
 * this customised Next.js build.
 */
export default function RouteProgress() {
  const pathname = usePathname();
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);

  const trickle = useRef<ReturnType<typeof setInterval> | null>(null);
  const hide = useRef<ReturnType<typeof setTimeout> | null>(null);
  const failsafe = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = () => {
    if (trickle.current) { clearInterval(trickle.current); trickle.current = null; }
    if (failsafe.current) { clearTimeout(failsafe.current); failsafe.current = null; }
  };

  const start = () => {
    if (hide.current) { clearTimeout(hide.current); hide.current = null; }
    clearTimers();
    setVisible(true);
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
    <div
      aria-hidden
      className={`pointer-events-none fixed inset-x-0 top-0 z-[200] h-[3px] transition-opacity duration-200 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
    >
      <div
        className="h-full rounded-r-full bg-linear-to-r from-brand-600 via-brand-500 to-violet-500 shadow-[0_0_10px_rgba(230,17,126,0.8),0_0_5px_rgba(124,58,237,0.6)] transition-[width] duration-200 ease-out"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}
