import puppeteer from "puppeteer-core";
import { CHROME, APP, seededMemberToken } from "./_shared.mjs";
const OUT = "/private/tmp/claude-501/-Users-praveenmaddela-Desktop-PRAKMAS-GLOBAL/ab20bff5-1632-4dd1-8eb2-2ed0e468a687/scratchpad";
const tok = await seededMemberToken();
const b = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox"] });
const p = await b.newPage();
await p.setCookie({ name: "access_token", value: tok, domain: "localhost", path: "/" });
await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await p.goto(APP + "/app", { waitUntil: "domcontentloaded", timeout: 90000 });
await new Promise(r => setTimeout(r, 2500));
const m = await p.evaluate(() => {
  const bar = document.querySelector(".ux-topbar") || document.querySelector("header");
  if (!bar) return { none: true };
  const r = bar.getBoundingClientRect();
  const kids = [...bar.querySelectorAll("a,button")].map(e => {
    const b = e.getBoundingClientRect();
    return { t: (e.getAttribute("aria-label") || e.textContent || "").trim().slice(0,18),
             x: Math.round(b.x), w: Math.round(b.width), h: Math.round(b.height) };
  });
  return { h: Math.round(r.height), w: Math.round(r.width),
           over: Math.round(r.right - window.innerWidth), kids };
});
console.log(JSON.stringify(m, null, 1));
await p.screenshot({ path: `${OUT}/topbar.png`, clip: { x: 0, y: 0, width: 390, height: 170 } });
await b.close();
