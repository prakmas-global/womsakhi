"use client";

import { usePathname } from "next/navigation";
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
 * part of the screen to stop trusting. It is the only thing each route has to
 * say: where "back" goes is decided here from the URL, so the same two strings
 * are not written out across 58 files and then drift apart.
 */
export default function RouteError({
  what = "this page",
  reset,
  digest,
  home,
  homeLabel,
}: {
  what?: string;
  reset?: () => void;
  digest?: string;
  /** Overrides the destination derived from the URL. Rarely needed. */
  home?: string;
  homeLabel?: string;
}) {
  const pathname = usePathname() ?? "";
  const area =
    pathname.startsWith("/dashboard") ? { href: "/dashboard", label: "Back to dashboard" }
    : /^\/(signin|signup|forgot-password|reset-password)/.test(pathname)
                                      ? { href: "/signin",   label: "Back to sign in" }
    :                                   { href: "/",         label: "Back to the home page" };
  const backHref  = home ?? area.href;
  const backLabel = homeLabel ?? area.label;
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
        <a href={backHref} className="btn btn-secondary">{backLabel}</a>
      </div>

      {digest && (
        <p className="mt-5 text-2xs text-ink-faint">Reference: {digest}</p>
      )}
    </div>
  );
}
