import { NextRequest, NextResponse } from "next/server";

/**
 * Route guard + audience routing.
 *
 * WomSakhi is two apps behind one login:
 *   • /app/*       — the member experience
 *   • /dashboard/* — the staff admin panel
 *
 * The signed-in role decides which one you land in. The role is read from the
 * token purely as a ROUTING HINT — it is not verified here, and it does not
 * need to be: every API endpoint re-checks the role server-side, so forging the
 * cookie only gets you an empty shell whose requests all 403.
 */

const MEMBER_ROOT = "/app";
const STAFF_ROOT = "/dashboard";
const AUTH_ROUTES = ["/signin", "/signup"];

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

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get("access_token")?.value;

  const isStaffArea = pathname.startsWith(STAFF_ROOT);
  const isMemberArea = pathname.startsWith(MEMBER_ROOT);
  const isAuthRoute = AUTH_ROUTES.some((r) => pathname.startsWith(r));

  // Not signed in — anything private goes to the sign-in screen.
  if (!token) {
    if (isStaffArea || isMemberArea) {
      return NextResponse.redirect(new URL("/signin", request.url));
    }
    return NextResponse.next();
  }

  const home = isMemberToken(token) ? MEMBER_ROOT : STAFF_ROOT;

  // Signed in but sitting on a sign-in/sign-up page → send them home.
  if (isAuthRoute) {
    return NextResponse.redirect(new URL(home, request.url));
  }

  // Signed in but in the wrong app → send them to their own.
  if ((isStaffArea && home === MEMBER_ROOT) || (isMemberArea && home === STAFF_ROOT)) {
    return NextResponse.redirect(new URL(home, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/app/:path*", "/signin", "/signup"],
};
