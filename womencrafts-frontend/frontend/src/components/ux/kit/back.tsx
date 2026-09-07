"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import * as Icons from "@/components/ux/icons";

/**
 * Back — to where she actually came from.
 *
 * ── The bug this fixes ──────────────────────────────────────────────────────
 * Every back control in the app was a hard link to a fixed parent: the market
 * item said "Back to the market" and went to `/app/market` no matter how she
 * arrived. Reach that item from her journey, from search, from a message
 * someone sent her — press back, and the app moves her sideways into a screen
 * she has never seen. Fifty-two controls did this and none consulted history.
 *
 * §87 asks for back navigation that preserves context. That means history when
 * there is history, and the parent route only when there is not.
 *
 * ── Why both, and not just `router.back()` ──────────────────────────────────
 * `router.back()` alone is worse than what it replaces. On a deep link — a link
 * in WhatsApp, a bookmark, a refresh — there is no in-app history, so back
 * either does nothing at all or throws her out of the app into whatever she was
 * looking at before. A woman who opened a link someone sent her would land back
 * in the chat, which is not "back" in any sense she meant.
 *
 * So: history if this page was reached from inside the app, the declared parent
 * otherwise. `window.history.length` cannot tell the difference — it counts the
 * whole tab — so the component checks whether the referrer is this origin,
 * which is true exactly when the previous page was ours.
 *
 * ── Why the label changes ───────────────────────────────────────────────────
 * When there is history it says "Back", because we cannot know what she will
 * land on and naming the wrong screen is worse than naming none. When there is
 * not, it names the parent — "Back to the market" — because then it is a
 * promise the component can keep.
 */
export function Back({ to, label, className = "" }: {
  /** Where to go when there is no in-app history to return to. */
  to: string;
  /** What that parent is called, for the fallback label. */
  label: string;
  className?: string;
}) {
  const router = useRouter();
  // Starts false so the server and the first client render agree; the referrer
  // is only knowable in the browser.
  const [hasHistory, setHasHistory] = useState(false);

  useEffect(() => {
    try {
      const ref = document.referrer;
      setHasHistory(!!ref && new URL(ref).origin === window.location.origin);
    } catch { setHasHistory(false); }
  }, []);

  const cls =
    `ux-press ux-sq inline-flex w-fit items-center gap-1.5 text-[0.8125rem] font-semibold ${className}`;
  const style = { color: "var(--ux-muted)" };

  if (hasHistory) {
    return (
      <button type="button" onClick={() => router.back()} className={cls} style={style}>
        <Icons.ArrowLeft className="h-[15px] w-[15px]" /> Back
      </button>
    );
  }

  // No history: a real link, so it can be middle-clicked and read by a screen
  // reader as the navigation it is.
  return (
    <Link href={to} className={cls} style={style}>
      <Icons.ArrowLeft className="h-[15px] w-[15px]" /> {label}
    </Link>
  );
}
