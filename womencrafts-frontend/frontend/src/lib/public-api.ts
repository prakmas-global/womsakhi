import { apiBase } from "./api-base";
/**
 * The two things the sign-in page may ask the server before there is a session.
 *
 * Deliberately plain `fetch` rather than `apiClient`: that client carries
 * credentials and an auth interceptor, and these run for a stranger who has no
 * account. Neither call is allowed to break the page — a sign-in screen that
 * fails because a statistic did not load would be an absurd trade.
 */

const API_URL = apiBase();

/** Real counts. Every one is a `count_documents`, not a stored figure. */
export interface PublicStats {
  jobs?: number;
  courses?: number;
  members?: number;
  circles?: number;
}

export async function fetchPublicStats(): Promise<PublicStats> {
  const res = await fetch(`${API_URL}/public/stats`, { credentials: "omit" });
  if (!res.ok) throw new Error(`public stats: ${res.status}`);
  return res.json();
}

/**
 * Which social sign-ins actually work.
 *
 * Empty today: this backend knows only email and password. The sign-in page
 * renders exactly what this returns, so nothing decorative can appear — a
 * "Continue with Google" button that does nothing reads as a broken app on the
 * one screen where that costs you the person.
 */
export async function fetchAuthProviders(): Promise<string[]> {
  try {
    const res = await fetch(`${API_URL}/public/auth-providers`, { credentials: "omit" });
    if (!res.ok) return [];
    const data = (await res.json()) as { providers?: unknown };
    return Array.isArray(data.providers) ? data.providers.filter((p): p is string => typeof p === "string") : [];
  } catch {
    // Unreachable server: offer nothing rather than a button that cannot work.
    return [];
  }
}

/**
 * One thing a woman sells, read by somebody who has no account.
 *
 * Behind the link "Share" copies in My Shop. That button used to copy
 * `<origin>/shop/<id>` and say *"Link copied — send it on WhatsApp"* — and
 * there was no such route, so every one of those links was a 404 landing in a
 * customer's chat under her name.
 *
 * `credentials: "omit"` for the same reason as the two calls above: the reader
 * is a stranger, and a page that needs a session is a page her buyer cannot
 * open. It carries no phone number, no email and no seller id — see
 * `public_listing` in `app/routes/public.py`.
 */
export interface PublicListing {
  id: string;
  kind: "product" | "service";
  title: string;
  desc: string;
  /** MINOR units — paise. Render with `formatRupees`, never by dividing here. */
  price_minor: number;
  price_label: string;
  rate: string;
  out_of_stock: boolean;
  low_stock: boolean;
  category: string;
  place: string;
  photo: string;
  /** Her first name. Deliberately not her full one. */
  seller_first: string;
}

/** `null` means the page is genuinely not there — taken down, paused, or a
 *  mistyped link. The screen says so rather than showing an empty shape. */
export async function fetchPublicListing(id: string): Promise<PublicListing | null> {
  const res = await fetch(`${API_URL}/public/listings/${encodeURIComponent(id)}`,
                          { credentials: "omit" });
  if (!res.ok) return null;
  return res.json();
}
