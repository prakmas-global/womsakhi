import { apiClient } from "@/lib/api";

// --- Calendar module (events shown on the Calendar screen) ---

export type CalendarCategory = "Career" | "Skills" | "Business" | "Wellness" | "Finance";

// Shape returned by the backend for a single calendar event.
export interface ApiCalendarEvent {
  id: number; // integer event id — used for get/update/delete
  title: string;
  category: string;
  date: string; // "YYYY-MM-DD"
  time: string; // loose "H:MM", may be empty
  attendee: string;
  notes: string;
  color: string; // hex dot colour, derived from category
  created_at: string;
}

export interface CalendarEventListResponse {
  items: ApiCalendarEvent[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

export interface CalendarStats {
  total: number;
  by_category: Record<string, number>;
}

export interface CalendarListParams {
  category?: string;
  start?: string; // "YYYY-MM-DD" inclusive
  end?: string; // "YYYY-MM-DD" inclusive
  q?: string;
  page?: number;
  page_size?: number;
}

export interface CalendarEventInput {
  title: string;
  category?: CalendarCategory;
  date: string; // "YYYY-MM-DD"
  time?: string;
  attendee?: string;
  notes?: string;
}

export async function apiListCalendarEvents(
  params: CalendarListParams = {},
): Promise<CalendarEventListResponse> {
  const { data } = await apiClient.get<CalendarEventListResponse>("/calendar/events", { params });
  return data;
}

export async function apiUpcomingEvents(
  params: { after?: string; limit?: number } = {},
): Promise<ApiCalendarEvent[]> {
  const { data } = await apiClient.get<ApiCalendarEvent[]>("/calendar/events/upcoming", { params });
  return data;
}

export async function apiCalendarStats(): Promise<CalendarStats> {
  const { data } = await apiClient.get<CalendarStats>("/calendar/events/stats");
  return data;
}

export async function apiCreateCalendarEvent(body: CalendarEventInput): Promise<ApiCalendarEvent> {
  const { data } = await apiClient.post<ApiCalendarEvent>("/calendar/events", body);
  return data;
}

export async function apiUpdateCalendarEvent(
  id: number,
  body: Partial<CalendarEventInput>,
): Promise<ApiCalendarEvent> {
  const { data } = await apiClient.patch<ApiCalendarEvent>(`/calendar/events/${id}`, body);
  return data;
}

export async function apiDeleteCalendarEvent(id: number): Promise<void> {
  await apiClient.delete(`/calendar/events/${id}`);
}

// --- The merged agenda: bookings, events, programmes and staff entries ---------------
export type AgendaSource = "booking" | "event" | "programme" | "staff";

export interface AgendaItem {
  key: string;        // "<source>:<id>"
  source: AgendaSource;
  title: string;
  date: string;       // YYYY-MM-DD
  time: string;       // as stored, may be empty
  subtitle: string;   // who / where / which service
  status: string;
  href: string;       // the admin screen that owns it ("" for staff entries)
  category: string;
  color: string;
}

export interface AgendaResponse {
  start: string;
  end: string;
  items: AgendaItem[];
  counts: Partial<Record<AgendaSource, number>>;
}

export async function apiCalendarAgenda(start: string, end: string, sources?: AgendaSource[]): Promise<AgendaResponse> {
  const { data } = await apiClient.get<AgendaResponse>("/calendar/agenda", {
    params: { start, end, ...(sources ? { sources: sources.join(",") } : {}) },
  });
  return data;
}

export async function apiCalendarUpcoming(days = 30, limit = 8): Promise<AgendaResponse> {
  const { data } = await apiClient.get<AgendaResponse>("/calendar/upcoming", { params: { days, limit } });
  return data;
}
