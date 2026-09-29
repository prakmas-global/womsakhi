import { NextRequest, NextResponse } from "next/server";

import { PREVIEW_ROUTE_STATES } from "@/lib/auth-preview";

/**
 * The local preview switch (see lib/auth-preview), written out here rather
 * than imported: the build replaces NODE_ENV in this file, so every branch it
 * guards is stripped from production. An imported constant is not.
 */
const AUTH_PREVIEW = process.env.NODE_ENV !== "production";

/**
 * Route guard + audience routing + keeping a month-long session alive.
 *
 * WomSakhi is two apps behind one login:
 *   • /app/*       — the member experience
 *   • /dashboard/* — the staff admin panel
 *
 * The signed-in role decides which one you land in. The role is read from the
 * token purely as a ROUTING HINT — it is not verified here, and it does not
 * need to be: every API endpoint re-checks the role server-side, so forging the
 * cookie only gets you an empty shell whose requests all 403.
 *
 * ── Renewing before the page renders ────────────────────────────────────────
 * The access token lives 30 minutes; the device session behind it lives 30
 * days (a working day for staff), carried by the httpOnly `refresh_token`
 * cookie. A member who opens the app tomorrow arrives with no access token at
 * all. Without the step below she would be bounced to /signin even though her
 * session is perfectly good — so when the access token is missing or about to
 * expire and a refresh cookie is present, this asks the API for a new pair,
 * hands the new cookies to the browser, and passes the new access token on to
 * the server render so the first paint is already signed in.
 */

const MEMBER_ROOT = "/app";
const STAFF_ROOT = "/dashboard";
const AUTH_ROUTES = ["/signin", "/signup"];
const API = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8020/api/v1";
/** Renew this long before expiry, so a render never starts with a dying token. */
const EARLY_SECONDS = 60;

/** Decode a JWT payload without verifying it. Returns null on anything odd. */
function readTokenPayload(token: string): Record<string, unknown> | null {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const padded = payload.replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(padded + "=".repeat((4 - (padded.length % 4)) % 4)));
  } catch {
    return null;
  }
}

function isMemberToken(token: string): boolean {
  const payload = readTokenPayload(token);
  // Legacy tokens issued before roles were embedded have no `role` claim —
  // treat those as staff, which is what they were.
  return typeof payload?.role === "string" && payload.role === "Member";
}

function isFresh(token: string | undefined): token is string {
  if (!token) return false;
  const exp = Number(readTokenPayload(token)?.exp);
  return Number.isFinite(exp) && exp * 1000 > Date.now() + EARLY_SECONDS * 1000;
}

/** Value of one cookie inside a list of Set-Cookie headers, or undefined. */
function cookieFrom(setCookies: string[], name: string): string | undefined {
  for (const line of setCookies) {
    const [pair] = line.split(";");
    const eq = pair.indexOf("=");
    if (eq > 0 && pair.slice(0, eq).trim() === name) return pair.slice(eq + 1).trim();
  }
  return undefined;
}

async function renew(request: NextRequest): Promise<{ access?: string; setCookies: string[] } | null> {
  const refresh = request.cookies.get("refresh_token")?.value;
  if (!refresh) return null;
  try {
    const res = await fetch(`${API}/auth/refresh`, {
      method: "POST",
      headers: {
        cookie: `refresh_token=${refresh}`,
        "user-agent": request.headers.get("user-agent") ?? "",
        "x-forwarded-for": request.headers.get("x-forwarded-for") ?? "",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(4000),
    });
    const setCookies = res.headers.getSetCookie();
    return { access: res.ok ? cookieFrom(setCookies, "access_token") : undefined, setCookies };
  } catch {
    // API unreachable: carry on with what the browser has rather than signing
    // her out over a network blip. The screen will retry on its own.
    return null;
  }
}

/** Continue to the page with `access` substituted into the request's cookies. */
function continueWith(request: NextRequest, access: string, setCookies: string[]): NextResponse {
  const headers = new Headers(request.headers);
  const others = request.cookies
    .getAll()
    .filter((c) => c.name !== "access_token")
    .map((c) => `${c.name}=${c.value}`);
  headers.set("cookie", [...others, `access_token=${access}`].join("; "));
  const response = NextResponse.next({ request: { headers } });
  for (const line of setCookies) response.headers.append("set-cookie", line);
  return response;
}

function withCookies(response: NextResponse, setCookies: string[]): NextResponse {
  for (const line of setCookies) response.headers.append("set-cookie", line);
  return response;
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // Local development only: `?preview=` draws an auth screen from fixtures
  // (see lib/auth-preview), so it needs no session and must not be redirected.
  // `AUTH_PREVIEW` is false in a production build and this is stripped.
  if (AUTH_PREVIEW && PREVIEW_ROUTE_STATES[pathname]?.includes(request.nextUrl.searchParams.get("preview") ?? "")) {
    return NextResponse.next();
  }

  let token = request.cookies.get("access_token")?.value;
  let setCookies: string[] = [];

  if (!isFresh(token) && request.cookies.get("refresh_token")) {
    const renewed = await renew(request);
    if (renewed) {
      setCookies = renewed.setCookies;
      token = renewed.access;
    }
  }

  const isStaffArea = pathname.startsWith(STAFF_ROOT);
  const isMemberArea = pathname.startsWith(MEMBER_ROOT);
  const isAuthRoute = AUTH_ROUTES.some((r) => pathname.startsWith(r));

  // Not signed in — anything private goes to the sign-in screen, remembering
  // where she was going so she lands back there.
  if (!token) {
    if (isStaffArea || isMemberArea) {
      const target = new URL("/signin", request.url);
      target.searchParams.set("next", pathname + search);
      return withCookies(NextResponse.redirect(target), setCookies);
    }
    return withCookies(NextResponse.next(), setCookies);
  }

  const home = isMemberToken(token) ? MEMBER_ROOT : STAFF_ROOT;

  // Signed in but sitting on a sign-in/sign-up page → send them home.
  if (isAuthRoute) {
    return withCookies(NextResponse.redirect(new URL(home, request.url)), setCookies);
  }

  // Signed in but in the wrong app → send them to their own.
  if ((isStaffArea && home === MEMBER_ROOT) || (isMemberArea && home === STAFF_ROOT)) {
    return withCookies(NextResponse.redirect(new URL(home, request.url)), setCookies);
  }

  return setCookies.length ? continueWith(request, token, setCookies) : NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/app/:path*", "/signin", "/signup"],
};
