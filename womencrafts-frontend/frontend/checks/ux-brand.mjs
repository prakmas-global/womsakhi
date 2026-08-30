/**
 * The brand lockup.
 *
 * A logo is the one thing on a screen nobody forgives being wrong, and it is
 * also the easiest to break silently: a 404 renders as nothing, an oversized
 * lockup pushes the last letter under the rail's edge, and a mark drawn at
 * three times its source resolution goes soft on a retina screen without ever
 * throwing an error.
 */
import { launch, pageAs, seededMemberToken } from "./_shared.mjs";

const APP = process.env.UX_URL || "http://localhost:3100";
const fail = [];
const say = (ok, msg) => { console.log(`  ${ok ? "ok  " : "✗   "} ${msg}`); if (!ok) fail.push(msg); };

const token = await seededMemberToken();
const browser = await launch();

for (const mode of ["light", "dark"]) {
  const page = await pageAs(browser, token, { width: 1536, height: 1024, mode });
  await page.evaluateOnNewDocument((m) => { try { localStorage.setItem("theme", m); } catch {} }, mode);
  await page.goto(APP + "/app", { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForFunction(() => document.querySelector("aside") !== null, { timeout: 60000 });
  await new Promise((r) => setTimeout(r, 2000));

  console.log(`\n  ${mode}`);
  const m = await page.evaluate(() => {
    // The lockup lives in the topbar now, not the rail: with a full-width bar
    // above every column, the brand belongs at the top-left of the whole app.
    const a = document.querySelector('header a[aria-label^="WomSakhi"]');
    if (!a) return null;
    const bar = document.querySelector("header");
    const tabs = bar.querySelector("nav");
    // It must not crowd the mode tabs — the gap between them is the room it has.
    const inner = tabs
      ? tabs.getBoundingClientRect().left - a.getBoundingClientRect().left
      : bar.getBoundingClientRect().width;
    const r = a.getBoundingClientRect();
    const imgs = [...a.querySelectorAll("img")].map((i) => ({
      file: (i.currentSrc || i.src).split("/").pop(),
      loaded: i.complete && i.naturalWidth > 0,
      drawn: Math.round(i.getBoundingClientRect().width),
      natural: i.naturalWidth,
    }));
    // The LEAF span. The outer wrapper's textContent also starts with the
    // tagline — the images contribute none — so an unqualified match picked the
    // whole lockup and counted its rows as wrapped lines.
    const tagEl = [...a.querySelectorAll("span")].find(
      (s) => s.children.length === 0 && /^Empowering/i.test(s.textContent.trim()),
    );
    // Count line BOXES, not height/line-height: the computed line-height here is
    // `normal`, which parseFloat turns into NaN and every comparison then fails.
    let tagLines = 0;
    if (tagEl?.firstChild) {
      const rng = document.createRange();
      rng.selectNodeContents(tagEl.firstChild);
      tagLines = rng.getClientRects().length;
    }
    return {
      w: Math.round(r.width), h: Math.round(r.height), room: Math.round(inner || room),
      imgs, tagLines,
      alt: [...a.querySelectorAll("img")].map((i) => i.alt).join("|"),
    };
  });

  if (!m) { say(false, "the lockup is not on the page at all"); continue; }

  for (const i of m.imgs) say(i.loaded, `${i.file} loads`);
  // 2x is the floor for a retina screen; the source is 3x on purpose.
  for (const i of m.imgs) {
    say(i.natural >= i.drawn * 2,
        `${i.file} has the pixels for it (${i.natural} source for ${i.drawn} drawn — ${(i.natural / i.drawn).toFixed(1)}x)`);
  }
  say(m.w <= m.room, `the lockup clears the mode tabs (${m.w}px in ${m.room}px)`);
  // No tagline in the bar — there is no room, and the wordmark carries it.
  say(m.tagLines <= 1, `the tagline never wraps (${m.tagLines} line(s))`);
  say(/WomSakhi/.test(m.alt), "the wordmark carries the name for a screen reader");
  say(m.imgs.length === 2, `both marks are present (${m.imgs.length})`);

  await page.close();
}

// The mark is also the tab icon, and a favicon that 404s is a broken-looking app.
const page = await browser.newPage();
for (const url of ["/icon.png", "/apple-icon.png", "/ux/brand/womsakhi-emblem.webp", "/ux/brand/womsakhi-wordmark.webp"]) {
  const res = await page.goto(APP + url, { waitUntil: "domcontentloaded", timeout: 30000 }).catch(() => null);
  // 304 is a cache hit, which is a served asset — only a 4xx/5xx is a problem.
  const ok = !!res && res.status() < 400;
  say(ok, `${url} serves (${res ? res.status() : "no response"})`);
}
await page.close();

await browser.close();
console.log(fail.length ? `\n  ${fail.length} failing\n` : "\n  the lockup renders sharp, fits, and reads correctly in both themes\n");
process.exit(fail.length ? 1 : 0);
