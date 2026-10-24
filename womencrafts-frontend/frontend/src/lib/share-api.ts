import { apiClient } from "./api";

/**
 * Links a member shares, and the member half of them — backend:
 * routes/public_share.py. The pages strangers open (`/c/[id]`, `/story/[id]`,
 * `/join/[code]`) fetch the public half on the server.
 */

export interface PublicCourse {
  id: string; name: string; desc: string; category: string; duration: string;
  teacher: string; by_member: boolean; lessons: number; lesson_titles: string[];
  price_minor: number; enrolled: number;
}
export interface PublicStory {
  id: string; title: string; body: string; program: string; cover: string;
  author: string; when: string; likes: number;
}
export interface PublicInvite {
  code: string; name: string; topic: string; desc: string; icon: string;
  member_count: number; is_savings: boolean; is_private: boolean; monthly_minor: number;
}

/** Her circle's invite link — host only; the same code every time. */
export const apiCircleInviteCode = (circleId: string) =>
  apiClient.post<{ code: string; path: string }>(`/community/circles/${circleId}/invite-code`).then((r) => r.data);

/** Join with an invite code — works for a private circle too: the invite is the way in. */
export const apiJoinCircleByCode = (code: string) =>
  apiClient.post<{ circle_id: string; name: string; already: boolean }>(`/community/circles/join/${encodeURIComponent(code)}`)
    .then((r) => r.data);

/** The author of a published story, to message her — "" when she kept her name off it. */
export const apiStoryAuthor = (storyId: string, signal?: AbortSignal) =>
  apiClient.get<{ user_id: string; name: string }>(`/community/stories/${storyId}/author`, { signal }).then((r) => r.data);
