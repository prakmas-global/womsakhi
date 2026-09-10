import puppeteer from "puppeteer-core";
import { CHROME, APP, seededMemberToken } from "./_shared.mjs";
const out = process.argv[2] || "/tmp/shot.png";
const W = +(process.argv[3] || 1586), H = +(process.argv[4] || 992);
const route = process.argv[5] || "/app/learn";
const mode = process.argv[6] || "light";
const tok = await seededMemberToken();
const b = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox"] });
const p = await b.newPage();
await p.setCookie({ name: "access_token", value: tok, domain: "localhost", path: "/" });
await p.setCookie({ name: "theme", value: mode, domain: "localhost", path: "/" });
await p.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
await p.goto(APP + route, { waitUntil: "domcontentloaded", timeout: 180000 });
await p.waitForFunction(() => (document.querySelector("#content")?.innerText ?? "").length > 40, { timeout: 90000 }).catch(()=>{});
await new Promise(x => setTimeout(x, 2600));
await p.screenshot({ path: out });
const m = await p.evaluate(() => {
  const sc = document.getElementById("ux-scroll");
  return { over: sc ? sc.scrollHeight - sc.clientHeight : null,
           side: document.documentElement.scrollWidth - document.documentElement.clientWidth };
});
console.log(out, JSON.stringify(m));
await b.close();
