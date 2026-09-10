/**
 * Lint, as a ratchet rather than a wall.
 *
 * The codebase carries 104 errors and 184 warnings that predate this pipeline,
 * almost all of them `react-hooks/set-state-in-effect`. Two options were
 * available and both are bad: `--max-warnings=0` blocks every pull request
 * until someone does a 288-problem cleanup, and `|| true` is a gate that
 * cannot fail and therefore is not a gate.
 *
 * So the number is recorded in `.eslint-baseline.json` and this fails only if
 * a branch makes it WORSE. New code is held to zero; the existing debt is
 * visible, counted, and shrinks whenever someone touches it — the baseline is
 * meant to be lowered, never raised.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const base = JSON.parse(readFileSync(new URL("../.eslint-baseline.json", import.meta.url), "utf8"));

let out = "";
try {
  out = execFileSync("npx", ["eslint", "src", "-f", "json"], { encoding: "utf8", maxBuffer: 64 << 20 });
} catch (e) {
  // eslint exits non-zero when it finds errors; the report is still on stdout.
  out = e.stdout || "";
}
if (!out.trim()) { console.error("eslint produced no report"); process.exit(1); }

const files = JSON.parse(out);
const now = {
  errors: files.reduce((n, f) => n + f.errorCount, 0),
  warnings: files.reduce((n, f) => n + f.warningCount, 0),
};

const worse = now.errors > base.errors || now.warnings > base.warnings;
console.log(`  errors   ${now.errors}  (baseline ${base.errors})`);
console.log(`  warnings ${now.warnings}  (baseline ${base.warnings})`);

if (worse) {
  console.log("\n  New lint problems were introduced. The worst offenders:");
  for (const f of files.filter((f) => f.errorCount)) {
    for (const m of f.messages.filter((m) => m.severity === 2).slice(0, 2)) {
      console.log(`    ${f.filePath.split("/frontend/")[1]}:${m.line}  ${m.ruleId}`);
    }
  }
  console.log("\n  Fix them, or if you genuinely removed some elsewhere, lower");
  console.log("  .eslint-baseline.json in the same commit and say why.");
  process.exit(1);
}

if (now.errors < base.errors || now.warnings < base.warnings) {
  writeFileSync(new URL("../.eslint-baseline.json", import.meta.url), JSON.stringify(now, null, 2) + "\n");
  console.log("\n  Improved. Commit the lowered .eslint-baseline.json so it stays lowered.");
}
console.log("\n  no new lint problems");
