"use client";

import { useCallback, useEffect, useRef } from "react";

type Stored<T> = { savedAt: number; value: T };

/**
 * Preserve a non-sensitive unfinished form on this device.
 *
 * Restoration happens after hydration so server and browser render the same
 * first frame. Writes begin only after that restoration pass, which prevents
 * an empty initial form from erasing a saved draft.
 */
export function useFormDraft<T>(key: string, value: T, restore: (value: T) => void, days = 7) {
  const restoredKeyRef = useRef<string | null>(null);

  useEffect(() => {
    restoredKeyRef.current = null;
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const stored = JSON.parse(raw) as Stored<T>;
        if (stored?.savedAt && Date.now() - stored.savedAt < days * 86_400_000) {
          restore(stored.value);
        } else {
          localStorage.removeItem(key);
        }
      }
    } catch {
      // Storage can be unavailable in private browsing; the form still works.
    }
    restoredKeyRef.current = key;
  }, [key, days, restore]);

  useEffect(() => {
    if (restoredKeyRef.current !== key) return;
    const timer = window.setTimeout(() => {
      try {
        const now = Date.now();
        localStorage.setItem(key, JSON.stringify({ savedAt: now, value } satisfies Stored<T>));
      } catch {
        // Saving a draft is a convenience and must never block the form.
      }
    }, 350);
    return () => window.clearTimeout(timer);
  }, [key, value]);

  const clear = useCallback(() => {
    try { localStorage.removeItem(key); } catch { /* storage unavailable */ }
  }, [key]);

  return { clear };
}
