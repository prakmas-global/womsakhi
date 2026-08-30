"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";


import { Shell } from "../Shell";
import { Btn, ScreenError, ScreenSkeleton, whatFailedFor } from "../kit";
import { useMe } from "../me";

/** The frame every Home screen sits in — the product-wide nav from board #1. */
export function HomeShell({
  children, rail, name, bare, skeleton = "list", loadFailed,
}: {
  /** Optional and ignored — Shell derives the mode and section from the URL. */
  active?: string; children: React.ReactNode; rail?: React.ReactNode; name?: string;
  /** Drops the "complete your profile" footer — used where the page IS that. */
  bare?: boolean;
  /** Which skeleton shape best matches this screen while it loads. */
  skeleton?: "list" | "grid" | "detail" | "form";
  /** What could not be loaded, in her words: "your orders", "this course". */
  loadFailed?: string;
}) {
  // Read the account here rather than in each screen: passing it only from
  // Home meant the topbar greeted her by her real name there and by a fixture
  // name everywhere else.
  const me = useMe();
  const first = name ?? me.first;

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

  return (
    <Shell
      user={{ name: first, avatar: me.avatar, unread: me.unread }}
      sidebarFooter={bare ? undefined : (
        <div className="rounded-[14px] p-4" style={{ background: "var(--ux-brand-900)" }}>
          <h3 className="text-[13.5px] font-semibold text-white">Complete Your Profile</h3>
          <p className="mt-1 text-[11.5px]" style={{ color: "var(--ux-on-brand-2)" }}>{me.profilePct}% completed</p>
          <div className="mt-2.5 h-[5px] w-full overflow-hidden rounded-full" style={{ background: "var(--ux-on-brand-track)" }}>
            <div className="h-full rounded-full"
                 style={{ width: `${me.profilePct}%`, background: "var(--ux-on-brand-fill)",
                          transition: "width var(--ux-t-slow) var(--ux-ease-out)" }} />
          </div>
          <div className="mt-3">
            <Btn href="/app/profile" variant="primary" size="sm" full iconEnd="ArrowRight">Complete Now</Btn>
          </div>
        </div>
      )}
      rail={rail}
    >
      {body}
    </Shell>
  );
}
