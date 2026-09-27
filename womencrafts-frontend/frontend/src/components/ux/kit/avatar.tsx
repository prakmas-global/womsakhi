"use client";

import { useState } from "react";
import { monogram, monogramTone } from "@/lib/monogram";

/**
 * A face, at the size it is actually drawn.
 *
 * ── The problem this solves ─────────────────────────────────────────────────
 * Avatars come from the API and are whatever the woman uploaded — the seeded
 * one is **1240×1269 and 1.8MB, drawn at 40px**. Every screen that shows her
 * face was pulling nearly two megabytes to paint a circle the size of a
 * fingernail, and on the connections this product is built for that is most of
 * the page load.
 *
 * A plain `<img>` cannot fix it: the bytes are decided by the file, not the
 * CSS. `next/image` asks the server for the size actually needed, so a 40px
 * avatar costs a few kilobytes regardless of what she uploaded.
 *
 * ── Why NOT `next/image` ────────────────────────────────────────────────────
 * It would be the right tool — resize a remote upload to the 40px actually
 * drawn — but the optimiser rejects these URLs in this setup with `"url"
 * parameter is not allowed`, with `remotePatterns` configured both ways the
 * Next 16 docs describe and the Turbopack cache cleared. That matches the note
 * in `next.config.ts` that the whole `images` block is inert here.
 *
 * So this ships explicit `width`/`height` instead, which earns the parts that
 * do not need an optimiser: no layout shift while it loads, and a decode at
 * the right size. **The bytes are still wrong** — a 1.8MB avatar drawn at 40px
 * needs a thumbnail generated at upload, which is server-side work.
 *
 * ── The fallback is a letter, not a broken image ────────────────────────────
 * A missing avatar renders her initial on a tinted circle. An empty `<img>`
 * makes the browser re-request the page URL and draw a broken-image glyph,
 * which looks like the app is broken rather than like she has no photo yet.
 */
export function Avatar({ src, name, size = 40, className = "", ring }: {
  src?: string | null;
  /** Used for the initial, and for the accessible name. */
  name: string;
  size?: number;
  className?: string;
  ring?: string;
}) {
  const [failed, setFailed] = useState(false);
  const style: React.CSSProperties = {
    width: size, height: size,
    ...(ring ? { boxShadow: `0 0 0 2px var(${ring})` } : {}),
  };

  if (!src?.trim() || failed) {
    const tints = ["--ux-brand-tint-2", "--ux-tint-lilac", "--ux-tint-pink", "--ux-tint-blue", "--ux-tint-green", "--ux-tint-amber"];
    return (
      <span
        className={`grid shrink-0 select-none place-items-center rounded-full border font-bold tracking-[0.04em] shadow-[inset_0_1px_0_var(--ux-sheen)] ${className}`}
        style={{ ...style, background: `linear-gradient(145deg, var(${tints[monogramTone(name)]}), var(--ux-surface))`, borderColor: "var(--ux-line)", color: "var(--ux-brand)",
                 fontSize: Math.max(9, Math.round(size * 0.31)) }}
        aria-label={`${name || "WomSakhi"} — no photo uploaded`}
        role="img"
      >
        {monogram(name, "person")}
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={name}
      loading="lazy"
      decoding="async"
      width={size}
      height={size}
      onError={() => setFailed(true)}
      className={`shrink-0 rounded-full object-cover ${className}`}
      style={style}
    />
  );
}
