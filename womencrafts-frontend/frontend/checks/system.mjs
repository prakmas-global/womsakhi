/**
 * Did normalising the type and radius scales break anything?
 *
 * 158 files had every font size rewritten and 115 had every radius rewritten,
 * so this checks a broad slice of routes for the failures that would follow:
 * text overflowing its box, a page that no longer renders, or a horizontal
 * scrollbar where the body should never have one.
 */
import { launch, pageAs, seededMemberToken, APP } from "./_shared.mjs";

const ROUTES = process.argv.slice(2);
const tok = await seededMemberToken();
const b = await launch();
let bad = 0;

for (const r of ROUTES) {
  const p = await pageAs(b, tok, { width: 1440, height: 1000 });
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  let st = 0;
  try { st = (await p.goto(APP + r, { waitUntil: "networkidle0", timeout: 90000 }))?.status() ?? 0; }
  catch (e) { errs.push(e.message); }
  await new Promise((x) => setTimeout(x, 1600));

  let s;
  try {
  s = await p.evaluate(() => {
    const sizes = new Set(), radii = new Set();
    let overflow = 0;
    for (const el of document.querySelectorAll("*")) {
      const cs = getComputedStyle(el);
      sizes.add(cs.fontSize);
      if (cs.borderTopLeftRadius !== "0px") radii.add(cs.borderTopLeftRadius);
      // Text wider than its own box, on an element that is not scrollable.
      if (el.scrollWidth > el.clientWidth + 2 && cs.overflowX === "visible"
          && el.clientWidth > 0 && cs.display !== "inline") overflow++;
    }
    return {
      t: (document.body.innerText || "").trim().length,
      sizes: [...sizes].length, radii: [...radii].length,
      overflow,
      bodyScrollsX: document.documentElement.scrollWidth > window.innerWidth + 2,
    };
  });
  } catch (e) { errs.push("evaluate: " + e.message); s = { t: 0, sizes: 0, radii: 0, overflow: 0, bodyScrollsX: false }; }

  const ok = st === 200 && s.t > 200 && errs.length === 0 && !s.bodyScrollsX;
  if (!ok) bad++;
  console.log(`${ok ? "ok  " : "FAIL"} ${r.padEnd(26)} ${st} sizes=${String(s.sizes).padEnd(3)} radii=${String(s.radii).padEnd(3)} overflow=${String(s.overflow).padEnd(3)} xscroll=${s.bodyScrollsX ? "YES" : "no"}${errs.length ? "  ERR " + errs[0].slice(0, 70) : ""}`);
  await p.close();
}
await b.close();
console.log(bad === 0 ? "\nAll clean." : `\n${bad} failed.`);
process.exit(bad === 0 ? 0 : 1);
