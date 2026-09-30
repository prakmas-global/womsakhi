"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import SakhiLauncher from "@/components/sakhi/SakhiLauncher";
import InstallPrompt from "@/components/ux/mobile/InstallPrompt";
import { ShellProvider } from "@/components/ux/ShellProvider";
import type { MeShell } from "@/lib/shell-api";
import { NavHistory } from "@/components/ux/kit";
import { ChromeProvider } from "@/components/ux/chrome";
import { ChromeShell } from "@/components/ux/home/ChromeShell";
import SkipToContent from "@/components/layout/SkipToContent";
import { Brand } from "@/components/ux/Brand";
import * as Icons from "@/components/ux/icons";
import { useAuth } from "@/context/AuthContext";
import { apiUpdateMeProfile } from "@/lib/member-api";
import { takePreSignInChoice, useI18n, useT } from "@/i18n";
import Spinner from "@/design-system/primitives/Spinner";
import { previewActive } from "@/lib/auth-preview";
import { apiOnboarding, isOnboardingSettled, markOnboardingSettled, onboardingDestination } from "@/lib/onboarding-api";
import "@/app/ux/tokens.css";
// After tokens.css on purpose: both are unlayered, so the later import wins.
import "@/app/ux/mobile.css";

/**
 * The local preview switch (see lib/auth-preview), written out here rather
 * than imported: the build replaces NODE_ENV in this file, so every branch it
 * guards is stripped from production. An imported constant is not.
 */
const AUTH_PREVIEW = process.env.NODE_ENV !== "production";

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
/** Admission states that are still open — she has applied and not been refused. */
const WAITING = new Set(["pending_email", "pending_documents", "in_review"]);

/** The member screens whose API calls `require_member_account` answers while she waits. */
const WAITING_ROUTES = ["/app/verify", "/app/phone", "/app/learn", "/app/profile", "/app/settings/language", "/app/welcome", "/app/onboarding"];

/**
 * Her devices and "sign out everywhere" are about keeping her account safe, so
 * they are open in every admission state — waiting, asked for more, rejected.
 */
const ALWAYS_ROUTES = ["/app/settings/security"];

function isAlwaysOpen(pathname: string): boolean {
  return ALWAYS_ROUTES.some((r) => pathname === r || pathname.startsWith(`${r}/`));
}

function allowedWhileWaiting(pathname: string): boolean {
  return WAITING_ROUTES.some((r) => pathname === r || pathname.startsWith(`${r}/`));
}

export default function MemberShell({
  children,
  initialShell,
}: {
  children: React.ReactNode;
  /** The shell payload the server already fetched, or null if it could not. */
  initialShell: MeShell | null;
}) {
  const { user, loading, isMember, updateUser } = useAuth();
  const tr = useT();
  const { locale, setLocale } = useI18n();
  const router = useRouter();
  const pathname = usePathname();

  // The onboarding screen has to stay reachable while she is unverified —
  // otherwise the gate below would bounce her off its own destination.
  const onVerifyScreen = pathname.startsWith("/app/verify");
  const onWelcomeScreen = pathname.startsWith("/app/welcome");
  const onPhoneScreen = pathname.startsWith("/app/phone");
  const onOnboardingScreen = pathname.startsWith("/app/onboarding");
  const verified = user?.verification_status === "active";
  /*
    The Post-Auth Flow replaces the forced tour. An approved member who has
    not finished the questions, or said "Not now" to them, is sent to
    /app/onboarding — or straight to its setting-up step when she answered
    while she waited and nothing has been prepared yet. The server decides
    (`offered`, `completed`, `setup.last_run_at`); the tour stays at
    /app/welcome for anyone who wants it, but nobody is sent there.

    Asked once per visit and only for a member whose account still says
    `onboarding_complete: false` (everyone admitted before this flow existed
    has it true). The verify screen (C6, "You're in") and the flow itself are
    exempt, or the gate would bounce her off her own destination.
  */
  const askOnboarding = Boolean(
    verified && user?.onboarding_complete === false && !(AUTH_PREVIEW && previewActive(pathname)),
  );
  const [onboardingRoute, setOnboardingRoute] = useState<{ uid: string; to: string | null } | null>(null);
  useEffect(() => {
    if (!askOnboarding || !user) return;
    let alive = true;
    const uid = user.id;
    void Promise.resolve(isOnboardingSettled(uid) ? null : apiOnboarding().then(onboardingDestination))
      .catch(() => null)
      .then((to) => {
        if (!to) markOnboardingSettled(uid);
        if (alive) setOnboardingRoute({ uid, to });
      });
    return () => { alive = false; };
  }, [askOnboarding, user]);
  const exemptFromOnboarding = onOnboardingScreen || onWelcomeScreen || onVerifyScreen;
  const onboardingKnown = !askOnboarding || (onboardingRoute?.uid === user?.id);
  const onboardingTo =
    askOnboarding && onboardingRoute && user && onboardingRoute.uid === user.id && !isOnboardingSettled(user.id)
      ? onboardingRoute.to : null;
  const needsOnboarding = verified && !exemptFromOnboarding && Boolean(onboardingTo);
  /*
    Where she may be, by admission state — mirroring the backend, which is the
    real gate (`require_member_account` vs `require_active_member`):
      · no mobile number saved → /app/phone first, whatever her state;
      · waiting (email / documents / review) → her status screen plus the few
        screens the API serves her: learning, profile, language, the tour;
      · rejected / suspended → the status screen only.
    `redirectTo` is null when she is already somewhere she is allowed to be.
  */
  const waiting = user ? WAITING.has(user.verification_status) : false;
  const redirectTo = !user ? null
    : user.phone_action_required ? (onPhoneScreen ? null : "/app/phone")
    : verified ? (needsOnboarding ? onboardingTo : null)
    : isAlwaysOpen(pathname) ? null
    : waiting ? (allowedWhileWaiting(pathname) ? null : "/app/verify")
    : onVerifyScreen ? null : "/app/verify";

  /*
    Her account is the source of truth for language — the cookie only exists so
    the first paint isn't in the wrong one.

    With ONE exception, and it is the whole reason the sign-in screen now has a
    language picker. A woman who chose Telugu there, then signed in, was put
    straight back into English by this effect: her account still said "en"
    because she had never been able to reach a language setting. The screen she
    picked her language on was the last screen it worked on.

    So a choice made in the seconds before signing in is taken as the newest
    thing anybody knows, applied, and written to her account — after which the
    account and the choice agree and this is an ordinary account sync again.
  */
  /*
    It applies the account's language when the ACCOUNT changes it — not
    whenever the two disagree.

    That distinction is the whole bug: the old condition was
    `user.locale !== locale`, and this effect lists `locale` in its
    dependencies. So choosing Hindi from the bar set `locale` to "hi", the
    effect woke up, saw the account still saying "te" (the PATCH had not
    landed, and the in-memory user is never refreshed anyway) and set it
    straight back. Nothing on screen ever changed until a reload, which is
    exactly what it looked like from outside: a language picker that does
    nothing. The Settings screen had it too.
  */
  const appliedAccount = useRef<string | null>(null);
  useEffect(() => {
    if (!user || (AUTH_PREVIEW && previewActive(pathname))) return;
    const chosen = takePreSignInChoice();
    if (chosen) {
      appliedAccount.current = chosen;
      if (chosen !== locale) setLocale(chosen);
      // Her account has to learn it, or the next device undoes her again.
      if (chosen !== user.locale) {
        void apiUpdateMeProfile({ locale: chosen })
          .then(() => updateUser({ ...user, locale: chosen }))
          .catch(() => {});
      }
      return;
    }
    const account = user.locale;
    if (!account || appliedAccount.current === account) return;
    appliedAccount.current = account;
    if (account !== locale) setLocale(account);
  }, [user, locale, setLocale, updateUser, pathname]);

  /*
    Local development only: a `?preview=` screen (see lib/auth-preview) is
    drawn for a fixture user, so no guard redirects it, and it gets a plain
    frame instead of the app chrome, whose requests all need a real session.
  */
  const [preview, setPreview] = useState(false);
  useEffect(() => {
    if (!AUTH_PREVIEW) return;
    const on = previewActive(pathname);
    const t = window.setTimeout(() => setPreview(on));
    return () => window.clearTimeout(t);
  }, [pathname]);

  useEffect(() => {
    if (AUTH_PREVIEW && previewActive(pathname)) return;
    if (loading) return;
    if (!user) router.replace("/signin");
    else if (!isMember) router.replace("/dashboard");
    else if (redirectTo) router.replace(redirectTo);
  }, [loading, user, isMember, redirectTo, router, pathname]);

  /*
    A spinner is the right thing while we are still asking. It is the WRONG
    thing once we know the answer is "nobody".

    Both cases rendered the same endless spinner, which is what a woman whose
    30-minute token had quietly expired actually saw: a blank white screen, no
    message, no way forward. The redirect below does fire, but a full page load
    to /signin is not instant on a slow connection, and what fills that gap
    should say something.
  */
  if (loading) {
    return (
      <div className="ux grid min-h-screen place-items-center px-6">
        <div role="status" className="text-center">
          <Spinner />
          <p className="mt-3 text-sm font-medium" style={{ color: "var(--ux-ink-2)" }}>{tr("common.loading")}</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="ux grid min-h-screen place-items-center px-6">
        <div className="text-center">
          <p className="text-base font-semibold" style={{ color: "var(--ux-ink)" }}>
            {tr("shell.signedOutTitle")}
          </p>
          <p className="mx-auto mt-2 max-w-[34ch] text-xsm leading-relaxed" style={{ color: "var(--ux-muted)" }}>
            {tr("shell.signedOutBody")}
          </p>
          <a href="/signin"
             className="ux-press mt-5 inline-flex h-[44px] items-center rounded-[14px] px-6 text-sm font-semibold"
             style={{ background: "var(--ux-brand)", color: "var(--ux-ink-on-brand)" }}>
            {tr("shell.signInAgain")}
          </a>
        </div>
      </div>
    );
  }

  // While a redirect is pending, render nothing rather than the destination
  // screen: mounting it would fire data requests we already know will 403.
  if (!isMember || redirectTo || (verified && !exemptFromOnboarding && !onboardingKnown)) {
    return (
      <div className="ux grid min-h-screen place-items-center px-6">
        <div role="status" className="text-center">
          <Spinner />
          <p className="mt-3 text-sm font-medium" style={{ color: "var(--ux-ink-2)" }}>{tr("wait.opening")}</p>
        </div>
      </div>
    );
  }

  // Verification and onboarding run outside the shell — they are full-screen
  // flows, and wrapping them in navigation invites her to skip the gate.
  //
  // Verify and phone are the approved auth screens (Version 11): each draws a
  // full-page `AuthShell` of its own — photo panel, cream side, logo, card — in
  // the fixed berry-on-cream palette, so nothing of the app's frame (or its
  // themed `.ux` canvas) goes around them. The tour keeps the app's canvas.
  if (onVerifyScreen || onPhoneScreen || onOnboardingScreen) return <>{children}</>;
  if (AUTH_PREVIEW && preview) {
    return (
      <div className="ux min-h-screen">
        <ChromeProvider>
          <div className="mx-auto w-full max-w-[1180px] px-4 pb-10 pt-4 lg:px-8 lg:pt-6">{children}</div>
        </ChromeProvider>
      </div>
    );
  }
  if (onWelcomeScreen) return <div className="ux min-h-screen">{children}</div>;

  /*
    A member still waiting to be admitted gets the few screens she may use
    WITHOUT the app's navigation, bell, Sakhi and the shell's live counters:
    every one of those leads to (or polls) something that 403s until she is
    admitted. One way back to her application instead.
  */
  if (waiting || (!verified && isAlwaysOpen(pathname))) {
    return (
      <div className="ux min-h-screen">
        <SkipToContent />
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b px-4 py-2.5 backdrop-blur lg:px-8"
                style={{ background: "color-mix(in srgb, var(--ux-canvas) 92%, transparent)", borderColor: "var(--ux-line)" }}>
          <Brand size="sm" href={null} tagline={false} />
          <a href="/app/verify"
             className="ux-press ms-auto inline-flex min-h-[44px] items-center gap-1.5 rounded-[12px] px-3 text-sm font-semibold"
             style={{ color: "var(--ux-brand)", background: "var(--ux-tint-pink)" }}>
            <Icons.ChevronLeft className="h-4 w-4 rtl:rotate-180" strokeWidth={2.4} aria-hidden="true" />
            My application
          </a>
        </header>
        {/* The shell payload the server already has: without it, screens
            fall back to their own calls, and some of those 403. */}
        <ShellProvider initial={initialShell}>
          <ChromeProvider>
            {/* ChromeShell normally supplies the page gutter. */}
            <div className="mx-auto w-full max-w-[1180px] px-4 pb-10 pt-4 lg:px-8 lg:pt-6">{children}</div>
          </ChromeProvider>
        </ShellProvider>
      </div>
    );
  }

  // Mounted here and nowhere higher: it is behind `require_active_member`, so
  // it belongs inside the gate that has just established she is one. Everything
  // under it shares ONE request for what used to be six.
  return (
    <ShellProvider initial={initialShell}>
      <div className="ux min-h-screen">
        {/* Records each route change so `Back` can name where she came from. */}
        <NavHistory />
        <SkipToContent />
        {/*
          The chrome is mounted HERE, in the layout, and not by the 108 screens
          that used to each render their own. A layout survives a navigation; a
          page does not. Rendering it per page meant every rail click destroyed
          and rebuilt the topbar, the rail and the mobile bar — the whole screen
          appeared to reload, and the sidebar lost her scroll position.
        */}
        <ChromeProvider>
          <ChromeShell>{children}</ChromeShell>
        </ChromeProvider>
        <SakhiLauncher />
        {/* Asked only after she has an account — a prompt to keep the icon
            means nothing before there is anything to come back to. */}
        <InstallPrompt />
      </div>
    </ShellProvider>
  );
}
