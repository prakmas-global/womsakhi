/**
 * Everything that can be checked without opening a browser.
 *
 * ── Why this exists ─────────────────────────────────────────────────────────
 * The full suite drives ~230 page loads through six Chrome instances and takes
 * roughly ten minutes. That is the right cost before saying a section is done,
 * and the wrong cost while you are in the middle of doing it — a check you
 * hesitate to run stops catching things, which makes it worse than no check,
 * because you still believe it is watching.
 *
 * So the rules that can be read off the source run here in about a second, and
 * the rest stays in the slow suite. This is not a replacement: a clean run here
 * proves the source is consistent, not that the app renders correctly. Run
 * `npm run check` before calling anything finished.
 */
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { execSync } = require("child_process");

const GREEN = "\x1b[32m", RED = "\x1b[31m", DIM = "\x1b[2m", OFF = "\x1b[0m";

const STEPS = [
  ["tokens", "node checks/tokens.mjs", "every colour comes from a token"],
  ["a11y", "node checks/a11y.mjs", "every control has a name"],
  ["feedback", "node checks/feedback.mjs", "one way to say what happened"],
  ["types", "npx tsc --noEmit -p tsconfig.json", "the types agree"],
];

const started = Date.now();
let failed = 0;

for (const [name, cmd, claim] of STEPS) {
  const at = Date.now();
  try {
    execSync(cmd, { stdio: "pipe" });
    console.log(`  ${GREEN}✓${OFF} ${name.padEnd(7)} ${DIM}${claim} · ${Date.now() - at}ms${OFF}`);
  } catch (e) {
    failed++;
    console.log(`  ${RED}✗${OFF} ${name.padEnd(7)} ${DIM}${Date.now() - at}ms${OFF}`);
    const out = `${e.stdout || ""}${e.stderr || ""}`.trim();
    console.log(out.split("\n").slice(0, 24).map((l) => `      ${l}`).join("\n"));
  }
}

console.log(
  failed
    ? `\n  ${RED}${failed} of ${STEPS.length} failed${OFF} ${DIM}in ${Date.now() - started}ms${OFF}\n`
    : `\n  ${GREEN}all ${STEPS.length} pass${OFF} ${DIM}in ${Date.now() - started}ms${OFF} — run \`npm run check\` for the browser sweep\n`
);
process.exit(failed ? 1 : 0);
