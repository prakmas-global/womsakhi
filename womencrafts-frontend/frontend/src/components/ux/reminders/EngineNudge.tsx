"use client";

import Link from "next/link";

import { useT } from "@/i18n";
import type { MessageKey } from "@/i18n";
import { I, v } from "@/components/ux/kit";

/**
 * The engine, on whichever dashboard she is already standing on.
 *
 * ── Why one component and not eight ─────────────────────────────────────────
 * Every module has something worth being reminded about — a lesson, a
 * deadline, an order, a circle instalment, a tablet. Writing that card eight
 * times would mean eight slightly different paddings, eight copies of the same
 * link, and a ninth module quietly shipping without one. One row, dropped in
 * additively, keeps them identical and keeps the dashboards themselves
 * untouched apart from a single line.
 *
 * ── Why it is a row and not a card ──────────────────────────────────────────
 * These boards are already dense. A full card competes with the module's own
 * content for the top of the screen; a single row sits under it and is still
 * the width of a thumb. Nothing here reports a number, so it never needs to
 * load anything and never shows a spinner on somebody else's screen.
 *
 * ── Why it links rather than creates ────────────────────────────────────────
 * Creating a reminder from a dashboard would mean deciding the hour for her.
 * The composer asks. This only carries her there with the right preset already
 * chosen, so the tap she saves is the picture, not the decision.
 */
export function EngineNudge({
  /** A `rem.preset.*` key, so the composer opens with the right picture. */
  preset,
  icon,
  tint = "--ux-brand-tint",
  ink = "--ux-brand",
  labelKey,
  noteKey,
  href = "/app/reminders",
  className = "",
}: {
  preset?: string;
  icon: string;
  tint?: string;
  ink?: string;
  labelKey: string;
  noteKey: string;
  href?: string;
  className?: string;
}) {
  const tr = useT();
  const to = preset ? `${href}?preset=${encodeURIComponent(preset)}` : href;

  return (
    <Link
      href={to}
      className={`ux-card ux-hov flex min-h-[64px] items-center gap-3 rounded-[16px] px-3.5 py-3 ${className}`}
      style={{ background: v("--ux-surface"), border: `1px solid ${v("--ux-line")}` }}
    >
      <span className="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-[11px]"
            style={{ background: v(tint), color: v(ink) }}>
        <I name={icon} className="h-[18px] w-[18px]" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xsm font-semibold" style={{ color: v("--ux-ink") }}>
          {tr(labelKey as MessageKey)}
        </span>
        <span className="mt-0.5 block text-2xs leading-snug" style={{ color: v("--ux-muted") }}>
          {tr(noteKey as MessageKey)}
        </span>
      </span>
      <I name="ChevronRight" className="h-[15px] w-[15px] shrink-0" style={{ color: v("--ux-muted") }} />
    </Link>
  );
}
