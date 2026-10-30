import { apiClient } from "./api";

/**
 * Rent & borrow (backend: routes/rentals.py; rules and pricing: app/core/rentals.py).
 *
 * Verified women rent their things to each other. WomSakhi never holds the
 * money: rent and deposit are paid to the owner AT PICKUP, in person or by
 * UPI, and the app records it. Amounts are paise; dates are YYYY-MM-DD and
 * both ends count (5th–7th is three days).
 */

const get = <T,>(url: string, signal?: AbortSignal, params?: object) =>
  apiClient.get<T>(url, { signal, params }).then((r) => r.data);
const post = <T,>(url: string, body?: unknown) => apiClient.post<T>(url, body ?? {}).then((r) => r.data);

/* ── things ─────────────────────────────────────────────────────────── */

export type Condition = "like_new" | "good" | "used";
export type Handover = "pickup" | "delivery" | "either";

export interface RentalOwner { id: string; first_name: string; avatar: string; stars: number | null; reviews: number }

export interface RentalCard {
  id: string; title: string;
  /** A label from the staff-controlled `rental_categories` master. */
  category: string;
  photo: string; condition: Condition;
  price_day_minor: number;
  /** 0 when she set no weekly price. */
  price_week_minor: number;
  deposit_minor: number; area: string; city: string; handover: Handover;
  status: "live" | "paused"; owner: RentalOwner; mine: boolean; times_rented: number;
  /** Only on her own list (`mine`): staff hid it, and why. */
  hidden?: boolean; hidden_reason?: string;
}

export interface RentalItem extends RentalCard {
  photos: string[]; about: string; min_days: number; max_days: number; rules: string[];
  /** Held dates (accepted or handed over) — never bookable. */
  busy: { start: string; end: string }[];
  hidden: boolean;
  reviews: { stars: number; praise: string[]; text: string; by: string; on: string }[];
  /** Her own open bookings on this thing. */
  my_bookings: string[];
}

export interface ItemInput {
  title: string; category: string; about: string;
  /** Upload URLs (apiUploadImage), 1–6. */
  photos: string[];
  condition: Condition;
  price_day_rupees: number; price_week_rupees: number | null; deposit_rupees: number;
  min_days: number; max_days: number; handover: Handover; area: string; city: string; rules: string[];
}

export interface Quote {
  days: number; rent_minor: number; deposit_minor: number; pay_at_pickup_minor: number; saved_by_week_minor: number;
  ok: boolean; problem: string;
}

export const apiRentals = (p: { q?: string; category?: string; city?: string; mine?: boolean } = {}, s?: AbortSignal) =>
  get<RentalCard[]>("/rentals", s, p);
export const apiRental = (id: string, s?: AbortSignal) => get<RentalItem>(`/rentals/${id}`, s);
export const apiAddRental = (i: ItemInput) => post<RentalItem>("/rentals", i);
export const apiEditRental = (id: string, i: ItemInput) => apiClient.put<RentalItem>(`/rentals/${id}`, i).then((r) => r.data);
export const apiPauseRental = (id: string, status: "live" | "paused") =>
  apiClient.patch<RentalItem>(`/rentals/${id}`, { status }).then((r) => r.data);
export const apiRemoveRental = (id: string) => apiClient.delete<{ ok: boolean }>(`/rentals/${id}`).then((r) => r.data);
export const apiRentalQuote = (id: string, start: string, end: string, s?: AbortSignal) =>
  get<Quote>(`/rentals/${id}/quote`, s, { start, end });

/* ── bookings ───────────────────────────────────────────────────────── */

export type BookingStatus = "requested" | "accepted" | "active" | "returned" | "closed" | "declined" | "cancelled" | "expired";

export interface Booking {
  id: string; status: BookingStatus;
  /** Which side she is on. */
  side: "owner" | "renter";
  item: { id: string; title: string; photo: string; category: string };
  /** The other woman. Her stars are as an owner (to a renter) or as a renter (to an owner). */
  with: { id: string; first_name: string; avatar: string; stars: number | null; reviews: number };
  start: string; end: string; days: number;
  rent_minor: number; deposit_minor: number; note: string;
  rent_paid: boolean; deposit_paid: boolean;
  condition_out: "" | Condition; photos_out: string[];
  condition_back: "" | "fine" | "damaged" | "lost"; deduction_minor: number; deduction_note: string; photos_back: string[];
  deposit_back_minor: number;
  /** "renter: …" / "owner: …" once raised; `problem_settled` is WomSakhi's answer. */
  problem: string; problem_settled: string;
  reason: string; i_reviewed: boolean; they_reviewed: boolean;
  history: { status: string; at: string; by: string; note: string }[];
  created_at: string;
}

export const apiRentalBookings = (side: "renter" | "owner" | "all" = "all", s?: AbortSignal) =>
  get<Booking[]>("/rentals/bookings/mine", s, { side });
export const apiRentalBooking = (id: string, s?: AbortSignal) => get<Booking>(`/rentals/bookings/${id}`, s);
export const apiBookRental = (itemId: string, start: string, end: string, note = "") =>
  post<Booking>(`/rentals/${itemId}/book`, { start, end, note });
export const apiAcceptBooking = (id: string) => post<Booking>(`/rentals/bookings/${id}/accept`);
export const apiDeclineBooking = (id: string, reason = "") => post<Booking>(`/rentals/bookings/${id}/decline`, { reason });
export const apiCancelBooking = (id: string, reason = "") => post<Booking>(`/rentals/bookings/${id}/cancel`, { reason });
export const apiHandover = (id: string, b: { rent_paid: boolean; deposit_paid: boolean; condition: Condition; photos: string[]; note?: string }) =>
  post<Booking>(`/rentals/bookings/${id}/handover`, b);
export const apiReturned = (id: string, b: { condition: "fine" | "damaged" | "lost"; deduction_rupees: number; note?: string; photos: string[]; rent_paid?: boolean }) =>
  post<Booking>(`/rentals/bookings/${id}/return`, b);
export const apiDepositBack = (id: string) => post<Booking>(`/rentals/bookings/${id}/deposit-back`);
export const apiRentalProblem = (id: string, text: string) => post<Booking>(`/rentals/bookings/${id}/problem`, { text });
export const apiRentalReview = (id: string, r: { stars: number; praise: string[]; text?: string }) =>
  post<Booking>(`/rentals/bookings/${id}/review`, r);

/** Mirrors app/core/rentals.py PRAISE_FOR_OWNER / PRAISE_FOR_RENTER. */
export const PRAISE_FOR_OWNER = ["Clean and as shown", "Easy pickup", "On time", "Kind and clear", "Would rent again"];
export const PRAISE_FOR_RENTER = ["Returned on time", "Took good care", "Easy to deal with", "Paid on time", "Would rent to her again"];

/* ── shared words, pictures and maths ───────────────────────────────── */

export const CONDITION_LOOK: Record<Condition, string> = { like_new: "Like new", good: "Good", used: "Used, works well" };
export const HANDOVER_LOOK: Record<Handover, { label: string; icon: string }> = {
  pickup: { label: "Pick up from her", icon: "Home" },
  delivery: { label: "She can bring it", icon: "Truck" },
  either: { label: "Pickup or she brings it", icon: "Handshake" },
};

/** Each step, for her: a word, a picture, and whether it is still going. */
export const STATUS_LOOK: Record<BookingStatus, { label: string; icon: string; open: boolean }> = {
  requested: { label: "Asked", icon: "Send", open: true },
  accepted: { label: "Confirmed", icon: "CalendarCheck", open: true },
  active: { label: "With the renter", icon: "KeyRound", open: true },
  returned: { label: "Returned", icon: "Undo2", open: true },
  closed: { label: "All done", icon: "PackageCheck", open: false },
  declined: { label: "Declined", icon: "X", open: false },
  cancelled: { label: "Cancelled", icon: "X", open: false },
  expired: { label: "No answer", icon: "Clock", open: false },
};

/** The steps in order, for a progress track. */
export const STEPS: BookingStatus[] = ["requested", "accepted", "active", "returned", "closed"];

/** Rent for `days` — mirrors app/core/rentals.py rent_for (a week price never makes it dearer). */
export function rentFor(item: Pick<RentalCard, "price_day_minor" | "price_week_minor">, days: number): number {
  const byDay = item.price_day_minor * days;
  if (item.price_week_minor && days >= 7) {
    return Math.min(byDay, Math.floor(days / 7) * item.price_week_minor + (days % 7) * item.price_day_minor);
  }
  return byDay;
}

/** Both ends count. */
export function daysBetween(start: string, end: string): number {
  return Math.round((Date.parse(end) - Date.parse(start)) / 86_400_000) + 1;
}

/** Does [start, end] touch any held range? ISO dates compare as strings. */
export const clashes = (start: string, end: string, busy: { start: string; end: string }[]) =>
  busy.some((b) => start <= b.end && b.start <= end);
