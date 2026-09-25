import { createRequire } from "node:module";
import { readFileSync, writeFileSync } from "node:fs";
const require = createRequire("/Users/praveenmaddela/Desktop/PRAKMAS-GLOBAL/womencrafts-frontend/frontend/package.json");
const puppeteer = require("puppeteer-core");
const [S] = process.argv.slice(2);
const b = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: "new", args: ["--no-sandbox"] });
const p = await b.newPage();
await p.setViewport({ width: 1123, height: 794 });
await p.goto("file://" + S + "/measure.html", { waitUntil: "networkidle0", timeout: 90000 });
await p.evaluateHandle("document.fonts.ready");
await new Promise(r => setTimeout(r, 700));
const h = await p.evaluate(() => {
  const out = {};
  document.querySelectorAll(".t-branch").forEach(el => {
    const name = el.querySelector(".t-root b")?.textContent?.trim();
    if (name) out[name] = Math.ceil(el.getBoundingClientRect().height);
  });
  return out;
});
writeFileSync(S + "/heights.json", JSON.stringify(h, null, 1));
console.log("measured", Object.keys(h).length, "branches:", Object.entries(h).map(([k,v]) => `${k.split(" ")[0]}=${v}`).join(" "));
await b.close();
