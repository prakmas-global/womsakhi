import puppeteer from "puppeteer-core";
import { CHROME } from "./_shared.mjs";
const WEB = "https://womsakhi-web-574825618745.asia-south1.run.app";
const OUT = "/private/tmp/claude-501/-Users-praveenmaddela-Desktop-PRAKMAS-GLOBAL/ab20bff5-1632-4dd1-8eb2-2ed0e468a687/scratchpad";
const b = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox"] });
const p = await b.newPage();
const bad = [];
p.on("response", r => { if (r.status() >= 400 && !r.url().includes("favicon")) bad.push(`${r.status()} ${r.url().slice(0,90)}`); });
await p.setViewport({ width: 1586, height: 992 });
await p.goto(`${WEB}/signin`, { waitUntil: "networkidle2", timeout: 120000 });

await p.type('input[type="email"], input[name="email"]', "priya.sharma@example.com", { delay: 12 });
await p.type('input[type="password"], input[name="password"]', "Womsakhi!2026", { delay: 12 });
await Promise.all([
  p.waitForNavigation({ waitUntil: "networkidle2", timeout: 120000 }).catch(() => {}),
  p.click('button[type="submit"]'),
]);
await new Promise(r => setTimeout(r, 6000));
console.log("after login →", p.url());
await p.screenshot({ path: `${OUT}/prod-after-login.png` });

await p.goto(`${WEB}/app/earn`, { waitUntil: "networkidle2", timeout: 120000 });
await new Promise(r => setTimeout(r, 5000));
console.log("earn →", p.url());
const seen = await p.evaluate(() => {
  const c = document.querySelector("#content");
  return { has: !!c, cards: document.querySelectorAll("[data-earn-card]").length,
           text: (c?.innerText || document.body.innerText || "").replace(/\n/g," | ").slice(0,150) };
});
console.log("earn board:", JSON.stringify(seen));
await p.screenshot({ path: `${OUT}/prod-earn2.png` });
console.log("4xx/5xx responses:", bad.length); bad.slice(0,6).forEach(x => console.log("   ", x));
await b.close();
