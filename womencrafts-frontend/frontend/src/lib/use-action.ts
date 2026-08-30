"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * The write counterpart to `useResource`.
 *
 * Six screens had hand-rolled this, each slightly differently, and the
 * differences were exactly where the bugs were: one forgot to re-fetch, one
 * swallowed the error, one left the button spinning forever if the request
 * threw. Cancelling a booking was the worst of them — it set local state and
 * never called the server at all, so a woman who cancelled was still marked
 * down as expected on the day.
 *
 * What it does, and why each part earns its place:
 *
 * **Optimistic.** The tap has to feel instant on a 2G connection. `optimistic`
 * paints the outcome immediately; if the request fails it is rolled back and
 * she is told, rather than the screen quietly disagreeing with the server.
 *
 * **A named error, not a swallowed one.** A woman who pressed "cancel" and saw
 * nothing change must be told it did not work. The API's own sentence is used
 * where there is one — every `HTTPException` in this backend carries a message
 * written for a person — and a plain fallback where there is not.
 *
 * **Busy is per action, not per screen.** A list of ten bookings needs to know
 * which one is being cancelled, so `run` takes an id and `busyWith` names it.
 *
 * **It never resolves into an unmounted component.** A woman who taps away
 * mid-request should not have a reply arriving at a screen that is gone.
 */

export interface Action<A extends unknown[]> {
  /** Fire it. Resolves true if the server agreed. */
  run: (...args: A) => Promise<boolean>;
  /** Which id is in flight, or null. */
  busyWith: string | null;
  busy: boolean;
  /** What went wrong, in words she can act on. Cleared on the next attempt. */
  error: string;
  clearError: () => void;
}

/** Pull the sentence the API wrote for a person, or fall back to a plain one. */
export function messageFrom(e: unknown, fallback: string): string {
  const r = (e as { response?: { data?: unknown; status?: number } })?.response;
  const d = r?.data as
    | { error?: { message?: string }; detail?: string | { msg?: string }[] }
    | undefined;

  if (typeof d?.error?.message === "string") return d.error.message;
  if (typeof d?.detail === "string") return d.detail;
  if (Array.isArray(d?.detail) && d.detail[0]?.msg) return String(d.detail[0].msg);
  // A network failure has no response at all, and "check your connection" is
  // more use than "request failed" to a woman on a train.
  if (!r) return "We could not reach WomSakhi. Check your connection and try again.";
  return fallback;
}

export function useAction<A extends unknown[]>(
  perform: (...args: A) => Promise<unknown>,
  {
    onDone,
    optimistic,
    rollback,
    fallbackError = "That did not go through. Try again in a moment.",
  }: {
    /** Usually the resource's `refetch`, so the screen ends on server truth. */
    onDone?: () => void;
    /** Paint the outcome before the server answers. */
    optimistic?: (...args: A) => void;
    /** Undo it if the server refuses. */
    rollback?: (...args: A) => void;
    fallbackError?: string;
  } = {},
): Action<A> {
  const [busyWith, setBusyWith] = useState<string | null>(null);
  const [error, setError] = useState("");

  // Kept in a ref so `run` stays stable: a changing callback identity would
  // re-render every row in a list on each keystroke elsewhere on the screen.
  const alive = useRef(true);
  // Without this the ref stays true forever and the guard below does nothing —
  // which is the same as not having written it.
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);
  // The callbacks, kept current without making `run` unstable. Updated in an
  // effect rather than during render: writing to a ref while rendering is the
  // same mistake `useResource` made, and React is entitled to throw the render
  // away and redo it.
  const fns = useRef({ perform, onDone, optimistic, rollback, fallbackError });
  useEffect(() => {
    fns.current = { perform, onDone, optimistic, rollback, fallbackError };
  });

  const run = useCallback(async (...args: A) => {
    // The first argument is the id when there is one — a list needs to know
    // which row is busy, not merely that something is.
    const id = typeof args[0] === "string" ? args[0] : "one";
    setBusyWith(id);
    setError("");
    fns.current.optimistic?.(...args);
    try {
      await fns.current.perform(...args);
      if (alive.current) fns.current.onDone?.();
      return true;
    } catch (e) {
      if (alive.current) {
        fns.current.rollback?.(...args);
        setError(messageFrom(e, fns.current.fallbackError));
      }
      return false;
    } finally {
      if (alive.current) setBusyWith(null);
    }
  }, []);

  return {
    run,
    busyWith,
    busy: busyWith !== null,
    error,
    clearError: useCallback(() => setError(""), []),
  };
}
