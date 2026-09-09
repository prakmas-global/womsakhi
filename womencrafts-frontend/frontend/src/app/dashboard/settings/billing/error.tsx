"use client";

import RouteError from "@/components/common/RouteError";

/** Error boundary for this route. The layout around it is preserved by Next,
 *  so this only has to explain the failure and offer a way forward. */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <RouteError
      what="the billing settings"
      reset={reset}
      digest={error.digest}
      home="/dashboard"
      homeLabel="Back to dashboard"
    />
  );
}
