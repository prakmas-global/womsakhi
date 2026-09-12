import puppeteer from "puppeteer-core";
import { CHROME, APP, seededMemberToken } from "./_shared.mjs";
const OUT = "/private/tmp/claude-501/-Users-praveenmaddela-Desktop-PRAKMAS-GLOBAL/ab20bff5-1632-4dd1-8eb2-2ed0e468a687/scratchpad";
const tok = await seededMemberToken();
const b = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox"] });
const p = await b.newPage();
const errs = [];
p.on("console", m => { if (m.type()==="error") errs.push(m.text().slice(0,120)); });
p.on("pageerror", e => errs.push("PAGEERROR " + String(e).slice(0,120)));
await p.setCookie({ name: "access_token", value: tok, domain: "localhost", path: "/" });
await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await p.goto(APP + "/app", { waitUntil: "networkidle2", timeout: 120000 });
await new Promise(r => setTimeout(r, 4000));
await p.screenshot({ path: `${OUT}/mob-home.png` });
const m = await p.evaluate(() => {
  const t = document.body.innerText;
  return {
    overflow: Math.round(document.documentElement.scrollWidth - document.documentElement.clientWidth),
    taps: [...document.querySelectorAll('a,button,input')]
      .filter(e => !String(e.className||"").includes("sr-only"))
      .filter(e => !(e.tagName==="A" && e.closest("p, li")))
      .filter(e => { const b=e.getBoundingClientRect(); return b.width>1&&b.height>1&&(b.width<44||b.height<44); }).length,
    tiny: [...document.querySelectorAll("p,span,li,label,div")]
      .filter(e => [...e.childNodes].some(n=>n.nodeType===3&&n.textContent.trim().length>12))
      .filter(e => parseFloat(getComputedStyle(e).fontSize) < 12).length,
    badNums: (t.match(/NaN|undefined|Infinity|₹0\b/g) || []).length,
    text: t.replace(/\n/g," | ").slice(0,150),
  };
});
console.log("  ", JSON.stringify(m, null, 1));
console.log("  console errors:", errs.length); errs.slice(0,4).forEach(e=>console.log("    ",e));
await b.close();
