/**
 * "Did you mean gmail.com?" — catches the slip that makes a sign-in code
 * "not match": a mistyped provider. Only well-known consumer domains are
 * suggested, so a real company address is never second-guessed.
 */
const KNOWN = [
  "gmail.com", "yahoo.com", "yahoo.co.in", "outlook.com", "hotmail.com", "live.com",
  "icloud.com", "rediffmail.com", "protonmail.com", "zoho.com", "aol.com", "womsakhi.com",
];

/** Levenshtein distance, early-out beyond `max`. */
function distance(a: string, b: string, max = 2): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      best = Math.min(best, cur[j]);
    }
    if (best > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}

/** The corrected address, or null when the domain looks right or unknown. */
export function suggestEmail(value: string): string | null {
  const at = value.lastIndexOf("@");
  if (at < 1) return null;
  const local = value.slice(0, at);
  const domain = value.slice(at + 1).trim().toLowerCase();
  if (!domain || KNOWN.includes(domain)) return null;
  let best: string | null = null;
  let bestD = 3;
  for (const k of KNOWN) {
    const d = distance(domain, k);
    if (d < bestD) { best = k; bestD = d; }
  }
  return best && bestD <= 2 ? `${local}@${best}` : null;
}
