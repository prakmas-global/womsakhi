import puppeteer from "puppeteer-core";
import { CHROME, APP, seededMemberToken } from "./_shared.mjs";
const OUT = process.env.OUT;
const tok = await seededMemberToken();
const ROUTES = ["/app", "/app/learn", "/app/work", "/app/earn", "/app/circle",
                "/app/helpdesk", "/app/you", "/app/shop/pricing", "/app/wallet/statement"];
for (const r of ROUTES) await fetch(APP + r, { headers: { Cookie: `access_token=${tok}` } }).catch(()=>{});

const b = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox"] });
const p = await b.newPage();
await p.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 2 });
await p.setCookie({ name: "access_token", value: tok, domain: "localhost", path: "/" });
const errs = [];
p.on("pageerror", e => errs.push(String(e).slice(0,140)));
p.on("console", m => { if (m.type()==="error") errs.push(m.text().slice(0,140)); });

for (const r of ROUTES) {
  await p.goto(APP + r, { waitUntil: "domcontentloaded", timeout: 60000 });
  await new Promise(x => setTimeout(x, 2200));
  const m = await p.evaluate(() => {
    const t = document.body.innerText;
    const rail = document.querySelector("aside");
    const railText = rail ? rail.innerText.replace(/\n+/g, " · ").slice(0, 120) : "(none)";
    const back = [...document.querySelectorAll("a")].find(a => /^Back to /.test(a.innerText.trim()));
    return { chars: t.length, h1: document.querySelector("h1")?.innerText.slice(0,34) ?? "-",
             rail: railText, back: back ? back.innerText.trim() : null,
             over: Math.max(0, document.documentElement.scrollWidth - innerWidth) };
  });
  console.log(`  ${r.padEnd(22)} ${String(m.chars).padStart(5)}ch  h1:${m.h1.padEnd(26)} back:${m.back ?? "-"}`);
  if (r === "/app/earn" || r === "/app/shop/pricing") await p.screenshot({ path: `${OUT}/nav-${r.replace(/\//g,"_")}.png` });
}
console.log("  rail sample:", (await p.evaluate(() => document.querySelector("aside")?.innerText.replace(/\n+/g," · ").slice(0,200))) ?? "-");
console.log(errs.length ? "\n  errors: " + [...new Set(errs)].slice(0,4).join("\n    ") : "\n  no console errors");
await b.close();
