import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";

import type { AuthPayload } from "./api";
import type { MeShell } from "./shell-api";
import { apiBase } from "./api-base";

/**
 * The same API, asked on the server, before the HTML is sent.
 *
 * ── What this is for ────────────────────────────────────────────────────────
 * Every member screen used to boot through two blocking round trips *from the
 * browser*, one after the other:
 *
 *   1. `AuthProvider` mounts, fires `/auth/session`, and the member layout
 *      renders a spinner until it lands.
 *   2. Only then does `ShellProvider` mount — it sits inside that gate — and
 *      fire `/me/shell`, which already contains the very user step 1 waited
 *      for.
 *   3. Only then does the page ask for anything of its own.
 *
 * Three waves, strictly ordered, before the first pixel of content. Both of
 * the first two are answerable on the server from the cookie the request
 * already carried, so neither has any business being a browser round trip.
 *
 * ── Why the cookie is forwarded by hand ─────────────────────────────────────
 * `fetch` on the server is not the browser: it has no cookie jar, so the
 * session cookie has to be read from the incoming request and put on the
 * outgoing one explicitly. It is `httpOnly`, which is exactly why this can only
 * happen here and not in any client component.
 *
 * ── Why failure is silent ───────────────────────────────────────────────────
 * Every function here returns `null` rather than throwing. A signed-out
 * visitor, an expired cookie, a member still waiting on her documents (who
 * gets a 401 from `/me/shell` while the individual endpoints serve her fine),
 * or an API that is simply down must all end in the client fetching for itself
 * exactly as it did before. This is a head start, never a gate — the gate is
 * the API, which re-checks every request regardless of what was rendered.
 */

const API_URL = apiBase();

/** How long to wait before giving up and letting the client try. */
const TIMEOUT_MS = 2500;

async function get<T>(path: string): Promise<T | null> {
  const token = (await cookies()).get("access_token")?.value;
  if (!token) return null;

  try {
    const res = await fetch(`${API_URL}${path}`, {
      headers: { cookie: `access_token=${token}`, Authorization: `Bearer ${token}` },
      // Per-request and private to one woman. Caching it would serve her
      // notifications to whoever asked next.
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    // A slow or unreachable API must not turn into a 500 on a page that can
    // render perfectly well without this.
    return null;
  }
}

/**
 * Who is signed in, resolved before paint.
 *
 * **`resolved` is the whole point of this return shape.** Two very different
 * things both produce a null user: she is signed out, and the API did not
 * answer. Collapsing them would mean an API blip renders as "signed out" — and
 * the member layout redirects a signed-out visitor to `/signin`, so a two
 * second outage would log everybody out of a working session.
 *
 * So: `resolved` is true only when the answer is trustworthy — either there
 * was no session cookie at all (definitively signed out) or the API answered.
 * When it is false the client asks for itself, exactly as it always did.
 */
export type ServerSession =
  | { resolved: true; user: AuthPayload["user"] | null }
  | { resolved: false; user: null };

export async function serverSession(): Promise<ServerSession> {
  // No cookie is not a failure — it is an answer, and the fastest one.
  if (!(await cookies()).get("access_token")?.value) {
    return { resolved: true, user: null };
  }
  const data = await get<{ user: AuthPayload["user"] | null }>("/auth/session");
  if (!data) return { resolved: false, user: null };
  return { resolved: true, user: data.user ?? null };
}

/** Everything the member shell needs, resolved before paint. */
export async function serverShell(): Promise<MeShell | null> {
  return get<MeShell>("/me/shell");
}

/**
 * Decode the role out of the session token without verifying it.
 *
 * Purely to decide *which question to ask the API* — never whether to allow
 * anything. `proxy.ts` reads the same claim for the same reason and says the
 * same thing: forging it changes nothing, because every endpoint re-checks the
 * role server-side. The worst a tampered claim can do here is make this file
 * ask the wrong endpoint and get a 401, which is already a handled case.
 */
function isMemberToken(token: string): boolean {
  try {
    const body = token.split(".")[1];
    if (!body) return false;
    const json = Buffer.from(body.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString();
    return (JSON.parse(json) as { role?: unknown }).role === "Member";
  } catch {
    return false;
  }
}

export type ServerBoot = { session: ServerSession; shell: MeShell | null };

/**
 * Everything the app needs to render its chrome, in as few requests as the
 * account type allows — and exactly once per page render.
 *
 * ── Why one call and not two ────────────────────────────────────────────────
 * `/me/shell` embeds `user`, and it is the *same object* `/auth/session`
 * returns: both are `_user_response(me)` on the same document, verified
 * field-for-field. So asking both for a member would be a second round trip for
 * data already in hand. Staff have no `/me/shell` at all — it is behind
 * `require_active_member` — so they ask `/auth/session`, and the role claim in
 * the token picks between them rather than a speculative 401.
 *
 * A member still in verification also 401s from `/me/shell`; that is why the
 * member branch falls through to the session call rather than concluding she is
 * signed out.
 *
 * ── Why `cache` ─────────────────────────────────────────────────────────────
 * The root layout needs this, and so does the member layout nested inside it.
 * React's `cache` makes the second caller free for the life of one request, so
 * the two layouts share one answer instead of racing for two.
 */
export const serverBoot = cache(async (): Promise<ServerBoot> => {
  const token = (await cookies()).get("access_token")?.value;
  if (!token) return { session: { resolved: true, user: null }, shell: null };

  if (isMemberToken(token)) {
    const shell = await serverShell();
    if (shell) {
      return {
        // Safe by construction, not by assumption: both endpoints serialise
        // the identical document through `_user_response`. `MeShell["user"]`
        // is typed loosely only because the shell schema had no reason to
        // restate the auth payload.
        session: { resolved: true, user: shell.user as unknown as AuthPayload["user"] },
        shell,
      };
    }
    // 401 here means verification is still pending, not that she is signed
    // out — her account is real and `/auth/session` will say so.
  }

  return { session: await serverSession(), shell: null };
});
