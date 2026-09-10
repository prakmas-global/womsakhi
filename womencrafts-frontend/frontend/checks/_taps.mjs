import puppeteer from "puppeteer-core";
import { CHROME, APP, seededMemberToken } from "./_shared.mjs";
const tok = await seededMemberToken();
const b = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox"] });
const p = await b.newPage();
await p.setCookie({ name: "access_token", value: tok, domain: "localhost", path: "/" });
await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
for (const r of ["/app","/app/settings"]) {
  await p.goto(APP + r, { waitUntil: "domcontentloaded", timeout: 60000 });
  await new Promise(x => setTimeout(x, 2000));
  const bad = await p.evaluate(() =>
    [...document.querySelectorAll('a,button,[role="button"],input,select')]
      .filter(e => !e.closest('.sr-only') && !String(e.className||'').includes('sr-only'))
      .map(e => { const b = e.getBoundingClientRect(); return { e, b }; })
      .filter(({b}) => b.width > 1 && b.height > 1 && (b.width < 44 || b.height < 44))
      .map(({e,b}) => ({ tag: e.tagName.toLowerCase(),
                         cls: (typeof e.className === "string" ? e.className : "").slice(0,60),
                         w: Math.round(b.width), h: Math.round(b.height),
                         txt: (e.textContent||"").trim().slice(0,26),
                         label: e.getAttribute("aria-label") || "" })));
  console.log(`\n ${r}`);
  bad.forEach(x => console.log(`   ${x.w}x${x.h}  <${x.tag}> "${x.txt||x.label}"  ${x.cls}`));
}
await b.close();
