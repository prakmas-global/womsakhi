"use client";

import Link from "next/link";

import { useT } from "@/i18n";
/** Website-matched wordmark for expanded application navigation. */
export function Brand({
  size = "md",
  href = "/app",
  tagline = true,
}: {
  size?: "sm" | "md" | "lg";
  href?: string | null;
  tagline?: boolean;
}) {
  const tr = useT();
  /**
   * Sized to the rail, not to taste.
   *
   * The sidebar is 253px with 20px of padding each side, so a lockup has 213px
   * to live in. The first pass came out at 222 and pushed the wordmark's last
   * letter into the edge — these numbers add up to 207 and leave a margin.
   */
  const s = {
    sm: { word: 126, tag: 7.5 },
    md: { word: 150, tag: 8.5 },
    lg: { word: 212, tag: 11.5 },
  }[size];

  const inner = (
    <span className="flex flex-col items-start" style={{ gap: 2 }}>
      {/*
        The brand artwork itself, in both themes.

        A recoloured copy was tried for dark mode — 65% of the mark's opaque
        pixels sit below 0.18 luminance, which on the #150c0f bar is ink on ink
        — and the owner's answer was the right one: a wordmark whose colours
        change is not the wordmark. So this is the original file in both
        themes, resized to 900px and written LOSSLESS (verified: maximum
        channel difference from the source is 0), which is still 116KB against
        the 756KB PNG it replaces on a logo that loads with every screen.

        It is also TRIMMED to its own ink. The source carries 55px of
        transparent padding above the letters and 77px below in a 300px box —
        the wordmark filled 56% of its own height, so a box set to 38px drew
        21px of lettering and read as an undersized logo whatever the box was
        set to. Cropped to the ink, the box height IS the wordmark height.

        The old `brightness(1.55) saturate(1.25)` plus pink glow is gone with
        it: a brightness filter cannot lift a near-black stroke, so all it did
        was add a halo.
      */}
      <span className="flex items-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/womsakhi-wordmark.webp"
          alt="WomSakhi"
          width={900}
          height={183}
          decoding="async"
          /*
            `maxWidth`, not just `width`.

            At 390px the row is the lockup plus five 44px controls and their
            gaps, which leaves the lockup about 104px. The `sm` size asks for
            126, and `shrink-0` meant it took them — the wordmark ran 20px past
            its own link and sat underneath the Search button, with the
            magnifier printed over the "i" in Sakhi.

            The cap only bites on a phone: `--ux-brand-cap` is 96px below the
            `sm` breakpoint and unset above it, so every other layout keeps the
            size it was tuned to.
          */
          style={{ width: s.word, maxWidth: "var(--ux-brand-cap, none)" }}
          className="ux-wordmark h-auto min-w-0"
          draggable={false}
        />
      </span>

      {tagline && (
        <span
          className="whitespace-nowrap font-medium uppercase"
          style={{ fontSize: s.tag, letterSpacing: "0.11em", color: "var(--ux-muted)" }}
        >
          {tr("brand.empoweringHerJourney")}
        </span>
      )}
    </span>
  );

  if (!href) return inner;
  return (
    /* `items-center`, because the touch-target floor makes this link 44px tall
       on a phone while the wordmark inside it is 26px. Without it the mark
       aligns to the top of that box and sits 9px above the bar's centre —
       measured: mark centre 25.5, bar centre 34.5. */
    <Link href={href} aria-label={tr("brand.womsakhiHome")} className="inline-flex items-center">
      {inner}
    </Link>
  );
}
