"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";


import { ScreenError, ScreenSkeleton, whatFailedFor } from "../kit";
import { usePageChrome } from "../chrome";

/**
 * What a screen asks of the chrome — not the chrome itself.
 *
 * This used to render the topbar, the rail and the mobile bar, on all 108
 * screens. In the App Router a page is destroyed on every navigation, so every
 * rail click rebuilt the whole frame: the screen appeared to reload when only
 * the middle had changed, and the sidebar lost her scroll position each time.
 *
 * The signature is unchanged so no screen had to be edited. What changed is
 * where the frame lives — one Shell in the layout, which survives — and this
 * now only registers the parts that differ per page. See `ux/chrome.tsx`.
 */
export function HomeShell({
  children, rail, name, bare, wide, skeleton = "list", loadFailed,
}: {
  /** Optional and ignored — Shell derives the mode and section from the URL. */
  active?: string; children: React.ReactNode; rail?: React.ReactNode; name?: string;
  /** Drops the "complete your profile" footer — used where the page IS that. */
  bare?: boolean;
  /** Hands the whole width to a screen that is already made of columns. */
  wide?: boolean;
  /** Which skeleton shape best matches this screen while it loads. */
  skeleton?: "list" | "grid" | "detail" | "form";
  /** What could not be loaded, in her words: "your orders", "this course". */
  loadFailed?: string;
}) {
  usePageChrome({ rail, wide, bare, name });

  /**
   * `?state=loading` and `?state=error` render those states on any screen.
   *
   * They cannot otherwise be produced while every screen runs on mock data that
   * never fails — and a state nobody can look at is a state nobody maintains.
   * It also gives support a link that reproduces exactly what a woman saw.
   *
   * The chrome stays: nav and search keep working, because the app is not
   * broken, one screen is. Replacing the whole window with an apology strands
   * her on the failure.
   */
  /**
   * Read from `location`, not `useSearchParams`.
   *
   * That hook forces every route above it into a Suspense boundary — without
   * one, Next renders the whole page as an empty fallback, which is exactly
   * what happened: thirty-eight screens went blank. Reading in an effect costs
   * one frame on a review-only affordance and asks nothing of any page.
   */
  const [forced, setForced] = useState<string | null>(null);
  useEffect(() => {
    setForced(new URLSearchParams(window.location.search).get("state"));
  }, []);
  const pathname = usePathname();
  const body =
    forced === "loading" ? <ScreenSkeleton shape={skeleton} />
    : forced === "error" ? <ScreenError what={loadFailed ?? whatFailedFor(pathname)} />
    : children;

  return <>{body}</>;
}
