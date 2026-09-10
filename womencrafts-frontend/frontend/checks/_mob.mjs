import puppeteer from "puppeteer-core";
import { CHROME, APP, seededMemberToken } from "./_shared.mjs";
const OUT = "/private/tmp/claude-501/-Users-praveenmaddela-Desktop-PRAKMAS-GLOBAL/ab20bff5-1632-4dd1-8eb2-2ed0e468a687/scratchpad";
const tok = await seededMemberToken();
const b = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox"] });
const p = await b.newPage();
await p.setCookie({ name: "access_token", value: tok, domain: "localhost", path: "/" });
await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
for (const [name, route] of [["mob-home", "/app"], ["mob-earn", "/app/earn"]]) {
  await p.goto(APP + route, { waitUntil: "domcontentloaded", timeout: 120000 });
  await new Promise(r => setTimeout(r, 3500));
  await p.screenshot({ path: `${OUT}/${name}.png` });
  const m = await p.evaluate(() => ({
    overflow: Math.round(document.documentElement.scrollWidth - document.documentElement.clientWidth),
    cards: document.querySelectorAll(".ux-card").length,
    shadow: getComputedStyle(document.querySelector(".ux-card") || document.body).boxShadow.slice(0, 30),
    tabbar: !!document.querySelector(".ux-tabbar, nav[class*='fixed'][class*='bottom']"),
  }));
  console.log(` ${route}`, JSON.stringify(m));
}
await b.close();
