import { apiClient } from "./api";

/**
 * Health videos — backend: routes/health_videos.py.
 *
 * Staff add them (Content permission); members read the active ones. What she
 * watched, saved or finished is a `vwatch` entry in the Health store.
 */

/** Each Health & Wellness section shows its own categories in its Watch & listen tab (components/ux/health/WatchListen.tsx). */
export const VIDEO_CATEGORIES = ["Workout", "Yoga", "Meditation", "Pregnancy", "Nutrition", "Sleep", "Fertility", "Mentoring", "Health talks"] as const;
export type VideoCategory = (typeof VIDEO_CATEGORIES)[number];
export const VIDEO_LEVELS = ["All levels", "Beginner", "Intermediate", "Gentle"] as const;

export interface HealthVideo {
  id: string;
  title: string;
  category: VideoCategory;
  url: string;
  /** Set for YouTube links; play through the nocookie embed. */
  youtube_id: string;
  duration_sec: number;
  level: string;
  description: string;
  thumbnail: string;
  source: string;
  active: boolean;
  order: number;
  created_at: string;
}

export type HealthVideoInput = {
  title: string; category: VideoCategory; url: string; duration_sec: number; level?: string;
  description?: string; source?: string; active?: boolean; order?: number;
};

export const apiHealthVideos = (signal?: AbortSignal) =>
  apiClient.get<HealthVideo[]>("/health/videos", { signal }).then((r) => r.data);

export const apiAdminHealthVideos = () => apiClient.get<HealthVideo[]>("/admin/health/videos").then((r) => r.data);
export const apiAdminAddHealthVideo = (v: HealthVideoInput) => apiClient.post<HealthVideo>("/admin/health/videos", v).then((r) => r.data);
export const apiAdminEditHealthVideo = (id: string, v: Partial<HealthVideoInput>) =>
  apiClient.patch<HealthVideo>(`/admin/health/videos/${id}`, v).then((r) => r.data);
export const apiAdminDeleteHealthVideo = (id: string) => apiClient.delete(`/admin/health/videos/${id}`).then(() => undefined);

export const fmtDuration = (sec: number) => {
  const m = Math.floor(sec / 60), s = sec % 60;
  return m >= 60 ? `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
};
