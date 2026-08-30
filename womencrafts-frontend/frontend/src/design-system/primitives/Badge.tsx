import { memo } from "react";
import type { ReactNode } from "react";

/**
 * Status / category chip.
 *
 * Tones are the app's semantic colour set — every tinted chip, icon square and
 * status pill picks from this list, so the palette can never drift page to page.
 */
export type Tone =
  | "brand"
  | "violet"
  | "emerald"
  | "amber"
  | "sky"
  | "rose"
  | "slate"
  | "blue"
  | "fuchsia";

/** Tinted background + readable foreground for each tone. */
export const TONE_CLASSES: Record<Tone, string> = {
  brand: "bg-brand-tint text-brand-ink",
  violet: "bg-violet-tint text-violet-ink",
  emerald: "bg-status-ok-bg text-status-ok-ink",
  amber: "bg-status-warn-bg text-status-warn-ink",
  sky: "bg-status-info-bg text-status-info-ink",
  rose: "bg-status-danger-bg text-status-danger-ink",
  slate: "bg-surface-inset text-ink-subtle",
  blue: "bg-status-info-bg text-status-info-ink",
  fuchsia: "bg-violet-tint text-violet-ink",
};

/** Solid dot colour per tone, for "● Published"-style status text. */
export const TONE_DOTS: Record<Tone, string> = {
  brand: "bg-brand-500",
  violet: "bg-violet-500",
  emerald: "bg-status-ok-solid",
  amber: "bg-status-warn-solid",
  sky: "bg-status-info-solid",
  rose: "bg-status-danger-solid",
  slate: "bg-ink-faint",
  blue: "bg-status-info-solid",
  fuchsia: "bg-violet-500",
};

function BadgeBase({
  tone = "slate",
  children,
  dot = false,
  className = "",
}: {
  tone?: Tone;
  children: ReactNode;
  /** Shows a leading status dot instead of a filled chip. */
  dot?: boolean;
  className?: string;
}) {
  if (dot) {
    return (
      <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${className}`}>
        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${TONE_DOTS[tone]}`} />
        {children}
      </span>
    );
  }
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-1 text-2xs font-semibold ${TONE_CLASSES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

export default memo(BadgeBase);
