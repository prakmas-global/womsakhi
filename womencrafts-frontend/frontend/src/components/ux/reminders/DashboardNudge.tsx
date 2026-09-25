"use client";

import { useT } from "@/i18n";
import type { MessageKey } from "@/i18n";
import { TransitionLink } from "@/components/ux/TransitionLink";
import { I } from "@/components/ux/kit";
import styles from "./DashboardNudge.module.css";

/**
 * The reminder engine, on a module's own main dashboard.
 *
 * ── Why this exists next to `EngineNudge` ───────────────────────────────────
 * The five tab dashboards (home, learn, work, earn, circle) are built from CSS
 * modules with their own borders, radii and type scale; the secondary boards
 * (money, shop, goals) are built from the Tailwind kit. Dropping the kit row
 * into a CSS-module dashboard produced a card with a different radius and a
 * different small-text size sitting between two that agreed with each other —
 * visible immediately, and the one thing these screens were redesigned to stop
 * doing. So the markup is the same idea and the stylesheet is the dashboard's.
 *
 * ── Additive, and only additive ─────────────────────────────────────────────
 * One element, inserted between two existing siblings in the flex column. No
 * existing rule is edited, no wrapper is introduced, and removing the line
 * restores the screen exactly. `--dashboard-gap` and the column's own `gap`
 * place it; this file sets no outer margin at all.
 *
 * ── Why it links rather than creates ────────────────────────────────────────
 * Creating a reminder here would mean choosing the hour for her. The composer
 * asks. This carries her there with the picture already chosen, so the tap it
 * saves is the picture, not the decision.
 */
export function DashboardNudge({
  /** A `rem.preset.*` key, so the composer opens on the right picture. */
  preset,
  icon,
  tint = "var(--ux-tint-pink)",
  ink = "var(--ux-brand)",
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
    <TransitionLink
      href={to}
      className={`${styles.nudge} ${className}`}
      style={{ "--tint": tint, "--ink": ink } as React.CSSProperties}
    >
      <span className={styles.icon} aria-hidden="true"><I name={icon} /></span>
      <span className={styles.body}>
        <strong>{tr(labelKey as MessageKey)}</strong>
        <span>{tr(noteKey as MessageKey)}</span>
      </span>
      <span className={styles.go}>
        <span>{tr("nudge.set")}</span>
        <I name="ArrowRight" />
      </span>
    </TransitionLink>
  );
}
