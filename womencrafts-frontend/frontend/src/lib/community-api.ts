import { apiClient } from "./api";
import type { ApiCircleSavings, CirclePost } from "./growth-api";

/**
 * Circles, the conversations inside them, and success stories.
 *
 * Same rule as `member-api.ts` — no "userId" parameter exists anywhere. The
 * server takes the author from the session, so a client that lies gets nowhere.
 */

export interface Circle {
  id: string;
  name: string;
  topic: string;
  desc: string;
  cover: string;
  guidelines: string;
  is_private: boolean;
  member_count: number;
  post_count: number;
  joined: boolean;
}

export interface Post {
  id: string;
  circle_id: string;
  author_name: string;
  author_avatar: string;
  body: string;
  image: string;
  likes: number;
  liked_by_me: boolean;
  mine: boolean;
  reply_count: number;
  pinned: boolean;
  when: string;
}

export interface Reply {
  id: string;
  author_name: string;
  author_avatar: string;
  body: string;
  mine: boolean;
  when: string;
}

export interface Story {
  id: string;
  author_name: string;
  author_avatar: string;
  title: string;
  body: string;
  program: string;
  cover: string;
  status: "pending" | "published" | "declined";
  featured: boolean;
  likes: number;
  liked_by_me: boolean;
  mine: boolean;
  when: string;
}

interface Like {
  likes: number;
  liked_by_me: boolean;
}

/* ---- circles ---- */

/**
 * `GET /community/overview` — everything `/app/circles` shows, in one request.
 *
 * Replaces `/community/circles?mine=true` + `/community/circles/{id}/savings`
 * + `/community/circles/{id}/posts`, which could not be sent together: the
 * screen had to learn WHICH circle the pot is about before it could ask about
 * it, so the second pair waited on the first. The dependency is real, and it
 * belongs on the server, where the step between the two costs a query instead
 * of a round trip from her phone.
 *
 * `circle_id` names the circle `savings` and `posts` describe. It is null for
 * a member who has not joined one yet — a normal state, not an error.
 */
export interface CommunityOverview {
  circles: Circle[];
  circle_id: string | null;
  savings: ApiCircleSavings | null;
  posts: CirclePost[];
}

export const apiCommunityOverview = (signal?: AbortSignal) =>
  apiClient
    .get<CommunityOverview>("/community/overview", { signal })
    .then((r) => r.data);

export async function apiCircles(params: { q?: string; mine?: boolean } = {}) {
  const { data } = await apiClient.get<Circle[]>("/community/circles", { params });
  return data;
}

export async function apiCircle(id: string) {
  const { data } = await apiClient.get<Circle>(`/community/circles/${id}`);
  return data;
}

export async function apiJoinCircle(id: string) {
  const { data } = await apiClient.post<Circle>(`/community/circles/${id}/join`);
  return data;
}

export async function apiLeaveCircle(id: string) {
  const { data } = await apiClient.post<Circle>(`/community/circles/${id}/leave`);
  return data;
}

/* ---- posts ---- */

export async function apiPosts(circleId: string) {
  const { data } = await apiClient.get<Post[]>(`/community/circles/${circleId}/posts`);
  return data;
}

export async function apiCreatePost(circleId: string, body: string) {
  const { data } = await apiClient.post<Post>(`/community/circles/${circleId}/posts`, { body });
  return data;
}

export async function apiDeletePost(postId: string) {
  await apiClient.delete(`/community/posts/${postId}`);
}

export async function apiLikePost(postId: string) {
  const { data } = await apiClient.post<Like>(`/community/posts/${postId}/like`);
  return data;
}

/* ---- replies ---- */

export async function apiReplies(postId: string) {
  const { data } = await apiClient.get<Reply[]>(`/community/posts/${postId}/replies`);
  return data;
}

export async function apiCreateReply(postId: string, body: string) {
  const { data } = await apiClient.post<Reply>(`/community/posts/${postId}/replies`, { body });
  return data;
}

export async function apiDeleteReply(replyId: string) {
  await apiClient.delete(`/community/replies/${replyId}`);
}

/* ---- stories ---- */

export async function apiStories(mine = false) {
  const { data } = await apiClient.get<Story[]>("/community/stories", { params: { mine } });
  return data;
}

export async function apiStory(id: string) {
  const { data } = await apiClient.get<Story>(`/community/stories/${id}`);
  return data;
}

export async function apiSubmitStory(body: {
  title: string;
  body: string;
  program?: string;
  allow_name?: boolean;
}) {
  const { data } = await apiClient.post<Story>("/community/stories", body);
  return data;
}

export async function apiLikeStory(id: string) {
  const { data } = await apiClient.post<Like>(`/community/stories/${id}/like`);
  return data;
}
