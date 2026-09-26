/**
 * Back goes where she came from — driven, not read.
 *
 * This has to be a browser test. The bug it guards against was invisible to
 * every static check and to a `curl`: `Back` read `document.referrer`, which a
 * Next `<Link>` never updates, so on real client-side navigation the referrer
 * was `""`, the "do we have history" test said no, and every control fell
 * through to its declared parent. Calendar → a booking → back sent her to All
 * bookings, a list she had not asked for.
 *
 * So the check clicks, the way she does.
 */
import puppeteer from "puppeteer-core";
import { CHROME, seededMemberToken } from "./_shared.mjs";

const tok = await seededMemberToken();
if (!tok) { console.log(" FAIL  could not sign in"); process.exit(1); }

const b = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox"] });
const p = await b.newPage();
await p.setViewport({ width: 1440, height: 900 });
await p.setCookie({ name: "access_token", value: tok, domain: "localhost", path: "/" });

/** Clicks a link and waits for the URL to actually change, then for the back
 *  control to appear — a fixed sleep is a flake generator on a dev server that
 *  may be compiling the route for the first time. */
async function clickTo(page, href) {
  const from = page.url();
  await page.click(`a[href="${href}"]`);
  for (let i = 0; i < 120 && page.url() === from; i++) await new Promise((r) => setTimeout(r, 250));
  await page.waitForFunction(
    () => [...document.querySelectorAll("a")].some((e) => /^Back|^All /i.test(e.textContent.trim())),
    { timeout: 60000 },
  ).catch(() => {});
}

const backControl = (page) => page.evaluate(() =>
  [...document.querySelectorAll("a")]
    .map((e) => ({ t: e.textContent.trim().replace(/\s+/g, " "), h: e.getAttribute("href") }))
    .filter((x) => /^Back|^All /i.test(x.t))[0] ?? null);

let bad = 0;
const check = (name, got, wantHref) => {
  const ok = got && got.h === wantHref;
  if (!ok) bad++;
  console.log(`  ${ok ? "ok  " : "FAIL"}  ${name.padEnd(26)} ${got ? `“${got.t}” → ${got.h}` : "(no back control)"}`);
};

// Reached from the calendar, back belongs to the calendar.
await p.goto("http://localhost:3100/app/schedule", { waitUntil: "networkidle0", timeout: 240000 });
const links = await p.$$eval('a[href*="/app/bookings/"]', (a) => a.map((x) => x.getAttribute("href")));
if (links.length) {
  await clickTo(p, links[0]);
  check("calendar → booking", await backControl(p), "/app/schedule");
} else {
  console.log("  skip  calendar has no booking entries this month");
}

// Reached from its own list, back belongs to the list.
await p.goto("http://localhost:3100/app/bookings", { waitUntil: "networkidle0", timeout: 240000 });
await new Promise((r) => setTimeout(r, 1500));
const rows = await p.$$eval('a[href*="/app/bookings/"]', (a) => a.map((x) => x.getAttribute("href")));
if (!rows.length) { console.log("  skip  bookings list is empty for this member"); }
else {
  await clickTo(p, rows[0]);
  check("bookings → booking", await backControl(p), "/app/bookings");
}

// Opened cold — a link in WhatsApp, a bookmark — back falls to the parent.
const target = links[0] ?? rows[0];
if (target) {
  const fresh = await b.newPage();
  await fresh.setViewport({ width: 1440, height: 900 });
  await fresh.setCookie({ name: "access_token", value: tok, domain: "localhost", path: "/" });
  await fresh.goto(`http://localhost:3100${target}`, { waitUntil: "networkidle0", timeout: 240000 });
  await new Promise((r) => setTimeout(r, 2000));
  check("cold deep link", await backControl(fresh), "/app/bookings");
} else {
  console.log("  skip  no live booking exists for a cold deep-link check");
}

await b.close();
console.log(bad ? `\n FAIL  ${bad} back control(s) go to the wrong place` : "\n PASS");
process.exit(bad ? 1 : 0);
