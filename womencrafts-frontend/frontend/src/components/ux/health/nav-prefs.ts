"use client";

import { useSyncExternalStore } from "react";

/**
 * Health sections she chose to hide from her menu (Fertility, Pregnancy).
 *
 * The choice itself lives in her health settings (`trackCycle`, `trackPreg`)
 * on the server. The app's menu draws before any Health page has loaded those,
 * so the last known answer is kept here, in this browser, and refreshed every
 * time her settings load or change. The ids are the nav-tree ids.
 */

const KEY = "ws-health-hidden";
const listeners = new Set<() => void>();
let cached: string | null = null;

function read(): string {
  if (cached !== null) return cached;
  try { cached = window.localStorage.getItem(KEY) ?? ""; } catch { cached = ""; }
  return cached;
}

export function setHiddenHealth(ids: string[]) {
  const next = [...ids].sort().join(",");
  if (next === read()) return;
  cached = next;
  try { window.localStorage.setItem(KEY, next); } catch { /* private window: the menu still follows this tab */ }
  listeners.forEach((l) => l());
}

/** From her settings: what to hide in the menu. */
export const hiddenFrom = (s: { trackCycle?: boolean; trackPreg?: boolean }) =>
  [s.trackCycle === false ? "fertility" : "", s.trackPreg === false ? "pregnancy" : ""].filter(Boolean);

function subscribe(cb: () => void) {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => { if (e.key === KEY) { cached = null; cb(); } };
  window.addEventListener("storage", onStorage);
  return () => { listeners.delete(cb); window.removeEventListener("storage", onStorage); };
}

/** The hidden nav ids, as a string ("fertility,pregnancy"); "" on the server. */
export function useHiddenHealth(): string {
  return useSyncExternalStore(subscribe, read, () => "");
}
