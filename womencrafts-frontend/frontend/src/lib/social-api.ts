import { apiClient } from "./api";
import type { PersonRow } from "./people-api";

/**
 * Community — backend: routes/social.py.
 *
 * Friends (one request, accept or decline, unfriend) and the feed: posts she
 * shares with her friends or with everyone, likes and comments.
 */

export type Audience = "friends" | "everyone";
export type FeedTab = "all" | "friends" | "mine";

export interface Author { id: string; name: string; username: string; avatar: string; verified: boolean }

export interface FeedPost {
  id: string;
  author: Author;
  text: string;
  photos: string[];
  audience: Audience;
  like_count: number;
  liked_by_me: boolean;
  comment_count: number;
  mine: boolean;
  created_at: string;
  when: string;
  /** Set on posts that came from a public circle before circles became chats. */
  from_circle: string;
}

export interface FeedPage { posts: FeedPost[]; next: string }

export interface FeedComment {
  id: string;
  author: Author;
  text: string;
  when: string;
  created_at: string;
  mine: boolean;
  can_delete: boolean;
}

export interface RequestRow extends PersonRow { when: string; mutual: number }
export interface Suggestion extends PersonRow { reason: string; mutual: number }
export interface FriendState { user_id: string; relation: PersonRow["relation"] }

const get = <T,>(url: string, signal?: AbortSignal, params?: object) =>
  apiClient.get<T>(url, { signal, params }).then((r) => r.data);

/* friends */
export const apiFriends = (s?: AbortSignal) => get<PersonRow[]>("/friends", s);
export const apiFriendRequests = (s?: AbortSignal) => get<{ incoming: RequestRow[]; sent: RequestRow[] }>("/friends/requests", s);
export const apiFriendSuggestions = (s?: AbortSignal, limit = 8) => get<Suggestion[]>("/friends/suggestions", s, { limit });
export const apiAddFriend = (userId: string) =>
  apiClient.post<FriendState>("/friends/requests", { user_id: userId }).then((r) => r.data);
export const apiAcceptFriend = (userId: string) =>
  apiClient.post<FriendState>(`/friends/requests/${userId}/accept`).then((r) => r.data);
export const apiDeclineFriend = (userId: string) =>
  apiClient.post<FriendState>(`/friends/requests/${userId}/decline`).then((r) => r.data);
export const apiCancelFriend = (userId: string) =>
  apiClient.delete<FriendState>(`/friends/requests/${userId}`).then((r) => r.data);
export const apiUnfriend = (userId: string) =>
  apiClient.delete<FriendState>(`/friends/${userId}`).then((r) => r.data);

/* feed */
export const apiFeed = (tab: FeedTab, before = "", s?: AbortSignal) =>
  get<FeedPage>("/feed", s, { tab, before: before || undefined });
export const apiUserFeed = (userId: string, before = "", s?: AbortSignal) =>
  get<FeedPage>(`/feed/user/${userId}`, s, { before: before || undefined });
export const apiCreatePost = (input: { text: string; photos: string[]; audience: Audience }) =>
  apiClient.post<FeedPost>("/feed/posts", input).then((r) => r.data);
export const apiEditPost = (id: string, patch: { text?: string; audience?: Audience }) =>
  apiClient.patch<FeedPost>(`/feed/posts/${id}`, patch).then((r) => r.data);
export const apiDeletePost = (id: string) => apiClient.delete(`/feed/posts/${id}`).then((r) => r.data);
export const apiLikePost = (id: string) =>
  apiClient.post<{ liked: boolean; like_count: number }>(`/feed/posts/${id}/like`).then((r) => r.data);
export const apiComments = (id: string, s?: AbortSignal) => get<FeedComment[]>(`/feed/posts/${id}/comments`, s);
export const apiAddComment = (id: string, text: string) =>
  apiClient.post<FeedComment>(`/feed/posts/${id}/comments`, { text }).then((r) => r.data);
export const apiDeleteComment = (id: string) => apiClient.delete(`/feed/comments/${id}`).then((r) => r.data);
export const apiReportPost = (id: string, reason: string) =>
  apiClient.post<{ ok: boolean; message: string }>(`/feed/posts/${id}/report`, { reason }).then((r) => r.data);

/**
 * The starting values of the `feed_report_reasons` master. Screens read the
 * live list with `useMaster("feed_report_reasons", REPORT_REASONS)`; the
 * server checks a report against the same master.
 */
export const REPORT_REASONS = ["Rude or hurtful", "Spam or selling", "False information", "Not safe", "Something else"];

/** Where a member's page lives: by username, else by id. */
export const profileHref = (p: { username?: string; id: string }) =>
  `/app/community/u/${encodeURIComponent(p.username || p.id)}`;
