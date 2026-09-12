import { apiClient } from "./api";

/**
 * A member's own conversations.
 *
 * Separate from `messages-api.ts`, which is the staff inbox: that collection
 * has no owner field, so it is one shared support queue. These are hers, and
 * every call below is scoped to her session on the server.
 */

/**
 * Who a thread is with. Must match `MemberConversationModel.KINDS` on the
 * server — `RING` and `TAG` in the inbox are indexed BY this union, so a kind
 * the server sends and this does not know reaches `TAG[kind].label` as
 * undefined and throws on render.
 *
 * `seller` is the other direction from `buyer`: a woman SHE is buying from,
 * which is what the market's "Ask her something" opens.
 */
export type PartyKind = "buyer" | "seller" | "mentor" | "circle" | "team";

export interface ConvContext {
  kind: string;
  ref?: string;
  title?: string;
  sub?: string;
  status?: string;
  amount_minor?: number;
  settled?: boolean;
  image?: string;
}

export interface ConvParty {
  role?: string;
  since?: string;
  orders?: number;
  spent_minor?: number;
}

export interface ConvOrder {
  state: string;
  title: string;
  sub: string;
  amount_minor: number;
  paid: boolean;
  image?: string;
}

export interface ConvBubble {
  dir: "in" | "out";
  text: string;
  file: { name: string; url: string; kind: string } | null;
  /** An order placed inside the conversation, kept as it was agreed. */
  order: ConvOrder | null;
  at: string | null;
  read: boolean;
}

export interface ConvRow {
  id: string;
  kind: PartyKind;
  name: string;
  avatar: string;
  online: boolean;
  subtitle: string;
  preview: string;
  last_at: string | null;
  unread: number;
  /** When the oldest unanswered message arrived — null when nobody is waiting. */
  waiting_since: string | null;
  starred: boolean;
  context: ConvContext | null;
  party: ConvParty;
}

export interface ConvDetail extends ConvRow {
  messages: ConvBubble[];
}

export interface InboxSummary {
  waiting: number;
  open_order_minor: number;
  reply_minutes: number | null;
  counts: Partial<Record<PartyKind, number>>;
}

export async function apiConversations(kind?: PartyKind, q?: string): Promise<ConvRow[]> {
  const { data } = await apiClient.get<ConvRow[]>("/me/conversations", { params: { kind, q } });
  return data;
}

export async function apiInboxSummary(): Promise<InboxSummary> {
  const { data } = await apiClient.get<InboxSummary>("/me/conversations/summary");
  return data;
}

export async function apiConversation(id: string): Promise<ConvDetail> {
  const { data } = await apiClient.get<ConvDetail>(`/me/conversations/${id}`);
  return data;
}

export async function apiSendToConversation(id: string, text: string): Promise<ConvDetail> {
  const { data } = await apiClient.post<ConvDetail>(`/me/conversations/${id}/messages`, { text });
  return data;
}


export async function apiStarConversation(id: string, starred: boolean): Promise<ConvDetail> {
  const { data } = await apiClient.patch<ConvDetail>(`/me/conversations/${id}/star`, { starred });
  return data;
}

export async function apiMarkUnread(id: string): Promise<ConvDetail> {
  const { data } = await apiClient.post<ConvDetail>(`/me/conversations/${id}/unread`);
  return data;
}

export async function apiDeleteConversation(id: string): Promise<void> {
  await apiClient.delete(`/me/conversations/${id}`);
}
