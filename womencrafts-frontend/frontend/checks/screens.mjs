/**
 * Every route in both modules, desktop and phone.
 *
 * Checks the things a person would notice or be blocked by: contrast, missing
 * accessible names, unlabelled inputs, horizontal overflow, stuck loaders and
 * console errors. Routes come from the file tree so a screen cannot be missed
 * by being forgotten in a hand-written list.
 */
import { createRequire } from "module";
import { APP, launch, pageAs, staffToken, memberToken, seededMemberToken, measureContrast } from "./_shared.mjs";
const require = createRequire(import.meta.url);
const _fs = require("fs");

/**
 * These checks change the signed-in account's theme, so two of them running at
 * once measure each other's colours. Observed as 4 phantom contrast failures
 * that vanished on a clean run.
 */
const LOCK = "/tmp/womsakhi-checks.lock";
function acquireLock(who) {
  for (let i = 0; i < 600; i++) {
    try { _fs.writeFileSync(LOCK, who, { flag: "wx" }); return; }
    catch { if (i === 0) console.log(`  waiting for ${_fs.readFileSync(LOCK, "utf8")} to finish…`);
            Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1000); }
  }
  throw new Error("timed out waiting for the check lock");
}
acquireLock("screens");
const releaseLock = () => { try { _fs.unlinkSync(LOCK); } catch {} };
process.on("exit", releaseLock);
process.on("SIGINT", () => { releaseLock(); process.exit(1); });
const fs = require("fs"), path = require("path");

const walk = (dir, base) => {
  let out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name.startsWith("[")) continue; out = out.concat(walk(p, `${base}/${e.name}`)); }
    else if (e.name === "page.tsx") out.push(base || "/");
  }
  return out;
};
const ADMIN = walk("src/app/dashboard", "/dashboard");
const MEMBER = walk("src/app/app", "/app");
const scope = process.env.CHECK_SCOPE || "all";

const inspect = (page) => page.evaluate(() => {
  const vis = (el) => {
    const r = el.getBoundingClientRect(); if (r.width < 1 || r.height < 1) return false;
    for (let n = el; n && n !== document.body; n = n.parentElement) {
      const c = getComputedStyle(n);
      if (c.display === "none" || c.visibility === "hidden" || c.opacity === "0") return false;
    } return true;
  };
  const unnamed = [...document.querySelectorAll("button,a[href]")].filter((el) =>
    vis(el) && !(el.getAttribute("aria-label") || el.getAttribute("title") || el.textContent || "").trim()).length;
  const unlabelled = [...document.querySelectorAll("input,select,textarea")].filter((el) => {
    if (!vis(el) || el.type === "hidden") return false;
    if (el.getAttribute("aria-label") || el.getAttribute("placeholder") || el.getAttribute("aria-labelledby")) return false;
    return !(el.id && document.querySelector(`label[for="${CSS.escape(el.id)}"]`));
  }).length;
  const stuck = [...document.querySelectorAll('.wc-skeleton,[class*="animate-pulse"],[class*="animate-spin"]')].filter(vis).length;

  /**
   * Heading structure is how a screen-reader user skims a page — jump by
   * heading, get the shape of it, dive in. That only works if the levels
   * describe a real outline.
   *
   * Two things break it: no <h1>, so the page has no title to land on; and a
   * skipped level (h2 → h4), which implies a section that does not exist and
   * leaves the listener guessing what they missed.
   */
  const levels = [...document.querySelectorAll("h1,h2,h3,h4,h5,h6")]
    .filter(vis)
    .map((h) => Number(h.tagName[1]));
  let skipped = 0;
  for (let i = 1; i < levels.length; i++) {
    if (levels[i] > levels[i - 1] + 1) skipped++;
  }

  return {
    overflow: document.body.scrollWidth > window.innerWidth + 2,
    unnamed, unlabelled, stuck,
    h1: levels.filter((l) => l === 1).length,
    skipped,
    // A <main> gives "skip to content" somewhere to go, and lets a screen
    // reader jump past the nav that repeats on all 76 screens.
    main: !!document.querySelector("main"),
    textLen: ((document.querySelector("main") || document.body).innerText || "").trim().length,
  };
});

const staff = await staffToken();
const member = process.env.MEMBER_FIXTURE === "seeded"
  ? await seededMemberToken()
  : await memberToken(staff);
const problems = [];
let checked = 0, contrastTotal = 0, revivals = 0;

// Contrast is measured in BOTH modes. Dark is not a variant of light here —
// the tokens are derived separately per mode, so a value that reads on a pale
// card says nothing about the same token on a dark one.
for (const [mod, tok, list] of [["admin", staff, ADMIN], ["member", member, MEMBER]]) {
  if (scope !== "all" && scope !== mod) continue;
  if (!tok) continue;
  for (const vp of [
    { width: 1600, height: 1000, name: "desktop", mode: "light" },
    { width: 1600, height: 1000, name: "desktop-dark", mode: "dark" },
    { width: 390, height: 844, name: "phone", mode: "light" },
  ]) {
    // A fresh browser per pass. One Chrome across 228 page loads exhausts
    // itself and drops the CDP connection — and before it dies outright it
    // degrades: `inspect()` starts returning zeros and every page looks like it
    // is still loading. That produced a run reporting 99 "stuck loaders" and
    // zero accessibility problems, both false, on screens that settle in under
    // a second when measured on their own.
    /**
     * Chrome dies on long sweeps, and when it does it takes the whole check
     * with it — `socket hang up` / `ECONNRESET` / close code 1006, three
     * separate runs now. A fresh browser per pass helped but did not stop it:
     * one pass is still 76 page loads.
     *
     * So a dead browser is treated as an expected event, not a fatal one. The
     * connection is replaced and the sweep carries on from the route it died
     * on. Losing the whole run to a crash at screen 200 of 228 means the check
     * only reports on lucky days, and a check you re-roll until it passes is
     * not a check.
     */
    let browser = await launch();
    let p = await pageAs(browser, tok, vp);
    const dead = (e) =>
      /socket hang up|ECONNRESET|Connection closed|Target closed|Session closed|browser has disconnected/i
        .test(String(e));
    const revive = async () => {
      revivals++;
      try { await browser.close(); } catch {}
      browser = await launch();
      p = await pageAs(browser, tok, vp);
    };

    for (const route of list) {
      if (route.endsWith("/logout")) continue; // deliberately navigates away
      const errs = [];
      const onErr = (e) => errs.push(String(e));
      const onMsg = (m) => { if (m.type() === "error") errs.push(m.text()); };
      p.on("pageerror", onErr); p.on("console", onMsg);
      try {
        await p.goto(`${APP}${route}`, { waitUntil: "networkidle2", timeout: 30000 });
        // Wait for the page to actually settle rather than for a fixed delay.
        //
        // A flat 700ms was fine when collections held a handful of rows. Once
        // they held realistic volumes the same pages were still fetching at
        // that mark, and the check reported 89 "stuck loaders" across 73
        // screens — every one of which resolved a second later. It was
        // measuring "slow", and calling it "broken".
        //
        // Now it polls until nothing is loading, up to a generous ceiling. A
        // loader still spinning after that really is stuck, and worth a report.
        await p.waitForFunction(() => {
          const visible = (el) => {
            const r = el.getBoundingClientRect();
            return r.width > 0 && r.height > 0;
          };
          return ![...document.querySelectorAll(
            '.wc-skeleton,[class*="animate-pulse"],[class*="animate-spin"]'
          )].some(visible);
        }, { timeout: 6000 }).catch(() => {});
        await new Promise((r) => setTimeout(r, 250));
        const d = await inspect(p);
        checked++;
        const where = `${mod} ${vp.name} ${route}`;
        if (d.unnamed) problems.push(`${where}: ${d.unnamed} controls with no accessible name`);
        if (d.unlabelled) problems.push(`${where}: ${d.unlabelled} unlabelled inputs`);
        if (d.stuck) problems.push(`${where}: ${d.stuck} stuck loaders`);
        // Structure is measured once per screen, on desktop. It is the same
        // markup at every width, so checking it three times would treble the
        // count of a single fault and make the totals read worse than reality.
        if (vp.name === "desktop") {
          if (d.h1 === 0) problems.push(`${where}: no <h1> — the page has no title to land on`);
          if (d.h1 > 1) problems.push(`${where}: ${d.h1} <h1> elements — only one can be the page title`);
          if (d.skipped) problems.push(`${where}: ${d.skipped} skipped heading levels`);
          if (!d.main) problems.push(`${where}: no <main> landmark`);
        }
        if (vp.name.startsWith("desktop")) {
          const bad = await measureContrast(p);
          const n = Object.values(bad).reduce((a, b) => a + b, 0);
          contrastTotal += n;
          if (n) problems.push(`${where}: ${n} contrast failures — ${Object.keys(bad)[0]}`);
        }
        const real = errs.filter((e) => !/Warning:/i.test(e));
        if (real.length) problems.push(`${where}: ${real.length} console errors — ${real[0].slice(0, 90)}`);
      } catch (e) {
        if (dead(e)) {
          // Not this screen's fault — the browser went away underneath it.
          await revive();
          try {
            await p.goto(`${APP}${route}`, { waitUntil: "networkidle2", timeout: 30000 });
            await new Promise((r) => setTimeout(r, 400));
            const d = await inspect(p);
            checked++;
            if (d.unnamed) problems.push(`${mod} ${vp.name} ${route}: ${d.unnamed} controls with no accessible name`);
            if (d.unlabelled) problems.push(`${mod} ${vp.name} ${route}: ${d.unlabelled} unlabelled inputs`);
          } catch (again) {
            problems.push(`${mod} ${vp.name} ${route}: FAILED TO LOAD after a browser restart — ${String(again).slice(0, 60)}`);
          }
        } else {
          problems.push(`${mod} ${vp.name} ${route}: FAILED TO LOAD — ${String(e).slice(0, 60)}`);
        }
      }
      p.off("pageerror", onErr); p.off("console", onMsg);
    }
    await p.close().catch(() => {});
    await browser.close().catch(() => {});
  }
}

console.log(`\n  ${checked} screen×viewport combinations checked`);
fs.writeFileSync("checks/_screens.json", JSON.stringify({ checked, contrastTotal, revivals, problems }, null, 2));
// Reported, never hidden: a run that needed three browser restarts is
// still a valid run, but you should know the machine was struggling.
if (revivals) console.log(`  ${revivals} browser restart(s) after a crash`);
console.log(`  contrast failures across all screens: ${contrastTotal}`);
if (!problems.length) console.log(`  \x1b[32mno problems\x1b[0m\n`);
else {
  console.log(`  \x1b[31m${problems.length} problems\x1b[0m\n`);
  // Grouped by kind first — 150 individual lines tell you nothing, whereas
  // "430 unnamed controls" tells you what to go and fix.
  const byKind = {};
  for (const x of problems) {
    // Drop the "admin desktop /route: " prefix, then any leading count, then
    // any trailing detail. Without dropping the prefix, findings that carry no
    // number (a missing <h1>) kept the route in the key and every screen
    // became its own category — 40 groups of one instead of one group of 40.
    const kind = x
      .replace(/^\w+ [\w-]+ \S+: /, "")
      .replace(/^\d+ /, "")
      .replace(/ —.*$/, "")
      .replace(/^FAILED.*/, "failed to load");
    byKind[kind] = byKind[kind] || { lines: 0, count: 0 };
    byKind[kind].lines++;
    byKind[kind].count += Number(x.match(/: (\d+) /)?.[1] ?? 1);
  }
  for (const [kind, v] of Object.entries(byKind).sort((a, b) => b[1].count - a[1].count))
    console.log(`   ${String(v.count).padStart(5)} ${kind}  (on ${v.lines} screens)`);
  console.log("\n   worst screens:");
  problems.slice().sort((a, b) => Number(b.match(/: (\d+) /)?.[1] ?? 0) - Number(a.match(/: (\d+) /)?.[1] ?? 0))
    .slice(0, 8).forEach((x) => console.log("    ·", x));
}
process.exit(problems.length ? 1 : 0);
