/**
 * The Work board, against `Womsakhi-user-ux/wm.png`.
 *
 * Every part of the drawing has to be here — the five places with their
 * numbers, the five-step journey, the insight tiles, and the strip at the
 * foot — and all of it has to be reachable, which is a separate claim.
 *
 * The board fits a 1586x1024 window (its own size) and a 1440x900 laptop with
 * nothing hidden. It reached that honestly: an earlier pass fitted by giving
 * the board `h-full` and a `flex-1` middle row, which did not shrink the
 * design, it CLIPPED it — the journey's five captions and half the insight
 * tiles were cut off with no scrollbar to reach them, and both numbers still
 * read "overflow 0px". So this checks the parts before it checks the fit, and
 * on a phone it asks for the opposite: that the page scrolls rather than
 * hiding what will not fit.
 */
import puppeteer from "puppeteer-core";
import { CHROME, APP, seededMemberToken } from "./_shared.mjs";

const PLACES = [
  ["Find work", "/app/opportunities", "1,200+ active opportunities"],
  ["Did they pay her?", "/app/verified", "5,000+ verified reviews"],
  ["Your applications", "/app/applications", "12 applications this month"],
  ["Big orders", "/app/contracts", "80+ group opportunities"],
  ["Proof you keep your word", "/app/trust", "Build a trusted profile"],
];
const STEPS = ["Explore", "Apply", "Collaborate", "Get Verified", "Grow"];
const ART = ["hero-work-banner", "sakhi-ask-me", "leaves-pink"];

const tok = await seededMemberToken();
const b = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox"] });
const p = await b.newPage();
await p.setCookie({ name: "access_token", value: tok, domain: "localhost", path: "/" });
await p.setViewport({ width: 1586, height: 1024, deviceScaleFactor: 1 });
await p.goto(APP + "/app/work", { waitUntil: "domcontentloaded", timeout: 180000 });
await p.waitForFunction(() => /Find meaningful work/.test(document.querySelector("#content")?.innerText ?? ""),
                        { timeout: 90000 });
await new Promise(x => setTimeout(x, 2200));

let bad = 0;
const say = (ok, msg) => { console.log(`  ${ok ? "ok  " : "FAIL"}  ${msg}`); if (!ok) bad++; };

const seen = await p.evaluate((args) => {
  const c = document.querySelector("#content");
  const text = c.innerText;
  const hrefs = [...c.querySelectorAll("a")].map(a => a.getAttribute("href"));
  const shown = (el) => { const r = el.getBoundingClientRect(); return r.width > 1 && r.height > 1; };
  return {
    headline: /Find meaningful work/.test(text) && /your terms/.test(text),
    places: args.PLACES.map(([t, href, foot]) => ({
      t, ok: text.includes(t) && hrefs.includes(href) && text.includes(foot),
    })),
    promises: ["Safe & Verified", "Women-friendly", "Flexible Work", "Real Opportunities"]
      .filter(t => text.includes(t)).length,
    journeyTitle: /Your Work Journey/.test(text),
    steps: args.STEPS.filter(t => text.includes(t)).length,
    stepBodies: ["Browse and find opportunities", "Send your application",
                 "Work, communicate and deliver", "Receive reviews and build trust",
                 "Get bigger opportunities"].filter(t => text.replace(/\s+/g, " ").includes(t)).length,
    insights: /Work Insights/.test(text) && /68%/.test(text)
              && /You’re building something great!/.test(text),
    tiles: ["Applications sent", "Interviews", "Jobs completed", "Positive reviews"]
      .filter(t => text.includes(t)).length,
    range: !!c.querySelector("select"),
    quote: /Every opportunity is a step towards a stronger, brighter you\./.test(text),
    help: /Need help getting started\?/.test(text) && hrefs.includes("/app/sakhi"),
    script: !!c.querySelector('[style*="--font-script"]'),
    art: args.ART.map(name => {
      const im = c.querySelector(`img[src*="${name}"]`);
      return { name, ok: !!im && im.naturalWidth > 0 && shown(im) };
    }),
  };
}, { PLACES, STEPS, ART });

say(seen.headline, "the board leads with “Find meaningful work on your terms”");
say(seen.promises === 4, `all four promises are on the hero (${seen.promises} of 4)`);
const gone = seen.places.filter(x => !x.ok).map(x => x.t);
say(gone.length === 0,
    gone.length ? `each of the five places is named, linked and carries its number (missing: ${gone.join(", ")})`
                : "each of the five places is named, linked and carries its number");
say(seen.journeyTitle && seen.steps === 5 && seen.stepBodies === 5,
    `the journey has all five steps with their captions (${seen.steps} titles, ${seen.stepBodies} captions)`);
say(seen.insights, "Work Insights shows the ring and what it means");
say(seen.tiles === 4, `all four insight tiles are there (${seen.tiles} of 4)`);
say(seen.range, "the range control is a real control, not a picture of one");
say(seen.quote, "the quote reads “towards”, not the board’s “towds”");
say(seen.help, "the help strip offers Sakhi, and the link goes to her");
say(seen.script, "“You can do this” is live text, not a picture");
const dark = seen.art.filter(a => !a.ok).map(a => a.name);
say(dark.length === 0,
    dark.length ? `all three pieces of supplied art are drawn (missing: ${dark.join(", ")})`
                : "all three pieces of supplied art are drawn");

/* ── it fits, and nothing was clipped to make it fit ────────────────────── */

for (const [w, h] of [[1586, 1024], [1440, 900]]) {
  await p.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
  await new Promise(x => setTimeout(x, 900));
  const m = await p.evaluate(() => {
    const sc = document.getElementById("ux-scroll");
    const c = document.querySelector("#content > div");
    // The step <li> is `sm:contents`, so it has no box of its own — the
    // caption paragraphs are what to measure.
    const caps = [...document.querySelectorAll("#content ol p")]
      .map(el => Math.round(el.getBoundingClientRect().height))
      .filter(h => h > 0);
    const line = parseFloat(getComputedStyle(document.querySelector("#content ol p")).lineHeight) || 18;
    return { over: sc.scrollHeight - sc.clientHeight,
             cols: getComputedStyle(c.children[1]).gridTemplateColumns.split(" ").length,
             captions: caps.length,
             tallest: Math.max(0, ...caps),
             lines: Math.round(Math.max(0, ...caps) / line) };
  });
  say(m.over <= 0, `${w}x${h}: the whole board is on screen (overflow ${m.over}px)`);
  say(m.cols === 5, `${w}x${h}: the five places are in one row (${m.cols})`);
  say(m.captions === 5, `${w}x${h}: no step was flattened to fit (${m.captions} of 5 still readable)`);
  say(m.lines <= 2, `${w}x${h}: every step caption sits on two lines as drawn (worst is ${m.lines})`);
}

/* ── and a phone scrolls instead of hiding ──────────────────────────────── */

await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
await new Promise(x => setTimeout(x, 1000));
const phone = await p.evaluate(() => {
  const cards = [...document.querySelectorAll("#content .ux-card")];
  const sc = document.getElementById("ux-scroll");
  return { sideways: document.documentElement.scrollWidth - document.documentElement.clientWidth,
           cards: cards.length,
           shortest: Math.min(...cards.map(c => Math.round(c.getBoundingClientRect().height))),
           scrolls: sc.scrollHeight > sc.clientHeight };
});
say(phone.sideways === 0, `390px: nothing runs off the side (${phone.sideways}px)`);
say(phone.cards >= 7, `390px: every card is rendered (${phone.cards})`);
say(phone.shortest > 100, `390px: no card is squeezed to nothing (shortest ${phone.shortest}px)`);
say(phone.scrolls, "390px: the page scrolls, rather than hiding what will not fit");


/* ── and it is drawn the way the board draws it ─────────────────────────── */

await p.setViewport({ width: 1586, height: 1024, deviceScaleFactor: 1 });
await new Promise(x => setTimeout(x, 900));
const look = await p.evaluate(() => {
  const c = document.querySelector("#content");
  const h1 = c.querySelector("h1");
  const em = h1.querySelector("em");
  const btns = [...c.querySelectorAll(".ux-card a")];
  const tile = c.querySelector(".ux-card span");
  const cs = getComputedStyle;
  return {
    serif: /display|Fraunces|serif/i.test(cs(h1).fontFamily),
    heavy: Number(cs(h1).fontWeight) >= 700,
    gradient: cs(em).backgroundImage.includes("gradient")
              && cs(em).webkitTextFillColor === "rgba(0, 0, 0, 0)",
    radii: btns.map(a => Math.round(parseFloat(cs(a).borderRadius))),
    wash: cs(c.querySelector(".ux-card")).backgroundImage.includes("gradient"),
    tinted: cs(tile).backgroundColor !== "rgba(0, 0, 0, 0)"
            && cs(tile).backgroundColor !== cs(document.body).backgroundColor,
    solidIcon: (() => {
      const svg = c.querySelectorAll(".ux-card")[1]?.querySelector("svg");
      return !!svg && cs(svg).fill !== "none";
    })(),
  };
});
say(look.serif && look.heavy, `the headline is the display serif at full weight (${look.serif}/${look.heavy})`);
say(look.gradient, "“your terms” is gradient-filled live text");
say(look.radii.length >= 5 && look.radii.every(r => r >= 20),
    `every card button is a full pill (radii ${look.radii.join(", ")})`);
say(look.wash, "each card is a wash of its own colour, not a flat fill");
say(look.tinted, "the icon tile is a deeper step of the card, not white");
say(look.solidIcon, "the card icons are solid shapes, not outlines");

console.log(bad ? `\n FAIL  ${bad} of 30` : "\n PASS  every part of the board is there, and it fits");
await b.close();
process.exit(bad ? 1 : 0);
