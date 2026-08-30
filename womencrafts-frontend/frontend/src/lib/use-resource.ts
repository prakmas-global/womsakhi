"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * One hook every redesigned screen reads its data through.
 *
 * The redesign was built on mock data by instruction, so that the screens could
 * be judged before the server existed. Wiring them up afterwards has an obvious
 * failure mode: thirty screens each grow their own `useEffect`, their own
 * `loading` boolean and their own idea of what to show when the request fails,
 * and the loading and error states that Phase 3 built as architecture get
 * quietly bypassed one screen at a time.
 *
 * So the fetch lives here instead, and it does three things no screen should
 * have to repeat:
 *
 * **It falls back to the mock rather than to nothing.** A module whose endpoint
 * does not exist yet — and a third of them do not — keeps working exactly as it
 * did. `source` says which she is looking at, so nobody has to guess whether a
 * screen is live.
 *
 * **It never leaves her on a spinner.** The mock is returned immediately and
 * replaced when the real data lands, so the screen is readable from the first
 * frame on a slow connection instead of blank for four seconds.
 *
 * **It cancels on unmount.** A woman who taps away mid-request should not have
 * a reply arriving into a component that no longer exists.
 */
export type Source = "live" | "mock" | "loading";

export interface Resource<T> {
  data: T;
  source: Source;
  /** The error, if the request failed. The mock is still in `data`. */
  error: Error | null;
  refetch: () => void;
}

export function useResource<T>(
  /**
   * Wrap this in `useCallback` at the call site. It is a real dependency — an
   * inline arrow changes identity every render and would re-fetch forever.
   */
  fetcher: (signal: AbortSignal) => Promise<T>,
  fallback: T,
): Resource<T> {
  const [state, setState] = useState<{ data: T; source: Source; error: Error | null }>({
    data: fallback,
    source: "loading",
    error: null,
  });
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    const ctl = new AbortController();
    let alive = true;

    // Nothing is set here, only in the callbacks below. Setting state in the
    // body of an effect cascades a second render before the request has even
    // left, and it would also flash the previous screen back to a skeleton on
    // every refetch — the old data is a better thing to look at while the new
    // data is on its way.
    fetcher(ctl.signal)
      .then((got) => {
        if (alive && !ctl.signal.aborted) setState({ data: got, source: "live", error: null });
      })
      .catch((e: unknown) => {
        if (!alive || ctl.signal.aborted) return;
        // Deliberately not empty. The mock is a worse answer than the real one
        // and a far better answer than a blank screen — and `source` says which
        // she is looking at, so nothing pretends the fallback is hers.
        setState({
          data: fallback,
          source: "mock",
          error: e instanceof Error ? e : new Error(String(e)),
        });
      });

    return () => { alive = false; ctl.abort(); };
    // `fallback` is a module constant at every call site; listing it would
    // re-fetch on each render for the ones that build it inline.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetcher, nonce]);

  const refetch = useCallback(() => setNonce((n) => n + 1), []);
  return { ...state, refetch };
}
