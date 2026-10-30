"use client";

import { HomeShell } from "@/components/ux/home/HomeShell";
import { ScreenError } from "@/components/ux/kit";

/**
 * The error boundary for My Khata. The shell stays: one screen is broken, not
 * the app, so nav and search keep working.
 */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <HomeShell>
      <ScreenError what="your khata" reset={reset} detail={error.digest} />
    </HomeShell>
  );
}
