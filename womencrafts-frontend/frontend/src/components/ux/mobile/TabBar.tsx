"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import * as Icons from "@/components/ux/icons";

import { TABS, trailFor } from "../nav-tree";
import { useNavLabel } from "../use-nav-label";
import { useHaptics } from "./useHaptics";

/**
 * The bottom tab bar.
 *
 * ── Which five, and why they are not re-chosen here ─────────────────────────
 * `nav-tree.ts` picks them: `TABS` is `SECTIONS.filter(s => s.tab)` — Home,
 * Learn, Work, Earn, Circle. That file argues the case at length and the
 * reasoning holds, so this component reads the answer rather than repeating
 * the decision. Help and You are deliberately not here: Help is one tap away
 * from every screen via `SafetyPin`, and You is a header control. Adding a
 * sixth tab would mean editing `nav-tree.ts`, which is where that argument
 * belongs.
 *
 * ── Labels are never hidden ─────────────────────────────────────────────────
 * An icon-only bar is a memory test. Our readers include women who are using a
 * smartphone for the first time and women who read slowly; a briefcase and a
 * graduation cap are not self-evident to anyone who has not already learnt
 * this app. Every tab carries its word, in her language, always.
 *
 * ── Telling the active tab apart without colour ─────────────────────────────
 * Colour alone fails ~1 in 12 men, and it fails everyone in direct sunlight on
 * a cheap screen. So the current tab differs in four ways at once, three of
 * which survive greyscale:
 *
 *   1. a 3px indicator sitting on the bar's top edge, above that tab only;
 *   2. a filled, outlined pill behind its icon — a shape the others do not
 *      have at all (lucide is a stroke-only set, so there is no filled icon
 *      variant to swap to; the pill is the structural substitute);
 *   3. a heavier icon stroke and an 800-weight label against 600;
 *   4. and, yes, the brand colour as well.
 *
 * ── Where the CSS lives ─────────────────────────────────────────────────────
 * In this file, hoisted into <head> by React. It cannot go in `mobile.css`
 * (owned elsewhere) and it must not be inline `style`, because inline styles
 * would beat the `prefers-contrast` and `forced-colors` blocks in `tokens.css`
 * that make `.ux-glass` legible for people who need those. Rules are written
 * `.ux .ux-tabbar` — two classes — so they beat `.ux-glass` no matter which
 * order the sheets end up in, and every property that `mobile.css` already
 * sets on `.ux-tabbar` (padding-bottom, z-index) is left alone here. Note the
 * padding longhands below: writing the `padding` shorthand would silently wipe
 * the safe-area inset that keeps the bar off the home indicator.
 */

const CSS = `
.ux .ux-tabbar { display: none; }

@media (max-width: 1023px) {
  /* Above lg the desktop rail takes over and this is gone entirely. */
  .ux .ux-tabbar {
    position: fixed;
    inset: auto 0 0 0;
    display: flex;
    align-items: stretch;
    /* NOT the padding shorthand: mobile.css owns padding-bottom (the home
       indicator) and a shorthand here would reset it to 0. */
    padding-left: max(2px, var(--sa-left));
    padding-right: max(2px, var(--sa-right));
    /* .ux-glass draws a box; a bar wants one edge. */
    border: 0;
    border-top: 1px solid color-mix(in srgb, var(--ux-line-strong) 76%, transparent);
    border-radius: 0;
    /* Lifts the bar off the content rather than dropping a shadow onto the
       screen below it, which there isn't one of. */
    box-shadow: 0 -10px 24px -20px rgba(12, 9, 38, 0.55);
  }

  .ux .ux-tab {
    position: relative;
    flex: 1 1 0;
    min-width: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 3px;
    height: 58px;
    padding: 6px 2px 6px;
    color: var(--ux-muted);
    text-decoration: none;
    -webkit-tap-highlight-color: transparent;
  }

  .ux .ux-tab-pill {
    display: grid;
    place-items: center;
    width: 44px;
    height: 26px;
    border-radius: 999px;
    border: 1px solid transparent;
    background: transparent;
    transition:
      background-color 160ms var(--ux-ease-out),
      border-color 160ms var(--ux-ease-out);
  }

  .ux .ux-tab-label {
    max-width: 100%;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    font-weight: 600;
    line-height: 1.1;
    letter-spacing: 0.005em;
  }

  /* ── The current tab ───────────────────────────────────────────────────── */

  .ux .ux-tab[aria-current="page"] { color: var(--ux-brand); }

  .ux .ux-tab[aria-current="page"] .ux-tab-pill {
    background: color-mix(in srgb, var(--ux-brand) 17%, var(--ux-surface));
    border-color: color-mix(in srgb, var(--ux-brand) 45%, transparent);
  }

  .ux .ux-tab[aria-current="page"] .ux-tab-label { font-weight: 800; }

  /* The structural tell: a bar on the top edge, over this tab only. Drawn in
     currentColor so forced-colors mode recolours it with everything else. */
  .ux .ux-tab[aria-current="page"]::before {
    content: "";
    position: absolute;
    top: -1px;
    left: 50%;
    width: 30px;
    height: 3px;
    transform: translateX(-50%);
    border-radius: 0 0 3px 3px;
    background: currentColor;
  }

  /* The ring in tokens.css is offset 3px outward, which on a bar flush with
     the bottom of the screen is drawn off the edge. Same ring, turned inward. */
  .ux .ux-tabbar .ux-tab:focus-visible {
    outline: 2px solid var(--ux-brand);
    outline-offset: -3px;
    border-radius: 14px;
  }
}

@media (prefers-contrast: more) {
  .ux .ux-tab[aria-current="page"] .ux-tab-pill {
    border-color: currentColor;
    border-width: 2px;
  }
}
`;

function Icon({ name, className, strokeWidth }: { name: string; className?: string; strokeWidth: number }) {
  const C =
    (Icons as unknown as Record<string, React.ComponentType<{ className?: string; strokeWidth?: number }>>)[name] ??
    Icons.Circle;
  return <C className={className} strokeWidth={strokeWidth} />;
}

export function TabBar() {
  const pathname = usePathname();
  // The section this route belongs to, not a string match on the href: every
  // route in the tree resolves to one of the five, so a deep page like
  // /app/opportunities still lights up Work.
  const here = trailFor(pathname)[0];
  const nav = useNavLabel();
  const haptics = useHaptics();

  return (
    <nav
      // `checks/phone-nav.mjs` finds the bar by this label. It is also what a
      // screen reader announces before the five links.
      aria-label="Sections"
      className="ux-tabbar ux-glass"
    >
      {TABS.map((t) => {
        const on = here?.id === t.id;
        return (
          <Link
            key={t.id}
            href={t.href}
            className="ux-tab"
            aria-current={on ? "page" : undefined}
            // Only on an actual change. Buzzing when she taps the tab she is
            // already on says something happened when nothing did.
            onClick={on ? undefined : haptics.light}
          >
            <span className="ux-tab-pill">
              <Icon name={t.icon} className="h-[21px] w-[21px]" strokeWidth={on ? 2.5 : 1.9} />
            </span>
            {/* text-2xs (11px) rather than a size in the CSS above: the type
                scale is a Tailwind utility and it moves with her "Bigger text"
                setting. A font-size here would be unlayered and would win,
                pinning the label at one size forever. */}
            <span className="ux-tab-label text-2xs">{nav.label(t)}</span>
          </Link>
        );
      })}

      <style href="ux-tabbar" precedence="ux-mobile">
        {CSS}
      </style>
    </nav>
  );
}
