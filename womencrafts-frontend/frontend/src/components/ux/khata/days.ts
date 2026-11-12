/**
 * Dates for My Khata, in HER day — not UTC. `toISOString()` would file a
 * 1 a.m. entry in India under yesterday.
 */

const pad = (n: number) => String(n).padStart(2, "0");

export function isoDay(d = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function addDays(n: number, from = new Date()): string {
  const d = new Date(from);
  d.setDate(d.getDate() + n);
  return isoDay(d);
}

export function thisMonth(d = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

export function shiftMonth(month: string, by: number): string {
  const [y, m] = month.split("-").map(Number);
  const total = y * 12 + (m - 1) + by;
  return `${Math.floor(total / 12)}-${pad((total % 12) + 1)}`;
}

/** "Oct 2026". */
export function monthName(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-IN", { month: "short", year: "numeric" });
}

/** "Today", "Yesterday", "Tomorrow" (a reminder), or "Mon, 20 Oct". */
export function dayName(iso: string): string {
  if (iso === isoDay()) return "Today";
  if (iso === addDays(-1)) return "Yesterday";
  if (iso === addDays(1)) return "Tomorrow";
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
}

/** Rupees as she types them ("1,500" or "250.50") → paise; 0 when it is not a number. */
export function toMinor(rupees: string): number {
  const n = Number(rupees.replace(/[,\s₹]/g, ""));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : 0;
}
