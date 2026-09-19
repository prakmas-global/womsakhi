"use client";

import Link from "next/link";

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
      <span className="flex items-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/womsakhi-wordmark-transparent.png"
          alt="WomSakhi"
          width={2172}
          height={724}
          decoding="async"
          style={{ width: s.word }}
          className="h-auto shrink-0 dark:brightness-[1.55] dark:saturate-125 dark:drop-shadow-[0_0_8px_rgba(240,94,157,0.22)]"
          draggable={false}
        />
      </span>

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
