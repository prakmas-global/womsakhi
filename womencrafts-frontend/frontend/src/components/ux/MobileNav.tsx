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
 * `.ux-dock-bottom` is what keeps it above the tab bar: `mobile.css` sets that
 * class to `bottom: var(--tabbar-h)`, which already includes the home
 * indicator. It used to carry a hand-written `calc(56px + env(...))` that had
 * to be kept in step with a bar height defined somewhere else, and was already
 * two pixels out.
 */
export function SafetyPin() {
  const tr = useT();
  const pathname = usePathname();
  if (pathname.startsWith("/app/safety")) return null;

  return (
    <Link
      href="/app/safety"
      aria-label={tr("ch.safety.label")}
      className="ux-press ux-sq ux-dock-bottom fixed bottom-0 left-3 z-[var(--ux-z-sticky)] mb-3 flex min-h-[44px] items-center gap-1.5 rounded-full px-3 lg:hidden"
      style={{
        background: "var(--ux-surface)",
        border: "1px solid var(--ux-line-strong)",
        boxShadow: "var(--ux-shadow-card)",
        color: "var(--ux-ink-2)",
      }}
    >
      <span style={{ color: "var(--ux-danger-solid)" }}>
        <Icon name="ShieldAlert" className="h-[16px] w-[16px]" />
      </span>
      <span className="text-2xs font-bold">{tr("ch.safety.label")}</span>
    </Link>
  );
}
