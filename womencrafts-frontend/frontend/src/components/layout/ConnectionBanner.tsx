"use client";

import { useEffect, useState } from "react";
import { RefreshCw, WifiOff, X } from "lucide-react";

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

  useEffect(() => subscribeToFailures(setFailures), []);

  // A fresh failure after a dismissal is new news — show it again.
  useEffect(() => {
    if (failures.length) setDismissed(false);
  }, [failures.length]);

  if (!failures.length || dismissed) return null;

  // No response at all is a different problem from a server error, and the
  // difference changes what the user should do about it.
  const offline = failures.some((f) => f.status === 0);
  const count = failures.length;

  return (
    <div
      role="status"
      aria-live="polite"
      // A stable hook for the checks. Next's dev overlay also uses
      // role="status", so querying by role alone matched the wrong element and
      // reported this banner as working when it was not rendering at all.
      data-connection-banner=""
      className="fixed inset-x-0 bottom-0 z-[60] flex flex-wrap items-center justify-center gap-3 border-t border-status-danger-border bg-status-danger-bg px-4 py-3 shadow-[0_-8px_24px_-14px_rgba(0,0,0,0.3)]"
    >
      <p className="flex items-center gap-2 text-sm text-status-danger-ink">
        <WifiOff className="h-4 w-4 shrink-0" aria-hidden />
        <span>
          <span className="font-semibold">
            {offline ? "Can't reach the server." : "Something didn't load."}
          </span>{" "}
          <span className="opacity-90">
            {offline
              ? "Check your connection — what's on screen may be out of date."
              : `${count} request${count > 1 ? "s" : ""} failed. What's on screen may be incomplete.`}
          </span>
        </span>
      </p>

      <div className="flex items-center gap-2">
        <button
          onClick={() => {
            clearFailures();
            window.location.reload();
          }}
          className="flex items-center gap-1.5 rounded-xl bg-status-danger-solid px-3 py-1.5 text-xs font-semibold text-white transition hover:opacity-90"
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden /> Try again
        </button>
        <button
          onClick={() => setDismissed(true)}
          aria-label="Dismiss"
          className="rounded-lg p-1.5 text-status-danger-ink transition hover:bg-status-danger-border"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}
