/**
 * Every GET endpoint, exercised against real seeded data.
 *
 * Written after two fixtures shipped that did not match their response schema:
 * `backups.collections` was an int where a list was declared, and
 * `certificates.hours` an int where a string was declared. Both returned 500 —
 * and both were invisible until the collection had rows, because an empty
 * collection never reaches the serialiser.
 *
 * The browser sweep did not catch either: the frontend swallows a failed fetch
 * and renders an empty state, which looks identical to "no data yet".
 *
 * So this asks the API directly, and treats a 500 as what it is.
 */
import { API, staffToken, seededMemberToken } from "./_shared.mjs";

const staff = await staffToken();
const member = await seededMemberToken();
if (!staff) { console.log("  cannot sign in as staff — is the API running?"); process.exit(2); }

const spec = await fetch(API.replace(/\/api\/v1$/, "") + "/openapi.json").then((r) => r.json());

// GET endpoints with no path parameters: the ones that should work on any
// database with data in it.
const paths = Object.entries(spec.paths ?? {})
  .filter(([p, ops]) => ops.get && !p.includes("{"))
  .map(([p]) => p.replace(/^\/api\/v1/, ""))
  .filter((p) => !/logout|signout|download|\/file$/.test(p));

const results = { ok: 0, auth: 0, notFound: [], failed: [] };
for (const path of paths) {
  // Member endpoints need a member; everything else gets the staff token.
  const token = path.startsWith("/me") || path.startsWith("/catalog") ? member : staff;
  if (!token) continue;
  try {
    const res = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${token}` } });
    if (res.status >= 500) {
      const body = (await res.text()).slice(0, 100);
      results.failed.push(`${res.status}  ${path}  ${body}`);
    } else if (res.status === 404) results.notFound.push(path);
    else if (res.status === 401 || res.status === 403) results.auth++;
    else results.ok++;
  } catch (e) {
    results.failed.push(`ERR  ${path}  ${String(e).slice(0, 60)}`);
  }
}

console.log(`\n  ${paths.length} GET endpoints exercised`);
console.log(`   ${String(results.ok).padStart(4)} ok`);
console.log(`   ${String(results.auth).padStart(4)} auth-gated (expected for staff-only paths)`);
// A bare count told me two endpoints 404 and nothing about WHICH — and a 404
// is either a route that moved (a bug the frontend will hit) or a path this
// check invented. Those need opposite responses, so it has to name them.
//
// The two standing entries are `/` and `/health`, which the server serves at
// its ROOT rather than under /api/v1. This check prefixes every path, so it
// asks for /api/v1/health and is correctly told there is nothing there. They
// are artefacts of how paths are derived, not broken routes.
console.log(`   ${String(results.notFound.length).padStart(4)} not found`);
results.notFound.forEach((p) => console.log(`        ${p}`));
if (results.failed.length) {
  console.log(`   \x1b[31m${String(results.failed.length).padStart(4)} SERVER ERRORS\x1b[0m`);
  results.failed.slice(0, 12).forEach((f) => console.log("      " + f));
} else {
  console.log("   \x1b[32m   0 server errors\x1b[0m");
}
console.log();
process.exit(results.failed.length ? 1 : 0);
