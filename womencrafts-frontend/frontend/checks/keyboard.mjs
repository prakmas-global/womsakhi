/**
 * Can the app be used without a mouse?
 *
 * Naming controls (checks/a11y.mjs) makes them announceable. This checks the
 * other half: that you can REACH them, SEE where you are, and get back out.
 *
 * Three failures, each of which makes the keyboard unusable in a different way:
 *
 *   1. Invisible focus — focus is real and moving, but nothing on screen shows
 *      where. Before the global rule in globals.css, only `.btn` showed it, and
 *      34 files set `outline-none` without putting anything back.
 *
 *   2. A trap — Tab stops advancing. Focus goes into something and cannot get
 *      out, so the whole page is finished for that user. Nothing left to do but
 *      reload.
 *
 *   3. No skip link — the admin rail is twenty-odd links, repeated on all 76
 *      screens. Without a way past it, reaching the page content means tabbing
 *      through the entire nav every single time.
 *
 * It samples screens rather than sweeping all of them: focus behaviour comes
 * from the shell and the shared primitives, so it is the same on every route,
 * and 40 tab presses × 76 routes would buy nothing for the minutes it costs.
 */
import { createRequire } from "module";
import { APP, launch, pageAs, staffToken, memberToken } from "./_shared.mjs";
const require = createRequire(import.meta.url);
const _fs = require("fs");

const LOCK = "/tmp/womsakhi-checks.lock";
function acquireLock(who) {
  for (let i = 0; i < 600; i++) {
    try { _fs.writeFileSync(LOCK, who, { flag: "wx" }); return; }
    catch { if (i === 0) console.log(`  waiting for ${_fs.readFileSync(LOCK, "utf8")} to finish…`);
            Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1000); }
  }
  throw new Error("timed out waiting for the check lock");
}
acquireLock("keyboard");
const release = () => { try { _fs.unlinkSync(LOCK); } catch {} };
process.on("exit", release);
process.on("SIGINT", () => { release(); process.exit(1); });

const RED = "\x1b[31m", GREEN = "\x1b[32m", DIM = "\x1b[2m", OFF = "\x1b[0m";

const SAMPLE = {
  admin: ["/dashboard", "/dashboard/users", "/dashboard/services", "/dashboard/settings/notifications"],
  member: ["/app", "/app/explore", "/app/bookings", "/app/settings/security"],
};
const TABS = 40;

/** What the browser will actually draw around the focused element. */
const focusRing = (page) => page.evaluate(() => {
  const el = document.activeElement;
  if (!el || el === document.body) return null;
  // Next's dev-mode error overlay injects its own focusable host element. It is
  // not ours, it is not in a production build, and it draws no focus ring —
  // reporting it would be reporting the toolbox, not the app.
  if (el.tagName.toLowerCase() === "nextjs-portal") return null;
  const s = getComputedStyle(el);
  const width = parseFloat(s.outlineWidth) || 0;
  const drawnOutline = width > 0 && s.outlineStyle !== "none" &&
    !/transparent|rgba\(0, 0, 0, 0\)/.test(s.outlineColor);
  // A ring drawn with box-shadow counts too — several primitives use one, and
  // to a person there is no difference between the two.
  const drawnShadow = s.boxShadow !== "none" && s.boxShadow.trim() !== "";
  return {
    tag: el.tagName.toLowerCase(),
    name: (el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 40),
    visible: drawnOutline || drawnShadow,
    outline: `${s.outlineWidth} ${s.outlineStyle} ${s.outlineColor}`,
  };
});

const staff = await staffToken();
const member = await memberToken(staff);
const problems = [];
let tabsChecked = 0;

for (const [mod, tok] of [["admin", staff], ["member", member]]) {
  const browser = await launch();
  const page = await pageAs(browser, tok, { width: 1600, height: 1000, name: "desktop", mode: "light" });

  for (const route of SAMPLE[mod]) {
    await page.goto(`${APP}${route}`, { waitUntil: "networkidle2", timeout: 30000 });
    await page.waitForFunction(() => ![...document.querySelectorAll(
      '.wc-skeleton,[class*="animate-pulse"],[class*="animate-spin"]')]
      .some((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; }),
      { timeout: 6000 }).catch(() => {});

    // ── 1. the skip link is the first stop ──────────────────────────────────
    await page.evaluate(() => { document.body.focus(); window.scrollTo(0, 0); });
    await page.keyboard.press("Tab");
    const first = await focusRing(page);
    if (!first || !/skip to content/i.test(first.name)) {
      problems.push(`${mod} ${route}: first Tab reaches "${first?.name ?? "nothing"}", not the skip link`);
    } else if (!first.visible) {
      problems.push(`${mod} ${route}: the skip link takes focus but is invisible`);
    }

    // ── 2. focus stays visible, and keeps moving ────────────────────────────
    const seen = new Set();
    // Naming them matters: "2 of 40 stops show no focus" tells you a problem
    // exists; "the theme swatch" tells you where to go.
    const invisibleAt = [];
    let invisible = 0, stuckAt = null;
    for (let i = 0; i < TABS; i++) {
      await page.keyboard.press("Tab");
      const cur = await focusRing(page);
      tabsChecked++;
      if (!cur) continue;                     // left the document (browser chrome)
      if (!cur.visible) { invisible++; invisibleAt.push(`${cur.tag}${cur.name ? ` "${cur.name}"` : ""}`); }
      const key = `${cur.tag}:${cur.name}`;
      // Landing on the same control four times running is a trap: Tab is being
      // swallowed, or focus is being forced back.
      if (seen.has(`${key}#${i - 1}`) && seen.has(`${key}#${i - 2}`) && seen.has(`${key}#${i - 3}`)) {
        stuckAt = cur.name || cur.tag;
        break;
      }
      seen.add(`${key}#${i}`);
    }
    if (invisible)
      problems.push(`${mod} ${route}: ${invisible} of ${TABS} tab stops show no focus — ${[...new Set(invisibleAt)].slice(0, 4).join(", ")}`);
    if (stuckAt) problems.push(`${mod} ${route}: keyboard trap at "${stuckAt}" — Tab stops advancing`);
  }
  await browser.close().catch(() => {});
}

console.log(`\n  ${tabsChecked} tab stops across ${SAMPLE.admin.length + SAMPLE.member.length} screens`);
if (!problems.length) {
  console.log(`  ${GREEN}focus is always visible, nothing traps it, the skip link comes first${OFF}\n`);
} else {
  console.log(`  ${RED}${problems.length} problems${OFF}\n`);
  problems.forEach((p) => console.log(`   · ${p}`));
  console.log();
}
process.exit(problems.length ? 1 : 0);
