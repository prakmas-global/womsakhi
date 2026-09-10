"use client";

import { HomeShell } from "@/components/ux/home/HomeShell";
import { ScreenError } from "@/components/ux/kit";

/** Error boundary for this route. The member shell stays. */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <HomeShell>
      <ScreenError what="this form" reset={reset} detail={error.digest} />
    </HomeShell>
  );
}
