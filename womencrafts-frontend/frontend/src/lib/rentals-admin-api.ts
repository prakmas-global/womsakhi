import { apiClient } from "./api";
import type { RentalCard } from "./rentals-api";

/**
 * Staff side of Rent & borrow (backend: routes/rentals.py `admin_router`,
 * `/admin/rentals/*`, behind the "market" module guard). Reading needs
 * `market.view`; hiding a listing `market.edit`; settling a raised problem
 * `market.approve` — the screen asks `apiMarketPermissions()` which it has.
 *
 * WomSakhi never holds rental money, so "settling" is a written answer to
 * both women, recorded in the booking's history and the audit trail.
 */

export interface AdminRentalItem extends RentalCard {
  owner_name: string;
  hidden: boolean;
  hidden_reason: string;
}

export interface AdminRentalBooking {
  id: string; item_title: string; status: string; start: string; end: string;
  rent_minor: number; deposit_minor: number; deduction_minor: number;
  owner: string; renter: string;
  problem: string; problem_settled: string;
  history: { status: string; at: string; by: string; note: string }[];
}

export const apiAdminRentalItems = (q = "") =>
  apiClient.get<AdminRentalItem[]>("/admin/rentals/items", { params: { q } }).then((r) => r.data);
export const apiAdminHideRental = (id: string, hidden: boolean, reason = "") =>
  apiClient.patch<{ ok: boolean }>(`/admin/rentals/items/${id}`, { hidden, reason }).then((r) => r.data);
export const apiAdminRentalBookings = (problems = false) =>
  apiClient.get<AdminRentalBooking[]>("/admin/rentals/bookings", { params: { problems } }).then((r) => r.data);
export const apiAdminSettleRental = (id: string, note: string) =>
  apiClient.post<{ ok: boolean }>(`/admin/rentals/bookings/${id}/settle`, { note }).then((r) => r.data);
