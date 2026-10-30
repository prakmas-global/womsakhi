import { apiClient } from "./api";

/**
 * Mentor reviews — backend: routes/mentor_reviews.py.
 *
 * A learner rates a session once it has happened, once. Everything a mentor's
 * page says about her — reviews, average, sessions given, women who came back
 * — is counted from those rows; nothing is written down by hand.
 */

export interface MentorReview { first_name: string; rating: number; text: string; date: string }

export interface MentorReviewPage {
  rating: number;
  rating_count: number;
  sessions_done: number;
  /** Women who had at least one session with her. */
  learners: number;
  /** Of those, how many came back for another. */
  came_back: number;
  reviews: MentorReview[];
}

export const apiMentorReviews = (mentorId: string, signal?: AbortSignal) =>
  apiClient.get<MentorReviewPage>(`/growth/mentors/${mentorId}/reviews`, { signal }).then((r) => r.data);

/** request id → the stars she gave, for the sessions she has rated. */
export const apiMyReviewedSessions = (signal?: AbortSignal) =>
  apiClient.get<Record<string, number>>("/growth/mentors/requests/reviewed", { signal }).then((r) => r.data);

export const apiReviewSession = (requestId: string, rating: number, text = "") =>
  apiClient.post<{ ok: boolean; rating: number; rating_count: number }>(
    `/growth/mentors/requests/${requestId}/review`, { rating, text }).then((r) => r.data);
