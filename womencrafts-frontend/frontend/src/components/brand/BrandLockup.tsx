/**
 * The owner's official complete lockup: emblem, name, lotus and slogan.
 * The transparent artwork is shared by both themes so its colours never shift.
 * A small theme-aware shadow preserves the fine gold edge on every surface.
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
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/womsakhi-main-logo.png"
      alt={alt}
      className={`brand-lockup ${className}`}
      decoding="async"
      draggable={false}
    />
  );
}

export default BrandLockup;
