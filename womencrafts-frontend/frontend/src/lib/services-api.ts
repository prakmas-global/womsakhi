import { apiClient, type Paginated } from "@/lib/api";

// =============================================================================
// Services & Types module
// Two resources served by the backend Services router:
//   /services       — the services table + /services/stats + /services/types
//   /service-types  — the categories (types) table
// Icons/tones/colors are derived on the backend and returned by NAME; the page
// maps the icon name back to a lucide component via its ICON_MAP.
// =============================================================================

// --- Services ----------------------------------------------------------------
export interface ApiService {
  id: string; // mongo id — used for update/status/delete calls
  name: string;
  type: string;
  tone: string;
  icon: string; // lucide icon name, e.g. "Scissors"
  duration: string;
  price: string; // display string shown verbatim, e.g. "₹499"
  status: string;
  bookings: number; // live: appointments that name this service
  description: string;
  /** Colour slot 1-8 from the theme's categorical palette. */
  slot: number;
}

export interface ServiceListParams {
  q?: string;
  status?: string;
  type?: string;
  page?: number;
  page_size?: number;
}

export interface ServiceInput {
  name: string;
  type?: string;
  duration?: string;
  price?: string;
  status?: string;
  description?: string;
}

// --- Service types (categories) ----------------------------------------------
export interface ApiServiceType {
  id: string; // mongo id — used for update/delete calls
  name: string;
  desc: string;
  services: number;
  status: string;
  pop: number; // share of all bookings, 0-100, computed on the server
  color: string;
  icon: string; // lucide icon name, e.g. "Scissors"
  /** Colour slot 1-8 from the theme's categorical palette. */
  slot: number;
}

export interface ServiceTypeListParams {
  q?: string;
  status?: string;
  page?: number;
  page_size?: number;
}

export interface ServiceTypeInput {
  name: string;
  desc?: string;
  status?: string;
}

// --- Stats (stat cards + overview donut + popular list) ----------------------
export interface ServiceStatCard {
  key: string;
  label: string;
  value: string;
  icon: string;
  tone: string;
  /** Only present when there is real history to compare against. */
  delta?: string;
}

export interface ServiceOverviewSlice {
  name: string;
  value: number;
  color: string;
}

export interface ServicePopularItem {
  icon: string;
  name: string;
  bookings: string;
  tone: string;
}

export interface ServiceStats {
  stats: ServiceStatCard[];
  overview: ServiceOverviewSlice[];
  overview_total: string;
  overview_label: string;
  popular: ServicePopularItem[];
}

// --- Services endpoints -------------------------------------------------------
export async function apiListServices(
  params: ServiceListParams = {},
): Promise<Paginated<ApiService>> {
  const { data } = await apiClient.get<Paginated<ApiService>>("/services", { params });
  return data;
}

export async function apiServiceStats(): Promise<ServiceStats> {
  const { data } = await apiClient.get<ServiceStats>("/services/stats");
  return data;
}

export async function apiServiceTypeNames(): Promise<string[]> {
  const { data } = await apiClient.get<string[]>("/services/types");
  return data;
}

export async function apiCreateService(body: ServiceInput): Promise<ApiService> {
  const { data } = await apiClient.post<ApiService>("/services", body);
  return data;
}

export async function apiUpdateService(id: string, body: Partial<ServiceInput>): Promise<ApiService> {
  const { data } = await apiClient.put<ApiService>(`/services/${id}`, body);
  return data;
}

export async function apiSetServiceStatus(id: string, status?: string): Promise<ApiService> {
  const { data } = await apiClient.patch<ApiService>(`/services/${id}/status`, { status });
  return data;
}

export async function apiDeleteService(id: string): Promise<void> {
  await apiClient.delete(`/services/${id}`);
}

// --- Service types endpoints --------------------------------------------------
export async function apiListServiceTypes(
  params: ServiceTypeListParams = {},
): Promise<Paginated<ApiServiceType>> {
  const { data } = await apiClient.get<Paginated<ApiServiceType>>("/service-types", { params });
  return data;
}

export async function apiCreateServiceType(body: ServiceTypeInput): Promise<ApiServiceType> {
  const { data } = await apiClient.post<ApiServiceType>("/service-types", body);
  return data;
}

export async function apiUpdateServiceType(
  id: string,
  body: Partial<ServiceTypeInput>,
): Promise<ApiServiceType> {
  const { data } = await apiClient.put<ApiServiceType>(`/service-types/${id}`, body);
  return data;
}

export async function apiDeleteServiceType(id: string): Promise<void> {
  await apiClient.delete(`/service-types/${id}`);
}

// --- The appointments behind a service's bookings number ----------------------
export interface ServiceBooking {
  id: string;
  name: string;   // who booked
  date: string;   // short label as the appointment stores it, e.g. "May 20"
  time: string;
  status: string;
}

export async function apiServiceBookings(id: string, limit = 10): Promise<{ items: ServiceBooking[]; total: number }> {
  const { data } = await apiClient.get<{ items: ServiceBooking[]; total: number }>(`/services/${id}/bookings`, { params: { limit } });
  return data;
}
