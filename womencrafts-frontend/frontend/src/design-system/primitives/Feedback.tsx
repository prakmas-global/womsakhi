"use client";

import type { ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";

import Button from "./Button";

/* ------------------------------------------------------------------ */
/* Skeleton                                                            */
/* ------------------------------------------------------------------ */

/**
 * Shimmer placeholder. Prefer a skeleton shaped like the content it replaces
 * over a spinner — the page doesn't jump when the data lands.
 */
export function Skeleton({ className = "h-4 w-full" }: { className?: string }) {
  return <span className={`wc-skeleton block ${className}`} aria-hidden />;
}

/** A few stacked lines, for paragraph-ish content. */
export function SkeletonText({ lines = 3, className = "" }: { lines?: number; className?: string }) {
  return (
    <div className={`space-y-2 ${className}`} role="status" aria-label="Loading">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={`h-3.5 ${i === lines - 1 ? "w-2/3" : "w-full"}`} />
      ))}
    </div>
  );
}

/** Card-shaped placeholder, matching the standard panel padding. */
export function SkeletonCard({ className = "" }: { className?: string }) {
  return (
    <div className={`wc-card p-5 ${className}`} role="status" aria-label="Loading">
      <div className="flex items-center gap-4">
        <Skeleton className="h-12 w-12 rounded-xl" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-5 w-16" />
        </div>
      </div>
    </div>
  );
}

/** Table placeholder — same row rhythm as the real DataTable. */
/**
 * Placeholder rows that go straight inside a `<tbody>`.
 *
 * Table screens showed the word "Loading services…" in a single merged cell.
 * That is honest but it is not a *shape*: the table has no height until data
 * lands, so the page jumps the moment it does, and the eye has to find its
 * place again.
 *
 * Rows of the right width in the right columns hold the space, so the real data
 * replaces them without moving anything.
 */
export function SkeletonRows({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <>
      {/*
        Announced once, on the first row only. The sibling skeletons are marked
        aria-hidden, so without this the whole loading state is silent — a
        screen-reader user hears nothing between asking for the page and the
        data arriving, with no way to tell "still loading" from "empty".
        Repeating it per row would announce "Loading" six times instead.
      */}
      {Array.from({ length: rows }).map((_, r) => (
        <tr key={r} className="border-t border-line">
          {Array.from({ length: cols }).map((_, c) => (
            <td
              key={c}
              className="px-2 py-3"
              {...(r === 0 && c === 0 ? { role: "status", "aria-label": "Loading" } : {})}
            >
              {/* Varied widths — a grid of identical bars reads as a pattern
                  rather than as text waiting to arrive. */}
              <Skeleton className={`h-3 ${["w-3/4", "w-1/2", "w-2/3", "w-5/6", "w-1/3"][(r + c) % 5]}`} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

export function SkeletonTable({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="w-full" role="status" aria-label="Loading">
      <div className="flex gap-4 border-b border-line pb-3">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-3 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex items-center gap-4 border-b border-line py-4">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} className={`h-4 flex-1 ${c === 0 ? "max-w-[10rem]" : ""}`} />
          ))}
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* EmptyState                                                          */
/* ------------------------------------------------------------------ */

/**
 * Shown when a list has nothing in it. Always give the user the next action —
 * an empty screen with no way forward is a dead end.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className = "",
}: {
  icon?: React.ElementType;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-col items-center justify-center px-6 py-14 text-center ${className}`}>
      {Icon && (
        <span className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-linear-to-br from-brand-50 to-violet-50 text-brand-500">
          <Icon className="h-7 w-7" strokeWidth={1.8} />
        </span>
      )}
      <p className="font-display text-base font-bold text-ink">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-ink-subtle">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/**
 * An empty state that knows WHY it is empty.
 *
 * "No services" and "No services match your filters" are different facts and
 * need different offers: the first wants a way to create one, the second wants
 * a way to clear the filter. Fourteen screens rendered a bare sentence with
 * neither, leaving the user to work out which situation they were in and what
 * to do about it.
 *
 * Sized for a table cell as well as a panel, because most of the empty states
 * in this app live inside a `<td colSpan>`.
 */
export function NoResults({
  icon: Icon,
  /** True when a filter or search is narrowing the list. */
  filtered = false,
  thing = "results",
  /** Clears the active filters. Shown only when `filtered`. */
  onClear,
  /** Creates the first one. Shown only when the list is genuinely empty. */
  action,
  description,
  compact = false,
}: {
  icon?: React.ElementType;
  filtered?: boolean;
  thing?: string;
  onClear?: () => void;
  action?: ReactNode;
  description?: string;
  compact?: boolean;
}) {
  const title = filtered ? `No ${thing} match your filters` : `No ${thing} yet`;
  const body =
    description ??
    (filtered
      ? "Try removing a filter or searching for something broader."
      : `When there are ${thing}, they will appear here.`);

  return (
    <div className={`flex flex-col items-center justify-center text-center ${compact ? "px-4 py-8" : "px-6 py-12"}`}>
      {Icon && (
        <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-inset text-ink-faint">
          <Icon className="h-5 w-5" strokeWidth={1.8} />
        </span>
      )}
      <p className="text-sm font-semibold text-ink">{title}</p>
      <p className="mt-1 max-w-xs text-xs text-ink-subtle">{body}</p>
      {filtered && onClear && (
        <Button variant="outline" size="sm" className="mt-4" onClick={onClear}>
          Clear filters
        </Button>
      )}
      {!filtered && action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* ErrorState                                                          */
/* ------------------------------------------------------------------ */

/** Shown when a request fails. Always offers a retry. */
export function ErrorState({
  title = "Something went wrong",
  description = "We couldn't load this right now.",
  onRetry,
  className = "",
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div className={`flex flex-col items-center justify-center px-6 py-14 text-center ${className}`}>
      <span className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-status-danger-bg text-status-danger-ink">
        <XCircle className="h-7 w-7" strokeWidth={1.8} />
      </span>
      <p className="font-display text-base font-bold text-ink">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-ink-subtle">{description}</p>
      {onRetry && (
        <Button variant="outline" size="sm" className="mt-5" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Alert                                                               */
/* ------------------------------------------------------------------ */

const ALERT_STYLES = {
  info: { wrap: "bg-status-info-bg text-status-info-ink", icon: Info, iconCls: "text-status-info-ink" },
  success: { wrap: "bg-status-ok-bg text-status-ok-ink", icon: CheckCircle2, iconCls: "text-status-ok-ink" },
  warning: { wrap: "bg-status-warn-bg text-status-warn-ink", icon: AlertTriangle, iconCls: "text-status-warn-ink" },
  danger: { wrap: "bg-status-danger-bg text-status-danger-ink", icon: XCircle, iconCls: "text-status-danger-ink" },
} as const;

/** Inline message block — validation summaries, banners, confirmations. */
export function Alert({
  variant = "info",
  title,
  children,
  action,
  className = "",
}: {
  variant?: keyof typeof ALERT_STYLES;
  title?: string;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  const { wrap, icon: Icon, iconCls } = ALERT_STYLES[variant];
  return (
    <div role="alert" className={`flex items-start gap-3 rounded-xl px-4 py-3 ${wrap} ${className}`}>
      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${iconCls}`} />
      <div className="min-w-0 flex-1 text-sm">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={title ? "mt-0.5 opacity-90" : ""}>{children}</div>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
