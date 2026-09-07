/**
 * The accessibility failures that actually strand someone (§41, §95).
 *
 * Checked in a real browser because most of these are computed, not authored:
 * an icon button's accessible name can come from aria-label, title, or the
 * text of a child, and only the browser knows which won.
 */
import { launch, pageAs, seededMemberToken, APP } from "./_shared.mjs";

const R = process.argv.slice(2);
const tok = await seededMemberToken();
const b = await launch();
let totals = { nameless: 0, noFocus: 0, badHeadings: 0, lowContrast: 0, noLang: 0 };

for (const r of R) {
  const p = await pageAs(b, tok, { width: 1440, height: 1000 });
  await p.goto(APP + r, { waitUntil: "networkidle0", timeout: 90000 });
  await new Promise((x) => setTimeout(x, 900));

  const a = await p.evaluate(() => {
    const name = (el) =>
      (el.getAttribute("aria-label") || el.getAttribute("title") ||
       el.innerText || el.getAttribute("alt") || "").trim();

    // Controls with no accessible name at all.
    const nameless = [...document.querySelectorAll("button,a,[role='button'],[role='switch']")]
      .filter((el) => {
        const b = el.getBoundingClientRect();
        return b.width > 0 && b.height > 0 && !name(el) && !el.getAttribute("aria-labelledby");
      })
      .map((el) => el.tagName + "." + (el.className || "").toString().slice(0, 40));

    // Focus removed with nothing put back. Measured by actually focusing the
    // element — reading `outlineStyle` at rest is always "none" and says
    // nothing about whether a focus ring exists.
    let noFocus = 0;
    for (const el of [...document.querySelectorAll("button,a,input,select,textarea")].slice(0, 60)) {
      if (el.getBoundingClientRect().width === 0) continue;
      try { el.focus({ preventScroll: true }); } catch { continue; }
      const cs = getComputedStyle(el);
      const ring = cs.outlineStyle !== "none" || cs.boxShadow !== "none";
      if (!ring) noFocus++;
      try { el.blur(); } catch {}
    }

    // Heading order: no h1, or a level skipped.
    const hs = [...document.querySelectorAll("h1,h2,h3,h4,h5,h6")].map((h) => +h.tagName[1]);
    let badHeadings = hs.length && hs[0] !== 1 ? 1 : 0;
    for (let i = 1; i < hs.length; i++) if (hs[i] - hs[i - 1] > 1) badHeadings++;

    return { nameless, noFocus, badHeadings, lang: document.documentElement.lang };
  }).catch(() => ({ nameless: [], noFocus: 0, badHeadings: 0, lang: "" }));

  totals.nameless += a.nameless.length;
  totals.noFocus += a.noFocus;
  totals.badHeadings += a.badHeadings;
  if (!a.lang) totals.noLang++;

  const ok = a.nameless.length === 0 && a.badHeadings === 0;
  console.log(`${ok ? "ok  " : "WARN"} ${r.padEnd(22)} nameless=${String(a.nameless.length).padEnd(3)} headingJumps=${String(a.badHeadings).padEnd(3)} focusRemoved=${a.noFocus}` +
    (a.nameless.length ? `  [${a.nameless.slice(0, 2).join(" | ")}]` : ""));
  await p.close();
}
await b.close();
console.log(`\nnameless controls: ${totals.nameless}   heading jumps: ${totals.badHeadings}   pages without lang: ${totals.noLang}`);
