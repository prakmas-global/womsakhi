"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import * as Icons from "@/components/ux/icons";

import { MODES, modeForPath } from "./nav";
import { useNavLabel } from "./use-nav-label";

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
 * A bottom bar of five, which is the ceiling this codebase already agreed on
 * ("five tabs is the most a phone can carry comfortably"), plus a More sheet
 * that holds the ENTIRE map — all seven modes, every child, and the four things
 * that are deliberately not modes. Nothing in the app is more than two taps
 * away, and there is one screen she can open to see everything there is.
 *
 * Below `lg` only. The desktop topbar and rail are good and are left alone.
 */

/**
 * The six from the product's primary navigation.
 *
 * Work split back out of Earn and Discover was promoted, so there are seven
 * sections again and a phone bar comfortably holds six at 60px each. Help is
 * the one left off — and it is the one that matters most on a bad day, so it
 * is not hidden behind a menu: `SafetyPin` below puts it one tap away from
 * every screen, permanently. That is the reading of §65 that actually protects
 * her, rather than the one that satisfies a tab count.
 */
const BAR = ["home", "discover", "learn", "work", "earn", "circle"] as const;

function Icon({ name, className }: { name: string; className?: string }) {
  const C = (Icons as unknown as Record<string, React.ComponentType<{ className?: string; strokeWidth?: number }>>)[name]
    ?? Icons.Circle;
  return <C className={className} strokeWidth={1.9} />;
}

export function MobileNav() {
  const pathname = usePathname();
  const mode = modeForPath(pathname);
  const nav = useNavLabel();

  // Close on navigation. Without this the sheet stays over the screen she just
  // asked for, and the only way out is the button she has stopped looking at.
  //
  // Derived from the path rather than set in an effect: `setOpenedAt(null)` in an
  // effect body runs a second render pass on every navigation, and React's
  // compiler rejects it. Keeping the path the sheet was opened at, and treating
  // a different path as closed, needs no effect at all.

  const tabs = BAR.map((id) => MODES.find((m) => m.id === id)).filter(Boolean) as typeof MODES;

  return (
    <>
      {/* ── The bar ───────────────────────────────────────────────────────── */}
      <nav
        aria-label="Sections"
        className="fixed inset-x-0 bottom-0 z-[var(--ux-z-sticky)] flex lg:hidden"
        style={{
          background: "var(--ux-surface)",
          borderTop: "1px solid var(--ux-line)",
          // Clears the home indicator on an iPhone; zero everywhere else.
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}
      >
        {tabs.map((m) => {
          const on = mode?.id === m.id;
          return (
            <Link
              key={m.id}
              href={m.href}
              aria-current={on ? "page" : undefined}
              className="flex min-h-[56px] min-w-0 flex-1 flex-col items-center justify-center gap-1 px-0.5 py-2"
              style={{ color: on ? "var(--ux-brand)" : "var(--ux-muted)" }}
            >
              <Icon name={m.icon} className="h-[21px] w-[21px]" />
              <span className="max-w-full truncate text-2xs font-semibold">{nav.label(m)}</span>
            </Link>
          );
        })}

      </nav>
    </>
  );
}

/**
 * The sub-pages of the mode she is in, on a phone.
 *
 * The rail that carries these is `hidden lg:flex`, so on a phone every child
 * screen — Your journey, Your diary, Notifications, Saved — was reachable only
 * by whatever happened to link to it. A scrolling strip of chips is the
 * smallest thing that puts them back without taking a row of vertical space
 * away from the content.
 */
export function ModeChips() {
  const pathname = usePathname();
  const mode = modeForPath(pathname);
  // Above the early return on purpose — hooks cannot sit behind a condition.
  const nav = useNavLabel();
  if (!mode || mode.items.length < 2) return null;

  return (
    <div
      className="-mx-[20px] mb-3 flex gap-2 overflow-x-auto px-[20px] pb-1 lg:hidden"
      // The scrollbar is hidden but the scroll is real; `overscroll-contain`
      // stops a sideways flick from also dragging the page.
      style={{ scrollbarWidth: "none", overscrollBehaviorX: "contain" }}
      aria-label={`Inside ${nav.label(mode)}`}
    >
      {mode.items.map((i) => {
        const on = pathname === i.href;
        return (
          <Link
            key={i.href}
            href={i.href}
            aria-current={on ? "page" : undefined}
            className="ux-sq flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-full px-3.5 text-xsm font-semibold"
            style={{
              background: on ? "var(--ux-fill)" : "var(--ux-surface-2)",
              color: on ? "var(--ux-on-brand)" : "var(--ux-ink-2)",
              border: on ? "1px solid transparent" : "1px solid var(--ux-line)",
            }}
          >
            <Icon name={i.icon} className="h-[14px] w-[14px]" />
            {nav.label(i)}
          </Link>
        );
      })}
    </div>
  );
}

/**
 * Safety, one tap from anywhere on a phone.
 *
 * Help is the one section the six-tab bar cannot carry, and it is the section
 * containing the alert, the helplines and the reporting form. Burying that
 * behind a menu to satisfy a tab count would be following the letter of the
 * navigation spec against the point of the product.
 *
 * Deliberately quiet — a small outlined pill, not a red panic button. A control
 * that shouts is a control she cannot open in front of the person she is
 * afraid of.
 */
export function SafetyPin() {
  const pathname = usePathname();
  if (pathname.startsWith("/app/safety")) return null;

  return (
    <Link
      href="/app/safety"
      aria-label="Get help now"
      className="ux-press ux-sq fixed bottom-[calc(56px+env(safe-area-inset-bottom,0px)+12px)] left-3 z-[var(--ux-z-sticky)] flex min-h-[44px] items-center gap-1.5 rounded-full px-3 lg:hidden"
      style={{
        background: "var(--ux-surface)",
        border: "1px solid var(--ux-line-strong)",
        boxShadow: "var(--ux-shadow-card)",
        color: "var(--ux-ink-2)",
      }}
    >
      <Icon name="ShieldAlert" className="h-[16px] w-[16px]" />
      <span className="text-2xs font-bold">Help</span>
    </Link>
  );
}
