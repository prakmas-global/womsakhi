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

/**
 * What `/me/notifications` actually returns.
 *
 * This declared `desc`, `time` and `group` — none of which the server has ever
 * sent. TypeScript cannot catch that: the response is cast at the boundary, so
 * the wrong names compiled cleanly and every row rendered as a bare title with
 * no body, no timestamp and nowhere to go. The real fields are below.
 */
export interface ApiNotification {
  id: string;
  type: string;
  /** A lucide name chosen server-side from the type. */
  icon: string;
  title: string;
  body: string;
  /** Where tapping it should take her. */
  href: string;
  unread: boolean;
  /** Ready to print — "1d ago", "just now". */
  when: string;
  /** ISO, for grouping onto a day. */
  created_at: string;
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

/** Mark one read. Scoped to her on the server — she can only mark her own. */
export async function apiReadNotification(id: string): Promise<void> {
  await apiClient.post(`/me/notifications/${id}/read`);
}

export async function apiReadAllNotifications(): Promise<void> {
  await apiClient.post("/me/notifications/read-all");
}

/** One search across her own things, the catalogue, and what she can do. */
export interface ApiSearchHit {
  id: string; kind: string; title: string; sub: string; href: string;
  /** "mine" | "app" | "do" — which list it belongs in. */
  group: string;
  amount: string;
  tag: string;
}
export interface ApiSearchAnswer {
  label: string; value: string; detail: string; href: string; action: string;
}
export interface ApiSearchResults {
  query: string;
  hits: ApiSearchHit[];
  answer: ApiSearchAnswer | null;
  took_ms: number;
}

export const apiSearch = (q: string, s?: AbortSignal) =>
  apiClient.get<ApiSearchResults>("/search", { params: { q }, signal: s }).then((r) => r.data);

/** How she is told: the delivery-channel toggles, and setting one. */
export interface ApiChannel { id: string; label: string; icon: string; on: boolean }

export const apiChannels = (s?: AbortSignal) =>
  apiClient.get<{ items: ApiChannel[]; total: number }>("/notifications/channels", { signal: s })
    .then((r) => r.data.items);

export async function apiSetChannel(label: string, on: boolean): Promise<void> {
  await apiClient.patch(`/notifications/channels/${encodeURIComponent(label)}`, { on });
}
export const apiBookings = (s?: AbortSignal) => get<ApiBooking[]>("/me/bookings", s);
export const apiCertificates = (s?: AbortSignal) => get<ApiCertificate[]>("/me/certificates", s);
export const apiDocuments = (s?: AbortSignal) => get<ApiDocument[]>("/me/documents", s);
export const apiReferrals = (s?: AbortSignal) => get<ApiReferrals>("/me/referrals", s);
export const apiProgress = (s?: AbortSignal) => get<ApiProgress>("/me/progress", s);
export const apiSummary = (s?: AbortSignal) => get<ApiSummary>("/me/summary", s);

/* ── Home, in one call ────────────────────────────────────────────────────── */

/**
 * The whole Home screen, in one round trip.
 *
 * Home used to render twenty-five mock constants and make no request at all.
 * The obvious fix — one `useResource` per block — would have meant eleven
 * requests before a woman on a 3G connection sees anything, each with its own
 * spinner and its own way to half-fail. `/me/home` gathers them server-side
 * and measures 69ms at the median against 715ms for the same eleven called
 * sequentially, before any network cost.
 *
 * Three fields are `null` on purpose and must render as absent, never as a
 * zero or a guess: `streak` (nothing records which days she opened the app),
 * `earnings.better_than_pct` (this platform does not rank women against each
 * other) and `journey.left_mins` (lesson durations are optional and mostly
 * unset). A confident wrong number about her money or her progress is worse
 * than a gap.
 *
 * `unavailable` names blocks whose own fetch timed out server-side. The screen
 * stays up and shows the rest; a block listed there is missing, not empty.
 */
export interface ApiHomeMoney {
  earned_this_month_minor: number;
  last_month_minor: number;
  pending_minor: number;
  /** MINOR units. Every money field here is paise — see `formatRupees`. */
  balance_minor: number;
  goal_minor: number;
  goal_label: string;
}

export interface ApiHome {
  me: {
    first: string; name: string; avatar: string; verified: boolean;
    unread: { notifications: number; messages: number };
    profile: { pct: number; steps: { key: string; label: string; done: boolean; href: string }[] };
  };
  journey: {
    enrollment_id: string; program_id: string; title: string; category: string;
    cover: string; pct: number; done: number; total: number;
    up_next: { n: number; title: string; duration: string; done: boolean }[];
    href: string; left_mins: number | null;
  } | null;
  next_step: { title: string; because: string; href: string; cta: string; icon: string; duration: string } | null;
  progress: Record<string, unknown> | null;
  earnings: {
    money: ApiHomeMoney;
    series_minor: number[]; series_labels: string[];
    sources: { name: string; minor: number; tone: string }[];
    delta_pct: number | null;
    better_than_pct: number | null;
  } | null;
  upcoming: { id: string; kind: string; title: string; date: string; day: string;
              month: string; time: string; mode: string; with_whom: string; href: string }[];
  recommended: Record<string, unknown>[];
  opportunities: Record<string, unknown>[];
  circles: Record<string, unknown>[];
  stories: Record<string, unknown>[];
  notifications: Record<string, unknown>[];
  streak: Record<string, unknown> | null;
  /** Blocks that failed server-side. Missing, not empty. */
  unavailable: string[];
}

export const apiHome = (s?: AbortSignal) => get<ApiHome>("/me/home", s);
export const apiCircles = (s?: AbortSignal) => get<ApiCircle[]>("/community/circles", s);
export const apiStories = (s?: AbortSignal) => get<ApiStory[]>("/community/stories", s);
export const apiMentors = (s?: AbortSignal) => get<ApiMentor[]>("/growth/mentors", s);

/**
 * Put "YOUR NEXT STEP" aside — for real, and only this one.
 *
 * The X on that card was a `useState(false)`: it vanished, no request left the
 * phone, and it was back on the next load. Every day, forever, on the loudest
 * card the home screen has.
 *
 * The step's `href` is sent rather than a flag, because "put this aside" is
 * about *this* step. Stored as a boolean, dismissing "finish lesson 3" would
 * also have hidden "claim your certificate" three weeks later and she would
 * never have learned it was waiting. Pass "" to put the card back.
 */
export async function apiDismissNextStep(href: string): Promise<void> {
  await apiClient.post("/me/home/next-step/dismiss", { href });
}
