import { apiClient } from "./api";

/**
 * Work, events, mentors and courses — the modules that already had a server
 * but whose screens were still reading fixtures.
 *
 * Every call takes an `AbortSignal`, like the rest of this layer, so
 * `useResource` can cancel in flight when a woman taps away.
 */

const get = <T>(url: string, signal?: AbortSignal, params?: Record<string, unknown>) =>
  apiClient.get<T>(url, { signal, params }).then((r) => r.data);

/* ── Work ────────────────────────────────────────────────────────────── */

export interface Opportunity {
  id: string;
  title: string;
  org: string;
  kind: string;
  desc: string;
  location: string;
  mode: string;
  /** Free text, e.g. "₹12,000–₹18,000 / month". See the note in
   *  `docs/backend-plan.md`: this ought to be minor units, and cannot be
   *  filtered or sorted until it is. */
  pay: string;
  skills: string[];
  openings: number;
  deadline: string;
  deadline_label: string;
  experience: string;
  cover: string;
  contact_note: string;
  applicant_count: number;
  posted: string;
  saved: boolean;
  applied: boolean;
  status: string;
}

export interface Application {
  id: string;
  opportunity_id: string;
  /**
   * The listing's title.
   *
   * Named `title` here while the endpoint sends `opportunity_title` — so the
   * adapter read `undefined` and all seven of her applications rendered with
   * an empty heading. TypeScript could not catch it: the type was simply
   * describing a payload that does not exist. That is the fourth time this
   * repo has been bitten by exactly that, so the names now match the wire.
   */
  opportunity_title: string;
  org: string;
  status: string;
  note: string;
  /** How far along, when the server tracks steps. */
  step?: number;
  steps?: number;
  staff_note?: string;
  applied_on: string;
}

export const apiOpportunities = (s?: AbortSignal, params?: { q?: string; kind?: string }) =>
  get<Opportunity[]>("/growth/opportunities", s, params);

export const apiOpportunity = (id: string, s?: AbortSignal) =>
  get<Opportunity>(`/growth/opportunities/${id}`, s);

export const apiApplications = (s?: AbortSignal) =>
  get<Application[]>("/growth/applications", s);

export async function apiApply(id: string, note = "") {
  const { data } = await apiClient.post(`/growth/opportunities/${id}/apply`, { note });
  return data;
}

export async function apiToggleSaveOpportunity(id: string) {
  const { data } = await apiClient.post<{ message: string }>(`/growth/opportunities/${id}/save`);
  return data;
}

/* ── Events ──────────────────────────────────────────────────────────── */

export interface GrowthEvent {
  id: string;
  title: string;
  desc: string;
  category: string;
  cover: string;
  date: string;
  date_label: string;
  time: string;
  duration: string;
  host: string;
  language: string;
  mode: string;
  venue: string;
  fee: number;
  seats: number;
  seats_left: number;
  full: boolean;
  registered: boolean;
}

export const apiEvents = (s?: AbortSignal, params?: { category?: string; past?: boolean }) =>
  get<GrowthEvent[]>("/growth/events", s, params);

export const apiEvent = (id: string, s?: AbortSignal) =>
  get<GrowthEvent>(`/growth/events/${id}`, s);

export async function apiRegisterForEvent(id: string) {
  const { data } = await apiClient.post<GrowthEvent>(`/growth/events/${id}/register`);
  return data;
}

export async function apiCancelEvent(id: string) {
  const { data } = await apiClient.post<GrowthEvent>(`/growth/events/${id}/cancel`);
  return data;
}

/* ── Mentors ─────────────────────────────────────────────────────────── */

export interface ApiMentorDetail {
  id: string; name: string; headline: string; bio: string; photo: string;
  expertise: string[]; languages: string[]; experience_years: number;
  location: string; availability: string; rating: number;
  rating_count: number; sessions_done: number; requested: boolean;
}

export interface MentorRequest {
  id: string; mentor_id: string; mentor_name: string;
  goal: string; preferred_time: string; status: string; when: string;
}

export const apiMyMentorRequests = (s?: AbortSignal) =>
  get<MentorRequest[]>("/growth/mentors/requests/mine", s);

export const apiMentor = (id: string, s?: AbortSignal) =>
  get<ApiMentorDetail>(`/growth/mentors/${id}`, s);

/**
 * Ask a mentor for a session.
 *
 * `goal` is required by the server and this sent `{ note }` — a field the
 * endpoint does not have. Even once the button was wired it would have been
 * refused for a missing goal, which is the right refusal: a mentor reading
 * "someone wants to talk" with no subject cannot prepare or say yes.
 */
export async function apiRequestMentor(id: string, goal: string, preferredTime = "") {
  const { data } = await apiClient.post(`/growth/mentors/${id}/request`, {
    goal, preferred_time: preferredTime,
  });
  return data;
}

/* ── Courses ─────────────────────────────────────────────────────────── */

export interface Enrollment {
  id: string;
  program_id: string;
  program_name: string;
  category: string;
  cover: string;
  desc: string;
  duration: string;
  dates: string;
  days: string;
  mode: string;
  progress: number;
  sessions_attended: number;
  status: string;
  joined: string;
}

export interface CatalogProgramRow {
  id: string; name: string; desc: string; category: string;
  duration: string; dates: string; days: string; mode: string;
  cap: number; enrolled: number; seats_left: number | null;
  is_full: boolean; joined: boolean; pct: number; bar: string;
  cat_tone: string; note: string; status: string;
}

export const apiMyPrograms = (s?: AbortSignal) => get<Enrollment[]>("/me/programs", s);
export const apiCatalogPrograms = (s?: AbortSignal, params?: { q?: string; category?: string }) =>
  get<CatalogProgramRow[]>("/catalog/programs", s, params);

/** One item of a course's curriculum, as the server keeps it. */
export interface ApiLesson {
  title: string;
  detail: string;
  duration: string;
  done: boolean;
}

/**
 * One enrolled course in full.
 *
 * Typed properly rather than `Record<string, unknown>` — the lesson screens
 * could not read a curriculum they had no type for, which is part of why they
 * used a constant instead.
 */
export interface ApiProgramDetail {
  id: string;
  name: string;
  category: string;
  desc: string;
  mode: string;
  duration: string;
  dates: string;
  days: string;
  cover: string;
  seats: number;
  enrolled: number;
  /** 0–100. */
  progress: number;
  sessions_attended: number;
  status: string;
  joined_on: string;
  curriculum: ApiLesson[];
  certificate_code: string;
}

export const apiProgramDetail = (id: string, s?: AbortSignal) =>
  get<ApiProgramDetail>(`/me/programs/${id}/detail`, s);

export async function apiEnroll(programId: string) {
  const { data } = await apiClient.post(`/me/programs/${programId}/enroll`);
  return data;
}

export async function apiSetProgress(programId: string, progress: number) {
  const { data } = await apiClient.patch(`/me/programs/${programId}/progress`, { progress });
  return data;
}

/* ── Community ───────────────────────────────────────────────────────── */

export interface ApiCircleDetail {
  id: string; name: string; topic: string; desc: string; cover: string;
  guidelines: string; is_private: boolean; member_count: number;
  post_count: number; joined: boolean;
  is_savings: boolean; monthly_minor: number; round: number;
}

/** One member of a savings circle, as the pay screen needs her. */
export interface ApiCircleMember {
  name: string; avatar: string; turn: number; paid: boolean; you: boolean;
}

/** Everything the pay screen shows, in one request rather than four. */
export interface ApiCircleSavings {
  circle_id: string;
  is_savings: boolean;
  monthly_minor: number;
  round: number;
  collected_minor: number;
  pot_minor: number;
  members_total: number;
  members_paid: number;
  you_paid: boolean;
  whose_turn: string;
  members: ApiCircleMember[];
}

export interface ApiContribution {
  id: string; round: number; amount_minor: number; amount_label: string;
  paid_on: string; members_paid: number; members_total: number; whose_turn: string;
}

export interface CirclePost {
  id: string; author_name: string; author_avatar: string;
  body: string; likes: number; liked_by_me: boolean;
  reply_count: number; when: string; mine: boolean;
  /** Which circle it was posted in — the only route to its topic, and so to
   *  the category a reader sees on the card. Sent by `/community/overview`. */
  circle_id: string;
  /** One photograph, or "". The server has sent this all along; the type did
   *  not say so, so every circle screen dropped it. */
  image: string;
  /** Held at the top of its circle, because somebody needs it read. */
  pinned: boolean;
}

export const apiCircle = (id: string, s?: AbortSignal) =>
  get<ApiCircleDetail>(`/community/circles/${id}`, s);

/** Start a circle. The woman who starts it is its first member and its host. */
export async function apiCreateCircle(
  body: { name: string; topic: string; desc: string; is_savings: boolean; monthly_minor: number },
  attemptKey?: string,
) {
  const { data } = await apiClient.post<ApiCircleDetail>(
    "/community/circles",
    body,
    attemptKey ? { headers: { "Idempotency-Key": attemptKey } } : undefined,
  );
  return data;
}

export const apiCircleSavings = (id: string, s?: AbortSignal) =>
  get<ApiCircleSavings>(`/community/circles/${id}/savings`, s);

/**
 * Pay this month's share.
 *
 * `attemptKey` comes from `useAttemptKey` — one key per press and its retries.
 * The server also holds a unique index on (circle, member, round), so paying
 * twice for one month is impossible even without it; the key is what turns a
 * lost retry into the first answer rather than a refusal she did not earn.
 */
export async function apiContribute(id: string, attemptKey?: string) {
  const { data } = await apiClient.post<ApiContribution>(
    `/community/circles/${id}/contribute`,
    {},
    attemptKey ? { headers: { "Idempotency-Key": attemptKey } } : undefined,
  );
  return data;
}

export const apiCirclePosts = (id: string, s?: AbortSignal) =>
  get<CirclePost[]>(`/community/circles/${id}/posts`, s);

export async function apiJoinCircle(id: string) {
  const { data } = await apiClient.post(`/community/circles/${id}/join`);
  return data;
}

export async function apiLeaveCircle(id: string) {
  const { data } = await apiClient.post(`/community/circles/${id}/leave`);
  return data;
}

export async function apiPostToCircle(id: string, body: string) {
  const { data } = await apiClient.post<CirclePost>(`/community/circles/${id}/posts`, { body });
  return data;
}

export interface ApiStoryDetail {
  id: string; author_name: string; author_avatar: string; title: string;
  body: string; program: string; cover: string; status: string;
  featured: boolean; likes: number; liked_by_me: boolean; mine: boolean; when: string;
}

export const apiStory = (id: string, s?: AbortSignal) =>
  get<ApiStoryDetail>(`/community/stories/${id}`, s);

export async function apiLikeStory(id: string) {
  const { data } = await apiClient.post<{ likes: number; liked: boolean }>(
    `/community/stories/${id}/like`,
  );
  return data;
}
