"use client";

import { useCallback, useEffect, useRef } from "react";

/** This URL with `?step=` set to `s` (or removed), every other param kept. */
function urlFor(s: string | null): string {
  const url = new URL(window.location.href);
  if (s) url.searchParams.set("step", s);
  else url.searchParams.delete("step");
  return url.pathname + url.search + url.hash;
}

/**
 * The browser's (and the phone's) Back button walks a multi-step auth screen
 * backwards instead of leaving it.
 *
 * Every forward step adds a history entry (`?step=<name>`, other params kept,
 * through the native `history.pushState` that Next 16 integrates with its
 * router). A step that consumes the one before it — the code she just used —
 * `replace`s that entry, so Back never lands on a spent code. A `lock`ed step
 * (recovery codes that are shown once) holds its ground. From the first step,
 * Back leaves the page as usual.
 *
 * `back(target)` is what the on-screen back links call: when `target` is the
 * previous entry it is a real `history.back()`, so the browser and the screen
 * never disagree; otherwise it moves forward to `target`.
 *
 * On a reload a stale `?step=` is dropped: the data behind it (the number, the
 * ticket) is gone, so she starts from the first step.
 */
export function useStepHistory<T extends string>(
  step: T | null,
  go: (to: T) => void,
  opts: { replace?: (to: T) => boolean; lock?: (at: T) => boolean } = {},
) {
  const trail = useRef<T[]>([]);
  const pos = useRef(0);
  const fromPop = useRef(false);
  const current = useRef<T | null>(null);
  const goRef = useRef(go);
  const optsRef = useRef(opts);
  const path = useRef("");

  useEffect(() => {
    goRef.current = go;
    optsRef.current = opts;
  });

  useEffect(() => {
    if (!step) return;
    current.current = step;
    if (!trail.current.length) {
      // The first step owns the entry she arrived on.
      path.current = window.location.pathname;
      trail.current = [step];
      pos.current = 0;
      if (new URL(window.location.href).searchParams.has("step")) window.history.replaceState(window.history.state, "", urlFor(null));
      return;
    }
    if (fromPop.current) {
      fromPop.current = false;
      return;
    }
    if (trail.current[pos.current] === step) return;
    if (optsRef.current.replace?.(step) && pos.current > 0) {
      trail.current[pos.current] = step;
      window.history.replaceState(window.history.state, "", urlFor(step));
    } else {
      trail.current = [...trail.current.slice(0, pos.current + 1), step];
      pos.current += 1;
      window.history.pushState(null, "", urlFor(step));
    }
  }, [step]);

  useEffect(() => {
    const onPop = () => {
      if (window.location.pathname !== path.current || !trail.current.length) return;
      const now = current.current;
      if (now && optsRef.current.lock?.(now)) {
        window.history.pushState(null, "", urlFor(now));
        return;
      }
      const raw = new URL(window.location.href).searchParams.get("step") as T | null;
      const target = raw ?? trail.current[0];
      const t = trail.current;
      if (t[pos.current - 1] === target) pos.current -= 1;
      else if (t[pos.current + 1] === target) pos.current += 1;
      else pos.current = Math.max(0, t.lastIndexOf(target));
      if (target === now) return;
      fromPop.current = true;
      current.current = target;
      goRef.current(target);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  return useCallback((target: T) => {
    if (pos.current > 0 && trail.current[pos.current - 1] === target) window.history.back();
    else goRef.current(target);
  }, []);
}
