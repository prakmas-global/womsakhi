"use client";

import { memo, useState } from "react";
import { monogram, monogramTone } from "@/lib/monogram";

/**
 * Uploaded photos are shown as-is. Missing or failed photos become a stable,
 * branded two-letter monogram — never a stock stranger or a broken image.
 */

const PALETTE = [
  "bg-brand-100 text-brand-ink",
  "bg-violet-tint text-violet-ink",
  "bg-status-warn-bg text-status-warn-ink",
  "bg-status-ok-bg text-status-ok-ink",
  "bg-status-info-bg text-status-info-ink",
  "bg-status-danger-bg text-status-danger-ink",
  "bg-violet-tint text-violet-ink",
];

function colorFor(name: string) { return PALETTE[monogramTone(name)]; }

const SIZES: Record<string, string> = {
  xs: "h-7 w-7 text-2xs",
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-12 w-12 text-base",
  xl: "h-16 w-16 text-lg",
};

function Avatar({
  name,
  src,
  size = "md",
  className = "",
  ring = false,
}: {
  name: string;
  src?: string | null;
  size?: keyof typeof SIZES;
  className?: string;
  ring?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const ringCls = ring ? "ring-2 ring-white" : "";
  const photo = src?.trim();

  if (photo && !failed) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img loading="lazy" decoding="async"
        src={photo}
        alt={name}
        onError={() => setFailed(true)}
        className={`${SIZES[size]} shrink-0 rounded-full bg-surface-inset object-cover ${ringCls} ${className}`}
      />
    );
  }
  return (
    <span
      role="img"
      aria-label={`${name || "WomSakhi"} — no photo uploaded`}
      className={`relative inline-flex shrink-0 select-none items-center justify-center rounded-full border border-current/10 font-bold tracking-[0.04em] shadow-[inset_0_1px_0_var(--ux-sheen)] ${colorFor(
        name
      )} ${SIZES[size]} ${ringCls} ${className}`}
    >
      {monogram(name, "person")}
    </span>
  );
}

export default memo(Avatar);
