import puppeteer from "puppeteer-core";
import { CHROME } from "./_shared.mjs";
const OUT = "/private/tmp/claude-501/-Users-praveenmaddela-Desktop-PRAKMAS-GLOBAL/ab20bff5-1632-4dd1-8eb2-2ed0e468a687/scratchpad";
const b = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox"] });
for (const [name, w, h] of [["site-desk", 1440, 900], ["site-mob", 390, 844]]) {
  const p = await b.newPage();
  await p.setViewport({ width: w, height: h, deviceScaleFactor: 2 });
  await p.goto("http://localhost:3200/", { waitUntil: "networkidle2", timeout: 180000 });
  await new Promise(r => setTimeout(r, 4500));
  await p.screenshot({ path: `${OUT}/${name}.png` });
  console.log(` ${name}`, JSON.stringify(await p.evaluate(() => ({
    overflow: Math.round(document.documentElement.scrollWidth - document.documentElement.clientWidth),
    h1: document.querySelector("h1")?.textContent?.trim().slice(0, 50),
    canvas: !!document.querySelector("canvas"),
  }))));
  await p.close();
}
await b.close();
