/** Home uses the shared banner geometry and preserves its complete artwork. */
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
  const im = [...c.querySelectorAll('img[src*="home-banner"]')].find((image) => image.getBoundingClientRect().width > 0);
    const hrefs = [...c.querySelectorAll("a")].map(a => a.getAttribute("href"));
  return {
    there: !!im,
    decoded: !!im && im.naturalWidth > 0,
    bannerHeight: im?.closest("[data-banner]")?.getBoundingClientRect().height,
    fit: im ? getComputedStyle(im).objectFit : "",
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
say(m.bannerHeight === 320 && m.fit === "contain",
    `desktop: shared 320px banner preserves the complete artwork (${m.bannerHeight}px, ${m.fit})`);
say(m.alt.length > 40 && /Independent Women/.test(m.alt),
    "it has a real description — its words are baked in, so it is not decoration");
say(m.eager, "it is not lazy-loaded; it is the first thing on the first screen");
say(m.greeting, "her greeting is still there, under the picture rather than over it");
say(m.tagline, "and the tagline reads “Connect. Learn. Earn. Grow. Together.”");
say(m.explore && m.watch, "both actions survived the rebuild (Explore Opportunities, Watch Inspiration)");

await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
await new Promise(x => setTimeout(x, 1200));
const phone = await p.evaluate(() => {
  const im = [...document.querySelectorAll('#content img[src*="home-banner"]')].find((image) => image.getBoundingClientRect().width > 0);
  const r = im.getBoundingClientRect();
  return { sideways: document.documentElement.scrollWidth - document.documentElement.clientWidth,
           w: Math.round(r.width), h: Math.round(r.height),
           bannerHeight: im.closest("[data-banner]")?.getBoundingClientRect().height,
           fit: getComputedStyle(im).objectFit };
});
say(phone.sideways === 0, `390px: nothing runs off the side (${phone.sideways}px)`);
say(phone.bannerHeight === 360 && phone.fit === "contain", `390px: shared 360px banner preserves the complete artwork (${phone.bannerHeight}px)`);

console.log(bad ? `\n FAIL  ${bad} of 9` : "\n PASS  the banner is whole, described, and hers underneath");
await b.close();
process.exit(bad ? 1 : 0);
