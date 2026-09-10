"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

import { apiMeShell, type MeShell } from "@/lib/shell-api";

/**
 * One request for everything the member shell needs.
 *
 * ── What this replaces ──────────────────────────────────────────────────────
 * Every member screen used to boot by firing `/auth/session`, `/layout/me`,
 * `/layout/me/features`, `/me/progress` and `/me/unread` — and `/me/unread`
 * twice, because the header and the greeting each asked for it. Six requests
 * and eight queries before a screen asked for anything of its own. At ~22ms a
 * round trip that is most of a second of a woman watching a spinner, on a
 * phone, on a connection worse than the one this was measured on.
 *
 * `GET /me/shell` has returned all of it in one request for a while and
 * nothing called it. This is the thing that calls it.
 *
 * ── Why it falls back rather than insisting ─────────────────────────────────
 * `/me/shell` sits behind `require_active_member`, so a woman still waiting on
 * her documents gets a 401 from it while the individual endpoints answer her
 * fine. A batching optimisation that logs out everyone mid-verification would
 * be a spectacularly bad trade, so a failure here is not an error: `ready`
 * stays false, and each consumer falls back to the calls it always made.
 */

type Shell = {
  /** Null until it arrives, or forever if this member cannot use the batch. */
  data: MeShell | null;
  /**
   * Three states, not two.
   *
   * A consumer has to be able to tell "not here YET" from "not coming". With
   * only a boolean, every consumer fired its own fallback request on first
   * render and then got the batch a moment later — so the batch ADDED a
   * request instead of removing four. Measured: `/me/shell` arrived and
   * `/me/progress` and `/me/unread` had already gone out beside it.
   */
  status: "loading" | "ready" | "unavailable";
  /** Re-read it — after marking notifications read, say. */
  refresh: () => void;
};

const ShellContext = createContext<Shell>({
  // Outside the provider — staff screens — there is no batch and never will be,
  // so consumers should go straight to their own calls rather than wait.
  data: null, status: "unavailable", refresh: () => {},
});

export function useShell(): Shell {
  return useContext(ShellContext);
}

export function ShellProvider({
  children,
  initial = null,
}: {
  children: React.ReactNode;
  /**
   * The payload the server already fetched on this request.
   *
   * When present there is nothing to wait for: the provider starts `ready` and
   * skips its own fetch entirely, so no consumer ever sees `loading` and none
   * of them fire the fallback calls that state exists to permit.
   */
  initial?: MeShell | null;
}) {
  const [data, setData] = useState<MeShell | null>(initial);
  const [status, setStatus] = useState<Shell["status"]>(initial ? "ready" : "loading");
  const alive = useRef(true);

  const load = useCallback(() => {
    // Deliberately NOT setting "loading" here.
    //
    // `load` runs from an effect on mount, and setting state synchronously in
    // an effect body triggers a second render pass before anything has been
    // fetched. "loading" is already the initial state, so the only case this
    // served was a manual `refresh()` — and there the old data should stay on
    // screen while the new arrives rather than every consumer falling back to
    // its placeholder for a moment.
    apiMeShell()
      .then((s) => { if (alive.current) { setData(s); setStatus("ready"); } })
      // Not an error: a woman still in verification gets a 401 here and her
      // screens fall back to the calls that do serve her.
      .catch(() => { if (alive.current) { setData(null); setStatus("unavailable"); } });
  }, []);

  useEffect(() => {
    alive.current = true;
    // Only when the server could not answer. Fetching again here would ask the
    // same question with the same cookie and get the same answer a round trip
    // later — which is the whole waterfall this change removes.
    if (!initial) load();
    return () => { alive.current = false; };
    // `initial` is fixed for the life of the provider: it comes from the
    // server render of the layout above, so re-running on it is not a case
    // that exists.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  return (
    <ShellContext.Provider value={{ data, status, refresh: load }}>
      {children}
    </ShellContext.Provider>
  );
}
