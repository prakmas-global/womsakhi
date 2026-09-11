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
      // The ERROR dialog only. `nextjs-portal` is present for the ordinary dev
      // indicator and for warning toasts too, and failing a route because a
      // hydration WARNING was logged is its own kind of false report — the
      // screen rendered fine.
      const portal = document.querySelector("nextjs-portal");
      const overlay = !!(portal?.shadowRoot?.querySelector("[data-nextjs-dialog]"));
      const content = document.querySelector("#content");
      const rendered = !!content && content.innerText.trim().length > 40;
      if (overlay || !rendered) return { broken: true, overlay: !!overlay, rendered };

      const de = document.documentElement;
      /*
        Text a reader cannot reach.

        Three earlier versions of this measured the wrong thing and each one
        over-reported, which is worse than under-reporting because it buries
        the real faults:

          `document.scrollWidth` — missed everything clipped INSIDE a card,
          which is the most common phone failure there is.

          element `scrollWidth` — counted `truncate` (an ellipsis on purpose)
          and every decorative glow deliberately bleeding past an
          `overflow-hidden` edge. /app/help's "56px cut" was a 220px radial
          positioned -56px off the right edge, working exactly as drawn.

        So it asks the only question that matters: is there TEXT whose box
        extends past its clipping ancestor, with no way to scroll to it? A
        decorative span has no text. An ellipsis is handled by the browser and
        is legible. A sentence running under a hard edge is none of those.
      */
      const clipped = [];
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      const seen = new Set();
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        const txt = n.textContent.trim();
        if (txt.length < 8) continue;
        const el = n.parentElement;
        if (!el || seen.has(el)) continue;
        if (el.closest("[aria-hidden='true']")) continue;
        const cs = getComputedStyle(el);
        if (cs.textOverflow === "ellipsis") continue;   // legible by design
        /*
          Invisible elements have a zero-size box, and comparing a zero box
          against its container reports the container's own left offset as an
          overflow. /app/journey's "Practice" and "Get opportunities" are
          `hidden wide:flex` — and `wide:` is not a registered breakpoint in
          this project (`--breakpoint-wide` lives in `design-system/tokens.css`,
          not in the `@theme` block Tailwind reads), so `wide:flex` compiles to
          nothing and `hidden` simply wins. They are display:none, not clipped.
        */
        if (cs.display === "none" || cs.visibility === "hidden") continue;
        /*
          ...and `display:none` on an ANCESTOR does not show up in the child's
          own computed style — `getComputedStyle(li).display` is still
          `list-item` when its `<ul>` is hidden. The rendered box is the only
          honest test: an element that generates no boxes is not on screen.
        */
        if (el.getClientRects().length === 0) continue;
        // the nearest ancestor that actually clips
        let clip = el.parentElement;
        while (clip && clip !== document.body) {
          const c = getComputedStyle(clip);
          if (c.overflowX === "hidden" || c.overflowX === "clip") break;
          if (c.overflowX === "auto" || c.overflowX === "scroll") { clip = null; break; }
          clip = clip.parentElement;
        }
        if (!clip || clip === document.body) continue;
        const eb = el.getBoundingClientRect(), cb = clip.getBoundingClientRect();
        const over = Math.round(Math.max(eb.right - cb.right, cb.left - eb.left));
        if (over > 4) {
          seen.add(el);
          clipped.push({ tag: el.tagName.toLowerCase(), over,
                         cls: String(el.className || "").slice(0, 40),
                         txt: txt.slice(0, 34) });
        }
      }
      clipped.sort((a, b) => b.over - a.over);

      const taps = [...document.querySelectorAll('a,button,[role="button"],input,select')]
        .filter(e => !e.closest(".sr-only") && !String(e.className||"").includes("sr-only"))
        /*
          A link inside a sentence is exempt under WCAG 2.5.8, and rightly:
          making it 44px tall tears the line spacing of the paragraph it lives
          in, which costs more legibility than the bigger target buys. The test
          is whether it has a text-bearing paragraph or list-item ancestor.
        */
        .filter(e => !(e.tagName === "A" && e.closest("p, li")))
        .filter(e => { const x = e.getBoundingClientRect();
          return x.width > 1 && x.height > 1 && (x.width < 44 || x.height < 44); }).length;
      const small = [...document.querySelectorAll("p,span,li,label,div")]
        .filter(e => [...e.childNodes].some(n => n.nodeType===3 && n.textContent.trim().length>12))
        .filter(e => parseFloat(getComputedStyle(e).fontSize) < 12).length;
      return { over: Math.round(de.scrollWidth - de.clientWidth), taps, small,
               clipped: clipped.slice(0, 3) };
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
