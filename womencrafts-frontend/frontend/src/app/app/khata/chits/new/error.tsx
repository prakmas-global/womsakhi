"use client";

import { HomeShell } from "@/components/ux/home/HomeShell";
import { ScreenError } from "@/components/ux/kit";

/**
 * The error boundary for this route.
 *
 * The shell stays: nav and search keep working, because the app is not broken —
 * one screen is.
 */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <HomeShell>
      <ScreenError what="your chits" reset={reset} detail={error.digest} />
    </HomeShell>
  );
}
