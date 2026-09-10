import puppeteer from "puppeteer-core";
import { CHROME, APP, seededMemberToken } from "./_shared.mjs";
const ROUTES = ["/app","/app/learn","/app/work","/app/earn","/app/circle",
                "/app/programs","/app/mentors","/app/opportunities","/app/wallet",
                "/app/money","/app/documents","/app/market","/app/sakhi","/app/settings"];
const tok = await seededMemberToken();
const b = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox"] });
const p = await b.newPage();
await p.setCookie({ name: "access_token", value: tok, domain: "localhost", path: "/" });
await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
let bad = 0;
for (const r of ROUTES) {
  try {
    await p.goto(APP + r, { waitUntil: "domcontentloaded", timeout: 60000 });
    await new Promise(x => setTimeout(x, 1600));
    const m = await p.evaluate(() => {
      const de = document.documentElement;
      // `sr-only` controls are clipped to 1px until focused — a skip link is
      // not something a thumb aims at, and counting it reports a fault that
      // cannot be fixed without breaking the accessibility feature itself.
      const taps = [...document.querySelectorAll('a,button,[role="button"],input,select')]
        .filter(e => !e.closest('.sr-only') && !e.className?.toString().includes('sr-only'))
        .filter(e => { const x = e.getBoundingClientRect();
          return x.width > 1 && x.height > 1 && (x.width < 44 || x.height < 44); }).length;
      const small = [...document.querySelectorAll("p,span,li,label")]
        .filter(e => [...e.childNodes].some(n => n.nodeType===3 && n.textContent.trim().length>12))
        .filter(e => parseFloat(getComputedStyle(e).fontSize) < 12).length;
      return { over: Math.round(de.scrollWidth - de.clientWidth), taps, small };
    });
    const ok = m.over === 0 && m.taps === 0 && m.small === 0;
    if (!ok) bad++;
    console.log(`  ${ok ? "ok  " : "FAIL"} ${r.padEnd(22)} overflow ${String(m.over).padStart(3)}  small-taps ${String(m.taps).padStart(3)}  tiny-text ${m.small}`);
  } catch (e) { bad++; console.log(`  ERR  ${r} ${String(e).slice(0,50)}`); }
}
console.log(`\n  ${ROUTES.length - bad}/${ROUTES.length} clean at 390x844`);
await b.close();
