/**
 * Routes that render the same thing (§103: no duplicate screens).
 *
 * Compares the visible text of every route, ignoring the shell, and reports
 * pairs that overlap heavily. Two screens a woman cannot tell apart are two
 * screens she has to choose between for no reason.
 */
import { launch, pageAs, seededMemberToken, APP } from "./_shared.mjs";
import { readdirSync, statSync } from "fs";
import { join } from "path";

const ROOT = "src/app/app";
const routes = [];
(function walk(d, r) {
  for (const e of readdirSync(d)) {
    const p = join(d, e);
    if (statSync(p).isDirectory()) walk(p, r + "/" + e);
    else if (e === "page.tsx" && !r.includes("[")) routes.push("/app" + r);
  }
})(ROOT, "");

const tok = await seededMemberToken();
const b = await launch();
const seen = [];

for (const r of routes) {
  const p = await pageAs(b, tok, { width: 1280, height: 900 });
  try {
    await p.goto(APP + r, { waitUntil: "domcontentloaded", timeout: 45000 });
    await new Promise(x => setTimeout(x, 550));
    // Main content only — every page shares the rail and top bar.
    const txt = await p.evaluate(() => {
      const main = document.querySelector("main") || document.body;
      const clone = main.cloneNode(true);
      clone.querySelectorAll("aside,nav,header").forEach(e => e.remove());
      return (clone.innerText || "").replace(/\s+/g, " ").trim().toLowerCase();
    });
    seen.push([r, txt]);
  } catch { /* covered by the render sweep */ }
  await p.close();
}
await b.close();

const words = (t) => new Set(t.split(" ").filter(w => w.length > 3));
const pairs = [];
for (let i = 0; i < seen.length; i++) {
  for (let j = i + 1; j < seen.length; j++) {
    const a = words(seen[i][1]), c = words(seen[j][1]);
    if (a.size < 25 || c.size < 25) continue;
    let shared = 0;
    for (const w of a) if (c.has(w)) shared++;
    const overlap = shared / Math.min(a.size, c.size);
    if (overlap > 0.72) pairs.push([overlap, seen[i][0], seen[j][0]]);
  }
}
pairs.sort((x, y) => y[0] - x[0]);
console.log(`compared ${seen.length} routes\n`);
if (!pairs.length) console.log("  no near-duplicate screens");
for (const [o, a, c] of pairs.slice(0, 12)) console.log(`  ${(o * 100).toFixed(0)}%  ${a}  ≈  ${c}`);
