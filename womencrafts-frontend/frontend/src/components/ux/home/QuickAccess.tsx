"use client";

import { useT } from "@/i18n";
import { TransitionLink } from "@/components/ux/TransitionLink";
import { I } from "@/components/ux/kit";

/**
 * Quick Access: the same eight doors on the laptop home and the phone home.
 *
 * Navigation, not data — which is why it is a constant and stays one. These
 * are destinations the app has whether or not she has used them; a request to
 * find out that /app/wallet exists would be a request for nothing.
 *
 * **Eight, and it stays even.** There were seven in a six-column grid, which
 * left "On your way" alone on a second row and read as a layout that had
 * broken. Eight fills 4 × 2 on a tablet and a laptop and 2 × 4 on a phone, so
 * every row is full at every width. Adding a ninth means adding a tenth, or
 * taking one away.
 *
 * **One place for both screens.** The laptop and the phone each had their own
 * idea of this grid, and the phone's had been removed altogether, so the same
 * product offered eight shortcuts on one device and none on the other. One
 * list means a tile added here is added everywhere.
 *
 * Hints are kept to about sixteen characters so they sit on one line in a
 * 2-column phone tile; on a tile too narrow even for that (a 320px screen)
 * the hint is dropped by a container query rather than cut to "Buy & se…".
 */
export const QUICK_TILES = [
  { icon: "UsersRound", label: "My Circles", sub: "Your people", tint: "--ux-tint-pink", ink: "--ux-pink-ink", href: "/app/circles" },
  { icon: "PiggyBank", label: "Savings Pot", sub: "Save small, grow", tint: "--ux-tint-violet", ink: "--ux-violet-ink", href: "/app/circles" },
  { icon: "HeartHandshake", label: "Care Circle", sub: "Help when needed", tint: "--ux-tint-blue", ink: "--ux-blue-ink", href: "/app/family" },
  { icon: "Store", label: "My Shop", sub: "Sell your work", tint: "--ux-tint-amber", ink: "--ux-amber-ink", href: "/app/shop" },
  { icon: "ShoppingBasket", label: "Market", sub: "Buy & sell nearby", tint: "--ux-tint-green", ink: "--ux-green-ink", href: "/app/market" },
  { icon: "Wallet", label: "Wallet", sub: "Your money", tint: "--ux-tint-lilac", ink: "--ux-violet-ink", href: "/app/wallet" },
  /* The reminder engine's tile keeps its catalogue key, so its label reads in
     her language; the others have always rendered raw English. */
  { icon: "MapPin", label: "On your way", k: "ch.travel-journey.label", sub: "Check in safely",
    tint: "--ux-tint-green", ink: "--ux-green-ink", href: "/app/travel/journey" },
  // The eighth, so the grid closes. Learning is the other half of the
  // Skill → Income spine the rest of these tiles are about.
  { icon: "GraduationCap", label: "Learn", sub: "At your own pace",
    tint: "--ux-tint-orange", ink: "--ux-orange-ink", href: "/app/learn" },
] as const;

/**
 * The grid itself.
 *
 * The focus outline is solid brand at full strength and marked important: the
 * app-wide `.ux a:focus-visible` rule is unlayered, so it beat the utility and
 * left a 28%-alpha outline — under 3:1 against the canvas.
 *
 * `size="desk"` sizes its columns to its container (the dashboard's middle
 * column changes width with the rail); `size="phone"` to the viewport —
 * 2 across, and 4 from 640px, the tablet.
 *
 * Every tile in a row is the height of the tallest: grid rows stretch, and
 * `h-full` hands that height to the link, so the whole tile is the target.
 */
export function QuickAccessGrid({ size }: { size: "desk" | "phone" }) {
  const tr = useT();
  const cols = size === "desk"
    ? "grid-cols-2 gap-2.5 @lg:grid-cols-4 @lg:gap-3"
    : "grid-cols-2 gap-2.5 sm:grid-cols-4";
  const grid = (
    <div data-testid="quick-access" className={`grid ${cols}`}>
      {QUICK_TILES.map((t) => (
        <TransitionLink key={t.label} href={t.href}
              className={`ux-card ux-tile ux-sq @container flex h-full flex-col rounded-[16px]
                         focus-visible:outline-solid! focus-visible:outline-2! focus-visible:outline-offset-2!
                         focus-visible:outline-[var(--ux-brand)]! ${
                           size === "desk" ? "min-h-[112px] p-3.5 @lg:min-h-[128px] @lg:p-4" : "min-h-[104px] p-3"}`}
              style={{ background: "var(--ux-surface)", border: "1px solid var(--ux-line)",
                       ["--ux-glow" as string]: `color-mix(in oklab, var(${t.ink}) 26%, transparent)` }}>
          <span className="ux-tile-ic grid h-[44px] w-[44px] shrink-0 place-items-center rounded-full"
                style={{ background: `var(${t.tint})`, color: `var(${t.ink})` }}>
            <I name={t.icon} className="h-[20px] w-[20px]" />
          </span>
          <span className="mt-auto block truncate pt-2.5 text-sm font-bold" style={{ color: "var(--ux-ink)" }}>
            {"k" in t ? tr(t.k as Parameters<typeof tr>[0]) : t.label}
          </span>
          {/* Hidden on a tile under 116px of content (the widest hint is
              113px): there it would not fit on one line, and a cut hint is
              worse than none. */}
          <span data-hint className="mt-0.5 hidden truncate text-2xs leading-snug @[7.25rem]:block"
                style={{ color: "var(--ux-muted)" }}>
            {t.sub}
          </span>
        </TransitionLink>
      ))}
    </div>
  );
  return size === "desk" ? <div className="@container">{grid}</div> : grid;
}
