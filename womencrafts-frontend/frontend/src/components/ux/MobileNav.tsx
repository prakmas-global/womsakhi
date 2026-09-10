"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import * as Icons from "@/components/ux/icons";

import { TABS, trailFor } from "./nav-tree";
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
/** Every section that is a place she works. Help and You are header
 *  controls, because they are not places she works — they are where she goes
 *  when something is wrong or she wants to change a setting. */
const BAR = TABS.map((t) => t.id);

function Icon({ name, className }: { name: string; className?: string }) {
  const C = (Icons as unknown as Record<string, React.ComponentType<{ className?: string; strokeWidth?: number }>>)[name]
    ?? Icons.Circle;
  return <C className={className} strokeWidth={1.9} />;
}

export function MobileNav() {
  const pathname = usePathname();
  const here = trailFor(pathname)[0];
  const nav = useNavLabel();

  // Close on navigation. Without this the sheet stays over the screen she just
  // asked for, and the only way out is the button she has stopped looking at.
  //
  // Derived from the path rather than set in an effect: `setOpenedAt(null)` in an
  // effect body runs a second render pass on every navigation, and React's
  // compiler rejects it. Keeping the path the sheet was opened at, and treating
  // a different path as closed, needs no effect at all.

  const tabs = TABS;

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
          const on = here?.id === m.id;
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
      <span style={{ color: "var(--ux-danger-solid)" }}>
        <Icon name="ShieldAlert" className="h-[16px] w-[16px]" />
      </span>
      <span className="text-2xs font-bold">Get help now</span>
    </Link>
  );
}
