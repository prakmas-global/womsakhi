/**
 * The Learn board holds the whole window, and holds all of itself.
 *
 * Built from `Womsakhi-user-ux/learnmain.png`. Two things it has to be at
 * once, and they pull against each other:
 *
 *   **It fits the window.** No scrollbar from `xl` up. The board was drawn at
 *   1586x992; a 1440x900 laptop is 92px short of that and a 1366x768 one
 *   224px short, so density steps down by window height — padding, gaps and
 *   how many lines of a description a card shows — while every heading,
 *   button and destination stays exactly where it was drawn.
 *
 *   **It is still all there below `xl`.** The first attempt at fitting gave
 *   the board `h-full` at every width. On a 390px phone that squeezed the
 *   middle row to nothing: hero, then How-it-works, and all six destinations
 *   clipped out of existence with no scrollbar to reach them. A screen that
 *   cannot fit must scroll, so this checks the phone separately and asks for
 *   the opposite thing.
 */
import puppeteer from "puppeteer-core";
import { CHROME, APP, seededMemberToken } from "./_shared.mjs";

const WANT = [
  ["Courses", "/app/programs"],
  ["Mentors", "/app/mentors"],
  ["Certificates", "/app/certificates"],
  ["Teach and learn", "/app/library"],
  ["Prove your skills", "/app/assess"],
  ["Using a phone", "/app/digital"],
];

const tok = await seededMemberToken();
const b = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox"] });
const p = await b.newPage();
await p.setCookie({ name: "access_token", value: tok, domain: "localhost", path: "/" });
await p.setViewport({ width: 1586, height: 992, deviceScaleFactor: 1 });
await p.goto(APP + "/app/learn", { waitUntil: "domcontentloaded", timeout: 180000 });
await p.waitForFunction(() => /Learn\. Grow/.test(document.querySelector("#content")?.innerText ?? ""),
                        { timeout: 90000 });
await new Promise(x => setTimeout(x, 2000));

let bad = 0;
const say = (ok, msg) => { console.log(`  ${ok ? "ok  " : "FAIL"}  ${msg}`); if (!ok) bad++; };

/* ── all of it is there ─────────────────────────────────────────────────── */

const parts = await p.evaluate((want) => {
  const c = document.querySelector("#content");
  const text = c.innerText;
  const hrefs = [...c.querySelectorAll("a")].map(a => a.getAttribute("href"));
  const art = c.querySelector('img[src*="hero-learn-banner"]');
  return {
    heading: /Learn\. Grow\. Achieve\./.test(text),
    places: want.map(([label, href]) => ({
      label, href, titled: text.includes(label), linked: hrefs.includes(href),
    })),
    promises: ["Learn at your pace", "Get certified", "Learn from real women",
               "Turn skills into opportunities"].filter(t => text.includes(t)).length,
    journey: /2 of 6 steps complete/.test(text),
    steps: c.querySelectorAll("ol li").length,
    how: ["Explore", "Learn & Practice", "Get Certified", "Grow"].filter(t => text.includes(t)).length,
    script: !!c.querySelector('[style*="--font-script"]'),
    artLoaded: !!art && art.naturalWidth > 0,
  };
}, WANT);

say(parts.heading, "the board leads with “Learn. Grow. Achieve.”");
say(parts.artLoaded, "the supplied hero art is present and decoded");
say(parts.promises === 4, `all four promises are on the hero (${parts.promises} of 4)`);
const missing = parts.places.filter(x => !x.titled || !x.linked);
say(missing.length === 0,
    missing.length ? `every destination is named and linked (missing: ${missing.map(m => m.label).join(", ")})`
                   : "all six destinations are named and linked to the right route");
say(parts.journey, "the journey card shows where she is (2 of 6)");
say(parts.how === 4, `How it works spells out all four steps (${parts.how} of 4)`);
say(parts.script, "the hand-written line is live text, not a picture");

/* ── it fits the window ─────────────────────────────────────────────────── */

for (const [w, h] of [[1586, 992], [1440, 900], [1366, 768]]) {
  await p.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
  await new Promise(x => setTimeout(x, 900));
  const m = await p.evaluate(() => {
    const sc = document.getElementById("ux-scroll");
    const grid = document.querySelector("#content .grid");
    return { over: sc.scrollHeight - sc.clientHeight,
             cols: getComputedStyle(grid).gridTemplateColumns.split(" ").length };
  });
  say(m.over <= 0, `${w}x${h}: the whole board is on screen (overflow ${m.over}px)`);
  say(m.cols === 3, `${w}x${h}: the six cards are in three columns (${m.cols})`);
}

/* ── and on a phone it scrolls instead ──────────────────────────────────── */

await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
await new Promise(x => setTimeout(x, 1000));
const phone = await p.evaluate(() => {
  const cards = [...document.querySelectorAll("#content .ux-card")];
  return {
    sideways: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    cards: cards.length,
    tallest: Math.max(0, ...cards.map(c => Math.round(c.getBoundingClientRect().height))),
    shortest: Math.min(...cards.map(c => Math.round(c.getBoundingClientRect().height))),
    scrolls: document.getElementById("ux-scroll").scrollHeight
             > document.getElementById("ux-scroll").clientHeight,
  };
});
say(phone.sideways === 0, `390px: nothing runs off the side (${phone.sideways}px)`);
say(phone.cards >= 7, `390px: every card is rendered (${phone.cards})`);
say(phone.shortest > 90, `390px: no card is squeezed to nothing (shortest ${phone.shortest}px)`);
say(phone.scrolls, "390px: the page scrolls, rather than hiding what will not fit");

console.log(bad ? `\n FAIL  ${bad} of 18` : "\n PASS  the board fits the window, and fits on a phone");
await b.close();
process.exit(bad ? 1 : 0);
