import { formatMoney } from "@/components/ux/kit/money";
import type { Booking } from "@/lib/rentals-api";

/**
 * Words for a booking, from HER side of it (backend: routes/rentals.py).
 *
 * The same booking reads differently to the woman renting and the woman who
 * owns the thing: "Pick up on 5 Nov" is one of them's next step, "Hand it over
 * on 5 Nov" the other's. `nextFor` is that one line — the thing to do now,
 * or null once there is nothing left for her to do.
 */

/** "2026-11-05" → "5 Nov" (read as a local day, not UTC midnight). */
export function day(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

/** Days from today to an ISO day: 0 today, 1 tomorrow, negative if gone. */
export function daysUntil(iso: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((new Date(`${iso}T00:00:00`).getTime() - today.getTime()) / 86_400_000);
}

export function inWords(n: number): string {
  if (n === 0) return "today";
  if (n === 1) return "tomorrow";
  if (n === -1) return "yesterday";
  return n > 0 ? `in ${n} days` : `${-n} days ago`;
}

export interface Next { text: string; icon: string; urgent?: boolean }

export function nextFor(b: Booking): Next | null {
  const renter = b.side === "renter";
  const atPickup = formatMoney(b.rent_minor + b.deposit_minor);
  switch (b.status) {
    case "requested":
      return renter
        ? { text: `Waiting for ${b.with.first_name} to say yes`, icon: "Hourglass" }
        : { text: "Say yes or no", icon: "MessageCircleQuestion", urgent: true };
    case "accepted":
      return renter
        ? { text: `Pick up on ${day(b.start)} — pay ${atPickup} at pickup`, icon: "KeyRound", urgent: daysUntil(b.start) <= 1 }
        : { text: `Hand it over on ${day(b.start)}`, icon: "KeyRound", urgent: daysUntil(b.start) <= 1 };
    case "active":
      return renter
        ? { text: `Return by ${day(b.end)} (${inWords(daysUntil(b.end))})`, icon: "Undo2", urgent: daysUntil(b.end) <= 1 }
        : { text: `Comes back ${day(b.end)} (${inWords(daysUntil(b.end))})`, icon: "Undo2" };
    case "returned":
      if (renter && b.deposit_back_minor > 0) return { text: `Did you get ${formatMoney(b.deposit_back_minor)} back?`, icon: "HandCoins", urgent: true };
      if (!b.i_reviewed) return { text: "Say how it went", icon: "Star" };
      return renter ? null : { text: `Waiting for ${b.with.first_name} to confirm her deposit`, icon: "Hourglass" };
    case "closed":
      return b.i_reviewed ? null : { text: "Say how it went", icon: "Star" };
    default:
      return null;
  }
}

/** Is there still something for either of them to do? */
export const isNow = (b: Booking) => ["requested", "accepted", "active", "returned"].includes(b.status);

export const CANCEL_REASONS = ["Plans changed", "Found it elsewhere", "Not well", "Dates do not work now"];
export const DECLINE_REASONS = ["I need it those days", "It is being repaired", "Too far for pickup", "Away that week"];
export const DAMAGE_NOTES = ["A stain that will not wash out", "Torn", "A part is missing", "It does not work now", "Came back late"];
export const PROBLEM_LINES = [
  "The deduction is not fair.", "I have not got my deposit back.", "It was damaged before I got it.",
  "It was not returned on time.", "It is not what the photos showed.",
];
