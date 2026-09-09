/**
 * How much of the app each language actually covers — read from the files, in
 * under a second, so it can run on every commit.
 *
 * Two different things are measured, because they fail differently:
 *
 *   core   — compile-enforced. Every language must have every key, so a gap
 *            here means someone widened `Catalog` and broke the safety net.
 *   chrome — navigation labels and hints. Optional by design: a language shows
 *            English until a native speaker has been through it. A gap here is
 *            a to-do, not a bug, and this is what keeps it visible.
 *
 * It also checks the other direction — that every `k:` in nav.ts names a key
 * that exists — because a typo there renders the key itself on screen, which
 * looks like "ch.money.label" to her.
 */
import { readFileSync, readdirSync } from "fs";

const DIR = "src/i18n/messages";
const read = (f) => readFileSync(`${DIR}/${f}`, "utf8");
const keysIn = (s) => new Set([...s.matchAll(/"([a-zA-Z0-9_.]+)":\s*"/g)].map((m) => m[1]));

const enSrc = read("en.ts");
const chromeStart = enSrc.indexOf("const chrome = {");
const coreKeys = keysIn(enSrc.slice(0, chromeStart));
const chromeKeys = keysIn(enSrc.slice(chromeStart));

let bad = 0;

// ── nav.ts keys must resolve ────────────────────────────────────────────────
const nav = readFileSync("src/components/ux/nav.ts", "utf8");
const navKeys = [...nav.matchAll(/k:\s*"([a-zA-Z0-9_.]+)"/g)].map((m) => m[1]);
const dangling = navKeys.filter((k) => !chromeKeys.has(`${k}.label`) && !chromeKeys.has(k));
if (dangling.length) {
  bad++;
  console.log(` FAIL  ${dangling.length} nav key(s) name nothing in en.ts: ${dangling.slice(0, 5).join(", ")}`);
} else {
  console.log(` ok    all ${navKeys.length} nav keys resolve`);
}

// ── per language ────────────────────────────────────────────────────────────
console.log(`\n  core ${coreKeys.size} keys (required) · chrome ${chromeKeys.size} keys (optional)\n`);
console.log("  lang   core        chrome");

const files = readdirSync(DIR).filter((f) => f.endsWith(".ts") && f !== "en.ts").sort();
const partial = [];

for (const f of files) {
  const have = keysIn(read(f));
  const core = [...coreKeys].filter((k) => have.has(k)).length;
  const chrome = [...chromeKeys].filter((k) => have.has(k)).length;
  const lang = f.replace(".ts", "");

  if (core < coreKeys.size) {
    bad++;
    console.log(`  ${lang.padEnd(6)} ${String(core).padStart(3)}/${coreKeys.size}  MISSING   —  core is compile-enforced`);
    continue;
  }
  const pct = Math.round((chrome / chromeKeys.size) * 100);
  const bar = "█".repeat(Math.round(pct / 10)).padEnd(10, "·");
  console.log(`  ${lang.padEnd(6)} ${String(core).padStart(3)}/${coreKeys.size}  ${bar} ${String(pct).padStart(3)}%`);
  if (chrome === 0) partial.push(lang);
}

if (partial.length) {
  console.log(`\n  ${partial.length} language(s) fall back to English for navigation: ${partial.join(", ")}`);
  console.log("  That is the designed behaviour, not a failure — they need a native reviewer.");
}

console.log(bad ? `\n FAIL  ${bad} problem(s)` : "\n PASS");
process.exit(bad ? 1 : 0);
