/**
 * Navigation rail geometry, on every route in both modules.
 *
 * Exists because a collapsed rail once shipped with its icons pushed out of
 * view on every single page — `visibility: hidden` keeps an element's box, so a
 * zero-opacity label with `flex-1` still ate the row. 84 feature checks were
 * passing at the time; it was caught by a person looking at a screenshot.
 *
 * These assertions are about geometry a person would notice, not about whether
 * a feature "works".
 */
import { createRequire } from "module";
import { APP, launch, pageAs, staffToken, memberToken } from "./_shared.mjs";
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

const audit = (page) => page.evaluate(() => {
  const aside = document.querySelector("aside");
  if (!aside) return { noRail: true };
  const railEl = aside.querySelector(".wc-rail") || aside;
  const rail = railEl.getBoundingClientRect();

  // Chevrons carry `.wc-rail-label` and collapse to zero on purpose.
  const icons = [...aside.querySelectorAll("nav svg")]
    .filter((s) => !s.classList.contains("wc-rail-label") && !s.closest(".wc-rail-label"));

  const clipped = icons.filter((s) => {
    const r = s.getBoundingClientRect();
    return r.width < 8 || r.left < rail.left - 1 || r.right > rail.right + 1;
  }).length;

  // Icons must share one centre line. Two centres is the zig-zag that a
  // zero-width label's leftover flex GAP produces.
  const centres = new Set(icons.map((s) => {
    const r = s.getBoundingClientRect();
    return Math.round((r.left + r.width / 2) * 2) / 2;
  }));

  const invisible = (el) => {
    for (let n = el; n && n !== document.body; n = n.parentElement) {
      const c = getComputedStyle(n);
      if (c.opacity === "0" || c.display === "none" || c.visibility === "hidden") return true;
    }
    return false;
  };
  const spill = [...aside.querySelectorAll("*")].filter((el) => {
    const r = el.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) return false;
    if (getComputedStyle(el).position === "fixed") return false;
    if (el.ownerSVGElement || invisible(el)) return false;
    for (let n = el.parentElement; n && n !== document.body; n = n.parentElement) {
      const ox = getComputedStyle(n).overflowX;
      if ((ox === "hidden" || ox === "auto" || ox === "clip") &&
          n.getBoundingClientRect().right <= rail.right + 2) return false;
      if (n === railEl) break;
    }
    return r.right > rail.right + 2;
  }).length;

  return { railW: Math.round(rail.width), icons: icons.length, clipped, spill, centres: centres.size };
});

const staff = await staffToken();
const member = await memberToken(staff);
const browser = await launch();
const problems = [];
let checked = 0;

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
      await new Promise((r) => setTimeout(r, 500));
      const a = await audit(p);
      checked++;
      const where = `${mod} ${route}`;
      if (a.noRail) { problems.push(`${where}: no rail`); continue; }
      if (a.icons < 4) problems.push(`${where}: only ${a.icons} nav icons`);
      if (a.clipped) problems.push(`${where}: ${a.clipped} clipped icons`);
      if (a.spill) problems.push(`${where}: ${a.spill} elements painting past the rail edge`);
      if (a.centres > 1) problems.push(`${where}: icons on ${a.centres} centre lines — not aligned`);
    } catch (e) {
      problems.push(`${mod} ${route}: FAILED TO LOAD`);
    }
  }
  await p.close();
}
await browser.close();

console.log(`\n  ${checked} routes checked`);
if (!problems.length) console.log("  \x1b[32mrail is correct on every route\x1b[0m\n");
else {
  console.log(`  \x1b[31m${problems.length} problems\x1b[0m`);
  problems.slice(0, 15).forEach((x) => console.log("   ·", x));
}
process.exit(problems.length ? 1 : 0);
