/**
 * Where the API is, answered differently on each side of the wire.
 *
 * ── Why this is not one constant ────────────────────────────────────────────
 * In the browser the API is reached at a RELATIVE path, `/api/v1`, which
 * `next.config.ts` rewrites onto the real backend. That makes every call
 * same-origin, and same-origin is what the session depends on: the API sets an
 * HttpOnly `access_token` cookie, and both the browser AND this Next server
 * have to be able to read it. A cookie set by a different host is invisible to
 * this one, so a signed-in page bounces to /signin while the API insists the
 * login worked — a clean 200 on signin followed by 401 on everything after it.
 *
 * Going through the rewrite also means there is no cross-origin request left
 * to configure, so CORS stops being able to break the app at all.
 *
 * On the server there is no origin to be relative to — `fetch("/api/v1/…")`
 * from Node throws — so it talks to the backend directly over its internal
 * URL. `INTERNAL_API_URL` is read at RUNTIME here, unlike `NEXT_PUBLIC_*`
 * which is inlined at build time.
 */
const FALLBACK = "http://localhost:8020/api/v1";

export const apiBase = (): string =>
  typeof window === "undefined"
    ? process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || FALLBACK
    : process.env.NEXT_PUBLIC_API_URL || "/api/v1";

/** The value at module scope, for the many callers that want a constant. */
export const API_BASE = apiBase();
