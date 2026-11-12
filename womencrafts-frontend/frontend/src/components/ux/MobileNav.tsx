"use client";

import Link from "next/link";
import { useT } from "@/i18n";
import { usePathname } from "next/navigation";
import * as Icons from "@/components/ux/icons";

import { TabBar } from "./mobile/TabBar";

/**
 * Navigation on a phone.
 *
 * ── What was there before ───────────────────────────────────────────────────
 * Nothing. The seven modes rendered as one flex row in the topbar with no wrap
 * and no scroll, so on a 390px screen the first three fitted and **Work, Money,
 * Wellbeing and Community were not merely off-screen — they were unreachable**.
 * Measured: the header's `overflow-x` is `visible` and `scrollLeft` does not
 * move, so there was no gesture that would ever bring them back.
 *
 * The rail carrying every sub-page is `hidden lg:flex`, so those were gone too.
 * A woman on a phone — which is most of them — could reach three of seven
 * sections and almost none of the screens inside them.
 *
 * ── What this is ────────────────────────────────────────────────────────────
 * A bottom bar of five — the ceiling this codebase already agreed on ("five
 * tabs is the most a phone can carry comfortably") — and each of the five
 * lands on a hub that lists its own children as large labelled cards. Nothing
 * in the app is more than two taps away.
 *
 * The bar itself now lives in `mobile/TabBar.tsx`, where it is a tab bar
 * rather than a row of links: a translucent bar over the content, a press that
 * answers before the screen changes, a buzz on Android, and an active tab you
 * can pick out without seeing colour. This file keeps the reasoning above and
 * the panic pill below, both of which are about the product rather than about
 * the control.
 *
 * Below `lg` only. The desktop topbar and rail are good and are left alone.
 */
export function MobileNav() {
  return <TabBar />;
}

function Icon({ name, className }: { name: string; className?: string }) {
  const C = (Icons as unknown as Record<string, React.ComponentType<{ className?: string; strokeWidth?: number }>>)[name]
    ?? Icons.Circle;
  return <C className={className} strokeWidth={1.9} />;
}

/**
 * Help, on every screen, permanently.
 *
 * Help is the section left off the bar — and it is the one that matters most on
 * a bad day, so it is not behind a menu. That is the reading of §65 that
 * actually protects her, rather than the one that satisfies a tab count.
 *
 * The shared utility strip reserves space above the tab bar, including the
 * home indicator. The link opens safety choices without dialling a number.
 */
export function SafetyPin() {
  const tr = useT();
  const pathname = usePathname();
  if (pathname.startsWith("/app/safety")) return null;

  // Opens the existing safety screen; it never makes a call automatically.
  return (
    <Link
      href="/app/safety"
      aria-label={`SOS — ${tr("ch.safety.label")}`}
      className="ux-press ux-safety-trigger fixed z-[var(--ux-z-sticky)] lg:hidden"
    >
      <Icon name="ShieldAlert" className="h-5 w-5" />
      <span>SOS · Get help</span>
    </Link>
  );
}
