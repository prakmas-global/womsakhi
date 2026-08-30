/**
 * Empty, loading and error states.
 *
 * The failure this is written against is subtle and was live for months: when a
 * request failed, a list screen caught the error, fell through to its empty
 * state, and told the user **"No members yet"**. Every stat read 0. Nothing
 * looked broken, so nobody reported it.
 *
 * So the important assertion is not "is there an empty state" — it is that a
 * FAILED request never looks like an EMPTY one.
 */
import { createRequire } from "module";
import { APP, launch, pageAs, staffToken, seededMemberToken } from "./_shared.mjs";
const require = createRequire(import.meta.url);
const fs = require("fs"), path = require("path");

const walk = (d, b) => {
  let o = [];
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const q = path.join(d, e.name);
    if (e.isDirectory()) { if (e.name.startsWith("[")) continue; o = o.concat(walk(q, `${b}/${e.name}`)); }
    else if (e.name === "page.tsx") o.push(b || "/");
  }
  return o;
};

const staff = await staffToken();
const member = await seededMemberToken();
const problems = [];
let checked = 0;

// ── 1. A failed request must be visible ─────────────────────────────────────
{
  const browser = await launch();
  const p = await pageAs(browser, staff);
  await p.setRequestInterception(true);
  p.on("request", (req) => {
    const u = req.url();
    if (u.includes("/api/v1/") && !u.includes("/auth/")) req.abort("failed");
    else req.continue();
  });

  for (const route of ["/dashboard/users", "/dashboard/services", "/dashboard/programs"]) {
    try {
      await p.goto(`${APP}${route}`, { waitUntil: "networkidle2", timeout: 25000 });
    } catch { /* aborted requests are the point */ }
    await new Promise((r) => setTimeout(r, 2500));
    const told = await p.evaluate(() => !!document.querySelector("[data-connection-banner]"));
    checked++;
    if (!told) problems.push(`${route}: request failed and the app said nothing — the empty state looks like real data`);
  }
  await p.close().catch(() => {});
  await browser.close().catch(() => {});
}

// ── 2. A screen with data must not render an empty state ────────────────────
{
  const browser = await launch();
  for (const [mod, tok, routes] of [
    ["admin", staff, walk("src/app/dashboard", "/dashboard")],
    ["member", member, walk("src/app/app", "/app")],
  ]) {
    if (!tok) continue;
    const p = await pageAs(browser, tok);
    for (const route of routes) {
      if (route.endsWith("/logout")) continue;
      try {
        await p.goto(`${APP}${route}`, { waitUntil: "networkidle2", timeout: 25000 });
        await p.waitForFunction(() => ![...document.querySelectorAll(
          '.wc-skeleton,[class*="animate-pulse"],[class*="animate-spin"]')]
          .some((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; }),
          { timeout: 6000 }).catch(() => {});
        await new Promise((r) => setTimeout(r, 200));
        checked++;
        const d = await p.evaluate(() => {
          const main = document.querySelector("main") || document.body;
          const text = (main.innerText || "").trim();
          return {
            chars: text.length,
            // An empty state that offers nothing leaves the user stuck.
            //
            // Scoped to a screen that is ACTUALLY empty. The first version
            // matched any "No … yet" anywhere in the page, which caught the
            // verification screen's tab labels ("No ID yet", "Unconfirmed
            // email") and reported a screen showing six applicants as empty.
            bareEmpty: text.length < 400
              && /No [a-z ]+ (yet|found|match)/i.test(text)
              && !/clear filter|try|add|create|browse|explore|get started/i.test(text),
          };
        });
        // Under 120 characters is not a designed empty state, it is a blank page.
        if (d.chars < 120) problems.push(`${mod} ${route}: renders only ${d.chars} characters`);
        else if (d.bareEmpty) problems.push(`${mod} ${route}: empty state with no way forward`);
      } catch { problems.push(`${mod} ${route}: failed to load`); }
    }
    await p.close().catch(() => {});
  }
  await browser.close().catch(() => {});
}

console.log(`\n  ${checked} checks across empty, loading and error states`);
if (!problems.length) console.log("  \x1b[32mno problems\x1b[0m\n");
else {
  console.log(`  \x1b[31m${problems.length} problems\x1b[0m`);
  problems.slice(0, 20).forEach((x) => console.log("   ·", x));
}
process.exit(problems.length ? 1 : 0);
