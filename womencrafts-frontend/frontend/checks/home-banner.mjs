/**
 * The front door carries the banner, whole.
 *
 * `bannermain.png` is a finished piece rather than a backdrop: the wordmark,
 * the quote, six women, the globe and the Charminar are composed into it, and
 * every one of them sits close to an edge. The art is 2.5:1 and the hero
 * crops it to 2.8:1, which leaves very little margin — "A Brighter Tomorrow"
 * begins at 7.5% of the height, the tallest head at 8%, the wordmark at 13%.
 * A crop tightened to 3.05:1 took the lettering's top off, and nothing about
 * the page looked wrong; it just quietly lost a piece of the picture.
 *
 * So this checks the ratio as a number, not the look — and that it is real
 * content with a real description, because a banner whose words are baked in
 * is not decoration and cannot be left to `alt=""`.
 */
import puppeteer from "puppeteer-core";
import { CHROME, APP, seededMemberToken } from "./_shared.mjs";

const tok = await seededMemberToken();
const b = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox"] });
const p = await b.newPage();
await p.setCookie({ name: "access_token", value: tok, domain: "localhost", path: "/" });
await p.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
await p.goto(APP + "/app", { waitUntil: "domcontentloaded", timeout: 180000 });
await p.waitForFunction(() => /Connect\. Learn/.test(document.querySelector("#content")?.innerText ?? ""),
                        { timeout: 90000 });
await new Promise(x => setTimeout(x, 2200));

let bad = 0;
const say = (ok, msg) => { console.log(`  ${ok ? "ok  " : "FAIL"}  ${msg}`); if (!ok) bad++; };

const m = await p.evaluate(() => {
  const c = document.querySelector("#content");
  const im = c.querySelector('img[src*="home-banner"]');
  const box = im?.getBoundingClientRect();
  const hrefs = [...c.querySelectorAll("a")].map(a => a.getAttribute("href"));
  return {
    there: !!im,
    decoded: !!im && im.naturalWidth > 0,
    ratio: box ? +(box.width / box.height).toFixed(2) : 0,
    natural: im ? +(im.naturalWidth / im.naturalHeight).toFixed(2) : 0,
    alt: im?.getAttribute("alt") ?? "",
    eager: im?.loading !== "lazy",
    greeting: /Good (morning|afternoon|evening), /.test(c.innerText),
    explore: hrefs.includes("/app/opportunities"),
    watch: hrefs.includes("/app/stories"),
    tagline: /Connect\. Learn\. Earn\. Grow\. Together\./.test(c.innerText),
  };
});

say(m.there && m.decoded, "the banner is on the home page and decoded");
say(m.ratio >= 2.7 && m.ratio <= 2.9,
    `it is cropped to 2.8:1, not tighter (drawn at ${m.ratio}:1, art is ${m.natural}:1)`);
say(m.alt.length > 40 && /Independent Women/.test(m.alt),
    "it has a real description — its words are baked in, so it is not decoration");
say(m.eager, "it is not lazy-loaded; it is the first thing on the first screen");
say(m.greeting, "her greeting is still there, under the picture rather than over it");
say(m.tagline, "and the tagline reads “Connect. Learn. Earn. Grow. Together.”");
say(m.explore && m.watch, "both actions survived the rebuild (Explore Opportunities, Watch Inspiration)");

await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
await new Promise(x => setTimeout(x, 1200));
const phone = await p.evaluate(() => {
  const im = document.querySelector('#content img[src*="home-banner"]');
  const r = im.getBoundingClientRect();
  return { sideways: document.documentElement.scrollWidth - document.documentElement.clientWidth,
           w: Math.round(r.width), h: Math.round(r.height) };
});
say(phone.sideways === 0, `390px: nothing runs off the side (${phone.sideways}px)`);
say(phone.h > 90 && phone.h < 200, `390px: the banner is still legible, not a letterbox (${phone.w}x${phone.h})`);

console.log(bad ? `\n FAIL  ${bad} of 9` : "\n PASS  the banner is whole, described, and hers underneath");
await b.close();
process.exit(bad ? 1 : 0);
