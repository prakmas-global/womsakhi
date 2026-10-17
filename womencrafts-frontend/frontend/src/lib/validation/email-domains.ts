/**
 * Addresses that are well formed but can never get her a code: throwaway
 * inboxes and a mistyped ".com". At join the server also looks the domain up
 * (app/core/email_domain.py) and turns away one that takes no mail; this is
 * what can be told at once, without a lookup. (Reserved domains such as
 * example.com are left to that lookup: the demo accounts sign in with them.)
 */

/** Same list as DISPOSABLE in app/core/email_domain.py. */
const THROWAWAY = new Set([
  "guerrillamail.com", "guerrillamail.net", "sharklasers.com",
  "10minutemail.com", "10minutemail.net", "tempmail.com", "temp-mail.org",
  "tempmailo.com", "tempmail.net", "throwawaymail.com", "yopmail.com",
  "yopmail.net", "getnada.com", "nada.email", "trashmail.com", "dispostable.com",
  "maildrop.cc", "mailnesia.com", "fakeinbox.com", "moakt.com", "emailondeck.com",
  "mintemail.com", "mohmal.com", "burnermail.io", "spamgourmet.com", "mailcatch.com",
  "tempinbox.com", "trashmail.de", "inboxkitten.com", "emailfake.com", "fakemail.net",
]);

/** Endings that are a slip for ".com" — none is a real top-level domain. */
const COM_SLIPS = new Set(["con", "cmo", "cpm", "comm", "coom", "ocm", "vom", "xom", "cim", "cok", "comn"]);

/** Why this (well-formed, lower-case) address can't be used, or null. */
export function emailDomainProblem(address: string): string | null {
  const at = address.lastIndexOf("@");
  const local = address.slice(0, at);
  const domain = address.slice(at + 1);
  if (local.length > 64) return "The part before @ is too long";
  if (THROWAWAY.has(domain)) return "Temporary inboxes can't be used. Please use your own email address.";
  if (COM_SLIPS.has(domain.slice(domain.lastIndexOf(".") + 1))) return "Check the end of your email. Did you mean .com?";
  return null;
}
