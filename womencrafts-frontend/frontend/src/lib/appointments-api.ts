import { apiClient } from "@/lib/api";

// --- Appointments (admin) -------------------------------------------------
// One list over members' own bookings and the sessions staff entered by hand.
// Every row carries a `ref` ("member:<id>" | "staff:<id>") and that is what
// every action takes, so an action can never land on the wrong collection.

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

export type AdminApptStatus = "booked" | "confirmed" | "completed" | "cancelled" | "no_show";
export type ApptSource = "member" | "staff";
export type ApptScope = "today" | "upcoming" | "past" | "all";

/** One line of an appointment's internal notes or its history. */
export interface ApptEntry {
  action: string;
  text: string;
  by_name: string;
  at: string;
  detail: string;
}

export interface AdminAppointment {
  id: string;
  ref: string;
  source: ApptSource;
  name: string;
  member_id: string;
  contact: string;
  service: string;
  service_id: string;
  date: string; // ISO "2026-09-26", or a legacy label on an undated row
  time: string; // "10:00 AM"
  starts_at: string | null; // ISO instant in IST; null when the row has no real date
  ends_at: string | null;
  undated: boolean;
  duration: string;
  duration_minutes: number;
  mode: string;
  with_whom: string;
  status: AdminApptStatus;
  status_label: string;
  note: string; // what she (or the staff who entered it) wrote
  cancelled_reason: string;
  no_show: boolean;
  rescheduled_count: number;
  confirmed_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  internal_notes: ApptEntry[];
  history: ApptEntry[];
  created_by_name: string;
  created_at: string | null;
  updated_at: string | null;
}

export interface AdminAppointmentList extends Paginated<AdminAppointment> {
  /** Per-scope totals before status/service/search filters, for the tabs. */
  counts: Record<ApptScope, number>;
}

export interface AdminAppointmentListParams {
  scope?: ApptScope;
  status?: AdminApptStatus;
  service?: string;
  source?: ApptSource;
  undated?: boolean;
  q?: string;
  page?: number;
  page_size?: number;
}

export interface AdminAppointmentStats {
  today: number;
  today_unconfirmed: number;
  upcoming: number;
  needs_confirmation: number;
  completed_30d: number;
  missed_30d: number;
  no_show_30d: number;
  total: number;
  undated: number;
  by_status: Record<AdminApptStatus, number>;
  by_source: Record<ApptSource, number>;
  by_service: { name: string; value: number }[];
  services: string[];
  as_of: string;
}

export interface StaffAppointmentInput {
  name: string;
  phone?: string;
  service: string;
  date: string; // ISO from <input type="date">
  time: string; // "HH:MM" from <input type="time">
  duration?: string;
  mode?: "Online" | "In person";
  with_whom?: string;
  note?: string;
}

export async function apiAdminAppointments(
  params: AdminAppointmentListParams = {},
): Promise<AdminAppointmentList> {
  const { data } = await apiClient.get<AdminAppointmentList>("/appointments", { params });
  return data;
}

export async function apiAdminAppointmentStats(): Promise<AdminAppointmentStats> {
  const { data } = await apiClient.get<AdminAppointmentStats>("/appointments/stats");
  return data;
}

export async function apiAdminAppointment(ref: string): Promise<AdminAppointment> {
  const { data } = await apiClient.get<AdminAppointment>(`/appointments/${ref}`);
  return data;
}

export async function apiCreateStaffAppointment(body: StaffAppointmentInput): Promise<AdminAppointment> {
  const { data } = await apiClient.post<AdminAppointment>("/appointments", body);
  return data;
}

export async function apiConfirmAppointment(ref: string): Promise<AdminAppointment> {
  const { data } = await apiClient.post<AdminAppointment>(`/appointments/${ref}/confirm`);
  return data;
}

export async function apiRescheduleAppointment(
  ref: string,
  body: { date: string; time: string },
): Promise<AdminAppointment> {
  const { data } = await apiClient.post<AdminAppointment>(`/appointments/${ref}/reschedule`, body);
  return data;
}

export async function apiCancelAppointment(ref: string, reason: string): Promise<AdminAppointment> {
  const { data } = await apiClient.post<AdminAppointment>(`/appointments/${ref}/cancel`, { reason });
  return data;
}

export async function apiCompleteAppointment(ref: string): Promise<AdminAppointment> {
  const { data } = await apiClient.post<AdminAppointment>(`/appointments/${ref}/complete`);
  return data;
}

export async function apiNoShowAppointment(ref: string): Promise<AdminAppointment> {
  const { data } = await apiClient.post<AdminAppointment>(`/appointments/${ref}/no-show`);
  return data;
}

export async function apiAddAppointmentNote(ref: string, text: string): Promise<AdminAppointment> {
  const { data } = await apiClient.post<AdminAppointment>(`/appointments/${ref}/notes`, { text });
  return data;
}

/** Staff-entered rows only; a member's own booking is cancelled, never deleted. */
export async function apiDeleteAppointment(ref: string): Promise<void> {
  await apiClient.delete(`/appointments/${ref}`);
}
