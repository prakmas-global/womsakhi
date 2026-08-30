import axios from "axios";

import { recordFailure } from "./request-errors";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8010/api/v1";

/**
 * The session lives in an httpOnly cookie set by the API, so there is no token
 * in JavaScript for an XSS bug to steal. `withCredentials` is what makes the
 * browser attach it to every cross-origin call to the API.
 */
export const apiClient = axios.create({
  baseURL: API_URL,
  headers: { "Content-Type": "application/json" },
  withCredentials: true,
});

/**
 * Report every failure centrally, then re-throw so callers behave as before.
 *
 * 97 catch blocks in this app swallow their error. A list screen whose fetch
 * failed therefore falls through to its empty state and tells the user "No
 * members yet" when the truth is that the server could not be reached.
 *
 * This interceptor changes nothing about how a call resolves — it only makes
 * sure the failure is *known*, so `<ConnectionBanner>` can say so. Screens that
 * want a scoped retry still render their own `ErrorState`.
 */
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const path = (error?.config?.url as string | undefined) ?? "unknown";
    // No response at all means the API is unreachable — the most important
    // case to surface, and the one a status-code check would miss entirely.
    const status = error?.response?.status ?? 0;
    recordFailure(path, status);
    return Promise.reject(error);
  },
);

// --- Auth API calls ---

export interface AuthPayload {
  access_token: string;
  token_type: string;
  user: {
    id: string;
    full_name: string;
    email: string;
    role: string;
    is_active: boolean;
    created_at: string;
    modules: string[]; // RBAC — module keys this account can open
    audience: "member" | "staff"; // which app this account belongs to
    member_id: string; // set for members — their row in the members directory
    locale: string;
    phone: string;
    avatar: string;
    /** Colour theme — two seeds; every shade is derived client-side. */
    theme_id: string;
    theme_primary: string;
    theme_secondary: string;
    /** Onboarding progress, saved per step. */
    onboarding_done: string[];
    onboarding_complete: boolean;
    /** Admission state — only "active" may use the member app. */
    verification_status:
      | "pending_email"
      | "pending_documents"
      | "in_review"
      | "active"
      | "rejected"
      | "suspended";
    rejection_reason: string;
  };
}

export async function apiSignUp(
  full_name: string,
  email: string,
  password: string,
  extra: { phone?: string; locale?: string } = {}
): Promise<AuthPayload> {
  const { data } = await apiClient.post<AuthPayload>("/auth/signup", {
    full_name,
    email,
    password,
    phone: extra.phone ?? "",
    locale: extra.locale ?? "en",
  });
  return data;
}

export async function apiSignIn(
  email: string,
  password: string
): Promise<AuthPayload> {
  const { data } = await apiClient.post<AuthPayload>("/auth/signin", {
    email,
    password,
  });
  return data;
}

/**
 * "Is there a session?" — 200 either way, so a signed-out visitor's console
 * stays clean. (/auth/me correctly 401s, which is noisy on every page load.)
 */
export async function apiGetSession(): Promise<AuthPayload["user"] | null> {
  const { data } = await apiClient.get<{ user: AuthPayload["user"] | null }>("/auth/session");
  return data.user;
}

/** Ends the session — only the server can clear an httpOnly cookie. */
export async function apiSignOut(): Promise<void> {
  await apiClient.post("/auth/signout");
}

export async function apiGetMe(): Promise<AuthPayload["user"]> {
  const { data } = await apiClient.get<AuthPayload["user"]>("/auth/me");
  return data;
}

// --- Users module (members directory, roles, segments) ---

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

export interface ApiMember {
  id: string; // mongo id (used for updates/deletes)
  code: string; // display code, e.g. "WC-12564"
  full_name: string;
  email: string;
  phone: string;
  role: string;
  status: string;
  location: string;
  segment: string;
  gender: string;
  dob: string;
  referral: string;
  engagement: number;
  verified_on: string;
  avatar: string;
  joined: string;
  created_at: string;
}

export interface MemberStats {
  total: number;
  active: number;
  inactive: number;
  pending: number;
  rejected: number;
  avg_engagement: number;
  by_role: Record<string, number>;
  by_segment: Record<string, number>;
}

export interface MemberListParams {
  q?: string;
  role?: string;
  status?: string;
  segment?: string;
  sort?: string;
  page?: number;
  page_size?: number;
}

export interface MemberInput {
  full_name: string;
  email: string;
  phone?: string;
  role?: string;
  status?: string;
  location?: string;
  segment?: string;
  gender?: string;
  dob?: string;
  referral?: string;
  engagement?: number;
  avatar?: string; // URL from POST /uploads
}

export async function apiListMembers(params: MemberListParams = {}): Promise<Paginated<ApiMember>> {
  const { data } = await apiClient.get<Paginated<ApiMember>>("/members", { params });
  return data;
}

export async function apiMemberStats(): Promise<MemberStats> {
  const { data } = await apiClient.get<MemberStats>("/members/stats");
  return data;
}

export async function apiCreateMember(body: MemberInput): Promise<ApiMember> {
  const { data } = await apiClient.post<ApiMember>("/members", body);
  return data;
}

export async function apiUpdateMember(id: string, body: Partial<MemberInput>): Promise<ApiMember> {
  const { data } = await apiClient.patch<ApiMember>(`/members/${id}`, body);
  return data;
}

export async function apiSetMemberStatus(id: string, status: string): Promise<ApiMember> {
  const { data } = await apiClient.patch<ApiMember>(`/members/${id}/status`, { status });
  return data;
}

export async function apiDeleteMember(id: string): Promise<void> {
  await apiClient.delete(`/members/${id}`);
}

/**
 * Staff-initiated password reset.
 *
 * Emails the member a single-use link — we never set or reveal a password on
 * someone's behalf, so no staff member ever knows a member's credentials.
 */
export async function apiResetMemberPassword(
  id: string,
): Promise<{ message: string; delivered: boolean }> {
  const { data } = await apiClient.post(`/members/${id}/reset-password`);
  return data;
}

// Roles

export interface ApiRole {
  id: string;
  name: string;
  desc: string;
  users: number;
  type: string;
  perms: number;
  status: string;
  icon: string;
  modules: string[];
  created: string;
}

export interface RoleInput {
  name: string;
  desc?: string;
  users?: number;
  type?: string;
  perms?: number;
  status?: string;
  icon?: string;
}

export async function apiListRoles(params: { q?: string; status?: string } = {}): Promise<{ items: ApiRole[]; total: number }> {
  const { data } = await apiClient.get<{ items: ApiRole[]; total: number }>("/roles", { params });
  return data;
}

export async function apiCreateRole(body: RoleInput): Promise<ApiRole> {
  const { data } = await apiClient.post<ApiRole>("/roles", body);
  return data;
}

export async function apiUpdateRole(id: string, body: Partial<RoleInput>): Promise<ApiRole> {
  const { data } = await apiClient.patch<ApiRole>(`/roles/${id}`, body);
  return data;
}

export async function apiDeleteRole(id: string): Promise<void> {
  await apiClient.delete(`/roles/${id}`);
}

/** RBAC — Super Admin sets which modules a role can open. */
export async function apiSetRoleModules(id: string, modules: string[]): Promise<ApiRole> {
  const { data } = await apiClient.put<ApiRole>(`/roles/${id}/modules`, { modules });
  return data;
}

// Segments

export interface ApiSegment {
  id: string;
  name: string;
  desc: string;
  users: string;
  pct: string;
  eng: number;
  growth: string;
  up: boolean;
  status: string;
  icon: string;
}

export interface SegmentInput {
  name: string;
  desc?: string;
  users?: string;
  pct?: string;
  eng?: number;
  growth?: string;
  up?: boolean;
  status?: string;
  icon?: string;
}

export async function apiListSegments(params: { q?: string; status?: string } = {}): Promise<{ items: ApiSegment[]; total: number }> {
  const { data } = await apiClient.get<{ items: ApiSegment[]; total: number }>("/segments", { params });
  return data;
}

export async function apiCreateSegment(body: SegmentInput): Promise<ApiSegment> {
  const { data } = await apiClient.post<ApiSegment>("/segments", body);
  return data;
}

export async function apiUpdateSegment(id: string, body: Partial<SegmentInput>): Promise<ApiSegment> {
  const { data } = await apiClient.patch<ApiSegment>(`/segments/${id}`, body);
  return data;
}

export async function apiDeleteSegment(id: string): Promise<void> {
  await apiClient.delete(`/segments/${id}`);
}

/* ── one request per question, however many components ask ─────────────── */

/**
 * Share a GET that is already in flight instead of sending it again.
 *
 * `useMe()` is called by `HomeShell` and again by each page that needs her
 * name, so `/me/unread` went out **twice on every screen** and four times on
 * `/app/notifications` — twelve of that screen's fifteen database queries were
 * the same two questions asked over and over. Nothing was wrong with the
 * hooks; there was simply nothing between them and the wire.
 *
 * **In-flight only, deliberately — this is not a cache.** A completed response
 * is never reused, so a screen can never show a figure that a write has since
 * changed. That matters more than the extra request: this app has spent six
 * phases making sure what she sees is what the server holds, and a stale-cache
 * bug would undo it invisibly. Two components asking the same question in the
 * same instant get one answer; anyone asking a moment later gets a fresh one.
 *
 * **The signal is dropped from the shared request, on purpose.** Every read in
 * this app goes through `useResource`, which makes a fresh `AbortController`
 * per fetch — so excluding signal-carrying requests excluded all of them, and
 * an earlier version of this did exactly that and deduplicated nothing.
 * Sharing one promise between two callers means either could otherwise cancel
 * the other's request. Letting it run instead is safe because `useResource`
 * checks both `alive` and its own `signal.aborted` before it touches state:
 * the caller that walked away discards the answer, and the one still waiting
 * gets it. The cost is a response nobody reads; the saving is a request nobody
 * needed to make.
 */
const inFlight = new Map<string, Promise<unknown>>();

/**
 * The whole mechanism is here, on `get`, and not in a request interceptor.
 *
 * An interceptor runs too late: two components rendering in the same tick both
 * reach it before either has produced a promise to share, so neither finds the
 * other. Registering the promise at the call is the only point where the
 * second caller can still see the first.
 */
const rawGet = apiClient.get.bind(apiClient);
apiClient.get = function dedupedGet(url: string, config?: Parameters<typeof rawGet>[1]) {
  const key = `${apiClient.defaults.baseURL ?? ""}${url}?${JSON.stringify(config?.params ?? {})}`;
  const held = inFlight.get(key);
  if (held) return held as ReturnType<typeof rawGet>;

  // Without the caller's signal — see above.
  const { signal: _ignored, ...shared } = config ?? {};
  void _ignored;
  const p = rawGet(url, shared).finally(() => {
    // Cleared the moment it settles. The next question gets a real request.
    inFlight.delete(key);
  });
  inFlight.set(key, p);
  return p;
} as typeof apiClient.get;
