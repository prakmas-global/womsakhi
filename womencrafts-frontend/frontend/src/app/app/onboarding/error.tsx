"use client";

import { ScreenError } from "@/components/ux/kit";

/**
 * The flow runs outside the app shell (she may not be approved yet), so its
 * error boundary is bare too: the shared one draws the member navigation,
 * whose every link would bounce a waiting member straight back.
 */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="ux min-h-screen">
      <div className="mx-auto w-full max-w-[1080px] px-8 py-[40px]">
        <ScreenError what="your questions" reset={reset} detail={error.digest} />
      </div>
    </div>
  );
}
