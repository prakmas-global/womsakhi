"use client";

import { useCallback, useEffect, useState } from "react";

import { useKhata } from "@/components/ux/khata/KhataGate";
import { apiErrorMessage } from "@/lib/api";

/**
 * Load something from her khata, inside <KhataGate>.
 *
 * Not `useResource`: a 423 here is not an error to show — it means the PIN's
 * key lapsed, and the gate takes over (`locked`). Everything else is a
 * sentence she can act on.
 */
export function useKhataLoad<T>(fetch: (signal: AbortSignal) => Promise<T>) {
  const { locked } = useKhata();
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const ctl = new AbortController();
    // A tick later, so this effect never sets state while it runs.
    const t = window.setTimeout(() => {
      fetch(ctl.signal)
        .then((d) => { setData(d); setError(""); })
        .catch((e) => {
          if (ctl.signal.aborted || locked(e)) return;
          setError(apiErrorMessage(e, "This did not load. Check your connection and try again."));
        });
    }, 0);
    return () => { window.clearTimeout(t); ctl.abort(); };
  }, [fetch, locked, tick]);

  const reload = useCallback(() => setTick((n) => n + 1), []);
  return { data, setData, error, reload, loading: data === null && !error };
}
