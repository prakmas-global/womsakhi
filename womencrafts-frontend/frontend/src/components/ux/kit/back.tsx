"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import * as Icons from "@/components/ux/icons";
import { pageFor } from "@/components/ux/nav-search";
import { previous, record } from "@/lib/nav-history";
import { useT } from "@/i18n";
import type { MessageKey } from "@/i18n";

/**
 * Records every route change, so `Back` has a trail to read.
 *
 * Mounted once in the member shell rather than per page: a page that forgot to
 * record itself would be a hole in the trail, and back would then skip over it
 * to the screen before.
 */
export function NavHistory() {
  const pathname = usePathname();
  useEffect(() => { if (pathname) record(pathname); }, [pathname]);
  return null;
}

/**
 * Back — to where she actually came from, named.
 *
 * ── The bug this fixes, twice ───────────────────────────────────────────────
 * Every back control was a hard link to a fixed parent: the booking detail said
 * "All bookings" and went there however she arrived. Reach it from her calendar
 * and back moves her sideways into a list she never asked for.
 *
 * The first fix read `document.referrer` and used history when it matched our
 * origin. That was wrong in a way only a browser could show: a Next `<Link>` is
 * a pushState, not a new document, so the referrer never updates. Driven for
 * real, Calendar → a booking leaves `document.referrer` as `""` while
 * `history.length` is 3 — so the check reported "no in-app history" on every
 * client-side navigation and every control fell through to its parent anyway.
 *
 * It now reads a trail this component records itself. See `lib/nav-history`.
 *
 * ── Why it names the destination ────────────────────────────────────────────
 * A bare "Back" asks her to remember where she was. Naming it — "Back to your
 * calendar" — means she can tell before she taps whether it is where she wants
 * to go, which matters most on the screens she reached by accident.
 */
export function Back({ to, label, className = "" }: {
  /** Where to go when there is no in-app trail — a deep link, a fresh tab. */
  to: string;
  /** What that parent is called, for the fallback label. */
  label: string;
  className?: string;
}) {
  const t = useT();
  const pathname = usePathname() ?? "";
  // Starts null so the server and first client render agree; sessionStorage is
  // only readable in the browser.
  const [prev, setPrev] = useState<string | null>(null);

  useEffect(() => { setPrev(previous(pathname)); }, [pathname]);

  const href = prev ?? to;
  const page = prev ? pageFor(prev) : null;
  const name = page ? (page.k ? t(`${page.k}.label` as MessageKey) : page.title) : label;

  return (
    <Link
      href={href}
      className={`ux-press ux-sq inline-flex w-fit items-center gap-1.5 text-xsm font-semibold ${className}`}
      style={{ color: "var(--ux-muted)" }}
    >
      <Icons.ArrowLeft className="h-[15px] w-[15px]" />
      {prev ? `Back to ${name.charAt(0).toLowerCase()}${name.slice(1)}` : label}
    </Link>
  );
}
