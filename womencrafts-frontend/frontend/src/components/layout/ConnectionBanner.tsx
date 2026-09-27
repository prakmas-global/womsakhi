"use client";

import { useEffect, useState } from "react";
import { CloudOff, RefreshCw, Wifi, X } from "lucide-react";

import { clearFailures, subscribeToFailures, type RequestFailure } from "@/lib/request-errors";

/**
 * Tells the user when the app could not reach the server.
 *
 * ── Why this exists ─────────────────────────────────────────────────────────
 * Without it, a failed request is indistinguishable from no data. A list screen
 * catches the error, renders its empty state, and says "No members yet" — which
 * is not merely unhelpful, it is wrong. The user has no reason to retry, and no
 * reason to report a bug, because nothing looks broken.
 *
 * ── Why a banner and not a toast ────────────────────────────────────────────
 * A toast is for something that happened once and is over. This is a *state*:
 * the data on screen is stale or missing, and stays that way until something
 * changes. A banner persists while the condition does, and clears itself when
 * requests start succeeding again.
 *
 * ── Why it does not block ───────────────────────────────────────────────────
 * Whatever loaded before the failure is still worth reading. A modal would take
 * that away to deliver news the banner can give without it.
 */
export default function ConnectionBanner() {
  const [failures, setFailures] = useState<RequestFailure[]>([]);
  const [dismissed, setDismissed] = useState(false);
  const [nativeOffline, setNativeOffline] = useState(false);
  const [recovered, setRecovered] = useState(false);

  useEffect(() => subscribeToFailures(setFailures), []);

  useEffect(() => {
    const read = () => setNativeOffline(!navigator.onLine);
    const online = () => {
      setNativeOffline(false);
      setRecovered(true);
      window.setTimeout(() => setRecovered(false), 4000);
    };
    read();
    window.addEventListener("offline", read);
    window.addEventListener("online", online);
    return () => {
      window.removeEventListener("offline", read);
      window.removeEventListener("online", online);
    };
  }, []);

  // A fresh failure after a dismissal is new news — show it again.
  useEffect(() => {
    if (!failures.length) return;
    const timer = window.setTimeout(() => setDismissed(false), 0);
    return () => window.clearTimeout(timer);
  }, [failures.length]);

  if ((!failures.length && !nativeOffline && !recovered) || dismissed) return null;

  // No response at all is a different problem from a server error, and the
  // difference changes what the user should do about it.
  const offline = nativeOffline || failures.some((f) => f.status === 0);
  const count = failures.length;

  if (recovered && !failures.length && !nativeOffline) {
    return (
      <div
        role="status"
        aria-live="polite"
        data-connection-banner="recovered"
        className="fixed bottom-[max(12px,env(safe-area-inset-bottom))] left-1/2 z-[60] flex w-[calc(100%-24px)] max-w-md -translate-x-1/2 items-center gap-3 rounded-2xl border border-status-ok-border bg-surface/95 px-4 py-3 text-status-ok-ink shadow-[var(--wc-shadow-overlay)] backdrop-blur-xl"
      >
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-status-ok-bg">
          <Wifi className="h-4.5 w-4.5" aria-hidden />
        </span>
        <p className="min-w-0 flex-1 text-sm"><span className="font-semibold">You’re back online.</span> New information can sync again.</p>
        <button onClick={() => setRecovered(false)} aria-label="Dismiss connection message" className="rounded-lg p-2 transition hover:bg-status-ok-bg">
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
    );
  }

  return (
    <div
      role="status"
      aria-live="polite"
      // A stable hook for the checks. Next's dev overlay also uses
      // role="status", so querying by role alone matched the wrong element and
      // reported this banner as working when it was not rendering at all.
      data-connection-banner=""
      className="fixed bottom-[max(12px,env(safe-area-inset-bottom))] left-1/2 z-[60] flex w-[calc(100%-24px)] max-w-2xl -translate-x-1/2 flex-wrap items-center gap-3 rounded-2xl border border-status-danger-border bg-surface/95 px-3 py-3 shadow-[var(--wc-shadow-overlay)] backdrop-blur-xl sm:flex-nowrap sm:px-4"
    >
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-status-danger-bg text-status-danger-ink">
        <CloudOff className="h-5 w-5" aria-hidden />
      </span>
      <p className="min-w-0 flex-1 text-sm leading-5 text-status-danger-ink">
        <span>
          <span className="font-semibold">
            {offline ? "You’re offline." : "Some information didn’t load."}
          </span>{" "}
          <span className="opacity-90">
            {offline
              ? "You can keep reading saved information. We’ll reconnect automatically."
              : `${count} request${count === 1 ? "" : "s"} failed, so this screen may be incomplete.`}
          </span>
        </span>
      </p>

      <div className="ml-auto flex items-center gap-1.5">
        <button
          onClick={() => {
            clearFailures();
            window.location.reload();
          }}
          disabled={nativeOffline}
          className="flex min-h-9 items-center gap-1.5 rounded-xl bg-status-danger-solid px-3 py-2 text-xs font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-45"
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden /> Try again
        </button>
        <button
          onClick={() => setDismissed(true)}
          aria-label="Dismiss connection message"
          className="rounded-lg p-2 text-status-danger-ink transition hover:bg-status-danger-bg"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}
