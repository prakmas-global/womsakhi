"use client";

import RouteError from "@/components/common/RouteError";
import { AuthShell } from "@/components/auth-shell";

/** Error boundary for this route: the failure explained inside the same auth
 *  shell (the layout above it is now a thin wrapper), with a way forward. */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <AuthShell photo="plain">
      <RouteError what="the sign-up page" reset={reset} digest={error.digest} />
    </AuthShell>
  );
}
