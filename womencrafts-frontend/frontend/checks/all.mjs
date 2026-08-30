/**
 * Run every check, in the order that fails fastest.
 *
 * `tokens.mjs` is static and sub-second, so a raw colour is caught before a
 * browser even launches. The browser checks then prove the tokens actually
 * meet contrast in the rendered app.
 */
import { execSync } from "child_process";

const CHECKS = [
  ["tokens",   "node checks/tokens.mjs"],
  ["ink",      "npx tsx src/theme-engine/__checks__/ink.mjs"],
  ["contrast", "node checks/contrast.mjs"],
  ["rail",     "node checks/rail.mjs"],
  ["a11y",     "node checks/a11y.mjs"],
  ["keyboard", "node checks/keyboard.mjs"],
  ["feedback", "node checks/feedback.mjs"],
  ["toast",    "node checks/toast.mjs"],
  ["states",   "node checks/states.mjs"],
  ["api",      "node checks/api.mjs"],
  ["screens",  "node checks/screens.mjs"],
  // Every dashboard screen at 390px, plus the off-canvas drawer.
  ["phone",    "node checks/phone.mjs"],
  ["split",    "node checks/split.mjs"],
  // Every language, rendered in a real browser.
  ["i18n",     "node checks/i18n.mjs"],
  // Last: it drives a real conversation, so it is the slowest by far and
  // costs money on every run.
  ["sakhi",    "node checks/sakhi.mjs"],
  ["avatar",   "node checks/avatar.mjs"],
  ["refresh",  "node checks/sakhi-refresh.mjs"],
  ["reach",    "node checks/sakhi-reach.mjs"],
  ["rag",      "node checks/sakhi-rag.mjs"],
  ["plain",    "node checks/sakhi-plain.mjs"],
  ["ux",       "node checks/ux-learning.mjs"],
  ["ux-home",  "node checks/ux-home.mjs"],
  ["ux-motion","node checks/ux-motion.mjs"],
  ["ux-search","node checks/ux-search.mjs"],
  ["ux-surf",  "node checks/ux-surfaces.mjs"],
  ["ux-adv",   "node checks/ux-motion-adv.mjs"],
  ["ux-work",  "node checks/ux-work.mjs"],
  ["ux-brand", "node checks/ux-brand.mjs"],
  ["ux-raise", "node checks/ux-raise.mjs"],
  ["ux-money", "node checks/ux-money.mjs"],
  ["ux-circle","node checks/ux-circles.mjs"],
  ["ux-shop",  "node checks/ux-shop.mjs"],
  ["ux-learn2","node checks/ux-learn-app.mjs"],
  ["ux-mentor","node checks/ux-mentors.mjs"],
  ["ux-journey","node checks/ux-journey.mjs"],
  ["ux-disc",  "node checks/ux-discover.mjs"],
  ["ux-comm",  "node checks/ux-community.mjs"],
  ["ux-acct",  "node checks/ux-account.mjs"],
  ["ux-onb",   "node checks/ux-onboard.mjs"],
  ["ux-nav",   "node checks/ux-nav.mjs"],
  ["ux-set",   "node checks/ux-settings.mjs"],
  ["ux-detail","node checks/ux-detail.mjs"],
  ["ux-phase2","node checks/ux-phase2.mjs"],
  ["ux-states","node checks/ux-states.mjs"],
  ["ux-phase4","node checks/ux-phase4.mjs"],
  ["ux-phase5","node checks/ux-phase5.mjs"],
  ["ux-dead",  "node checks/ux-dead.mjs"],
  ["ux-cert",  "node checks/ux-certificate.mjs"],
  ["voice",    "node checks/sakhi-voice.mjs"],
  ["language", "node checks/sakhi-language.mjs"],
  ["sync",     "node checks/sakhi-sync.mjs"],
  ["login",    "node checks/login.mjs"],
];

let failed = 0;
for (const [name, cmd] of CHECKS) {
  process.stdout.write(`\n\x1b[1m── ${name} ─────────────────────────────────\x1b[0m\n`);
  try { execSync(cmd, { stdio: "inherit" }); }
  catch { failed++; console.log(`\x1b[31m   ${name} FAILED\x1b[0m`); }
}
console.log(failed ? `\n\x1b[31m${failed} check(s) failed\x1b[0m\n` : "\n\x1b[32mall checks pass\x1b[0m\n");
process.exit(failed ? 1 : 0);
