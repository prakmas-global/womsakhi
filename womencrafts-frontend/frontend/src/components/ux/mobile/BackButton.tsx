"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import * as Icons from "@/components/ux/icons";
import { useT } from "@/i18n";

import { isTabRoot, parentFor } from "../nav-tree";
import { useNavLabel } from "../use-nav-label";

/**
 * The way back, on a phone.
 *
 * ── The measured problem ────────────────────────────────────────────────────
 * Swept at 390x844, seventy of the 105 non-root member screens had no back
 * affordance of any kind. The bottom bar carries the five roots and nothing
 * else, so a woman who taps into `/app/certificates`, `/app/bookings` or
 * `/app/goals` could leave only by the OS gesture — and installed to a home
 * screen as a PWA, in standalone display mode, there is no OS gesture. She was
 * stuck on the screen until she killed the app.
 *
 * Thirty-five screens had one, because thirty-five page authors remembered to
 * place `kit/back`'s `<Back>` in their own markup. That is the whole reason
 * this is in the shell instead: seventy individual edits would have drifted
 * apart inside a month and would have missed the next screen anyone adds. This
 * one asks the route where it is and draws itself, so a new page under
 * `/app/*` is covered the day it is created, with nothing for its author to
 * remember.
 *
 * ── Why it goes UP rather than BACK ─────────────────────────────────────────
 * `history.back()` was never an option on its own: a woman arriving from a
 * notification, a WhatsApp link or an installed shortcut has no history in this
 * tab, and the control would have done nothing at all — the exact failure it
 * exists to fix, only now with a button to press. So it resolves the
 * STRUCTURAL parent from `nav-tree`'s `parentFor`, which is the same tree the
 * rail, the hubs and the bottom bar read, and navigates there for real.
 *
 * That also makes it predictable in a way a history pop is not: this screen's
 * back always goes to the same place, and it says where before she taps. The
 * in-page `kit/back` keeps its own behaviour — it prefers the trail in
 * `lib/nav-history` — and the two do not fight, because that one is rendered
 * inside the page and this one is in the bar above it.
 *
 * ── Why the five tab roots are excluded ─────────────────────────────────────
 * `/app`, `/app/learn`, `/app/work`, `/app/earn` and `/app/circle` have nothing
 * above them; the bar itself is how she moves between them. A back control
 * there could only point sideways. Help and You are NOT excluded even though
 * they are section hubs, because they are not tabs — she reaches them from the
 * header, so they need a way out like anything else. `isTabRoot` is that
 * distinction, in the tree rather than in a list kept here.
 *
 * ── Right to left ───────────────────────────────────────────────────────────
 * Urdu and Arabic are shipped locales. The control is positioned with logical
 * properties only, and the chevron is mirrored by the stylesheet under
 * `[dir="rtl"]` rather than swapped for a second icon — one glyph, pointing
 * whichever way "backwards" is in her script.
 *
 * ── Why the CSS is here and not in `mobile.css` ─────────────────────────────
 * The same reason `TabBar` gives: that file is owned elsewhere and this needs
 * to land without waiting on it. It is a hoisted `<style>` rather than inline
 * `style` props so that the `prefers-contrast` and `forced-colors` blocks in
 * `tokens.css` can still win — an inline style beats a stylesheet.
 */

const CSS = `
/* Above lg the rail and the desktop top bar carry the navigation, and the
   in-page Back is sized for a pointer. This control is a phone control. */
.ux .ux-backbtn { display: none; }

@media (max-width: 1023px) {
  .ux .ux-backbtn {
    display: inline-flex;
    align-items: center;
    justify-content: flex-start;
    gap: 3px;

    /* 44 on both axes, which is Apple's floor and the one this project
       audits against. The chevron alone is 18px wide, so the min-width is
       doing real work on a screen whose parent has a one-word name. */
    min-width: 44px;
    min-height: 44px;
    /* Never wide enough to reach the icons at the other end of the bar. The
       label ellipsises instead — see the note on truncation below. */
    max-width: min(46vw, 200px);
    /* Shrinkable, so a long parent name can never push the search, bell and
       avatar off the end of the row. */
    flex: 0 1 auto;

    padding-inline: 6px 10px;
    /* Optical alignment: pulls the chevron's ink out to the same edge the
       screen's own content starts at, rather than indenting it by the
       button's padding. A logical property, so RTL gets it on the right. */
    margin-inline-start: -6px;
    border-radius: 12px;

    color: var(--ux-ink-2);
    text-decoration: none;
    -webkit-tap-highlight-color: transparent;
  }

  .ux .ux-backbtn:hover { background: var(--ux-surface-2); }

  .ux .ux-backbtn-chevron {
    width: 18px;
    height: 18px;
    flex: none;
  }

  .ux .ux-backbtn-label {
    /* THE body size on a phone — 15px. Comfortably over this project's 12px
       floor, and it moves with her "bigger text" setting because it is the
       token rather than a hard pixel value. */
    font-size: var(--text-xsm);
    font-weight: 600;
    line-height: 1.2;

    /* Truncation, not wrapping: the bar is one row 70px tall and a name that
       wrapped would grow it. An ellipsis is legible and the aria-label below
       still carries the destination in full for a screen reader. */
    min-width: 0;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
}

/* Mirrored, not replaced. In Urdu and Arabic "back" is to the right. */
[dir="rtl"] .ux .ux-backbtn-chevron { transform: scaleX(-1); }
`;

/**
 * Back, in the phone's top bar, on every `/app` screen but the five tab roots.
 *
 * Rendered once by `Shell`'s `Topbar`. It takes no props on purpose: a prop
 * would be a second source of truth about where a screen sits, and that is
 * precisely the drift `nav-tree` exists to end.
 */
export function MobileBack() {
  const pathname = usePathname() ?? "";
  const t = useT();
  const { label } = useNavLabel();

  const inApp = pathname === "/app" || pathname.startsWith("/app/");
  const show = inApp && !isTabRoot(pathname);

  const parent = parentFor(pathname);
  /* `/app/you` and `/app/helpdesk` are section hubs with no parent node above
     them, and a route the tree has never heard of resolves to nothing at all.
     Home is where both of those belong; it is never a dead end. */
  const href = parent?.href ?? "/app";
  const name = parent ? label(parent) : t("ch.mode.home.label");

  return (
    <>
      {show && (
        <Link
          href={href}
          /* The sweep looks for this rather than for the word "back" in the
             markup — "Ways to sell: what you charge, who comes back" is a card
             on /app/earn, and grading on a substring reported a tab root as
             already having a back control. */
          data-ux-back
          /*
            The accessible name says where; the visible label says which.
            WCAG 2.5.3 wants the visible text inside the accessible name, and
            "Back to Learn" contains "Learn", so speech control still works.

            The visible half is the destination's own name rather than the word
            "Back" because a bare arrow asks her to remember where she was —
            the argument `kit/back` already makes — and because at 390px there
            is room for one word, which had better be the useful one.
          */
          aria-label={t("ch.back.to", { name })}
          className="ux-press ux-sq ux-backbtn"
        >
          <Icons.ChevronLeft
            aria-hidden="true"
            className="ux-backbtn-chevron"
            strokeWidth={2.25}
          />
          <span className="ux-backbtn-label">{name}</span>
        </Link>
      )}
      {/* Outside the conditional: the rules are needed the instant the control
          appears, and a stylesheet that mounts in the same commit as the
          element it styles can paint one unstyled frame. */}
      <style href="ux-mobile-back" precedence="ux-mobile">
        {CSS}
      </style>
    </>
  );
}
