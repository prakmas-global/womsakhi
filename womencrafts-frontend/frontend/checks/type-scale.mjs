/**
 * The type scale stays a scale.
 *
 * It did not, for a while: 36 distinct sizes written as arbitrary values, then
 * normalised to 12 — but still written out by hand at 2,203 call sites, with
 * the tokens that were meant to enforce them referenced exactly zero times.
 * A scale held by copy-paste drifts back the first time someone eyeballs a
 * heading, and the drift is invisible on screen while being obvious in a diff.
 *
 * Sizes now come from `@theme` in design-system/tokens.css, which Tailwind
 * turns into real utilities. This fails the build if an arbitrary one returns.
 */
import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";

const files = [];
(function walk(d) {
  for (const e of readdirSync(d)) {
    if (e === "node_modules" || e === ".next") continue;
    const p = join(d, e);
    if (statSync(p).isDirectory()) walk(p);
    else if (p.endsWith(".tsx") || p.endsWith(".ts")) files.push(p);
  }
})("src");

// `clamp()` is deliberate — a fluid heading is a range, not a step.
const ARBITRARY = /text-\[(?!clamp|length:var|var\()([^\]]+)\]/g;

const hits = [];
for (const f of files) {
  const src = readFileSync(f, "utf8");
  for (const m of src.matchAll(ARBITRARY)) {
    // Only sizes; text-[#fff] and text-[--var] are colour, checked elsewhere.
    if (!/^[0-9.]+(rem|px|em)$/.test(m[1])) continue;
    hits.push(`${f}:${src.slice(0, m.index).split("\n").length}  text-[${m[1]}]`);
  }
}

const named = readFileSync("src/design-system/tokens.css", "utf8")
  .match(/--text-[a-z0-9]+:/g) ?? [];
console.log(`  ${files.length} files scanned · ${named.length} custom steps in @theme`);

if (hits.length) {
  console.log(`\n FAIL  ${hits.length} arbitrary font size(s) — use a named step:\n`);
  for (const h of hits.slice(0, 20)) console.log(`   ${h}`);
  process.exit(1);
}
console.log(" PASS  no arbitrary font sizes");
