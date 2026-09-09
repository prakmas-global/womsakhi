"use client";

import { HomeShell } from "@/components/ux/home/HomeShell";
import { ScreenError } from "@/components/ux/kit";

/**
 * The error boundary for this route.
 *
 * The member shell stays: nav and search keep working, because the app is not
 * broken — one screen is. `RouteError` is for the staff and public areas; it
 * derives "back" from the pathname and would send her to the public landing
 * page from in here.
 */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <HomeShell>
      <ScreenError what="what you sell" reset={reset} detail={error.digest} />
    </HomeShell>
  );
}
