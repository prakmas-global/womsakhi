"use client";

import { memo, useState } from "react";

/**
 * Image thumbnail for content/program/media slots. Shows a deterministic
 * placeholder photo by default; pass `src` for a real/uploaded image (what an
 * upload flow will set later). Falls back to a soft gradient tile if it fails.
 */
function Thumb({
  seed,
  src,
  alt = "",
  className = "h-11 w-11 rounded-lg",
}: {
  seed: string;
  src?: string | null;
  alt?: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const photo = src || `https://picsum.photos/seed/${encodeURIComponent(seed)}/120/120`;

  if (failed) {
    return (
      <span
        className={`inline-block shrink-0 bg-linear-to-br from-brand-100 to-violet-tint ${className}`}
        aria-label={alt}
      />
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return (
    <img loading="lazy" decoding="async"
      src={photo}
      alt={alt}
      onError={() => setFailed(true)}
      className={`shrink-0 bg-surface-inset object-cover ${className}`}
    />
  );
}

export default memo(Thumb);
