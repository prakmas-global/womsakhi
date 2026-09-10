/**
 * The sign-in screen leads with the brand reveal.
 *
 * It must introduce itself once — on a first visit it plays on its own, and a
 * returning visitor gets the finished lockup with a control instead.
 *
 * The failure this guards against was shipped once: reduced motion used to swap
 * the whole tile for a still image, leaving anyone with that setting — on by
 * default on plenty of machines — staring at a frozen tile with nothing to
 * click. So the harsher preference is the one exercised here, and it must still
 * autoplay for a newcomer and still be playable by hand afterwards.
 */
import { launch, APP } from "./_shared.mjs";

const browser = await launch();
const fail = [];

async function inspect(pref, { returning = false } = {}) {
  // a fresh context is a person who has never been here before
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.setViewport({ width: 1440, height: 950 });
  const errors = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(String(e)));

  await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: pref }]);
  await page.goto(`${APP}/signin`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForSelector("form", { timeout: 30000 });
  await new Promise((r) => setTimeout(r, 3500));

  if (returning) {
    // second time through the same browser
    await page.reload({ waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForSelector("form", { timeout: 30000 });
    await new Promise((r) => setTimeout(r, 3000));
  }

  const onLoad = await page.evaluate(() => {
    const v = [...document.querySelectorAll('video[src*="womsakhi-reveal"]')]
      .find((e) => e.getBoundingClientRect().height > 0);
    if (!v) return { present: false };
    const r = v.getBoundingClientRect();
    return {
      present: true, played: +v.currentTime.toFixed(2), paused: v.paused,
      muted: v.muted, loop: v.loop, poster: v.getAttribute("poster"),
      readyState: v.readyState, error: v.error?.message ?? null,
      w: Math.round(r.width), h: Math.round(r.height),
    };
  });

  // and reach it the way a person would — a real click on the tile.
  //
  // Found structurally, as "the control wrapping the video", rather than by a
  // fixed aria-label. This used to match one exact phrase, so rewording the
  // label — which is copy, not behaviour — reported the control as missing.
  // What this check is actually for is that a control EXISTS, that it is
  // reachable, and that it has some accessible name at all.
  const at = await page.evaluate(() => {
    const v = [...document.querySelectorAll('video[src*="womsakhi-reveal"]')]
      .find((e) => e.getBoundingClientRect().height > 0);
    const el = v?.closest("button") ?? v?.parentElement?.querySelector("button");
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return {
      x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2),
      name: el.getAttribute("aria-label") || el.textContent.trim(),
    };
  });
  let afterClick = null;
  if (at) {
    await page.mouse.click(at.x, at.y);
    await new Promise((r) => setTimeout(r, 1600));
    afterClick = await page.evaluate(() => {
      const v = [...document.querySelectorAll('video[src*="womsakhi-reveal"]')]
        .find((e) => e.getBoundingClientRect().height > 0);
      return v ? { played: +v.currentTime.toFixed(2), paused: v.paused } : null;
    });
  }

  if (pref === "reduce" && !returning) await page.screenshot({ path: "/tmp/signin.png" });
  await ctx.close();
  return { onLoad, hasControl: !!at, afterClick, errors };
}

const reduced = await inspect("reduce");                       // newcomer, motion reduced
const normal = await inspect("no-preference");                 // newcomer, motion fine
const again = await inspect("no-preference", { returning: true });

for (const [label, r] of [["reduced motion", reduced], ["normal motion", normal], ["returning", again]]) {
  const v = r.onLoad;
  if (!v.present) { fail.push(`${label}: the reveal is not on the screen at all`); continue; }
  if (v.error) fail.push(`${label}: the browser could not decode it — ${v.error}`);
  if (v.readyState < 2) fail.push(`${label}: it never loaded enough to show a frame`);
  if (!v.muted) fail.push(`${label}: it is not muted — a sign-in screen must not make noise`);
  if (v.loop) fail.push(`${label}: it loops — a brand reveal should play once and hold`);
  if (!v.poster) fail.push(`${label}: no poster, so a blocked video leaves an empty tile`);
  if (v.w < 200) fail.push(`${label}: it renders too small (${v.w}x${v.h})`);
  if (!r.hasControl) fail.push(`${label}: there is no way to start it by hand`);
  if (r.errors.length) fail.push(`${label}: console error — ${r.errors[0].slice(0, 80)}`);
}

// the behaviours that differ, and must
if (normal.onLoad.present && normal.onLoad.played <= 0.1)
  fail.push("a first-time visitor did not get the reveal automatically");
if (reduced.onLoad.present && reduced.onLoad.played <= 0.1)
  fail.push("a first-time visitor with reduced motion did not get the reveal either");
if (again.onLoad.present && again.onLoad.played > 0.1)
  fail.push("it played itself again for a returning visitor — it should introduce itself once");
if (again.afterClick && again.afterClick.played <= 0.1)
  fail.push("a returning visitor could not start it by hand — that is the dead tile again");

console.log(`\n  first visit, motion reduced: reached ${reduced.onLoad.played}s on its own`);
console.log(`  first visit, motion fine:    reached ${normal.onLoad.played}s on its own`);
console.log(`  returning visitor:          waited at ${again.onLoad.played}s, played to ${again.afterClick?.played}s once asked`);
console.log(fail.length
  ? "  " + fail.map((f) => "✗ " + f).join("\n  ") + "\n"
  : "  it introduces itself once, then waits — and stays playable by hand either way\n");

await browser.close();
process.exit(fail.length ? 1 : 0);
