"use client";

import { HomeShell } from "@/components/ux/home/HomeShell";
import { ScreenError } from "@/components/ux/kit";
import { useT } from "@/i18n";

/**
 * The error boundary for this route.
 *
 * The shell stays: nav and search keep working, because the app is not broken —
 * one screen is. Replacing the whole window with an apology strands her on the
 * failure with nowhere to go.
 */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const tr = useT();
  return (
    <HomeShell>
      <ScreenError what={tr("safety.theSafetyCentre")} reset={reset} detail={error.digest} />
    </HomeShell>
  );
}
