/**
 * Palette audit — run with: node src/theme-engine/__checks__/audit.mjs
 *
 * Every preset, and a set of deliberately hostile seeds, must produce a scale
 * that passes WCAG AA. This is what stops someone shipping a theme that makes
 * the app unreadable, so it exits non-zero on any failure.
 */
import { generateScale, auditScale, contrast, readableOn } from "../palette.ts";
import { PRESETS } from "../presets.ts";

const HOSTILE = [
  ["pure yellow", "#ffff00"], ["cyan", "#00ffff"], ["neon green", "#39ff14"],
  ["pale pink", "#ffd9e8"], ["near-white", "#fafafa"], ["near-black", "#050505"],
  ["mid grey", "#888888"], ["hot magenta", "#ff00ff"], ["pure red", "#ff0000"],
  ["pure blue", "#0000ff"], ["olive", "#808000"], ["indigo", "#4b0082"],
];

let failures = 0;
const check = (label, seed) => {
  const report = auditScale(generateScale(seed));
  if (!report.accessible) {
    failures++;
    console.log(`  ✖ ${label} (${seed}): ${report.problems.join(" ")}`);
  }
};

console.log("Presets:");
for (const p of PRESETS) {
  check(`${p.name} primary`, p.primary);
  check(`${p.name} secondary`, p.secondary);
}
console.log(`  ${PRESETS.length * 2} scales checked`);

console.log("Hostile seeds:");
for (const [label, seed] of HOSTILE) check(label, seed);
console.log(`  ${HOSTILE.length} scales checked`);

if (failures) {
  console.log(`\n✖ ${failures} scale(s) fail WCAG AA`);
  process.exit(1);
}
console.log("\n✔ every scale passes WCAG AA");
