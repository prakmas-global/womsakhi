import { apiClient } from "./api";

/**
 * Circles as group chats — backend: routes/circle_chat.py.
 *
 * Her chat list, a circle's messages (polled, not pushed), group info and the
 * admin powers, and invites by username that she accepts or declines.
 */

export interface ChatRow {
  id: string;
  name: string;
  cover: string;
  icon: string;
  topic: string;
  member_count: number;
  is_private: boolean;
  is_savings: boolean;
  is_admin: boolean;
  muted: boolean;
  /** "Priya: see you at 5", "You: …", or a group line like "Asha joined". */
  last_text: string;
  last_at: string;
  unread: number;
}

export interface ReplyPreview { id: string; name: string; text: string; photo: boolean }

export interface ChatMessage {
  id: string;
  /** "text" from a member, "system" written by the app (joined, renamed…). */
  kind: "text" | "system";
  text: string;
  photo: string;
  user_id: string;
  name: string;
  username: string;
  avatar: string;
  mine: boolean;
  deleted: boolean;
  reply_to: ReplyPreview | null;
  at: string;
}

export interface MessagePage {
  messages: ChatMessage[];
  has_more: boolean;
  can_send: boolean;
  is_admin: boolean;
  last_read_at: string;
}

export interface GroupMember {
  id: string; name: string; username: string; avatar: string;
  admin: boolean; founder: boolean; you: boolean;
}

export interface PendingInvite { id: string; to_id: string; name: string; username: string; avatar: string }

export interface GroupInfo {
  id: string;
  name: string;
  desc: string;
  topic: string;
  cover: string;
  icon: string;
  is_private: boolean;
  is_savings: boolean;
  member_count: number;
  is_admin: boolean;
  only_admins: boolean;
  can_send: boolean;
  muted: boolean;
  /** Admins only; "" for everyone else. */
  invite_code: string;
  earlier_posts: number;
  members: GroupMember[];
  pending: PendingInvite[];
}

export interface IncomingInvite {
  id: string;
  circle_id: string;
  circle_name: string;
  cover: string;
  icon: string;
  topic: string;
  member_count: number;
  is_savings: boolean;
  from_name: string;
  at: string;
}

const get = <T,>(url: string, signal?: AbortSignal, params?: object) =>
  apiClient.get<T>(url, { signal, params }).then((r) => r.data);

export const apiChats = (s?: AbortSignal) => get<ChatRow[]>("/community/chats", s);

export const apiCircleMessages = (id: string, q: { after?: string; before?: string } = {}, s?: AbortSignal) =>
  get<MessagePage>(`/community/circles/${id}/messages`, s, q);

export const apiSendCircleMessage = (id: string, body: { text: string; photo?: string; reply_to?: string }) =>
  apiClient.post<ChatMessage>(`/community/circles/${id}/messages`, body).then((r) => r.data);

export const apiDeleteCircleMessage = (id: string, messageId: string) =>
  apiClient.delete<ChatMessage>(`/community/circles/${id}/messages/${messageId}`).then((r) => r.data);

export const apiMarkCircleRead = (id: string) =>
  apiClient.post<{ ok: boolean }>(`/community/circles/${id}/read`).then((r) => r.data);

export const apiGroupInfo = (id: string, s?: AbortSignal) => get<GroupInfo>(`/community/circles/${id}/group`, s);

export const apiUpdateGroup = (id: string, body: { name?: string; desc?: string; cover?: string; only_admins?: boolean }) =>
  apiClient.patch<GroupInfo>(`/community/circles/${id}/group`, body).then((r) => r.data);

export const apiSetGroupAdmin = (id: string, userId: string, admin: boolean) =>
  apiClient.post<GroupInfo>(`/community/circles/${id}/members/${userId}/admin`, { admin }).then((r) => r.data);

export const apiRemoveGroupMember = (id: string, userId: string) =>
  apiClient.delete<GroupInfo>(`/community/circles/${id}/members/${userId}`).then((r) => r.data);

export const apiResetInviteLink = (id: string) =>
  apiClient.post<{ code: string; path: string }>(`/community/circles/${id}/invite-code/reset`).then((r) => r.data);

export const apiInviteToGroup = (id: string, userId: string) =>
  apiClient.post<GroupInfo>(`/community/circles/${id}/invites`, { user_id: userId }).then((r) => r.data);

export const apiCancelGroupInvite = (id: string, inviteId: string) =>
  apiClient.delete<GroupInfo>(`/community/circles/${id}/invites/${inviteId}`).then((r) => r.data);

export const apiMyCircleInvites = (s?: AbortSignal) => get<IncomingInvite[]>("/community/circle-invites", s);

export const apiAcceptCircleInvite = (inviteId: string) =>
  apiClient.post<{ circle_id: string; name: string }>(`/community/circle-invites/${inviteId}/accept`).then((r) => r.data);

export const apiDeclineCircleInvite = (inviteId: string) =>
  apiClient.post<{ ok: boolean }>(`/community/circle-invites/${inviteId}/decline`).then((r) => r.data);

/** "10:42", "Yesterday", "Mon", or "12 Oct" — the time column of a chat list. */
export function chatTime(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((day(now) - day(d)) / 86400000);
  if (diff === 0) return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  if (diff === 1) return "Yesterday";
  if (diff < 7) return d.toLocaleDateString(undefined, { weekday: "short" });
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

/** "Today", "Yesterday", or "Monday, 12 October" — the line between days in a chat. */
export function chatDay(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((day(now) - day(d)) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return d.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });
}
