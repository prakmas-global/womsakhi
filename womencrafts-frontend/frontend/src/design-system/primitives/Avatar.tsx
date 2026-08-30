"use client";

import { memo, useState } from "react";

/**
 * Avatar: shows a real placeholder photo by default (deterministic per name) so
 * image slots look populated. Pass `src` to use an uploaded/real image — that's
 * what a future upload flow will set. Falls back to colored initials if the
 * image fails to load (e.g. offline).
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

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
}
function colorFor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

const SIZES: Record<string, string> = {
  xs: "h-7 w-7 text-2xs",
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-12 w-12 text-base",
  xl: "h-16 w-16 text-lg",
};

/** Deterministic placeholder photo for a given name. */
export function placeholderPhoto(name: string) {
  return `https://i.pravatar.cc/160?u=${encodeURIComponent(name.trim().toLowerCase())}`;
}

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
  const photo = src || placeholderPhoto(name);

  if (!failed) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={photo}
        alt={name}
        onError={() => setFailed(true)}
        className={`${SIZES[size]} shrink-0 rounded-full bg-surface-inset object-cover ${ringCls} ${className}`}
      />
    );
  }
  return (
    <span
      className={`inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold ${colorFor(
        name
      )} ${SIZES[size]} ${ringCls} ${className}`}
    >
      {initials(name)}
    </span>
  );
}

export default memo(Avatar);
