"use client";

import { HomeShell } from "@/components/ux/home/HomeShell";
import { ScreenError } from "@/components/ux/kit";
import { useT } from "@/i18n";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const tr = useT();
  return (
    <HomeShell>
      <ScreenError what={tr("digital.theseSteps")} reset={reset} detail={error.digest} />
    </HomeShell>
  );
}
