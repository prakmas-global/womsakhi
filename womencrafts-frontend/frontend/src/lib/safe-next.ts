/**
 * Where `?next=` may send her after signing in: a path on THIS site, or "".
 *
 * String checks were not enough. `/%09/evil.com` passes "starts with / and not
 * //", and then the browser strips the tab when it parses the URL, leaving
 * `//evil.com`: a protocol-relative URL to somebody else's site, reached from
 * a genuine WomSakhi sign-in link. So the value is parsed the way the browser
 * will parse it, and only the path, query and hash of a same-origin result are
 * kept. Anything with a control character or a backslash is refused before
 * parsing, because those are exactly the characters browsers quietly rewrite.
 *
 * `origin` defaults to the current page's; pass it explicitly to use this
 * outside a browser (tests, server code).
 */
export function safeNext(raw: string | null | undefined, origin?: string): string {
  if (!raw) return "";
  const value = String(raw);
  // Must be a path to begin with: no scheme, no host, no protocol-relative.
  if (!value.startsWith("/")) return "";
  // Control characters (tab, newline, NUL, DEL, …) and backslashes, raw or
  // percent-encoded. Browsers drop or rewrite these while parsing, which is
  // how an innocent-looking path turns into another host.
  for (let i = 0; i < value.length; i += 1) {
    const c = value.charCodeAt(i);
    if (c < 0x20 || c === 0x7f || c === 0x5c) return "";
  }
  if (/%(0[0-9a-f]|1[0-9a-f]|7f|5c)/i.test(value)) return "";
  const base = origin ?? (typeof window !== "undefined" ? window.location.origin : "");
  if (!base) return "";
  let url: URL;
  try {
    url = new URL(value, base);
  } catch {
    return "";
  }
  if (url.origin !== new URL(base).origin) return "";
  const path = url.pathname + url.search + url.hash;
  // Belt and braces: the result itself must not be protocol-relative.
  return path.startsWith("//") ? "" : path;
}
