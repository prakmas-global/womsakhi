"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * "Is this a phone-width screen?", answered in JavaScript.
 *
 * ── Why a hook and not a CSS class ──────────────────────────────────────────
 * `Sheet` renders through a portal, so wrapping one in `<div className="lg:hidden">`
 * no longer hides it: `display: none` applies to the wrapper, and the panel is
 * mounted somewhere else entirely. A phone-only overlay therefore has to be
 * phone-only in its `open` condition, not in its ancestor's stylesheet.
 *
 * ── Why `useSyncExternalStore` ──────────────────────────────────────────────
 * `matchMedia` does not exist on the server. Seeding `useState` from it is a
 * hydration mismatch; setting it in an effect paints the wrong branch for a
 * frame and trips the lint rule against it. This gives React an explicit
 * server snapshot instead, and React re-renders once on the client if they
 * differ — which is exactly the supported path.
 */
export function useNarrow(maxPx = 1023): boolean {
  const q = `(max-width: ${maxPx}px)`;
  const subscribe = useCallback((cb: () => void) => {
    const m = window.matchMedia(q);
    m.addEventListener("change", cb);
    return () => m.removeEventListener("change", cb);
  }, [q]);
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(q).matches,
    // The server has no viewport. Assume wide, which is what every `lg:` class
    // assumes too, so the markup Next sends and the CSS agree.
    () => false,
  );
}
