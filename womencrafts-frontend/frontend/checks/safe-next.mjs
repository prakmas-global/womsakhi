/**
 * `?next=` may only ever land her on this site. Run: node checks/safe-next.mjs
 *
 * Inputs are what `URLSearchParams.get("next")` hands the sign-in page, i.e.
 * ALREADY percent-decoded once: `?next=/%09/evil.com` arrives as "/\t/evil.com",
 * which the browser would otherwise turn into `//evil.com`. Both the decoded
 * and the still-encoded spellings are checked.
 */
import assert from "node:assert/strict";

import { safeNext } from "../src/lib/safe-next.ts";

const ORIGIN = "https://app.womsakhi.com";
const decoded = (query) => new URLSearchParams(query).get("next");

const cases = [
  ["/app", "/app"],
  ["/app?x=1#y", "/app?x=1#y"],
  ["/dashboard/users?tab=roles", "/dashboard/users?tab=roles"],
  ["//evil.com", ""],
  ["/\\evil.com", ""],
  ["/%09/evil.com", ""],                       // still encoded
  [decoded("next=/%09/evil.com"), ""],         // as the page receives it: "/\t/evil.com"
  [decoded("next=/%0a/evil.com"), ""],
  [decoded("next=/%5Cevil.com"), ""],          // "/\evil.com"
  ["https://evil.com", ""],
  ["https://app.womsakhi.com/app", ""],        // absolute, even our own: not a path
  ["javascript:alert(1)", ""],
  ["/javascript:alert(1)", "/javascript:alert(1)"], // a same-origin path, harmless
  ["", ""],
  [null, ""],
  [undefined, ""],
];

let failed = 0;
for (const [input, want] of cases) {
  const got = safeNext(input, ORIGIN);
  try {
    assert.equal(got, want);
    console.log(`  ok   ${JSON.stringify(input)} -> ${JSON.stringify(got)}`);
  } catch {
    failed += 1;
    console.log(`  FAIL ${JSON.stringify(input)} -> ${JSON.stringify(got)} (want ${JSON.stringify(want)})`);
  }
  // Whatever it returns must resolve to our own origin.
  if (got) assert.equal(new URL(got, ORIGIN).origin, ORIGIN);
}
if (failed) {
  console.log(`\n  ${failed} case(s) failed`);
  process.exit(1);
}
console.log(`\n  ${cases.length} cases, all same-origin or refused`);
