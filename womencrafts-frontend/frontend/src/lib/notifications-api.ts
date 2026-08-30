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
