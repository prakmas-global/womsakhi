"use client";

import { HomeShell } from "@/components/ux/home/HomeShell";
import { ScreenError } from "@/components/ux/kit";

/** The error boundary for this route. The shell stays: one screen is broken, not the app. */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <HomeShell>
      <ScreenError what="your rentals" reset={reset} detail={error.digest} />
    </HomeShell>
  );
}
