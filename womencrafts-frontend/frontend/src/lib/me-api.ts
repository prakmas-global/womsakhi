import { apiClient } from "./api";

/**
 * The `/me/*` endpoints the redesigned screens read.
 *
 * Separate from `member-api.ts` for one reason: every call here takes an
 * `AbortSignal`. `useResource` cancels in flight when a woman taps away, and a
 * layer that cannot be cancelled turns that into a reply arriving at a
 * component that no longer exists — a React warning in development and a
 * memory leak on a phone that has been open all day.
 */

const get = <T>(url: string, signal?: AbortSignal, params?: Record<string, unknown>) =>
  apiClient.get<T>(url, { signal, params }).then((r) => r.data);

export interface ApiNotification {
  id: string; type: string; title: string; desc: string;
  time: string; group: string; unread: boolean;
}

export interface ApiBooking {
  id: string; service_id: string; service_name: string; date: string; time: string;
  mode: string; with_whom: string; duration: string;
  /** Minor-unit-free: the server sends a plain rupee number, or 0 for free. */
  price: number;
  note?: string;
  status: string; cancelled_reason?: string; booked_on: string;
}

export interface ApiCertificate {
  id: string; code: string; holder_name: string; program_id: string;
  program_name: string; hours?: number; grade?: string; revoked: boolean; issued_on: string;
}

/**
 * A paper in her vault, as `/me/documents` actually returns it.
 *
 * This type used to describe the *identity-check* document instead —
 * `doc_type_label`, `original_name`, `submitted`, `reviewed_at`. None of those
 * fields exist on this endpoint, so every one of them read `undefined`: the
 * vault showed papers with no name and no date, and filled the gap with a
 * hardcoded list. Two different documents, one type.
 */
export interface ApiDocument {
  id: string;
  /** Already the human label — "Aadhaar card", not "aadhaar". */
  doc_type: string;
  /** The key, so an upload can replace the right slot. */
  doc_kind: string;
  filename: string;
  status: string;
  uploaded_on: string;
  note: string;
  /** Bytes. */
  size: number;
}

export interface ApiReferrals {
  code: string; link: string; invited: number; joined: number;
  credit_per_join_label: string; message: string;
}

export interface ApiProgress {
  member_since: string; sessions_attended: number; sessions_upcoming: number;
  programs_active: number; programs_completed: number; learning_hours: number;
  completion_rate: number; achievements: { name: string; earned: boolean; desc?: string }[];
}

/** What the home screen needs, in one request. */
export interface ApiSummary {
  full_name: string;
  /** Rows, not a count — the type said `number` and the server has always
   *  returned an array. Nothing read them, so nothing noticed. */
  upcoming_bookings: ApiBooking[];
  active_programs: { id: string; program_id: string; program_name: string; progress: number }[];
  total_bookings: number;
  total_programs: number;
  completed_programs: number;
  money: {
    earned_this_month_minor: number;
    last_month_minor: number;
    pending_minor: number;
    balance_minor: number;
    goal_minor: number;
    goal_label: string;
  };
}

export interface ApiCircle {
  id: string; name: string; topic: string; desc: string; cover?: string;
  guidelines?: string; is_private: boolean; member_count: number;
  post_count: number; joined: boolean;
  /** Whether this circle collects money. Stated by the server, not guessed
   *  from its name — the screens used to decide it with a regex. */
  is_savings: boolean;
  /** Each member's share per round, in minor units. */
  monthly_minor: number;
  /** Which round it is in. 0 when the circle does not collect money. */
  round: number;
}

export interface ApiStory {
  id: string; author_name: string; author_avatar?: string; title: string; body: string;
  program?: string; cover?: string; status: string; featured: boolean;
  likes: number; liked_by_me: boolean; mine: boolean; when: string;
}

export interface ApiMentor {
  id: string; name: string; headline: string; bio: string; photo?: string;
  expertise: string[]; languages: string[]; experience_years: number; location: string;
  availability: string; rating: number; rating_count: number; sessions_done: number;
  requested: boolean;
}

export const apiNotifications = (s?: AbortSignal) => get<ApiNotification[]>("/me/notifications", s);
export const apiBookings = (s?: AbortSignal) => get<ApiBooking[]>("/me/bookings", s);
export const apiCertificates = (s?: AbortSignal) => get<ApiCertificate[]>("/me/certificates", s);
export const apiDocuments = (s?: AbortSignal) => get<ApiDocument[]>("/me/documents", s);
export const apiReferrals = (s?: AbortSignal) => get<ApiReferrals>("/me/referrals", s);
export const apiProgress = (s?: AbortSignal) => get<ApiProgress>("/me/progress", s);
export const apiSummary = (s?: AbortSignal) => get<ApiSummary>("/me/summary", s);
export const apiCircles = (s?: AbortSignal) => get<ApiCircle[]>("/community/circles", s);
export const apiStories = (s?: AbortSignal) => get<ApiStory[]>("/community/stories", s);
export const apiMentors = (s?: AbortSignal) => get<ApiMentor[]>("/growth/mentors", s);
