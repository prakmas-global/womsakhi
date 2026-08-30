import { apiClient } from "@/lib/api";

// --- Response shapes (mirror app/schemas/message.py) --------------------------

export interface ApiMessageFile {
  name: string;
  size: string;
}

export interface ApiMessageBubble {
  dir: string; // "in" | "out"
  text: string | null;
  file: ApiMessageFile | null;
  time: string;
}

export interface ApiConversation {
  id: string; // mongo id (used for updates/deletes/sends)
  name: string;
  preview: string;
  time: string;
  unread: number;
  starred: boolean;
  active: boolean;
  has_attachment: boolean;
  messages: ApiMessageBubble[];
}

export interface ConversationList {
  items: ApiConversation[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

export interface ApiOverviewSlice {
  name: string;
  value: number;
  pct: string;
  color: string;
}

export interface ApiTopContact {
  name: string;
  count: number;
  badge: number;
}

export interface ApiMessageStats {
  total_conversations: number;
  messages_sent: number;
  messages_received: number;
  avg_response_time: string;
  resolved_conversations: number;
  overview_total: number;
  overview: ApiOverviewSlice[];
  top_contacts: ApiTopContact[];
  range: string;
}

export interface SimpleList {
  items: string[];
}

export interface BroadcastResult {
  message: string;
  recipients: string;
  sent: number;
}

// --- Enums (mirror the backend Literals) -------------------------------------

export type ConversationFilter = "all" | "unread" | "starred" | "attachments";
export type FlagAction =
  | "star"
  | "unstar"
  | "toggle_star"
  | "mark_unread"
  | "archive"
  | "read";
export type BroadcastAudience =
  | "All users"
  | "Active users"
  | "Workshop enrollees"
  | "Starred contacts";
export type StatsRange = "This Week" | "This Month" | "This Quarter" | "This Year";

// --- Params ------------------------------------------------------------------

export interface ConversationListParams {
  q?: string;
  filter?: ConversationFilter;
  page?: number;
  page_size?: number;
}

export interface SendMessageInput {
  dir?: "in" | "out";
  text?: string;
  file?: ApiMessageFile;
  time?: string;
}

export interface FlagUpdateInput {
  action?: FlagAction;
  starred?: boolean;
  unread?: number;
  active?: boolean;
}

// --- Reads -------------------------------------------------------------------

export async function apiListConversations(
  params: ConversationListParams = {}
): Promise<ConversationList> {
  const { data } = await apiClient.get<ConversationList>("/messages/conversations", { params });
  return data;
}

export async function apiGetConversation(id: string): Promise<ApiConversation> {
  const { data } = await apiClient.get<ApiConversation>(`/messages/conversations/${id}`);
  return data;
}

export async function apiMessageStats(range?: StatsRange): Promise<ApiMessageStats> {
  const { data } = await apiClient.get<ApiMessageStats>("/messages/stats", {
    params: range ? { range } : {},
  });
  return data;
}

export async function apiMessageContacts(): Promise<string[]> {
  const { data } = await apiClient.get<SimpleList>("/messages/contacts");
  return data.items;
}

export async function apiMessageTemplates(): Promise<string[]> {
  const { data } = await apiClient.get<SimpleList>("/messages/templates");
  return data.items;
}

export async function apiMessageAutomations(): Promise<string[]> {
  const { data } = await apiClient.get<SimpleList>("/messages/automations");
  return data.items;
}

// --- Mutations ---------------------------------------------------------------

export async function apiCreateConversation(body: {
  name: string;
  body?: string;
}): Promise<ApiConversation> {
  const { data } = await apiClient.post<ApiConversation>("/messages/conversations", body);
  return data;
}

export async function apiSendMessage(
  id: string,
  body: SendMessageInput
): Promise<ApiConversation> {
  const { data } = await apiClient.post<ApiConversation>(
    `/messages/conversations/${id}/messages`,
    body
  );
  return data;
}

export async function apiUpdateConversation(
  id: string,
  body: FlagUpdateInput
): Promise<ApiConversation> {
  const { data } = await apiClient.patch<ApiConversation>(
    `/messages/conversations/${id}`,
    body
  );
  return data;
}

export async function apiDeleteConversation(id: string): Promise<void> {
  await apiClient.delete(`/messages/conversations/${id}`);
}

export async function apiBroadcast(body: {
  recipients: BroadcastAudience;
  body: string;
}): Promise<BroadcastResult> {
  const { data } = await apiClient.post<BroadcastResult>("/messages/broadcast", body);
  return data;
}
