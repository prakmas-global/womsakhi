import puppeteer from "puppeteer-core";
import { CHROME, APP, seededMemberToken } from "./_shared.mjs";
const tok = await seededMemberToken();
const b = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox"] });
const p = await b.newPage();
await p.setCookie({ name: "access_token", value: tok, domain: "localhost", path: "/" });
await p.setViewport({ width: 1586, height: 992, deviceScaleFactor: 1 });
await p.goto(APP + "/app/learn", { waitUntil: "domcontentloaded", timeout: 180000 });
await p.waitForFunction(() => document.querySelector('#content img[src*="lm-banner"]')?.naturalWidth > 0, { timeout: 120000 });
await new Promise(x => setTimeout(x, 2500));
await p.screenshot({ path: process.env.OUT + "/lb.png" });
// every distinct type size on the page, so nothing is off the scale
console.log(JSON.stringify(await p.evaluate(() => {
  const seen = {};
  document.querySelectorAll("#content *").forEach(el => {
    if (!el.textContent?.trim() || el.children.length) return;
    const cs = getComputedStyle(el);
    const k = `${Math.round(parseFloat(cs.fontSize))}px/${cs.fontWeight}`;
    seen[k] = (seen[k] || 0) + 1;
  });
  return Object.fromEntries(Object.entries(seen).sort((a,b) => parseFloat(b[0]) - parseFloat(a[0])));
})));
await b.close();
