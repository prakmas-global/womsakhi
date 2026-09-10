"use client";

import { HomeShell } from "@/components/ux/home/HomeShell";
import { TransitionLink } from "@/components/ux/TransitionLink";
import { I, IconTile, v } from "@/components/ux/kit";
import { EARN_PLACES, EARN_WIDE, EARN_PLACE_COUNT, type EarnPlace, type EarnChip } from "./board";

/**
 * The Earn board, built from `Womsakhi-user-ux/Earn-assets`.
 *
 * It replaces the generic `Hub` on this route, the same way `LearnBoard` did
 * on Learn. A hub lists a section's children and stops; this says what each
 * place is, shows the way into every one of its rooms as a pill you can tap,
 * and puts a picture on each card so a woman who reads slowly can find "the
 * shop one" without reading at all.
 *
 * ── Measured, not guessed ───────────────────────────────────────────────────
 * Every number below came off the drawing with a pixel scan rather than an
 * eye. The band is 168px tall and starts 9px under the topbar; the four
 * columns are 313px wide with a 12px gutter; the first row of cards is 423px
 * tall and the second 252px, which is not a mistake in the drawing — the rows
 * are sized by their content, and "Ways to sell" carries nine pills where
 * "Your wallet" carries two. So the grid lets its rows size themselves rather
 * than forcing them equal, and each card's picture takes whatever height is
 * left over. That is what makes a card with three pills and a card with nine
 * both end flush at the same floor.
 *
 * ── The banner ─────────────────────────────────────────────────────────────
 * `earn-hero-banner.webp` arrives with three pieces of handwriting already in
 * it — the WomSakhi quote, "Your Skills / Your Income / Your Freedom", and the
 * "Small Steps Big Freedom" card. They are part of the photograph and are not
 * re-drawn here. The words that are live text — "Earn", "Sell it, and get
 * paid" — sit on the flat left of the band, because this app runs in eighteen
 * languages and is read aloud, and a sentence baked into a picture can be
 * neither translated nor spoken.
 */

/**
 * The card's icon tile — 60px at the drawn size, 44px on a short laptop.
 *
 * Not `kit`'s `IconTile`, and the reason is a trap rather than a preference:
 * that one takes `size` as a NUMBER and does arithmetic with it — `size * 0.45`
 * for the glyph, `size / 20` and `size / 8` for the shadow. Hand it
 * `var(--fb-earn-tile)` and every one of those becomes `NaN`, which does not
 * throw: the tile renders with no width and an invalid `box-shadow` string,
 * and nothing in a typecheck or a screenshot diff says why. So the size lives
 * in CSS here, the glyph is sized in `em` off the tile's own font-size, and
 * the shadow is written out rather than computed.
 */
function Tile({ icon, tint, ink }: { icon: string; tint: string; ink: string }) {
  return (
    <span className="ux-sq grid shrink-0 place-items-center"
          style={{ width: "var(--fb-earn-tile, 60px)", height: "var(--fb-earn-tile, 60px)",
                   fontSize: "var(--fb-earn-tile, 60px)", borderRadius: 18,
                   background: v(tint), color: v(ink),
                   boxShadow: "inset 0 1px 0 var(--ux-edge-hi), inset 0 0 0 1px var(--ux-hairline), 0 3px 7px -1px var(--ux-sh-1)" }}>
      <I name={icon} className="ux-ico" sw={2.1} style={{ width: "0.5em", height: "0.5em" }} />
    </span>
  );
}

/* ── the band ─────────────────────────────────────────────────────────────── */

/**
 * A deliberately light band in both themes.
 *
 * The artwork is a photograph on a pale lavender wall, so there is no dark
 * counterpart to swap to and no honest way to tint one. The band sets its own
 * ink rather than reading the theme — every colour here is chosen against that
 * gradient, not against `--ux-canvas`, which in dark mode sits behind the band
 * rather than under it.
 */
const BAND_INK = v("--ux-band-ink");
const BAND_INK_2 = v("--ux-band-ink-2");
/** #4A4D7B in the drawing — grey, not the brand purple. */
const BAND_MUTED = v("--ux-band-ink-2");

function Hero() {
  return (
    <section className="ux-sq relative isolate shrink-0 overflow-hidden rounded-[18px]"
             /* No border. The drawing has no stroke pixel on any edge of this
                band — its bottom simply fades to the canvas colour, which is
                also why it sits only 4px clear of the cards below it. */
             style={{ background: v("--ux-band-earn"),
                      minHeight: "var(--fb-earn-band, 169px)" }}>
      {/*
        The photograph, cropped by the band rather than sizing it.

        At its own 3:1 it would be 425px tall across this width — two and a
        half times the band — so it is `object-cover` inside a fixed height,
        which keeps the full WIDTH of it. That matters: the quote is at the
        left of the file, the woman in the middle and the "Small Steps Big
        Freedom" card at the right, and a horizontal crop would lose one of
        them. What it trims instead is the empty ceiling and the desk.

        Hidden below `lg`, where the band is only wide enough for the words.
        A 15% left fade, so the photograph dissolves into the flat lavender
        instead of ending on a vertical seam.
      */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/ux/art/earn-hero-banner.webp"
           alt="A woman smiling at her laptop, beside the words “Financial independence is a beautiful step towards a brighter you” and “Your skills, your income, your freedom.”"
           decoding="async" fetchPriority="high" width={1900} height={633}
           className="pointer-events-none absolute inset-y-0 end-0 hidden h-full w-[74%] object-cover lg:block"
           /* 34%, not centre. The handwritten quote sits in the upper half of
              the file and the band shows about 45% of the picture's height, so
              a centred crop cut the first line of it. */
           style={{ objectPosition: "center 34%",
                    maskImage: "linear-gradient(to right, transparent 0%, #000 15%)",
                    WebkitMaskImage: "linear-gradient(to right, transparent 0%, #000 15%)" }} />

      <div className="relative flex items-start gap-3.5 lg:max-w-[46%]"
           style={{ padding: "var(--fb-pad)", paddingBlock: "var(--fb-earn-band-y, 22px)" }}>
        <IconTile icon="IndianRupee" tint="--ux-brand-tint-2" ink="--ux-brand"
                  size={60} radius={18} />
        <div className="min-w-0">
          <h1 className="font-extrabold leading-[1.05] tracking-[-0.03em]"
              style={{ fontSize: "clamp(1.75rem, 3vw, var(--fb-earn-h1, 2.5rem))", color: BAND_INK }}>
            Earn
          </h1>
          <p className="mt-1 font-semibold leading-snug"
             style={{ fontSize: "var(--fb-earn-lead, 22px)", color: BAND_INK_2 }}>
            Sell it, and get paid
          </p>
          {/* Counted from the list, never typed. A hero that says ten while the
              board shows nine is the kind of thing nobody notices for months. */}
          <p className="mt-1.5" style={{ fontSize: "var(--fb-earn-count, 16px)", color: BAND_MUTED }}>
            {EARN_PLACE_COUNT} places, nothing hidden.
          </p>
        </div>
      </div>
    </section>
  );
}

/* ── one pill: a room inside a place ──────────────────────────────────────── */

/**
 * A link, not a button.
 *
 * These are the section's grandchildren — "Take the money first", "Your busy
 * months" — and every one of them is a real route. Drawn at 34px so it clears
 * the 24px minimum target size with room to spare, because this is the control
 * a woman on a phone in poor light is actually aiming at.
 */
function ChipLink({ c }: { c: EarnChip }) {
  return (
    <TransitionLink href={c.href} data-earn-chip
      className="ux-sq ux-press inline-flex items-center whitespace-nowrap font-medium transition-colors"
      /* `borderRadius` inline and not `rounded-full`: `.ux-card`-era rules in
         `tokens.css` are UNLAYERED and Tailwind's utilities sit in
         `@layer utilities`, so an unlayered radius beats the class no matter
         how specific the class is. Every radius on this board is set the same
         way, for the same reason. */
      style={{ minHeight: "var(--fb-earn-chip-h, 34px)",
               paddingInline: "var(--fb-earn-chip-x, 13px)",
               paddingBlock: 6,
               borderRadius: 999,
               fontSize: "var(--fb-earn-chip, 14px)",
               background: v("--ux-brand-tint-2"),
               color: v("--ux-ink") }}>
      {c.label}
    </TransitionLink>
  );
}

/* ── one of the eight ─────────────────────────────────────────────────────── */

function PlaceCard({ p }: { p: EarnPlace }) {
  const tint = p.pink ? "--ux-tint-pink" : "--ux-brand-tint-2";
  const ink = p.pink ? "--ux-pink-ink" : "--ux-brand";
  /*
    "Ways to sell" carries nine pills and fills its card to the floor, so the
    picture has nowhere to go — laid across the full width it came out sliced
    between the pill gaps, which reads as a rendering fault rather than a
    background. On a card this dense it retreats to the bottom-right corner
    instead, which is where the drawing has it too: the pills there stop about
    two thirds across and the woman with the tablet occupies the rest.
  */
  const dense = p.chips.length >= 6;

  return (
    /*
      The picture is BEHIND the words, not below them.

      This is the one structural thing the drawing does that a column layout
      cannot: on "Your shop" the three pills leave most of the card to the
      shop, while on "Ways to sell" nine pills reach the floor and the woman
      with the tablet shows through behind them. Both are the same rule — a
      fixed picture on the card's floor, with the content laid over it — and
      it is why the eight cards end flush no matter how many rooms each has.

      `min-height` is what gives the second row its height: its cards carry two
      pills and would otherwise collapse to 130px, showing a sliver of picture.
      The first row is taller than the minimum on its own, so the same number
      serves both rows without forcing them equal.
    */
    <section data-earn-card={p.href}
             className="ux-card ux-i ux-onscroll relative isolate flex h-full flex-col overflow-hidden"
             style={{ padding: 0, borderRadius: 12,
                      minHeight: "var(--fb-earn-card-min, 226px)" }}>
      <TransitionLink href={p.href}
                      className="ux-sq group relative z-10 flex shrink-0 items-start gap-[17px]"
                      style={{ paddingInline: "var(--fb-pad)",
                               paddingTop: "var(--fb-earn-pad-y, 14px)",
                               paddingBottom: 0 }}>
        <Tile icon={p.icon} tint={tint} ink={ink} />
        <span className="min-w-0 flex-1">
          <span className="flex items-start gap-2">
            <b className="min-w-0 flex-1 font-bold leading-[1.15] tracking-[-0.01em]"
               style={{ fontSize: "var(--fb-earn-title, 18px)", color: v("--ux-ink") }}>
              {p.title}
            </b>
            <I name="ChevronRight"
               className="mt-0.5 h-[13px] w-[13px] shrink-0 transition-transform group-hover:translate-x-0.5"
               sw={2.2} style={{ color: v("--ux-ink-2") }} />
          </span>
          <span className="mt-[7px] block"
                style={{ fontSize: "var(--fb-earn-sub, 15px)", lineHeight: "20px",
                         color: v("--ux-muted") }}>
            {p.sub}
          </span>
        </span>
      </TransitionLink>

      {p.chips.length > 0 && (
        /*
          `shrink-0`, and it matters.

          Left flexible, a card with nine pills lets the row squeeze itself
          when the board runs short of height — and a flex-wrap container that
          is shorter than its content does not scroll, it just hides the last
          row with no indication at all. The picture below gives up its height
          instead, which is the right thing to lose.
        */
        <div data-earn-chips className="relative z-10 flex shrink-0 flex-wrap"
             style={{ gap: "var(--fb-earn-chip-gap, 8px)",
                      paddingInline: "var(--fb-pad)",
                      paddingTop: "var(--fb-earn-chip-top, 22px)" }}>
          {p.chips.map((c) => <ChipLink key={c.href} c={c} />)}
        </div>
      )}

      {/*
        The picture takes the floor, and whatever height is left above it.

        `flex-1` with `min-h-0` is what makes the eight cards end flush: the
        row is as tall as its tallest card, and on every other card the
        difference is absorbed here rather than left as a hole under the
        pills. `object-contain` at `object-bottom` means the picture is never
        stretched to do it — it simply sits on the floor at whatever size the
        space allows.

        The top edge is faded out. Each file carries a pale lavender ground
        baked into the pixels, which is invisible on a white card and a pale
        block on a dark one; the mask dissolves it into whichever surface is
        behind it.
      */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/ux/art/${p.art}.webp`} alt="" aria-hidden loading="lazy" decoding="async"
           width={p.artW} height={p.artH}
           className={`pointer-events-none absolute bottom-0 z-0 object-contain ${
             dense ? "end-0 object-right-bottom" : "inset-x-0 w-full object-bottom"}`}
           /* Faded over 55px at the top, the distance measured off the drawing.
              Each file carries a pale lavender ground baked into the pixels:
              invisible on a white card, a pale block on a dark one, and the
              mask dissolves it into whichever surface is behind it. */
           /* A share of the card, not a fixed band. The first row is 418px
              tall and the second 240px, and a picture that was the same height
              on both left a hole under the pills on the tall one. `max()`
              keeps a floor so the shortest card still shows a real picture. */
           style={dense
             ? { height: "38%", width: "52%",
                 maskImage: "linear-gradient(to bottom, transparent 0, #000 46px), linear-gradient(to right, transparent 0, #000 40%)",
                 WebkitMaskImage: "linear-gradient(to bottom, transparent 0, #000 46px), linear-gradient(to right, transparent 0, #000 40%)",
                 maskComposite: "intersect", WebkitMaskComposite: "source-in" }
             : { height: "max(var(--fb-earn-art, 110px), 46%)",
                 maskImage: "linear-gradient(to bottom, transparent 0, #000 55px)",
                 WebkitMaskImage: "linear-gradient(to bottom, transparent 0, #000 55px)" }} />
    </section>
  );
}

/* ── the two the drawing leaves out ───────────────────────────────────────── */

/**
 * Laid out along the card rather than down it.
 *
 * The wireframe has eight cards and stops, but its rail lists ten places and
 * its hero counts ten. Giving these two a full-height row of their own would
 * have cost the eight above them a fifth of their height; laid on their side
 * they need about a quarter of that, and the drawn rows keep their
 * proportions. The picture is small and on the end, where it reads as a mark
 * rather than a scene.
 */
function WideCard({ p }: { p: EarnPlace }) {
  const tint = p.pink ? "--ux-tint-pink" : "--ux-brand-tint-2";
  const ink = p.pink ? "--ux-pink-ink" : "--ux-brand";

  return (
    <section data-earn-card={p.href}
             className="ux-card ux-i ux-onscroll flex min-w-0 flex-col items-stretch overflow-hidden lg:h-[var(--fb-earn-wide,60px)] lg:flex-row lg:items-center"
             style={{ padding: 0, borderRadius: 12 }}>
      <TransitionLink href={p.href}
                      className="ux-sq group flex min-w-0 shrink-0 items-center gap-3"
                      style={{ paddingInline: "var(--fb-pad)",
                               paddingBlock: "var(--fb-earn-pad-y, 14px)",
                               paddingInlineEnd: 0 }}
                      /* The vertical padding is dropped only once the card is
                         a strip; stacked, it needs the same breathing room as
                         any other card header. */
                      data-wide-head>
        <IconTile icon={p.icon} tint={tint} ink={ink} size={42} radius={13} />
        <span className="min-w-0">
          <span className="flex items-center gap-1.5">
            <b className="min-w-0 truncate font-bold leading-tight"
               style={{ fontSize: "var(--fb-earn-title, 18px)", color: v("--ux-ink") }}>
              {p.title}
            </b>
            <I name="ChevronRight"
               className="h-[16px] w-[16px] shrink-0 transition-transform group-hover:translate-x-0.5"
               sw={2} style={{ color: v("--ux-muted") }} />
          </span>
          <span className="mt-0.5 block truncate leading-snug"
                style={{ fontSize: "var(--fb-earn-sub, 15px)", color: v("--ux-muted") }}>
            {p.sub}
          </span>
        </span>
      </TransitionLink>

      {/*
        One line that scrolls sideways, rather than a block that wraps.

        Wrapping is what made this row 198px tall and pushed the board off the
        window. On its side the row costs 72px whatever the longest label
        turns out to be in Marathi or Bengali — and a row that scrolls is
        honest about having more in it, where a wrapped row that has been
        clipped to fit is not. The bar is hidden; the overflow is not.
      */}
      <div data-earn-chips
           className="ux-scroll-x flex min-w-0 flex-1 flex-wrap items-center overflow-x-auto lg:flex-nowrap"
           /* Faded on the end rather than cut. A label sliced through the
              middle of a word reads as broken; the same label fading out reads
              as "there is more this way", which is what is true. */
           style={{ gap: "var(--fb-earn-chip-gap, 8px)",
                    paddingInline: "var(--fb-pad)",
                    paddingBlock: "var(--fb-earn-pad-y, 14px)",
                    maskImage: "linear-gradient(to right, #000 calc(100% - 28px), transparent 100%)",
                    WebkitMaskImage: "linear-gradient(to right, #000 calc(100% - 28px), transparent 100%)" }}>
        {p.chips.map((c) => <ChipLink key={c.href} c={c} />)}
      </div>

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/ux/art/${p.art}.webp`} alt="" aria-hidden loading="lazy" decoding="async"
           width={p.artW} height={p.artH}
           className="pointer-events-none hidden w-auto shrink-0 self-end object-contain object-right-bottom lg:block"
           style={{ height: "calc(var(--fb-earn-wide, 64px) - 8px)", maxWidth: 62,
                    maskImage: "linear-gradient(to right, transparent 0%, #000 40%)",
                    WebkitMaskImage: "linear-gradient(to right, transparent 0%, #000 40%)" }} />
    </section>
  );
}

/* ── the board ────────────────────────────────────────────────────────────── */

export function EarnBoard() {
  return (
    <HomeShell active="/app/earn" loadFailed="your earning" fit>
      {/*
        Sized to the window from `xl` up, an ordinary scrolling column below it.

        `min-h-0` on the grid is what lets it shrink at all — without it a flex
        child refuses to go below its content height and the scrollbar comes
        back, which is the single thing that broke this layout the most times
        on the Learn and Work boards before it.
      */}
      <div className="ux-fitboard ux-earnboard flex flex-col xl:min-h-full"
           style={{ gap: "var(--fb-earn-hero-gap, 4px)" }}>
        <Hero />

        {/*
          Four fixed columns, not `auto-fit`.

          The drawing has four and only four, and an `auto-fit` track would
          quietly become five on a wide monitor and three on a narrow one —
          which is exactly the kind of "small cosmetic" drift this board is
          meant not to have. Below `xl` it steps 1 → 2 → 4 by breakpoint.

          `auto-rows` rather than equal rows: the first row is 423px in the
          drawing and the second 252px, because their content differs. Forcing
          them equal would put 170px of white space under "Your wallet".
        */}
        <div data-earn-grid
             className="grid min-h-0 grid-cols-1 sm:grid-cols-2 xl:flex-1 xl:grid-cols-4"
             style={{ columnGap: "var(--fb-gap)", rowGap: "var(--fb-earn-rowgap, 18px)",
                      gridAutoRows: "minmax(0, auto)" }}>
          {EARN_PLACES.map((p) => <PlaceCard key={p.id} p={p} />)}
        </div>

        <div data-earn-wide className="grid shrink-0 grid-cols-1"
             /* 1.2 / 1, not 1 / 1 — "Your locker" has four rooms and "What you
                are owed" two, and equal halves left one crowded beside one with
                empty space. The split is the ratio of what each has to show. */
             style={{ gap: "var(--fb-gap)", marginTop: "var(--fb-earn-rowgap, 18px)",
                      gridTemplateColumns: "var(--fb-earn-wide-cols, 1fr)" }}>
          {EARN_WIDE.map((p) => <WideCard key={p.id} p={p} />)}
        </div>
      </div>
    </HomeShell>
  );
}
