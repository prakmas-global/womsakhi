"use client";

import { ScreenError } from "@/components/ux/kit";
import { useT } from "@/i18n";

/**
 * The error boundary for this route.
 *
 * The shared one at `/app/error.tsx` wraps the apology in `HomeShell` — the
 * full member navigation — on a screen she reaches precisely because she does
 * not have the app yet. Every link in that sidebar would bounce her straight
 * back here. So this one is bare, like the screen it is replacing.
 */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const tr = useT();
  return (
    <div className="mx-auto w-full max-w-[1080px] px-8 py-[40px]">
      <ScreenError what={tr("verify.thisStep")} reset={reset} detail={error.digest} />
    </div>
  );
}
