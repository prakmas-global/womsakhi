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
import { readFileSync, readdirSync, statSync } from "fs";

const DIR = "src/i18n/messages";
const read = (f) => readFileSync(`${DIR}/${f}`, "utf8");
const keysIn = (s) => new Set([...s.matchAll(/"([a-zA-Z0-9_.]+)":\s*"/g)].map((m) => m[1]));

const enSrc = read("en.ts");
const chromeStart  = enSrc.indexOf("const chrome = {");
const screensStart = enSrc.indexOf("const screens = {");
const coreKeys   = keysIn(enSrc.slice(0, chromeStart));
const chromeKeys = keysIn(enSrc.slice(chromeStart, screensStart));
const screenKeys = keysIn(enSrc.slice(screensStart));
const optional   = new Set([...chromeKeys, ...screenKeys]);

let bad = 0;

// ── nav.ts keys must resolve ────────────────────────────────────────────────
// `k` is a base: the label is at `${k}.label`, the hint at `${k}.note`.
const nav = readFileSync("src/components/ux/nav.ts", "utf8");
const navKeys = [...nav.matchAll(/k:\s*"([a-zA-Z0-9_.]+)"/g)].map((m) => m[1]);
const dangling = navKeys.filter((k) => !chromeKeys.has(`${k}.label`));
if (dangling.length) {
  bad++;
  console.log(` FAIL  ${dangling.length} nav key(s) have no .label in en.ts: ${dangling.slice(0, 5).join(", ")}`);
} else {
  console.log(` ok    all ${navKeys.length} nav keys resolve`);
}

// ── every key the code asks for must exist ──────────────────────────────────
// `t()` falls back to returning the key itself, so a typo does not throw — it
// renders "ch.today" on screen where a woman expects a word. That shipped once.
const all = new Set([...coreKeys, ...optional]);
{
  const src = [];
  (function walk(d) {
    for (const e of readdirSync(d)) {
      if (e === "node_modules" || e === ".next") continue;
      const p = `${d}/${e}`;
      if (statSync(p).isDirectory()) walk(p);
      else if (p.endsWith(".tsx") || p.endsWith(".ts")) src.push(p);
    }
  })("src");

  const missing = new Map();
  for (const f of src) {
    if (f.includes("/i18n/messages/")) continue;
    const text = readFileSync(f, "utf8");
    for (const m of text.matchAll(/\b(?:t|tr)\(\s*"([a-zA-Z0-9_.]+)"/g)) {
      if (!all.has(m[1])) missing.set(m[1], f);
    }
  }
  if (missing.size) {
    bad++;
    console.log(`\n FAIL  ${missing.size} key(s) used in code but absent from en.ts:`);
    for (const [k, f] of [...missing].slice(0, 12)) console.log(`   ${k}  (${f})`);
  } else {
    console.log(" ok    every key used in code exists in en.ts");
  }
}

// ── per language ────────────────────────────────────────────────────────────
console.log(`\n  core ${coreKeys.size} required · chrome ${chromeKeys.size} + screens ${screenKeys.size} optional\n`);
console.log("  lang   core       nav          screens");

const files = readdirSync(DIR).filter((f) => f.endsWith(".ts") && f !== "en.ts").sort();
const partial = [];

for (const f of files) {
  const have = keysIn(read(f));
  const core = [...coreKeys].filter((k) => have.has(k)).length;
  const chrome = [...chromeKeys].filter((k) => have.has(k)).length;
  const screen = [...screenKeys].filter((k) => have.has(k)).length;
  const lang = f.replace(".ts", "");

  if (core < coreKeys.size) {
    bad++;
    console.log(`  ${lang.padEnd(6)} ${String(core).padStart(3)}/${coreKeys.size}  MISSING   —  core is compile-enforced`);
    continue;
  }
  const bar = (n, d) => {
    const pct = Math.round((n / d) * 100);
    return `${"█".repeat(Math.round(pct / 10)).padEnd(10, "·")} ${String(pct).padStart(3)}%`;
  };
  console.log(`  ${lang.padEnd(6)} ${String(core).padStart(3)}/${coreKeys.size}  ${bar(chrome, chromeKeys.size)}  ${bar(screen, screenKeys.size)}`);
  if (chrome === 0 && screen === 0) partial.push(lang);
}

if (partial.length) {
  console.log(`\n  ${partial.length} language(s) fall back to English entirely: ${partial.join(", ")}`);
  console.log("  That is the designed behaviour, not a failure — they need a native reviewer.");
}

console.log(bad ? `\n FAIL  ${bad} problem(s)` : "\n PASS");
process.exit(bad ? 1 : 0);
