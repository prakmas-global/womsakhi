"use client";

import { usePathname } from "next/navigation";
import { AlertTriangle, Home, RefreshCw, ShieldCheck } from "lucide-react";

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
    <div role="alert" className="grid min-h-[60vh] place-items-center px-4 py-8 sm:px-6">
      <div className="relative isolate w-full max-w-xl overflow-hidden rounded-3xl border border-line bg-surface px-6 py-9 text-center shadow-[var(--wc-shadow-overlay)] sm:px-10">
        <span aria-hidden className="pointer-events-none absolute left-1/2 top-0 -z-10 h-44 w-44 -translate-x-1/2 -translate-y-1/3 rounded-full bg-status-warn-bg blur-3xl" />
        <span className="mx-auto flex h-[72px] w-[72px] items-center justify-center rounded-[22px] border border-status-warn-border bg-status-warn-bg text-status-warn-ink shadow-sm">
          <AlertTriangle className="h-8 w-8" strokeWidth={1.7} aria-hidden />
        </span>

      <h1 className="mt-5 font-display text-2xl font-bold tracking-tight text-ink">
        We could not load {what}
      </h1>
      <p className="mx-auto mt-2 max-w-[44ch] text-sm leading-6 text-ink-subtle">
        This is a problem on our side, not something you did. Trying again usually works — the
        connection may simply have dropped.
      </p>

      <p className="mx-auto mt-4 flex w-fit items-center gap-2 rounded-xl bg-status-ok-bg px-3 py-2 text-xs font-medium text-status-ok-ink">
        <ShieldCheck className="h-4 w-4" aria-hidden /> Your saved work is safe.
      </p>

      <div className="mt-6 flex flex-wrap justify-center gap-3">
        {reset && (
          <button type="button" onClick={reset} className="btn btn-primary">
            <RefreshCw className="h-4 w-4" aria-hidden />
            Try again
          </button>
        )}
        <a href={backHref} className="btn btn-secondary"><Home className="h-4 w-4" aria-hidden />{backLabel}</a>
      </div>

        {digest && (
        <p className="mt-5 text-2xs text-ink-faint">Reference: {digest}</p>
        )}
      </div>
    </div>
  );
}
