import { apiClient } from "@/lib/api";

// --- Response shapes (mirror app/schemas/notification.py) ---------------------

export interface ApiNotification {
  id: string;
  type: string;
  title: string;
  desc: string;
  time: string;
  group: string;
  unread: boolean;
}

export interface NotificationSection {
  group: string;
  rows: ApiNotification[];
}

export interface NotificationGrouped {
  sections: NotificationSection[];
  total: number;
  unread: number;
}

export interface NotificationList {
  items: ApiNotification[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

export interface NotifStatCard {
  key: string;
  label: string;
  value: string;
  icon: string;
  tone: string;
  delta?: string | null;
  delta_note?: string | null;
}

export interface NotifCategory {
  name: string;
  value: number;
  color: string;
}

export interface NotificationStats {
  stat_cards: NotifStatCard[];
  categories: NotifCategory[];
  category_total: string;
  center_label: string;
}

export interface ApiChannel {
  id: string;
  label: string;
  icon: string;
  on: boolean;
}

export interface ChannelList {
  items: ApiChannel[];
  total: number;
}

// --- Params ------------------------------------------------------------------

export interface NotificationListParams {
  tab?: string;
  type?: string;
  group?: string;
  q?: string;
  unread?: boolean;
  page?: number;
  page_size?: number;
}

// --- Reads -------------------------------------------------------------------

export async function apiListNotifications(
  params: NotificationListParams = {}
): Promise<NotificationList> {
  const { data } = await apiClient.get<NotificationList>("/notifications", { params });
  return data;
}

export async function apiGroupedNotifications(
  params: { tab?: string; q?: string } = {}
): Promise<NotificationGrouped> {
  const { data } = await apiClient.get<NotificationGrouped>("/notifications/grouped", {
    params,
  });
  return data;
}

export async function apiNotificationStats(): Promise<NotificationStats> {
  const { data } = await apiClient.get<NotificationStats>("/notifications/stats");
  return data;
}

export async function apiListChannels(): Promise<ChannelList> {
  const { data } = await apiClient.get<ChannelList>("/notifications/channels");
  return data;
}

// --- Mutations ---------------------------------------------------------------

export async function apiMarkNotificationRead(id: string): Promise<ApiNotification> {
  const { data } = await apiClient.patch<ApiNotification>(`/notifications/${id}/read`);
  return data;
}

export async function apiMarkAllNotificationsRead(): Promise<{ updated_count: number }> {
  const { data } = await apiClient.patch<{ updated_count: number }>("/notifications/read-all");
  return data;
}

export async function apiDismissNotification(id: string): Promise<{ message: string }> {
  const { data } = await apiClient.delete<{ message: string }>(`/notifications/${id}`);
  return data;
}

export async function apiClearAllNotifications(): Promise<{ message: string }> {
  const { data } = await apiClient.delete<{ message: string }>("/notifications");
  return data;
}

export async function apiSetChannel(label: string, on: boolean): Promise<ApiChannel> {
  const { data } = await apiClient.patch<ApiChannel>(
    `/notifications/channels/${encodeURIComponent(label)}`,
    { on }
  );
  return data;
}

// --- Staff "needs attention" feed (app/routes/admin_notifications.py) --------
//
// The staff Notifications page no longer reads the seeded `notifications`
// rows above (those remain only for the topbar bell). It reads this: a feed
// computed live from the same queries each module screen runs, scoped to the
// modules the caller may view. Nothing is stored, so there is no read state —
// an item leaves when the work is done.

export interface AttentionItem {
  id: string;
  title: string;
  desc: string;
  /** ISO — when it started waiting; null when the row has no timestamp. */
  at: string | null;
  href: string;
  /** Assigned to the caller (reports and threads only). */
  mine: boolean;
}

export interface AttentionArea {
  key: string;
  module: string;
  label: string;
  note: string;
  count: number;
  mine: number;
  tone: string;
  icon: string;
  href: string;
  items: AttentionItem[];
  oldest_at: string | null;
}

export interface ModuleRef {
  module: string;
  label: string;
}

export interface AttentionFeed {
  as_of: string;
  total: number;
  mine: number;
  oldest_at: string | null;
  areas: AttentionArea[];
  /** Modules whose areas are in the feed. */
  modules: ModuleRef[];
  /** Modules with areas the caller may not view — named, never counted. */
  hidden: ModuleRef[];
}

export async function apiAttentionFeed(limit = 5): Promise<AttentionFeed> {
  const { data } = await apiClient.get<AttentionFeed>("/admin/notifications/attention", {
    params: { limit },
  });
  return data;
}
