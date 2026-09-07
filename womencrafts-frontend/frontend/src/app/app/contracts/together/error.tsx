"use client";

import { HomeShell } from "@/components/ux/home/HomeShell";
import { ScreenError } from "@/components/ux/kit";

/**
 * The error boundary for this route.
 *
 * The shell stays: nav and search keep working, because the app is not broken —
 * one screen is. Replacing the whole window with an apology strands her on the
 * failure with nowhere to go.
 */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <HomeShell>
      <ScreenError what="the ways to bid together" reset={reset} detail={error.digest} />
    </HomeShell>
  );
}
