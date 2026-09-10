import axios from "axios";

import { recordFailure } from "./request-errors";
import { apiBase } from "./api-base";

const API_URL = apiBase();

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

/**
 * The sentence to show a person when a request fails.
 *
 * ── Why this exists ─────────────────────────────────────────────────────────
 * This API wraps every error as `{ error: { message, request_id } }` — see
 * `RequestIdMiddleware` in the backend. Two separate extractors in this app
 * read `data.detail` instead, which FastAPI's raw shape uses and this one does
 * not. `detail` was therefore always undefined and both fell through to their
 * fallback, so a woman who mistyped her password was told "Something went
 * wrong. Please try again." — and so was one whose account was locked, one
 * whose reset link had expired, and one signing up with an address already in
 * use. The server had written a precise, kind sentence for each of them and
 * nobody ever saw one.
 *
 * Both shapes are read here, so this keeps working if a route is ever mounted
 * outside the middleware.
 */
export function apiErrorMessage(
  err: unknown,
  fallback = "Something went wrong. Please try again.",
): string {
  if (!axios.isAxiosError(err)) return fallback;

  // No response at all — the request never arrived. Saying "something went
  // wrong" to someone on a train is worse than saying what actually happened.
  if (!err.response) {
    return "We could not reach WomSakhi. Check your connection and try again.";
  }

  const data = err.response.data as
    | { error?: { message?: unknown }; detail?: unknown; message?: unknown }
    | undefined;

  const wrapped = data?.error?.message;
  if (typeof wrapped === "string" && wrapped.trim()) return wrapped;

  const detail = data?.detail;
  if (typeof detail === "string" && detail.trim()) return detail;
  // FastAPI validation errors arrive as a list of objects.
  if (Array.isArray(detail)) {
    const first = detail.find((d) => typeof d?.msg === "string");
    if (first) return String(first.msg);
  }

  const plain = data?.message;
  if (typeof plain === "string" && plain.trim()) return plain;

  return fallback;
}

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
 * **It now also holds the answer for a few seconds — see below.** This used to
 * be in-flight only, on the grounds that a completed response reused later
 * could show a figure a write had since changed. That reasoning was right
 * while nothing invalidated anything; it is answered now by clearing the whole
 * cache on every write, which is enforceable here because all 213 of this
 * app's mutations go through this one client.
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
 * ── Holding the answer, briefly ─────────────────────────────────────────────
 *
 * Navigating back to a screen re-asked it everything. On this laptop that is
 * 30ms a question and invisible; on the phone and the connection this app is
 * actually for, six questions is most of a second of staring at a skeleton she
 * has already read once.
 *
 * So a settled GET is kept for `READ_TTL_MS` and served from memory. Three
 * things keep that honest:
 *
 *   1. **Every write empties it.** Not by path, not by guessing which reads a
 *      write touched — the whole map, on any non-GET. Anything cleverer would
 *      eventually be wrong about a relationship nobody wrote down.
 *   2. **`refetch()` empties it first.** When a screen explicitly asks again,
 *      it means it, so `useResource` clears before re-reading.
 *   3. **The window is shorter than every poller.** The safety screen refreshes
 *      every 60s, the dashboards every 30-120s; at 10s a cache entry is always
 *      long gone before a poll comes round, so nothing that watches for change
 *      is watching a held copy.
 *
 * What is left is a woman on another device — or a payout landing server-side —
 * being up to ten seconds behind. That is the same window any cached UI
 * accepts, and it is bounded, which the old unbounded "always fresh" was not
 * paying for.
 */
const READ_TTL_MS = 10_000;

/** Settled responses, with the moment they may no longer be served. */
const held = new Map<string, { until: number; value: unknown }>();

/**
 * Reads that are never held.
 *
 * Safety is not a performance question. If a woman has raised an alert, or is
 * looking at whether one is still open, a ten-second-old answer is the wrong
 * answer in the one case where being wrong is worst. It is a handful of
 * requests a minute; it can go to the server every time.
 */
const NEVER_HELD = ["/safety"];

/** Throw away every held read. Called on every write, and by `refetch`. */
export function invalidateReads(): void {
  held.clear();
}

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

  const pending = inFlight.get(key);
  if (pending) return pending as ReturnType<typeof rawGet>;

  const holdable = !NEVER_HELD.some((p) => url.startsWith(p));
  if (holdable) {
    const hit = held.get(key);
    if (hit && hit.until > Date.now()) {
      // A resolved promise, so every caller keeps the same `.then` shape it
      // has always had and cannot tell the difference.
      return Promise.resolve(hit.value) as ReturnType<typeof rawGet>;
    }
    // Expired entries are dropped on the way past rather than by a timer:
    // there is no sweeper to leak, and a key nobody asks for again costs one
    // dead entry, not a running interval.
    if (hit) held.delete(key);
  }

  // Without the caller's signal — see above.
  const { signal: _ignored, ...shared } = config ?? {};
  void _ignored;
  const p = rawGet(url, shared)
    .then((res) => {
      if (holdable) held.set(key, { until: Date.now() + READ_TTL_MS, value: res });
      return res;
    })
    .finally(() => {
      // Cleared the moment it settles — the hold above is what serves the next
      // caller, and only for as long as it is allowed to.
      inFlight.delete(key);
    });
  inFlight.set(key, p);
  return p;
} as typeof apiClient.get;

/**
 * Every write empties the read cache.
 *
 * Wrapped here rather than in an interceptor for the same reason `get` is: an
 * interceptor sees the request, but this needs to run whatever the request
 * does next, including failing. A write that errors may still have committed —
 * a timeout on a payment is the obvious one — so the cache is dropped either
 * way and the next read finds out from the server.
 */
for (const verb of ["post", "put", "patch", "delete"] as const) {
  const raw = apiClient[verb].bind(apiClient);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (apiClient as any)[verb] = (...args: unknown[]) => {
    invalidateReads();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (raw as any)(...args).finally(invalidateReads);
  };
}
