import { apiClient } from "@/lib/api";
import type { ApptStatus } from "@/types/appointment";

// --- Appointments module (calendar / board / list views + analytics) ---

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

// Raw appointment as returned by the backend (carries the mongo id as `id`).
export interface ApiAppointment {
  id: string; // mongo id — used for status/delete calls
  name: string;
  service: string;
  day: string; // short weekday label, e.g. "Mon"
  date: string; // short date label, e.g. "May 20"
  time: string; // time range the card shows, e.g. "09:00 - 10:00 AM"
  status: string;
  category: string; // legend bucket: Career/Skills/Business/Wellness/Finance
  color: string; // accent hex the UI draws verbatim
  bg: string; // tailwind bg classes the UI applies verbatim
  duration: string | null;
  notes: string | null;
}

export interface AppointmentListParams {
  status?: string;
  service?: string;
  day?: string;
  date?: string;
  quick?: string;
  q?: string;
  page?: number;
  page_size?: number;
}

// Body of the New Appointment modal. The server derives day/date labels,
// category, color and bg from these.
export interface AppointmentInput {
  name: string;
  service?: string;
  date?: string; // ISO 'YYYY-MM-DD' from the date input (optional)
  time?: string; // 'HH:MM' from the start-time input (optional)
  duration?: string;
  status?: ApptStatus;
  notes?: string;
}

// --- Stats payload (feeds every analytics widget on the screen) ---

export interface ApptStatCard {
  key: string;
  label: string;
  value: string;
  delta: string;
  delta_dir: string; // "up" | "down"
  tone: string;
  icon: string;
}

export interface ApptQuickFilter {
  label: string;
  count: string;
}

export interface ApptStatusSlice {
  name: string;
  value: number;
  color: string;
  pct: string;
}

export interface ApptServiceSlice {
  name: string;
  value: number;
  color: string;
}

export interface ApptReminder {
  name: string;
  service: string;
  time: string;
  badge: string;
}

export interface ApptCancellation {
  value: number;
  color: string;
  center_value: string;
  title: string;
  note: string;
  high_risk: number;
}

export interface ApptTrendPoint {
  label: string;
  value: number;
}

export interface ApptLeadTime {
  value: string;
  unit: string;
  delta: string;
  delta_dir: string;
  note: string;
  trend: ApptTrendPoint[];
}

export interface AppointmentStats {
  stat_cards: ApptStatCard[];
  quick_filters: ApptQuickFilter[];
  status_breakdown: ApptStatusSlice[];
  status_total: string;
  by_service: ApptServiceSlice[];
  by_service_total: string;
  reminders: ApptReminder[];
  cancellation: ApptCancellation;
  lead_time: ApptLeadTime;
}

export async function apiListAppointments(
  params: AppointmentListParams = {},
): Promise<Paginated<ApiAppointment>> {
  const { data } = await apiClient.get<Paginated<ApiAppointment>>("/appointments", { params });
  return data;
}

export async function apiAppointmentStats(): Promise<AppointmentStats> {
  const { data } = await apiClient.get<AppointmentStats>("/appointments/stats");
  return data;
}

export async function apiCreateAppointment(body: AppointmentInput): Promise<ApiAppointment> {
  const { data } = await apiClient.post<ApiAppointment>("/appointments", body);
  return data;
}

export async function apiGetAppointment(id: string): Promise<ApiAppointment> {
  const { data } = await apiClient.get<ApiAppointment>(`/appointments/${id}`);
  return data;
}

export async function apiSetAppointmentStatus(
  id: string,
  status: ApptStatus,
): Promise<ApiAppointment> {
  const { data } = await apiClient.patch<ApiAppointment>(`/appointments/${id}`, { status });
  return data;
}

export async function apiDeleteAppointment(id: string): Promise<void> {
  await apiClient.delete(`/appointments/${id}`);
}
