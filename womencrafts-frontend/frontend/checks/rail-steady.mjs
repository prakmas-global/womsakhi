/**
 * The rail holds still.
 *
 * She said the sidebar was "moving up down and placement kind off", and three
 * separate things were doing it. All three were invisible until measured at a
 * 720px-tall window, which is an ordinary laptop once a bookmarks bar is out:
 *
 *   1. The rail was padded by a topbar's height PLUS 12px, for a header that
 *      is a flex row and already takes its own band. Her photo began at y=136
 *      while the first card in the page began at y=80 — 56px of empty rail,
 *      on every screen.
 *
 *   2. The whole column scrolled, so opening a taller section pushed the
 *      profile card up and the "Complete your profile" panel off the bottom.
 *      On Help the rail ran 177px past the fold and that panel could not be
 *      seen at all. The card and the panel are pinned now; the list between
 *      them is what scrolls.
 *
 *   3. Opening one section and shutting the rest changes the list's height by
 *      up to 153px, which was enough to carry the row she had just picked out
 *      of sight. The list corrects itself, but only when the row is actually
 *      outside the frame.
 *
 * This measures all three across five sections and one settings screen.
 */
import puppeteer from "puppeteer-core";
import { CHROME, APP, seededMemberToken } from "./_shared.mjs";

const tok = await seededMemberToken();
const b = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox"] });
const p = await b.newPage();
// 720 rather than 1000: at 1000 the rail fits and every one of these bugs
// hides. The complaint came from a laptop.
await p.setViewport({ width: 1440, height: 720, deviceScaleFactor: 1 });
await p.setCookie({ name: "access_token", value: tok, domain: "localhost", path: "/" });

const shot = () => p.evaluate(() => {
  const y = (el) => (el ? Math.round(el.getBoundingClientRect().top) : null);
  const aside = document.querySelector("aside");
  const list = aside?.querySelector("nav[aria-label='Sections']");
  const card = aside?.querySelector("a");
  const foot = aside && aside.lastElementChild !== list ? aside.lastElementChild : null;
  const row = list?.querySelector('[aria-current="page"]');
  const r = row?.getBoundingClientRect();
  const f = list?.getBoundingClientRect();
  const a = aside?.getBoundingClientRect();
  return {
    path: location.pathname,
    cardTop: y(card),
    contentTop: y(document.querySelector("#content")?.firstElementChild),
    footTop: y(foot),
    footInView: foot ? foot.getBoundingClientRect().bottom <= innerHeight + 1 : null,
    railBottom: a ? Math.round(a.bottom) : null,
    row: row?.innerText.trim().split("\n")[0] ?? null,
    rowInFrame: r && f ? r.top >= f.top - 1 && r.bottom <= f.bottom + 1 : null,
  };
});

const go = async (href) => {
  const ok = await p.evaluate((h) => {
    const a = [...document.querySelectorAll("aside nav a")].find(x => x.getAttribute("href") === h);
    if (!a) return false;
    a.click();
    return true;
  }, href);
  if (!ok) return null;
  await p.waitForFunction((h) => location.pathname === h, { timeout: 30000 }, href).catch(() => {});
  // The reveal grows over --ux-t-slow (320ms) and the correction runs at 360ms.
  await new Promise(x => setTimeout(x, 900));
  return shot();
};

await p.goto(APP + "/app", { waitUntil: "domcontentloaded", timeout: 180000 });
await p.waitForFunction(() => !!document.querySelector("aside nav[aria-label='Sections']"), { timeout: 60000 });
await new Promise(x => setTimeout(x, 1600));

const seen = [await shot()];
for (const h of ["/app/learn", "/app/earn", "/app/circle", "/app/settings", "/app/help", "/app/work"]) {
  const s = await go(h);
  if (s) seen.push(s);
}

let bad = 0;
const say = (ok, msg) => { console.log(`  ${ok ? "ok  " : "FAIL"}  ${msg}`); if (!ok) bad++; };

for (const s of seen)
  console.log(`  ${s.path.padEnd(15)} card ${String(s.cardTop).padStart(4)}  content ${String(s.contentTop).padStart(4)}` +
              `  footer ${String(s.footTop ?? "—").padStart(4)}  row ${s.row ?? "—"}`);
console.log("");

const tops = [...new Set(seen.map(s => s.cardTop))];
say(tops.length === 1, `her photo starts at the same height on every screen (${tops.join(", ")})`);

const off = seen.filter(s => s.contentTop != null && Math.abs(s.cardTop - s.contentTop) > 2);
say(off.length === 0,
    off.length ? `the rail and the page start level (off by ${off.map(s => s.cardTop - s.contentTop).join(", ")}px)`
               : "the rail and the page start level");

const feet = [...new Set(seen.filter(s => s.footTop != null).map(s => s.footTop))];
say(feet.length <= 1, `the profile panel is pinned, not carried by the list (${feet.join(", ") || "not on these screens"})`);
say(seen.every(s => s.footInView !== false), "the profile panel is on screen wherever it appears");

say(seen.every(s => s.railBottom <= 721), "nothing in the rail runs past the bottom of the window");

const lost = seen.filter(s => s.rowInFrame === false);
say(lost.length === 0,
    lost.length ? `the row she is on stays in the frame (lost on ${lost.map(s => s.path).join(", ")})`
                : "the row she is on stays in the frame");

console.log(bad ? `\n FAIL  ${bad} of 6` : "\n PASS  the rail holds still");
await b.close();
process.exit(bad ? 1 : 0);
