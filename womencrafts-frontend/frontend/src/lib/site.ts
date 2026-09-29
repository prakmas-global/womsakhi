/**
 * The marketing website — www.womsakhi.com, a separate Next.js app.
 *
 * Terms, Privacy, Help, Contact and About live ONLY there: the app carries no
 * copy of them, and next.config.ts sends the old app paths (/terms, /privacy,
 * /contact, /help, /about) to the same path on the website. Anything in the
 * app that points at one of those pages builds its link here, so a domain
 * change is one environment variable.
 *
 * `NEXT_PUBLIC_*` is inlined at build time — set it for `next build`, not only
 * at runtime.
 */
export const WEBSITE_URL = (process.env.NEXT_PUBLIC_WEBSITE_URL || "https://www.womsakhi.com").replace(/\/+$/, "");

/** `websiteUrl("/terms")` → "https://www.womsakhi.com/terms". */
export function websiteUrl(path = "/"): string {
  return `${WEBSITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}
