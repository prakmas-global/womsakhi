"use client";

import * as React from "react";

/**
 * One place that turns paise into something a woman reads.
 *
 * Eleven screens formatted rupees eleven ways: `₹24,350`, `₹24,350.00`,
 * `₹24350`, `24,350`, and — on one screen that had taken a plain number from
 * an API — `599`. A bare number on a cost line reads as an identifier, and two
 * screens disagreeing about the same amount by a rounding is how a woman stops
 * trusting the figure on either.
 *
 * **Minor units in, always.** The rest of this codebase stores money as paise
 * for the reason floats and money do not mix; this is the only place it stops
 * being paise, and it stops being paise at the last possible moment.
 *
 * `exact` is for anything that has to reconcile with a bank statement — a
 * receipt, a statement line, the confirmed amount on a withdrawal. Everywhere
 * else the paise are noise: nobody scanning a list of earnings wants `.00`
 * after every row.
 */

const INR = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });
const INR_EXACT = new Intl.NumberFormat("en-IN", {
  minimumFractionDigits: 2, maximumFractionDigits: 2,
});

/** The string form, for a title attribute, a print document or a CSV cell. */
export function formatMoney(minor: number, exact = false): string {
  const n = (minor || 0) / 100;
  return `₹${(exact ? INR_EXACT : INR).format(exact ? n : Math.round(n))}`;
}

/**
 * Money, or the word "Free".
 *
 * Two screens want this and five do not, which is exactly why it is a separate
 * function rather than a flag: an event with no fee says **Free**, because
 * "₹0" reads like a price somebody forgot to fill in. A wallet balance of zero
 * is not free, it is empty, and must not say so.
 */
export function formatMoneyOrFree(minor: number): string {
  return minor === 0 ? "Free" : formatMoney(minor);
}

/** The old name, kept so nothing has to change its imports. */
export const rupees = formatMoney;

/**
 * Whole rupees in, not paise.
 *
 * **Read that again before using this.** Two places genuinely hold whole
 * rupees — a job listing's monthly pay is stored as `25000` meaning ₹25,000,
 * not ₹250 — and passing one of those to `formatMoney` renders ₹250, which is
 * a wage that would look like an insult on a screen a woman is deciding her
 * month by.
 *
 * It is named differently rather than flagged for exactly that reason: a
 * boolean would be got wrong silently, a name has to be typed on purpose.
 * Everything else in this codebase is minor units and should use
 * `formatMoney`.
 */
/**
 * An amount, or a plain word when there is none.
 *
 * A bare "₹0" in a summary figure reads two ways, and only one of them is
 * true: either she earned nothing this month, or a formatter divided the
 * paise twice. Saying it in words removes the ambiguity, and matches the rule
 * this codebase already follows for money on its way — stated when it exists,
 * said plainly when it does not.
 *
 * This is for figures that are legitimately zero sometimes. A total that
 * should never be zero should stay a number, so that a broken one is visible.
 */
export function formatMoneyOrNothing(minor: number, word = "Nothing yet"): string {
  return minor > 0 ? formatMoney(minor) : word;
}

export function formatWholeRupees(n: number): string {
  return `₹${INR.format(Math.round(n || 0))}`;
}

export function Money({
  minor,
  exact = false,
  signed = false,
  className = "",
  style,
}: {
  minor: number;
  /** Show the paise. Only where it must match a bank statement. */
  exact?: boolean;
  /** Prefix + or −. Uses a real minus sign, which lines up in a column;
   *  a hyphen is narrower and makes a right-aligned list look ragged. */
  signed?: boolean;
  className?: string;
  style?: React.CSSProperties;
}) {
  const sign = signed ? (minor < 0 ? "−" : "+") : "";
  return (
    <span
      // `tabular-nums` so a column of amounts lines up digit under digit. A
      // proportional column of rupees is genuinely harder to scan, and this is
      // a screen women check against their own arithmetic.
      className={`tabular-nums ${className}`}
      style={style}
      // The exact figure is always available to a screen reader and on hover,
      // even where the visible one is rounded.
      title={formatMoney(Math.abs(minor), true)}
    >
      {sign}{formatMoney(Math.abs(minor), exact)}
    </span>
  );
}
