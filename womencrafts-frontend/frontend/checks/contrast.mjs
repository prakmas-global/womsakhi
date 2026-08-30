/**
 * WCAG AA contrast, across every theme and both modes.
 *
 * Token colours rotate with the theme's hue, so a pairing that passes on pink
 * can fail on green. A green badge at 2.86:1 survived a full 87-screen sweep
 * because the account it ran under happened to be pink — measuring one theme
 * measures one eighth of the problem.
 *
 * Screens here are a representative sample, not all 87: `screens.mjs` already
 * covers component breadth. What varies per theme is the token VALUES, so a set
 * that between them exercise badges, charts, tables, forms and empty states
 * catches token bugs at a fraction of the runtime.
 */
import { createRequire } from "module";
import { APP, API, launch, pageAs, staffToken, memberToken, measureContrast } from "./_shared.mjs";
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
acquireLock("contrast");
const releaseLock = () => { try { _fs.unlinkSync(LOCK); } catch {} };
process.on("exit", releaseLock);
process.on("SIGINT", () => { releaseLock(); process.exit(1); });
const fs = require("fs"), path = require("path");

/**
 * `--full` walks every route in both modules under every theme — the complete
 * matrix, ~1,400 page loads. The default is a sample that between them exercise
 * badges, charts, tables, forms and empty states, which is what actually varies
 * per theme; run the full matrix before calling the token work done, and the
 * sample on every change after.
 */
const FULL = process.argv.includes("--full");

const walk = (dir, base) => {
  let out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name.startsWith("[")) continue; out = out.concat(walk(p, `${base}/${e.name}`)); }
    else if (e.name === "page.tsx") out.push(base || "/");
  }
  return out;
};

const SAMPLE = [
  "/dashboard", "/dashboard/appointments", "/dashboard/users", "/dashboard/analytics",
  "/dashboard/events", "/dashboard/settings/notifications", "/dashboard/safety",
  "/dashboard/programs", "/dashboard/circles", "/dashboard/reports",
];
const ADMIN = FULL ? walk("src/app/dashboard", "/dashboard").filter((r) => !r.endsWith("/logout")) : SAMPLE;
const MEMBER = FULL ? walk("src/app/app", "/app") : [];

const PRESETS = [
  ["womsakhi", "#d21f7c", "#7440a6"], ["indigo", "#4f46e5", "#0ea5e9"],
  ["forest", "#0f766e", "#65a30d"], ["sunset", "#ea580c", "#e11d48"],
  ["rose", "#e11d48", "#a21caf"], ["ocean", "#0284c7", "#0d9488"],
  ["marigold", "#d97706", "#ca8a04"], ["graphite", "#475569", "#64748b"],
];

const token = await staffToken();
const H = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
// A member is only needed for the full matrix — /app redirects a staff account.
const member = FULL ? await memberToken(token) : null;
console.log(`  ${FULL ? "FULL" : "sample"}: ${ADMIN.length + MEMBER.length} screens × ${8 * 2} theme/mode combinations\n`);

let grand = 0;
const worst = {};
for (const [name, primary, secondary] of PRESETS) {
  await fetch(`${API}/theme/me`, { method: "PUT", headers: H,
    body: JSON.stringify({ id: name, primary, secondary }) });
  // Fresh browser per theme — see the note above.
  const browser = await launch();
  for (const mode of ["light", "dark"]) {
    let total = 0;
    for (const [tok, list] of [[token, ADMIN], [member, MEMBER]]) {
      if (!tok || !list.length) continue;
      const p = await pageAs(browser, tok, { mode });
      for (const s of list) {
        try {
          await p.goto(`${APP}${s}`, { waitUntil: "networkidle2", timeout: 25000 });
          await new Promise((r) => setTimeout(r, FULL ? 400 : 550));
          for (const [k, v] of Object.entries(await measureContrast(p))) {
            total += v;
            worst[k] = worst[k] || { count: 0, where: new Set() };
            worst[k].count += v;
            worst[k].where.add(`${name}/${mode} ${s}`);
          }
        } catch { /* a screen that fails to load is screens.mjs's problem */ }
      }
      await p.close().catch(() => {});
    }
    grand += total;
    const flag = total === 0 ? "\x1b[32m✓\x1b[0m" : "\x1b[31m✗\x1b[0m";
    console.log(`  ${flag} ${name.padEnd(10)} ${mode.padEnd(5)} ${String(total).padStart(4)} failing nodes`);
  }
  await browser.close();
}

// Leave the account on the default rather than whatever ran last.
await fetch(`${API}/theme/me`, { method: "PUT", headers: H,
  body: JSON.stringify({ id: "womsakhi", primary: "#d21f7c", secondary: "#7440a6" }) });

if (grand) {
  console.log("\n  worst pairings:");
  Object.entries(worst).sort((a, b) => b[1].count - a[1].count).slice(0, 8)
    .forEach(([k, v]) => {
      console.log(`   ${String(v.count).padStart(4)}× ${k}`);
      console.log(`        seen on: ${[...v.where].slice(0, 4).join(", ")}`);
    });
}
console.log(`\n  ${grand} failing text nodes across ${PRESETS.length} themes × 2 modes × ${ADMIN.length + MEMBER.length} screens\n`);
process.exit(grand ? 1 : 0);
