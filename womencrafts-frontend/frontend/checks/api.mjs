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

const origin = API.replace(/\/api\/v1$/, "");
const spec = await fetch(origin + "/openapi.json").then((r) => r.json());

// GET endpoints with no path parameters: the ones that should work on any
// database with data in it.
const paths = Object.entries(spec.paths ?? {})
  .filter(([p, ops]) => ops.get && !p.includes("{"))
  .map(([p]) => p)
  .filter((p) => !/logout|signout|download|\/file$/.test(p));

const results = { ok: 0, auth: [], validation: [], notFound: [], failed: [] };
const today = new Date().toISOString().slice(0, 10);
const queries = {
  "/api/v1/staff/scope-options": { kind: "region" },
  "/api/v1/work/talent": { skills: "blouse_stitching" },
  "/api/v1/calendar/agenda": { start: today, end: today },
  "/api/v1/masters": { lists: "circle_topics,circle_tags" },
  "/api/v1/me/health/entries": { kind: "reminder" },
};
for (const path of paths) {
  try {
    // Both audiences have routes outside /me. Try the other audience on an
    // access refusal so a member-only module is actually exercised.
    const tokens = /^\/api\/v1\/(me|catalog)(\/|$)/.test(path) ? [member, staff] : [staff, member];
    let res;
    const url = new URL(`${origin}${path}`);
    for (const [key, value] of Object.entries(queries[path] || {})) url.searchParams.set(key, value);
    for (const token of tokens.filter(Boolean)) {
      res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (![401, 403].includes(res.status)) break;
      await res.arrayBuffer();
    }
    if (!res) throw new Error("No audit session available");
    if (res.status >= 500) {
      const body = (await res.text()).slice(0, 100);
      results.failed.push(`${res.status}  ${path}  ${body}`);
    } else if (res.status === 404) results.notFound.push(path);
    else if (res.status === 401 || res.status === 403) results.auth.push(path);
    else if (res.status === 422) results.validation.push(path);
    else if (res.ok) results.ok++;
    else results.failed.push(`${res.status}  ${path}  ${(await res.text()).slice(0, 100)}`);
  } catch (e) {
    results.failed.push(`ERR  ${path}  ${String(e).slice(0, 60)}`);
  }
}

console.log(`\n  ${paths.length} GET endpoints exercised`);
console.log(`   ${String(results.ok).padStart(4)} ok`);
console.log(`   ${String(results.auth.length).padStart(4)} access-gated for both audit accounts`);
results.auth.forEach((p) => console.log(`        ${p}`));
console.log(`   ${String(results.validation.length).padStart(4)} require query parameters (not counted as successful)`);
results.validation.forEach((p) => console.log(`        ${p}`));
// A bare count told me two endpoints 404 and nothing about WHICH — and a 404
// is either a route that moved (a bug the frontend will hit) or a path this
// check invented. Those need opposite responses, so it has to name them.
//
// Keep the original OpenAPI path so root health routes are checked correctly.
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
