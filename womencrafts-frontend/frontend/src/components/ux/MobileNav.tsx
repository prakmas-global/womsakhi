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

  /*
    A red SOS, not a white pill.

    The pill said "Get help now" in 11px type with a 16px shield — fine for a
    woman who reads, invisible to one who does not, and grey enough to be
    mistaken for any other chip. This is the one control that has to be found
    in a panic, by anyone: a big red circle with SOS on it is understood in
    every language the app speaks, and by those who read none of them.

    It opens Get help (112, the helplines, her trusted people as big picture
    buttons); it never dials on its own, because a shared phone in a pocket
    must not call the police by accident.
  */
  return (
    <Link
      href="/app/safety"
      aria-label={`SOS — ${tr("ch.safety.label")}`}
      className="ux-press ux-dock-bottom fixed bottom-0 left-3 z-[var(--ux-z-sticky)] mb-3 grid h-[62px] w-[62px] place-items-center rounded-full lg:hidden"
      style={{
        background: "radial-gradient(circle at 35% 30%, #ff5a5a 0%, #e01e1e 55%, #b30f0f 100%)",
        boxShadow: "0 0 0 3px var(--ux-surface), 0 10px 24px -6px rgba(200,20,20,.55)",
        color: "#fff",
      }}
    >
      <span aria-hidden className="ux-sos-ring absolute inset-0 rounded-full" />
      <span className="relative flex flex-col items-center leading-none">
        <Icon name="ShieldAlert" className="h-[20px] w-[20px]" />
        <span className="mt-[3px] text-[13px] font-extrabold tracking-[0.06em]">SOS</span>
      </span>
    </Link>
  );
}
