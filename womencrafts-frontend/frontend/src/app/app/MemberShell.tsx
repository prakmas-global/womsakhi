"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";

import SakhiLauncher from "@/components/sakhi/SakhiLauncher";
import InstallPrompt from "@/components/ux/mobile/InstallPrompt";
import { ShellProvider } from "@/components/ux/ShellProvider";
import type { MeShell } from "@/lib/shell-api";
import { NavHistory } from "@/components/ux/kit";
import { ChromeProvider } from "@/components/ux/chrome";
import { ChromeShell } from "@/components/ux/home/ChromeShell";
import SkipToContent from "@/components/layout/SkipToContent";
import { useAuth } from "@/context/AuthContext";
import { apiUpdateMeProfile } from "@/lib/member-api";
import { takePreSignInChoice, useI18n, useT } from "@/i18n";
import Spinner from "@/design-system/primitives/Spinner";
import "@/app/ux/tokens.css";
// After tokens.css on purpose: both are unlayered, so the later import wins.
import "@/app/ux/mobile.css";

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
  const { user, loading, isMember, updateUser } = useAuth();
  const tr = useT();
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
    if (!user) return;
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
  }, [user, locale, setLocale, updateUser]);

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace("/signin");
    else if (!isMember) router.replace("/dashboard");
    else if (!verified && !onVerifyScreen) router.replace("/app/verify");
    else if (needsOnboarding) router.replace("/app/welcome");
  }, [loading, user, isMember, verified, onVerifyScreen, needsOnboarding, router]);

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
  if (!isMember || (!verified && !onVerifyScreen) || needsOnboarding) {
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
