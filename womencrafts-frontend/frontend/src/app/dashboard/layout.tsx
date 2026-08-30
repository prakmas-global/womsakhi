"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { isModuleAllowed, moduleForPath } from "@/lib/modules";
import Sidebar from "@/components/layout/Sidebar";
import Topbar from "@/components/layout/Topbar";
import { CustomiseBar } from "@/layout-engine";
import SkipToContent from "@/components/layout/SkipToContent";

function AccessDenied() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-status-danger-bg text-status-danger-ink">
        <ShieldAlert className="h-8 w-8" />
      </span>
      <h1 className="mt-4 font-display text-xl font-bold text-ink">Access Restricted</h1>
      <p className="mt-1 max-w-sm text-sm text-ink-subtle">
        Your role doesn&apos;t have access to this module. Ask a Super Admin to grant access from
        Settings → Roles &amp; Permissions.
      </p>
      <Link href="/dashboard" className="btn btn-primary mt-5">
        Back to Dashboard
      </Link>
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  // Whether the off-canvas navigation is showing. Only meaningful below `lg`;
  // above it the rail is always present and this is ignored.
  const [navOpen, setNavOpen] = useState(false);

  // Close it on navigate. A drawer that stays open over the screen you just
  // asked for makes every tap feel like it did not work.
  useEffect(() => {
    setNavOpen(false);
  }, [pathname]);

  // Escape closes it, and the page behind must not scroll while it is open.
  useEffect(() => {
    if (!navOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setNavOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [navOpen]);


  useEffect(() => {
    if (!loading && !user) router.replace("/signin");
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" />
          <p className="text-sm text-ink-subtle">Loading…</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  // RBAC — block the page if the user's role can't open this module.
  const allowed = isModuleAllowed(moduleForPath(pathname), user.modules);

  return (
    <div className="min-h-screen">
      <SkipToContent />
      {/* Tapping away closes it — the expected gesture, and the reason the
          drawer needs no visible close button competing with the nav items. */}
      {navOpen && (
        <div
          onClick={() => setNavOpen(false)}
          aria-hidden
          className="fixed inset-0 z-30 bg-black/40 backdrop-blur-[2px] lg:hidden"
        />
      )}
      <Sidebar navOpen={navOpen} onNavClose={() => setNavOpen(false)} />
      {/*
        The rail is a fixed 248px column, so the content is inset by the same
        amount — but only from `lg` up. Below that the inset is zero and the
        rail becomes an off-canvas drawer: a 248px rail on a 390px phone left
        142px of usable width, and 41 of 44 screens scrolled sideways.
      */}
      <div className="lg:pl-[var(--wc-sidebar-width)]">
        <Topbar onMenu={() => setNavOpen(true)} />
        <main id="content" tabIndex={-1} className="px-6 pb-6 pt-26">
          <div key={pathname} className="wc-page-enter">
            {allowed ? children : <AccessDenied />}
          </div>
        </main>
      </div>
      {/* Fixed to the viewport and never customisable — the way out of a
          rearranged layout must not live inside the thing being rearranged. */}
      <CustomiseBar />
    </div>
  );
}
