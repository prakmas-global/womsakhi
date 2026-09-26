"use client";

import { useCallback, useEffect, useState } from "react";

import { invalidateReads } from "./api";

/**
 * One hook every redesigned screen reads its data through.
 *
 * Fetching stays here so screens share cancellation, refetching, and a single
 * honest source state instead of each growing its own `useEffect`.
 *
 * So the fetch lives here instead, and it does three things no screen should
 * have to repeat:
 *
 * **It never presents fallback data as a successful response.** Callers pass a
 * safe empty shape so the screen can keep rendering, while `source: "error"`
 * and `error` preserve the failure for the connection banner and local states.
 *
 * **It never leaves her on a spinner.** The empty shape is available from the
 * first frame and replaced when real data lands.
 *
 * **It cancels on unmount.** A woman who taps away mid-request should not have
 * a reply arriving into a component that no longer exists.
 */
export type Source = "live" | "error" | "loading";

export interface Resource<T> {
  data: T;
  source: Source;
  /** The error, if the request failed. The caller's safe empty shape is in `data`. */
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
        setState({
          data: fallback,
          source: "error",
          error: e instanceof Error ? e : new Error(String(e)),
        });
      });

    return () => { alive = false; ctl.abort(); };
    // `fallback` is a module constant at every call site; listing it would
    // re-fetch on each render for the ones that build it inline.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetcher, nonce]);

  // An explicit refetch means the screen has reason to think the answer has
  // changed — after a write, or because she pulled to refresh. Serving it a
  // held copy would make the gesture do nothing, so the cache is dropped first
  // and this goes to the server.
  const refetch = useCallback(() => {
    invalidateReads();
    setNonce((n) => n + 1);
  }, []);
  return { ...state, refetch };
}
