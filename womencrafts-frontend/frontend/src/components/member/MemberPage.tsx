"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

/**
 * The frame every inner member screen shares: a back link, a title, and an
 * optional line explaining what the screen is for.
 *
 * Having one component means the back arrow is always in the same place and
 * always points somewhere sensible — on a phone, a screen you can't get out of
 * is a trap.
 *
 * Width is a deliberate choice per screen, not a default:
 *   · "wide"   — lists and grids. Fills a desktop instead of leaving it empty.
 *   · "narrow" — forms and long prose. A 1200px-wide paragraph is unreadable,
 *                and a text field that spans a monitor looks broken.
 *   · `aside`  — detail screens: content on the left, actions in a sticky
 *                column on the right, stacked back into one flow on a phone.
 */
export default function MemberPage({
  title,
  subtitle,
  backHref = "/app/profile",
  backLabel,
  children,
  action,
  aside,
  width = "wide",
}: {
  title: string;
  subtitle?: string;
  backHref?: string;
  backLabel?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  aside?: React.ReactNode;
  width?: "wide" | "narrow";
}) {
  const shell = width === "narrow" || aside ? "max-w-5xl" : "max-w-6xl";

  return (
    <div className={`wc-page-enter mx-auto ${shell}`}>
      <Link
        href={backHref}
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-subtle transition hover:text-ink-muted"
      >
        <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
        {backLabel ?? "Back"}
      </Link>

      <div className="mt-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-bold tracking-tight text-ink">{title}</h1>
          {subtitle && <p className="mt-1 max-w-2xl text-sm text-ink-subtle">{subtitle}</p>}
        </div>
        {action}
      </div>

      {aside ? (
        <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0">{children}</div>
          {/* Sticky on desktop so the primary action never scrolls away. */}
          <div className="lg:sticky lg:top-20 lg:self-start">{aside}</div>
        </div>
      ) : (
        <div className={`mt-5 ${width === "narrow" ? "max-w-2xl" : ""}`}>{children}</div>
      )}
    </div>
  );
}

/**
 * The card grid every list screen uses.
 *
 * One place to decide how many columns a phone, a tablet and a monitor each
 * get, so twelve screens can't drift into twelve different answers.
 */
export function MemberGrid({
  children,
  cols = 2,
  className = "",
}: {
  children: React.ReactNode;
  cols?: 1 | 2 | 3;
  className?: string;
}) {
  const template =
    cols === 1
      ? "grid-cols-1"
      : cols === 3
        ? "sm:grid-cols-2 xl:grid-cols-3"
        : "lg:grid-cols-2";
  return <ul className={`grid gap-3 ${template} ${className}`}>{children}</ul>;
}
