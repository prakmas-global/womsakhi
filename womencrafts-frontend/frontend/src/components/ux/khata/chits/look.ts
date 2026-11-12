import type { ChitMethod } from "@/lib/khata-api";

/**
 * How each chit looks and reads, in one place — the list, the form and the
 * detail all say "Auction" with the same picture.
 */

export const METHOD_LOOK: Record<ChitMethod, { label: string; icon: string; note: string }> = {
  auction: { label: "Auction", icon: "Gavel",
             note: "Members bid each month. The highest discount takes the pot; the rest is shared as a dividend." },
  draw: { label: "Lucky draw", icon: "Dices", note: "A draw each month among those who have not taken it yet." },
  fixed: { label: "Fixed order", icon: "ListOrdered", note: "An order agreed at the start: first in month 1, and so on." },
};

/** ₹1 lakh, ₹2.5 lakh, ₹50,000 — how chits are spoken of. */
export function lakhs(rupees: number): string {
  if (rupees >= 1_00_00_000) return `₹${+(rupees / 1_00_00_000).toFixed(2)} crore`;
  if (rupees >= 1_00_000) return `₹${+(rupees / 1_00_000).toFixed(2)} lakh`;
  return `₹${rupees.toLocaleString("en-IN")}`;
}

/** "2026-10" → "Oct 2026". Pinned to en-IN so the server and the browser agree. */
export function monthName(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  if (!y || !m) return ym;
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-IN", { month: "short", year: "numeric", timeZone: "UTC" });
}

/** "2026-10", offset by n months (negative is earlier). */
export function shiftMonth(ym: string, n: number): string {
  const [y, m] = ym.split("-").map(Number);
  const total = y * 12 + (m - 1) + n;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
}

export function thisMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** The first letter of a name, for a round initial. */
export const initial = (name: string) => (name.trim()[0] || "?").toUpperCase();
