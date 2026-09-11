/**
 * The sweep that would have caught /app/journey.
 *
 * The first one measured `document.scrollWidth - clientWidth` and called a
 * screen clean when that was 0. That misses the most common phone failure of
 * all: a row that overflows INSIDE a card. The card has `overflow: hidden`, so
 * the document never grows — the content is simply cut off, silently, with no
 * scrollbar and no way to reach it. On /app/journey the stepper's last label
 * reads "Your first opportunit" and stops.
 *
 * So this measures every element against its own scrollWidth, and reports
 * anything clipped that has no way to be scrolled to.
 */
import puppeteer from "puppeteer-core";
import { CHROME, APP, seededMemberToken } from "./_shared.mjs";
import { readFileSync } from "node:fs";

const ROUTES = JSON.parse(readFileSync(new URL("./_routes2.json", import.meta.url), "utf8"));
const tok = await seededMemberToken();
const b = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox"] });
const p = await b.newPage();
await p.setCookie({ name: "access_token", value: tok, domain: "localhost", path: "/" });
await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });

let bad = 0;
for (const r of ROUTES) {
  try {
    await p.goto(APP + r, { waitUntil: "domcontentloaded", timeout: 45000 });
    await new Promise(x => setTimeout(x, 1300));
    const m = await p.evaluate(() => {
      /*
        Did this screen actually render?

        Next's build-error overlay lives OUTSIDE `#content`, so an audit that
        measures only the content container reports a perfectly clean screen
        while the page is showing a red error box. A 32-screen run came back
        false green exactly this way. Any "is it clean" answer is worthless
        without first answering "is it there".
      */
      const overlay = document.querySelector("nextjs-portal") ||
                      document.querySelector("[data-nextjs-dialog], [data-nextjs-toast]");
      const content = document.querySelector("#content");
      const rendered = !!content && content.innerText.trim().length > 40;
      if (overlay || !rendered) return { broken: true, overlay: !!overlay, rendered };

      const de = document.documentElement;
      // Content cut off inside its own box, with no scroll to reach it.
      const clipped = [];
      for (const el of document.querySelectorAll("body *")) {
        const over = el.scrollWidth - el.clientWidth;
        if (over <= 2) continue;
        const cs = getComputedStyle(el);
        // If it can be scrolled, it is a shelf, not a bug.
        if (cs.overflowX === "auto" || cs.overflowX === "scroll") continue;
        if (cs.overflowX === "visible") continue;   // spills, caught elsewhere
        const b = el.getBoundingClientRect();
        if (b.width < 40 || b.height < 12) continue;
        clipped.push({ tag: el.tagName.toLowerCase(), over,
                       cls: String(el.className || "").slice(0, 48),
                       txt: (el.textContent || "").trim().slice(0, 30) });
      }
      const taps = [...document.querySelectorAll('a,button,[role="button"],input,select')]
        .filter(e => !e.closest(".sr-only") && !String(e.className||"").includes("sr-only"))
        .filter(e => { const x = e.getBoundingClientRect();
          return x.width > 1 && x.height > 1 && (x.width < 44 || x.height < 44); }).length;
      const small = [...document.querySelectorAll("p,span,li,label,div")]
        .filter(e => [...e.childNodes].some(n => n.nodeType===3 && n.textContent.trim().length>12))
        .filter(e => parseFloat(getComputedStyle(e).fontSize) < 12).length;
      return { over: Math.round(de.scrollWidth - de.clientWidth), taps, small,
               clipped: clipped.sort((a,b)=>b.over-a.over).slice(0,3) };
    });
    if (m.broken) { bad++; console.log(`  BROKEN ${r.padEnd(22)} ${m.overlay ? "build-error overlay" : "content never rendered"}`); continue; }
    const ok = m.over === 0 && m.taps === 0 && m.small === 0 && m.clipped.length === 0;
    if (!ok) { bad++;
      console.log(`  FAIL ${r.padEnd(24)} doc ${m.over}  taps ${m.taps}  tiny ${m.small}  clipped ${m.clipped.length}`);
      m.clipped.forEach(c => console.log(`        cut ${c.over}px  <${c.tag}> "${c.txt}"  ${c.cls}`));
    }
  } catch { bad++; console.log(`  ERR  ${r}`); }
}
console.log(`\n  ${ROUTES.length - bad}/${ROUTES.length} clean at 390x844`);
await b.close();
