import Link from "next/link";

/**
 * WomSakhi brand lockup.
 *
 * Two real assets, both cut out with transparency:
 *   • /womsakhi-emblem.png   — the "WS" monogram (two women shaking hands)
 *   • /womsakhi-wordmark.png — the "WomSakhi" gradient wordmark
 *
 * The emblem is the owner's final artwork, cut off its flat #f7f7f7 backing.
 * The cut is seeded only from regions that are already that exact colour, so
 * the white saree — eight levels away from the backing and the thing a naive
 * "remove white" destroys — survives intact.
 *
 * The monogram is ~1.8:1, so it is sized by HEIGHT with `w-auto` and never
 * boxed into a square — cropping or letterboxing it would hide the handshake
 * in the middle, which is the whole idea of the mark. Instead of a hard chip it
 * gets a soft brand-tinted halo, echoing the glow the artwork was drawn with.
 *
 * `layout="row"`   → mark beside the wordmark (sidebar, topbar)
 * `layout="stack"` → mark above the wordmark, centred (auth screens, splash)
 */

export function LogoMark({
  className = "h-10",
  glow = true,
  src = "/womsakhi-emblem.png",
  alt = "WomSakhi",
}: {
  className?: string;
  glow?: boolean;
  /** An organisation running its own copy replaces this — see org.branding. */
  src?: string;
  alt?: string;
}) {
  return (
    <span className="relative inline-flex shrink-0 items-center justify-center">
      {glow && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 scale-125 rounded-full bg-brand-400/25 blur-xl dark:bg-brand-400/20"
        />
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img loading="lazy" decoding="async"
        src={src}
        alt={alt}
        className={`w-auto object-contain ${className}`}
        draggable={false}
      />
    </span>
  );
}

export function LogoWordmark({
  className = "h-8",
  src = "/womsakhi-wordmark-transparent.png",
  alt = "WomSakhi",
}: {
  className?: string;
  src?: string;
  alt?: string;
}) {
  // The wordmark is artwork — its gradient is part of the brand, so it is never
  // re-typed as text. On dark surfaces the deep-purple "Wom" end of the gradient
  // loses contrast, so it gets a soft brand halo and a touch of brightness
  // rather than a colour change.
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img loading="lazy" decoding="async"
      src={src}
      alt={alt}
      className={`block w-auto dark:brightness-[1.55] dark:saturate-125 dark:drop-shadow-[0_0_8px_rgba(240,94,157,0.22)] ${className}`}
      draggable={false}
    />
  );
}

/** Kept for compatibility with any caller that wants just the mark. */
export const LogoBadge = LogoMark;

export default function Logo({
  href = "/dashboard",
  showTagline = true,
  layout = "row",
  className = "",
  markClassName = "h-10",
  wordmarkClassName = "h-8",
  taglineClassName = "",
  brand,
}: {
  href?: string | null;
  showTagline?: boolean;
  layout?: "row" | "stack";
  className?: string;
  markClassName?: string;
  wordmarkClassName?: string;
  taglineClassName?: string;
  /**
   * An organisation's own marks, when it has licensed `org.branding`.
   * Each field falls back independently: an org with a logo but no wordmark
   * gets its logo beside WomSakhi's wordmark rather than a broken image.
   */
  brand?: { name?: string; logo?: string; wordmark?: string };
}) {
  const alt = brand?.name || "WomSakhi";
  const tagline = showTagline && (
    <span
      className={`block whitespace-nowrap text-3xs font-bold uppercase tracking-[0.18em] text-ink-subtle ${taglineClassName}`}
    >
      Empowering Women
    </span>
  );

  const inner =
    layout === "stack" ? (
      <span className={`inline-flex flex-col items-center gap-3 text-center ${className}`}>
        <LogoMark className={markClassName} src={brand?.logo || undefined} alt={alt} />
        <span className="flex flex-col items-center gap-2">
          <LogoWordmark className={wordmarkClassName} src={brand?.wordmark || undefined} alt={alt} />
          {tagline}
        </span>
      </span>
    ) : (
      <span className={`inline-flex items-center gap-3 ${className}`}>
        {brand?.logo && <LogoMark className={markClassName} src={brand.logo} alt={alt} />}
        <span className="flex flex-col gap-1.5 leading-none">
          <LogoWordmark className={wordmarkClassName} src={brand?.wordmark || undefined} alt={alt} />
          {tagline}
        </span>
      </span>
    );

  if (!href) return inner;
  return (
    <Link href={href} aria-label="WomSakhi — go to dashboard">
      {inner}
    </Link>
  );
}
