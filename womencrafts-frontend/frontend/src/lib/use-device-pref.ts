"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * A preference that belongs to this device, not to her account.
 *
 * Some settings genuinely are per-device and should not follow her: larger
 * text on the phone she struggles to read, downloads over wifi only on the
 * connection she pays for by the megabyte, the wake word on the handset that
 * has a microphone. Writing those to her account would mean a choice made on
 * her own phone changing the shared computer at the community centre.
 *
 * What was wrong was not the store, it was that there was none — every one of
 * these screens held its switches in `useState`, so a choice lasted until she
 * navigated away, and nothing on the screen said so.
 *
 * **Why `useSyncExternalStore` and not an effect.** Reading storage in an
 * effect and calling `setState` cascades a second render on every mount, which
 * is the same mistake `useResource` documents at length. Reading it during
 * render instead would differ from what the server rendered and break
 * hydration. This hook is the API built for exactly that shape: React asks the
 * server for `fallback` and the browser for the stored value, and reconciles
 * them itself.
 */
export function useDevicePref<T>(key: string, fallback: T): [T, (v: T) => void] {
  const full = `ux.pref.${key}`;

  const subscribe = useCallback((onChange: () => void) => {
    // `storage` fires for other tabs; `ux-pref` is our own, for this one.
    window.addEventListener("storage", onChange);
    window.addEventListener("ux-pref", onChange);
    return () => {
      window.removeEventListener("storage", onChange);
      window.removeEventListener("ux-pref", onChange);
    };
  }, []);

  // Must return a stable reference for an unchanged value, or React re-renders
  // for ever — hence the parsed cache rather than a fresh JSON.parse each call.
  const snapshot = useCallback(() => read(full, fallback), [full, fallback]);
  const server = useCallback(() => fallback, [fallback]);

  const value = useSyncExternalStore(subscribe, snapshot, server);

  const write = useCallback(
    (v: T) => {
      try {
        window.localStorage.setItem(full, JSON.stringify(v));
      } catch {
        // Storage blocked — a private window, or site data turned off. The
        // setting is not worth taking the screen down for.
      }
      cache.set(full, { raw: safeRaw(full), parsed: v });
      window.dispatchEvent(new Event("ux-pref"));
    },
    [full],
  );

  return [value, write];
}

/** raw text → parsed value, so an unchanged store returns an unchanged object. */
const cache = new Map<string, { raw: string | null; parsed: unknown }>();

function read<T>(key: string, fallback: T): T {
  const raw = safeRaw(key);
  if (raw === null) return fallback;
  const held = cache.get(key);
  if (held && held.raw === raw) return held.parsed as T;
  try {
    const parsed = JSON.parse(raw) as T;
    cache.set(key, { raw, parsed });
    return parsed;
  } catch {
    return fallback;
  }
}

function safeRaw(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
