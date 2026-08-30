"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

import SakhiLauncher from "@/components/sakhi/SakhiLauncher";
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
 */
export default function MemberLayout({ children }: { children: React.ReactNode }) {
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

  return (
    <div className="ux min-h-screen">
      <SkipToContent />
      {children}
      <SakhiLauncher />
    </div>
  );
}
