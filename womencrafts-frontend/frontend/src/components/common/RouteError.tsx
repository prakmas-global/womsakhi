"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";

/**
 * The error boundary body shared by every route outside the member app —
 * the staff dashboard, the public pages and the auth pages.
 *
 * The member app has its own (`ScreenError`, inside `HomeShell`) because it
 * can keep her navigation on screen. These routes sit inside their own
 * layouts, which Next preserves around this component, so all this has to do
 * is explain the failure and offer the two ways out: retry, or leave.
 *
 * `what` names the thing that failed in the reader's words — "the billing
 * settings", "your reports" — because "an error occurred" tells nobody which
 * part of the screen to stop trusting.
 */
export default function RouteError({
  what = "this page",
  reset,
  digest,
  home = "/dashboard",
  homeLabel = "Back to dashboard",
}: {
  what?: string;
  reset?: () => void;
  digest?: string;
  home?: string;
  homeLabel?: string;
}) {
  return (
    <div role="alert" className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-status-warn-bg text-status-warn-ink">
        <AlertTriangle className="h-8 w-8" strokeWidth={1.8} />
      </span>

      <h1 className="mt-4 font-display text-xl font-bold text-ink">
        We could not load {what}
      </h1>
      <p className="mt-1.5 max-w-[44ch] text-sm leading-relaxed text-ink-subtle">
        This is a problem on our side, not something you did. Trying again usually works — the
        connection may simply have dropped.
      </p>

      <div className="mt-5 flex flex-wrap justify-center gap-3">
        {reset && (
          <button type="button" onClick={reset} className="btn btn-primary">
            <RefreshCw className="h-4 w-4" aria-hidden />
            Try again
          </button>
        )}
        <a href={home} className="btn btn-secondary">{homeLabel}</a>
      </div>

      {digest && (
        <p className="mt-5 text-[0.6875rem] text-ink-faint">Reference: {digest}</p>
      )}
    </div>
  );
}
