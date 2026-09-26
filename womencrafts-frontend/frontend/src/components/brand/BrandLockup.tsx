/**
 * The WomSakhi lockup — emblem, wordmark, lotus and rules — in both themes.
 *
 * Two files rather than one, because half the artwork is deep plum. The "Wom"
 * in the wordmark and the rules either side of the lotus are near-black at
 * #6f1454, and the sign-in card is genuinely dark in dark mode (#160f15, see
 * `auth-tokens.css`) — so a single light lockup loses its left half and its
 * ornament there and reads as a smudge. The dark file lifts exactly those two
 * elements; the emblem itself is unchanged between them.
 *
 * Swapped in CSS on `html.dark` rather than in React, so the right one is
 * painted on the first frame: this sits at the top of the first screen a woman
 * ever sees, and a lockup that flips a beat after paint looks broken.
 *
 * Both files carry real transparency, so neither needs a plate or a blend mode
 * behind it — it sits directly on whatever surface it is given.
 */

export function BrandLockup({
  className = "",
  alt,
}: {
  /** Sizing comes from the caller; these two only handle the theme swap. */
  className?: string;
  alt: string;
}) {
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/womsakhi-brand.webp"
        alt={alt}
        className={`brand-lockup-light ${className}`}
        decoding="async"
        draggable={false}
      />
      {/* The dark twin is decorative: the light one above already carries the
          accessible name, and announcing the brand twice is noise. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/womsakhi-brand-dark.webp"
        alt=""
        aria-hidden
        className={`brand-lockup-dark ${className}`}
        decoding="async"
        draggable={false}
      />
    </>
  );
}

export default BrandLockup;
