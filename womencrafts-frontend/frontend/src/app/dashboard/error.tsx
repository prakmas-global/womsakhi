"use client";

import { Card, ErrorState } from "@/design-system";

/**
 * The error boundary for the dashboard.
 *
 * There were forty-five routes under `/dashboard` and no boundary over any of
 * them, so a thrown render anywhere in here escaped to Next's own error page —
 * the stack trace one, with no navigation and nothing to press. The member app
 * has had a boundary per route since Phase 3; this side had none at all.
 *
 * It stays inside the dashboard layout on purpose: the sidebar and topbar keep
 * working, because one panel failing is not the same as the product failing.
 */
export default function DashboardError({
  error, reset,
}: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <Card className="mx-auto max-w-xl">
      <ErrorState
        title="We could not load this page"
        description="This is usually the connection rather than anything you did, and nothing you have saved has been lost."
        onRetry={reset}
      />
      {error.digest && (
        <p className="pb-5 text-center font-mono text-2xs text-ink-subtle">{error.digest}</p>
      )}
    </Card>
  );
}
