"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

import SakhiLauncher from "@/components/sakhi/SakhiLauncher";
import { ShellProvider } from "@/components/ux/ShellProvider";
import type { MeShell } from "@/lib/shell-api";
import { NavHistory } from "@/components/ux/kit";
import SkipToContent from "@/components/layout/SkipToContent";
import { useAuth } from "@/context/AuthContext";
import { useI18n } from "@/i18n";
import { Spinner } from "@/design-system";
import "@/app/ux/tokens.css";

/**
 * The member app shell — redesigned.
 *
 * The chrome is new; every GUARD is the old one, unchanged. A redesign is a
 * change of presentation, and quietly dropping the verification gate or the
 * onboarding redirect while moving the furniture is how a visual refresh turns
 * into a security bug. The old file is kept beside this one as
 * `layout.old.tsx.bak` until the migration is finished.
 *
 * Sakhi is mounted exactly as before and deliberately untouched — she gets her
 * own pass at the end.
 *
 * ── Why this is no longer the layout itself ─────────────────────────────────
 * The guards below need `useAuth`, so this file is a client component; but the
 * two things they wait for — who is signed in, and the shell payload — are both
 * answerable on the server from the cookie the request already carried. They
 * used to be two blocking browser round trips, strictly ordered, before any
 * screen was allowed to mount: `/auth/session` gated the spinner, and
 * `ShellProvider` could not even mount to fire `/me/shell` until it cleared,
 * even though `/me/shell` contains that same user.
 *
 * So `layout.tsx` is now a server component that fetches both, and this is what
 * it renders. Every guard is unchanged.
 */
export default function MemberShell({
  children,
  initialShell,
}: {
  children: React.ReactNode;
  /** The shell payload the server already fetched, or null if it could not. */
  initialShell: MeShell | null;
}) {
  const { user, loading, isMember } = useAuth();
  const { locale, setLocale } = useI18n();
  const router = useRouter();
  const pathname = usePathname();

  // The onboarding screen has to stay reachable while she is unverified —
  // otherwise the gate below would bounce her off its own destination.
  const onVerifyScreen = pathname.startsWith("/app/verify");
  const onWelcomeScreen = pathname.startsWith("/app/welcome");
  const verified = user?.verification_status === "active";
  const needsOnboarding =
    verified && user?.onboarding_complete === false && !onWelcomeScreen;

  // Her account is the source of truth for language — the cookie only exists so
  // the first paint isn't in the wrong one.
  useEffect(() => {
    if (user?.locale && user.locale !== locale) setLocale(user.locale);
  }, [user?.locale, locale, setLocale]);

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace("/signin");
    else if (!isMember) router.replace("/dashboard");
    else if (!verified && !onVerifyScreen) router.replace("/app/verify");
    else if (needsOnboarding) router.replace("/app/welcome");
  }, [loading, user, isMember, verified, onVerifyScreen, needsOnboarding, router]);

  if (loading || !user) {
    return (
      <div className="ux grid min-h-screen place-items-center"><Spinner /></div>
    );
  }

  // While a redirect is pending, render nothing rather than the destination
  // screen: mounting it would fire data requests we already know will 403.
  if (!isMember || (!verified && !onVerifyScreen) || needsOnboarding) {
    return (
      <div className="ux grid min-h-screen place-items-center"><Spinner /></div>
    );
  }

  // Verification and onboarding run outside the shell — they are full-screen
  // flows, and wrapping them in navigation invites her to skip the gate.
  const bare = onVerifyScreen || onWelcomeScreen;
  if (bare) return <div className="ux min-h-screen">{children}</div>;

  // Mounted here and nowhere higher: it is behind `require_active_member`, so
  // it belongs inside the gate that has just established she is one. Everything
  // under it shares ONE request for what used to be six.
  return (
    <ShellProvider initial={initialShell}>
      <div className="ux min-h-screen">
        {/* Records each route change so `Back` can name where she came from. */}
        <NavHistory />
        <SkipToContent />
        {children}
        <SakhiLauncher />
      </div>
    </ShellProvider>
  );
}
