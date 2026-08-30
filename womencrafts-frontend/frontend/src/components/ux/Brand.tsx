"use client";

import Link from "next/link";

/**
 * The WomSakhi lockup: the emblem, the wordmark, and the line underneath.
 *
 * Both marks are artwork and are never re-typed as text — the wordmark's
 * gradient runs violet through pink into amber across the letterforms, which no
 * font and no CSS gradient reproduces. The tagline IS text, because it is the
 * one part that has to re-colour with the theme and translate with the app.
 *
 * The emblem carries a soft halo of its own colour behind it. Two women shaking
 * hands inside a W and an S is a lot of detail for 46 pixels, and the halo is
 * what stops it reading as a smudge on a plain white rail.
 */
export function Brand({
  size = "md",
  href = "/app",
  tagline = true,
}: {
  size?: "sm" | "md" | "lg";
  href?: string | null;
  tagline?: boolean;
}) {
  /**
   * Sized to the rail, not to taste.
   *
   * The sidebar is 253px with 20px of padding each side, so a lockup has 213px
   * to live in. The first pass came out at 222 and pushed the wordmark's last
   * letter into the edge — these numbers add up to 207 and leave a margin.
   */
  const s = {
    sm: { mark: 30, word: 92, tag: 8, gap: 7 },
    md: { mark: 44, word: 128, tag: 8.5, gap: 8 },
    lg: { mark: 72, word: 212, tag: 11.5, gap: 13 },
  }[size];

  const inner = (
    <span className="ux-hov flex flex-col" style={{ gap: 3 }}>
      <span className="flex items-center" style={{ gap: s.gap }}>
        <span className="relative grid shrink-0 place-items-center"
              style={{ width: s.mark * 1.6, height: s.mark }}>
          {/* The halo. Sized off the mark so every size keeps the same ratio. */}
          <span
            aria-hidden
            className="ux-brand-halo pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(closest-side, color-mix(in srgb, var(--ux-brand) 28%, transparent), transparent 78%)",
              transform: "scale(1.5)",
            }}
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/ux/brand/womsakhi-emblem.webp"
            alt=""
            className="ux-brand-mark relative h-full w-full object-contain"
            draggable={false}
          />
        </span>

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/ux/brand/womsakhi-wordmark.webp"
          alt="WomSakhi"
          style={{ width: s.word }}
          className="h-auto shrink-0"
          draggable={false}
        />
      </span>

      {/* The tagline sits flush with the emblem rather than indented under the
          wordmark: indented it had 137px for a 142px line, and wrapped onto two. */}
      {tagline && (
        <span
          className="whitespace-nowrap font-medium uppercase"
          style={{ fontSize: s.tag, letterSpacing: "0.11em", color: "var(--ux-muted)" }}
        >
          Empowering Her Journey
        </span>
      )}
    </span>
  );

  if (!href) return inner;
  return (
    <Link href={href} aria-label="WomSakhi — home" className="inline-flex">
      {inner}
    </Link>
  );
}
