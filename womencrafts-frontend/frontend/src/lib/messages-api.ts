import { apiClient } from "@/lib/api";

/**
 * The staff inbox — every member's thread with the team.
 *
 * Mirrors app/routes/messages.py. The rows are the same `member_messages`
 * her app reads at /me/messages; the thread state (assignee, resolved) is the
 * admin side's own. Every figure is computed on the server from stored
 * timestamps and flags — nothing here is presence or an estimate.
 */

export type ThreadFilter = "all" | "awaiting" | "unread" | "mine" | "unassigned" | "resolved";
export type ThreadStatus = "open" | "resolved";

export interface Assignee {
  id: string;
  name: string;
}

export interface ThreadMessage {
  id: string;
  sender: "member" | "team" | string;
  sender_name: string;
  body: string;
  sent_at: string;
  sent_label: string;
  /** Stored flags: whether the OTHER side has read it. */
  read_by_member: boolean;
  read_by_team: boolean;
}

export interface ThreadRow {
  user_id: string;
  full_name: string;
  email: string;
  avatar: string;
  message_count: number;
  unread: number;
  last_message: string;
  last_sender: "member" | "team" | "";
  last_at: string | null;
  last_label: string;
  /** When the oldest unanswered message from her arrived; null when the team had the last word. */
  waiting_since: string | null;
  status: ThreadStatus;
  /** She wrote again after the thread was resolved. */
  reopened: boolean;
  resolved_at: string | null;
  resolved_by_name: string;
  assigned_to: Assignee | null;
}

export interface ThreadCounts {
  all: number;
  awaiting: number;
  unread: number;
  mine: number;
  unassigned: number;
  resolved: number;
}

export interface ThreadList {
  items: ThreadRow[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
  counts: ThreadCounts;
}

export interface MemberCard {
  id: string;
  full_name: string;
  email: string;
  avatar: string;
  joined_at: string | null;
  verification_status: string;
  is_active: boolean;
}

export interface ThreadDetail extends ThreadRow {
  member: MemberCard;
  messages: ThreadMessage[];
  first_at: string | null;
  last_team_at: string | null;
  last_member_at: string | null;
  assigned_at: string | null;
}

export interface MemberHit {
  id: string;
  full_name: string;
  email: string;
  avatar: string;
  has_thread: boolean;
}

export interface StaffOption {
  id: string;
  full_name: string;
  role: string;
}

export interface MessageStats {
  threads: number;
  open: number;
  resolved: number;
  awaiting_reply: number;
  unread_messages: number;
  sent_by_team: number;
  received_from_members: number;
  received_this_week: number;
  sent_this_week: number;
  median_first_reply_minutes: number | null;
  replies_measured: number;
  replied_within_24h_pct: number | null;
}

// --- reads -------------------------------------------------------------------

export async function apiThreads(params: {
  q?: string;
  filter?: ThreadFilter;
  page?: number;
  page_size?: number;
} = {}): Promise<ThreadList> {
  const { data } = await apiClient.get<ThreadList>("/messages/threads", { params });
  return data;
}

export async function apiThread(userId: string): Promise<ThreadDetail> {
  const { data } = await apiClient.get<ThreadDetail>(`/messages/threads/${userId}`);
  return data;
}

export async function apiMessageStats(): Promise<MessageStats> {
  const { data } = await apiClient.get<MessageStats>("/messages/stats");
  return data;
}

export async function apiFindMembers(q: string, limit = 20): Promise<MemberHit[]> {
  const { data } = await apiClient.get<MemberHit[]>("/messages/members", { params: { q, limit } });
  return data;
}

export async function apiStaffOptions(): Promise<StaffOption[]> {
  const { data } = await apiClient.get<StaffOption[]>("/messages/staff");
  return data;
}

// --- writes (each one is guarded and audited on the server) ------------------

export async function apiReply(userId: string, body: string): Promise<ThreadDetail> {
  const { data } = await apiClient.post<ThreadDetail>(`/messages/threads/${userId}/reply`, { body });
  return data;
}

export async function apiStartThread(userId: string, body: string): Promise<ThreadDetail> {
  const { data } = await apiClient.post<ThreadDetail>("/messages/threads", { user_id: userId, body });
  return data;
}

export async function apiMarkThreadRead(userId: string): Promise<ThreadDetail> {
  const { data } = await apiClient.post<ThreadDetail>(`/messages/threads/${userId}/read`);
  return data;
}

export async function apiMarkThreadUnread(userId: string): Promise<ThreadDetail> {
  const { data } = await apiClient.post<ThreadDetail>(`/messages/threads/${userId}/unread`);
  return data;
}

export async function apiAssignThread(userId: string, staffId: string | null): Promise<ThreadDetail> {
  const { data } = await apiClient.post<ThreadDetail>(`/messages/threads/${userId}/assign`, { staff_id: staffId });
  return data;
}

export async function apiResolveThread(userId: string): Promise<ThreadDetail> {
  const { data } = await apiClient.post<ThreadDetail>(`/messages/threads/${userId}/resolve`);
  return data;
}

export async function apiReopenThread(userId: string): Promise<ThreadDetail> {
  const { data } = await apiClient.post<ThreadDetail>(`/messages/threads/${userId}/reopen`);
  return data;
}
