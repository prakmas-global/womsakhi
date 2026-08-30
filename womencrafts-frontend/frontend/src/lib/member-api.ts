import axios from "axios";

import { apiClient } from "./api";

/**
 * The member app's data layer.
 *
 * Every one of these hits an endpoint that scopes to the signed-in account
 * server-side — there is no "userId" parameter anywhere on purpose.
 */

export interface CatalogService {
  id: string;
  name: string;
  type: string;
  tone: string;
  icon: string;
  duration: string;
  price: string;
  status: string;
  bookings: number;
  rating: string;
  description: string;
}

export interface CatalogProgram {
  id: string;
  name: string;
  desc: string;
  category: string;
  cat_tone: string;
  mode: string;
  duration: string;
  dates: string;
  days: string;
  enrolled: number;
  cap: number;
  pct: number;
  status: string;
  note: string;
  bar: string;
  joined: boolean;
  seats_left: number | null;
  is_full: boolean;
}

export interface Booking {
  id: string;
  service_id: string;
  service_name: string;
  date: string;
  time: string;
  mode: string;
  with_whom: string;
  duration: string;
  price: number;
  note: string;
  status: "upcoming" | "completed" | "cancelled";
  cancelled_reason: string;
  booked_on: string;
  created_at: string;
}

export interface Enrollment {
  id: string;
  program_id: string;
  program_name: string;
  status: "active" | "completed" | "withdrawn";
  progress: number;
  sessions_attended: number;
  joined: string;
  created_at: string;
  category: string;
  mode: string;
  duration: string;
  dates: string;
  days: string;
  desc: string;
  cover: string;
}

export interface MeSummary {
  full_name: string;
  upcoming_bookings: Booking[];
  active_programs: Enrollment[];
  total_bookings: number;
  total_programs: number;
  completed_programs: number;
}

export interface MeProfile {
  id: string;
  full_name: string;
  email: string;
  role: string;
  member_id: string;
  locale: string;
  phone: string;
  avatar: string;
  is_active: boolean;
  verification_status: string;
  rejection_reason: string;
  created_at: string;
  code: string;
  location: string;
  segment: string;
  dob: string;
  /** A line she writes about herself. */
  bio: string;
}

// --- catalogue ---

export async function apiCatalogServices(params: { q?: string; type?: string } = {}) {
  const { data } = await apiClient.get<CatalogService[]>("/catalog/services", { params });
  return data;
}

export async function apiCatalogService(id: string) {
  const { data } = await apiClient.get<CatalogService>(`/catalog/services/${id}`);
  return data;
}

export async function apiCatalogPrograms(params: { q?: string; category?: string } = {}) {
  const { data } = await apiClient.get<CatalogProgram[]>("/catalog/programs", { params });
  return data;
}

export async function apiCatalogProgram(id: string) {
  const { data } = await apiClient.get<CatalogProgram>(`/catalog/programs/${id}`);
  return data;
}

// --- guided intake (the AI seam) ---

export interface IntakeNeed {
  key: string;
  label: string;
  hint: string;
}

export interface IntakeSuggestion {
  id: string;
  name: string;
  kind: "service" | "program";
  description: string;
  /** Why this was suggested — shown to her, never hidden. */
  reason: string;
  meta: string;
}

export interface IntakeResult {
  needs: string[];
  /** false = we could not read her intent and are showing popular items instead */
  matched: boolean;
  services: IntakeSuggestion[];
  programs: IntakeSuggestion[];
}

export async function apiIntakeNeeds() {
  const { data } = await apiClient.get<IntakeNeed[]>("/me/intake/needs");
  return data;
}

export async function apiIntake(text: string, needs: string[]) {
  const { data } = await apiClient.post<IntakeResult>("/me/intake", { text, needs });
  return data;
}

// --- mine ---

export async function apiMeSummary() {
  const { data } = await apiClient.get<MeSummary>("/me/summary");
  return data;
}

export async function apiMeProfile() {
  const { data } = await apiClient.get<MeProfile>("/me/profile");
  return data;
}

export async function apiUpdateMeProfile(body: Partial<{
  full_name: string;
  phone: string;
  avatar: string;
  locale: string;
  location: string;
  dob: string;
  bio: string;
}>) {
  const { data } = await apiClient.patch<MeProfile>("/me/profile", body);
  return data;
}

export async function apiMyBookings(state?: Booking["status"]) {
  const { data } = await apiClient.get<Booking[]>("/me/bookings", { params: { state } });
  return data;
}

export async function apiCreateBooking(body: {
  service_id: string;
  date: string;
  time: string;
  mode?: string;
  note?: string;
}) {
  const { data } = await apiClient.post<Booking>("/me/bookings", body);
  return data;
}

export async function apiCancelBooking(id: string, reason = "") {
  const { data } = await apiClient.post<Booking>(`/me/bookings/${id}/cancel`, { reason });
  return data;
}

export async function apiMyPrograms(state?: Enrollment["status"]) {
  const { data } = await apiClient.get<Enrollment[]>("/me/programs", { params: { state } });
  return data;
}

export async function apiEnroll(programId: string) {
  const { data } = await apiClient.post<Enrollment>(`/me/programs/${programId}/enroll`);
  return data;
}

export async function apiLeaveProgram(programId: string) {
  const { data } = await apiClient.post<{ message: string }>(`/me/programs/${programId}/leave`);
  return data;
}

export async function apiSetProgress(programId: string, progress: number, sessions?: number) {
  const { data } = await apiClient.patch<Enrollment>(`/me/programs/${programId}/progress`, {
    progress,
    sessions_attended: sessions,
  });
  return data;
}

export interface MemberMessage {
  id: string;
  sender: "member" | "team";
  sender_name: string;
  body: string;
  sent_at: string;
  sent_label: string;
}

export interface MemberNotification {
  id: string;
  type: string;
  icon: string;
  title: string;
  body: string;
  href: string;
  unread: boolean;
  when: string;
  created_at: string;
}

export interface UnreadCounts {
  notifications: number;
  messages: number;
}

export async function apiMyMessages() {
  const { data } = await apiClient.get<MemberMessage[]>("/me/messages");
  return data;
}

export async function apiSendMessage(body: string) {
  const { data } = await apiClient.post<MemberMessage>("/me/messages", { body });
  return data;
}

export async function apiMyNotifications() {
  const { data } = await apiClient.get<MemberNotification[]>("/me/notifications");
  return data;
}

export async function apiUnreadCounts() {
  const { data } = await apiClient.get<UnreadCounts>("/me/unread");
  return data;
}

export async function apiMarkRead(id: string) {
  await apiClient.post(`/me/notifications/${id}/read`);
}

export async function apiMarkAllRead() {
  await apiClient.post("/me/notifications/read-all");
}

// --- payments ---

export interface PaymentMethod {
  key: string;
  label: string;
}

export interface PaymentConfig {
  enabled: boolean;
  provider: string;
  currency: string;
  methods: PaymentMethod[];
}

export interface Order {
  id: string;
  purpose: "booking" | "program";
  reference_id: string;
  title: string;
  /** Minor units (paise). Never do arithmetic on the label. */
  amount_minor: number;
  amount_label: string;
  currency: string;
  status: "created" | "paid" | "failed" | "refunded" | "cancelled";
  provider: string;
  provider_order_id: string;
  method: string;
  failure_reason: string;
  refunded_minor: number;
  created: string;
  created_at: string;
}

export async function apiPaymentMethods() {
  const { data } = await apiClient.get<PaymentConfig>("/payments/methods");
  return data;
}

/** One order, by id. The checkout screen needs this one, not all of them. */
export async function apiOrder(orderId: string, signal?: AbortSignal) {
  const { data } = await apiClient.get<Order>(`/payments/orders/${orderId}`, { signal });
  return data;
}

export async function apiStartOrder(
  purpose: "booking" | "program",
  referenceId: string,
  attemptKey?: string,
) {
  const { data } = await apiClient.post<{ order: Order; client_payload: Record<string, unknown> }>(
    "/payments/orders",
    { purpose, reference_id: referenceId },
    attemptKey ? { headers: { "Idempotency-Key": attemptKey } } : undefined,
  );
  return data;
}

/**
 * Take the payment. `attemptKey` comes from `useAttemptKey` — one key per
 * press and its retries, so a dropped response on 2G cannot become a second
 * charge, and a genuine retry after a decline is still allowed to go through.
 */
export async function apiConfirmPayment(
  orderId: string,
  method: string,
  providerPayload: Record<string, unknown> = {},
  attemptKey?: string,
) {
  const { data } = await apiClient.post<Order>(
    `/payments/orders/${orderId}/confirm`,
    { method, provider_payload: providerPayload },
    attemptKey ? { headers: { "Idempotency-Key": attemptKey } } : undefined,
  );
  return data;
}

export async function apiMyOrders() {
  const { data } = await apiClient.get<Order[]>("/payments/orders");
  return data;
}

// --- library ---

export interface LibraryItem {
  id: string;
  title: string;
  type: string;
  description: string;
  author: string;
  cover: string;
  icon: string;
  updated: string;
  saved: boolean;
}

export async function apiLibrary(params: { q?: string; type?: string } = {}) {
  const { data } = await apiClient.get<LibraryItem[]>("/me/library", { params });
  return data;
}

export async function apiToggleSaved(id: string) {
  const { data } = await apiClient.post<{ message: string }>(`/me/library/${id}/save`);
  return data;
}

// --- one booking ---

export async function apiBooking(id: string) {
  const { data } = await apiClient.get<Booking>(`/me/bookings/${id}`);
  return data;
}

// --- feedback ---

export async function apiLeaveFeedback(body: {
  text: string;
  rating: number;
  type?: string;
  program?: string;
}) {
  const { data } = await apiClient.post<{ message: string }>("/me/feedback", body);
  return data;
}

// --- settings ---

export interface NotificationPrefs {
  booking_reminders: boolean;
  program_updates: boolean;
  messages: boolean;
  new_programs: boolean;
  email_copies: boolean;
  /** Money arriving, leaving, or failing to arrive. */
  money: boolean;
  /** Orders in her shop. */
  orders: boolean;
  /** Her circles — a contribution due, somebody's turn coming up. */
  circles: boolean;
  /** Text messages. They reach her without data, which is both the point and
   *  the reason not to assume consent. */
  sms: boolean;
}

export async function apiNotificationPrefs() {
  const { data } = await apiClient.get<NotificationPrefs>("/me/settings/notifications");
  return data;
}

export async function apiSaveNotificationPrefs(prefs: NotificationPrefs) {
  const { data } = await apiClient.put<NotificationPrefs>("/me/settings/notifications", prefs);
  return data;
}

export async function apiChangePassword(current_password: string, new_password: string) {
  const { data } = await apiClient.post<{ message: string }>("/me/settings/password", {
    current_password,
    new_password,
  });
  return data;
}

export async function apiRequestDeletion(reason: string, confirm: string) {
  const { data } = await apiClient.post<{ message: string }>("/me/settings/delete-account", {
    reason,
    confirm,
  });
  return data;
}

// --- progress ---

export interface Achievement {
  key: string;
  title: string;
  description: string;
  icon: string;
  earned: boolean;
  earned_on: string;
}

export interface MyProgress {
  member_since: string;
  sessions_attended: number;
  sessions_upcoming: number;
  programs_active: number;
  programs_completed: number;
  learning_hours: number;
  completion_rate: number;
  achievements: Achievement[];
}

export async function apiMyProgress() {
  const { data } = await apiClient.get<MyProgress>("/me/progress");
  return data;
}

export function memberError(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const detail = err.response?.data?.detail;
    if (typeof detail === "string") return detail;
  }
  return "Something went wrong. Please try again.";
}

/** "2026-09-01" → "Tue, 1 Sep" in the member's own language. */
export function formatDate(iso: string, locale = "en") {
  if (!iso) return "";
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat(locale, { weekday: "short", day: "numeric", month: "short" }).format(d);
}

/** The next 14 days, as choices for the booking screen. */
export function upcomingDays(count = 14) {
  const out: { iso: string; day: string; date: string; weekday: string }[] = [];
  const today = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    out.push({
      iso: d.toISOString().slice(0, 10),
      day: d.toLocaleDateString(undefined, { weekday: "short" }),
      date: String(d.getDate()),
      weekday: d.toLocaleDateString(undefined, { weekday: "long" }),
    });
  }
  return out;
}

export const TIME_SLOTS = [
  "09:00 AM",
  "10:00 AM",
  "11:00 AM",
  "12:00 PM",
  "02:00 PM",
  "03:00 PM",
  "04:00 PM",
  "05:00 PM",
];
