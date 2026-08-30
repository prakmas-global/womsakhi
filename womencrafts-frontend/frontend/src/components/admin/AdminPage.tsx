"use client";

import { Alert, Card, Skeleton } from "@/design-system";

/**
 * The frame the newer staff screens share: heading, one primary action, and a
 * row of KPI tiles.
 *
 * The older dashboard screens each rolled their own header; rather than rewrite
 * all of them, everything added from here on uses this so the module pages stay
 * consistent with each other.
 */
export default function AdminPage({
  title,
  subtitle,
  action,
  stats,
  error,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  stats?: { label: string; value: React.ReactNode; tone?: string }[];
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="wc-page-enter">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-bold tracking-tight text-ink">{title}</h1>
          {subtitle && <p className="mt-1 max-w-2xl text-sm text-ink-subtle">{subtitle}</p>}
        </div>
        {action}
      </div>

      {error && (
        <Alert variant="danger" className="mb-4">
          {error}
        </Alert>
      )}

      {stats && stats.length > 0 && (
        <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((s) => (
            <Card key={s.label}>
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">
                {s.label}
              </p>
              <p
                className={`mt-1 font-display text-2xl font-bold ${s.tone ?? "text-ink"}`}
              >
                {s.value}
              </p>
            </Card>
          ))}
        </div>
      )}

      {children}
    </div>
  );
}

/** Uniform loading state, so every module screen waits the same way. */
export function AdminLoading({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-20 w-full rounded-2xl" />
      ))}
    </div>
  );
}
