"use client";

import { useEffect } from "react";

import { swSupported } from "@/lib/pwa";

/** At most one update check every ten minutes, however often she switches apps. */
const UPDATE_EVERY_MS = 10 * 60 * 1000;

/**
 * Registers `public/sw.js` — and, in development, makes sure one is not there.
 *
 * ── Why the development branch exists ───────────────────────────────────────
 * A service worker outlives the page that installed it. Run the production
 * build once on `localhost:3100`, go back to `next dev` on the same origin,
 * and the old worker is still in charge: it serves the old build's hashed
 * chunks and every edit appears to do nothing. That failure is invisible and
 * costs an afternoon, so dev actively unregisters instead of merely skipping
 * registration.
 *
 * ── Why the update dance ────────────────────────────────────────────────────
 * A new worker installs and then *waits* until every tab of the old one is
 * gone. On a phone, an installed app is never closed — it is backgrounded for
 * weeks. So the app would keep running a build from a month ago with a fixed
 * version sitting inches away, unused. Posting `SKIP_WAITING` retires the old
 * worker immediately.
 *
 * It deliberately does NOT reload the page afterwards. An automatic reload is
 * a form loses her work; the new worker takes effect at the next navigation,
 * which in this app is seconds away and costs her nothing.
 */
export default function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (!swSupported()) return;

    if (process.env.NODE_ENV !== "production") {
      navigator.serviceWorker
        .getRegistrations()
        .then((regs) => regs.forEach((r) => void r.unregister()))
        .catch(() => {
          /* Nothing registered, or storage is blocked. Either is fine. */
        });
      return;
    }

    let cancelled = false;
    let last = 0;
    let registration: ServiceWorkerRegistration | null = null;

    /** Retire a worker that has installed and is waiting its turn. */
    const promote = (reg: ServiceWorkerRegistration) => {
      if (reg.waiting) reg.waiting.postMessage({ type: "SKIP_WAITING" });
    };

    navigator.serviceWorker
      .register("/sw.js", {
        scope: "/",
        // Without this the browser may serve `sw.js` itself from its own HTTP
        // cache for up to a day, so a shipped fix waits a day to be noticed.
        updateViaCache: "none",
      })
      .then((reg) => {
        if (cancelled) return;
        registration = reg;
        promote(reg);
        reg.addEventListener("updatefound", () => {
          const next = reg.installing;
          if (!next) return;
          next.addEventListener("statechange", () => {
            // `installed` with a controller present means "an update is ready",
            // as opposed to the very first install, where there is nothing to
            // replace and nothing to skip.
            if (next.state === "installed" && navigator.serviceWorker.controller) {
              promote(reg);
            }
          });
        });
      })
      .catch(() => {
        /* Registration is blocked (private mode, enterprise policy, an
           insecure origin behind a proxy). The app works; it just has no
           offline page. */
      });

    /*
      The only reliable "the app was opened" signal a standalone PWA gets.
      There is no page load to hang an update check on — she taps the icon and
      the existing document is simply shown again.
    */
    const onVisible = () => {
      if (document.visibilityState !== "visible" || !registration) return;
      const now = Date.now();
      if (now - last < UPDATE_EVERY_MS) return;
      last = now;
      registration.update().catch(() => {
        /* Offline, most likely. The next foreground tries again. */
      });
    };

    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return null;
}
