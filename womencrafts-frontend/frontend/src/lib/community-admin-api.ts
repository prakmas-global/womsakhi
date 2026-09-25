import { apiClient } from "./api";
import { apiMyPermissions } from "./permissions-api";

/**
 * Staff side of circles, moderation and success stories.
 *
 * Everything under `/admin/community/*` is behind the "community" module
 * guard, and every write names its action (`community.edit`, `.delete`,
 * `.approve`). The screens ask `apiCommunityPermissions()` which of those the
 * signed-in account holds, so a button is only drawn when the server would
 * accept the click — a Viewer sees the queue, not a row of buttons that 403.
 */

/* ---------------- permissions ---------------- */

export type CommunityAction = "view" | "create" | "edit" | "delete" | "approve";

export async function apiCommunityPermissions(isSuperAdmin: boolean) {
  const all: CommunityAction[] = ["view", "create", "edit", "delete", "approve"];
  if (isSuperAdmin) return new Set<CommunityAction>(all);
  const { permissions } = await apiMyPermissions();
  return new Set<CommunityAction>(
    all.filter((a) => permissions.includes(`community.${a}`)),
  );
}

/* ---------------- circles ---------------- */

export interface AdminCircle {
  id: string;
  name: string;
  topic: string;
  desc: string;
  guidelines: string;
  is_private: boolean;
  is_savings: boolean;
  monthly_minor: number;
  round: number;
  status: "active" | "archived" | string;
  /** Counted from the membership and post collections at request time. */
  member_count: number;
  post_count: number;
  hidden_post_count: number;
  moderator_count: number;
  last_post_at: string;
  created_at: string;
}

export interface CircleSummary {
  total: number;
  active: number;
  archived: number;
  private: number;
  members: number;
  posts: number;
  hidden_posts: number;
  muted_members: number;
}

export interface CirclesPage {
  circles: AdminCircle[];
  summary: CircleSummary;
}

export type CircleInput = Pick<
  AdminCircle,
  "name" | "topic" | "desc" | "guidelines" | "is_private" | "status"
>;

/** Her public circle profile — name and avatar — plus her moderation state. */
export interface CircleMember {
  user_id: string;
  name: string;
  avatar: string;
  role: "host" | "moderator" | "member" | string;
  joined_at: string;
  muted_until: string;
  warnings: number;
}

export async function apiAdminCircles(params: { q?: string; status?: string } = {}) {
  const { data } = await apiClient.get<CirclesPage>("/admin/community/circles", { params });
  return data;
}

export async function apiCreateCircle(body: CircleInput) {
  const { data } = await apiClient.post<AdminCircle>("/admin/community/circles", body);
  return data;
}

export async function apiUpdateCircle(id: string, body: CircleInput) {
  const { data } = await apiClient.put<AdminCircle>(`/admin/community/circles/${id}`, body);
  return data;
}

export async function apiArchiveCircle(id: string) {
  const { data } = await apiClient.delete<{ message: string }>(`/admin/community/circles/${id}`);
  return data;
}

export async function apiReopenCircle(id: string) {
  const { data } = await apiClient.post<AdminCircle>(`/admin/community/circles/${id}/reopen`);
  return data;
}

export async function apiCircleMembers(id: string) {
  const { data } = await apiClient.get<CircleMember[]>(`/admin/community/circles/${id}/members`);
  return data;
}

export async function apiAssignModerator(circleId: string, userId: string) {
  const { data } = await apiClient.post<{ message: string }>(
    `/admin/community/circles/${circleId}/moderators`,
    { user_id: userId },
  );
  return data;
}

export async function apiRemoveModerator(circleId: string, userId: string) {
  const { data } = await apiClient.delete<{ message: string }>(
    `/admin/community/circles/${circleId}/moderators/${userId}`,
  );
  return data;
}

export async function apiWarnMember(circleId: string, userId: string, reason: string) {
  const { data } = await apiClient.post<{ message: string }>(
    `/admin/community/circles/${circleId}/members/${userId}/warn`,
    { reason },
  );
  return data;
}

export async function apiMuteMember(
  circleId: string,
  userId: string,
  body: { reason: string; days: number },
) {
  const { data } = await apiClient.post<{ message: string }>(
    `/admin/community/circles/${circleId}/members/${userId}/mute`,
    body,
  );
  return data;
}

export async function apiUnmuteMember(circleId: string, userId: string) {
  const { data } = await apiClient.post<{ message: string }>(
    `/admin/community/circles/${circleId}/members/${userId}/unmute`,
  );
  return data;
}

/* ---------------- moderation queue ---------------- */

export type ModerationState = "visible" | "hidden" | "removed";

export interface QueueItem {
  kind: "post" | "reply";
  id: string;
  /** The post itself, or the reply's parent post. */
  post_id: string;
  circle_id: string;
  circle_name: string;
  user_id: string;
  author_name: string;
  author_avatar: string;
  body: string;
  parent_snippet: string;
  likes: number;
  reply_count: number;
  pinned: boolean;
  hidden: boolean;
  state: ModerationState;
  reason: string;
  moderated_by: string;
  moderated_at: string;
  when: string;
  created_at: string;
  author_muted_until: string;
}

export interface QueueSummary {
  posts: number;
  replies: number;
  hidden: number;
  removed: number;
  muted_members: number;
  /** False until the member app can report a post. */
  reports_supported: boolean;
}

export interface ModerationQueue {
  items: QueueItem[];
  summary: QueueSummary;
}

export async function apiModerationQueue(
  params: { circle_id?: string; state?: "all" | ModerationState; kind?: "all" | "post" | "reply" } = {},
) {
  const { data } = await apiClient.get<ModerationQueue>("/admin/community/posts", { params });
  return data;
}

function itemPath(item: Pick<QueueItem, "kind" | "id">) {
  return `/admin/community/${item.kind === "post" ? "posts" : "replies"}/${item.id}`;
}

export async function apiHideItem(item: Pick<QueueItem, "kind" | "id">, reason: string) {
  const { data } = await apiClient.post<{ message: string }>(`${itemPath(item)}/hide`, { reason });
  return data;
}

export async function apiRemoveItem(item: Pick<QueueItem, "kind" | "id">, reason: string) {
  const { data } = await apiClient.post<{ message: string }>(`${itemPath(item)}/remove`, { reason });
  return data;
}

export async function apiRestoreItem(item: Pick<QueueItem, "kind" | "id">, reason = "") {
  const { data } = await apiClient.post<{ message: string }>(`${itemPath(item)}/restore`, { reason });
  return data;
}

export async function apiPinPost(id: string) {
  const { data } = await apiClient.post<{ message: string }>(`/admin/community/posts/${id}/pin`);
  return data;
}

/* ---------------- stories ---------------- */

export interface AdminStory {
  id: string;
  author_name: string;
  title: string;
  body: string;
  program: string;
  status: "pending" | "published" | "declined" | string;
  featured: boolean;
  likes: number;
  when: string;
  submitted_at: string;
  decided_at: string;
  decided_by: string;
  reason: string;
}

export interface StorySummary {
  total: number;
  pending: number;
  published: number;
  declined: number;
  featured: number;
}

export interface StoriesPage {
  stories: AdminStory[];
  summary: StorySummary;
}

export async function apiAdminStories(params: { status?: string } = {}) {
  const { data } = await apiClient.get<StoriesPage>("/admin/community/stories", { params });
  return data;
}

export async function apiDecideStory(
  id: string,
  body: { status: string; featured?: boolean; reason?: string },
) {
  const { data } = await apiClient.patch<AdminStory>(`/admin/community/stories/${id}`, body);
  return data;
}

/* ---------------- shared formatting ---------------- */

export function shortDate(iso: string) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}
