"use client";

import { memo, useState } from "react";
import { monogram, monogramTone } from "@/lib/monogram";

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
  const photo = src?.trim();

  if (!photo || failed) {
    const tone = monogramTone(seed);
    const tones = ["from-brand-100 to-violet-tint text-brand-ink", "from-status-info-bg to-brand-tint text-status-info-ink", "from-status-ok-bg to-brand-tint text-status-ok-ink", "from-status-warn-bg to-violet-tint text-status-warn-ink", "from-violet-tint to-brand-tint text-violet-ink", "from-surface-inset to-brand-tint text-brand-ink"];
    return (
      <span
        role="img"
        className={`inline-grid shrink-0 place-items-center border border-current/10 bg-linear-to-br font-bold tracking-[0.05em] shadow-[inset_0_1px_0_var(--ux-sheen)] ${tones[tone]} ${className}`}
        aria-label={alt ? `${alt} — no image uploaded` : `${seed} — no image uploaded`}
      >{monogram(seed, "label")}</span>
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
