/**
 * The rail opens the section she is in, and shuts the rest.
 *
 * Two bugs this guards, both of which were invisible until measured:
 *
 *   Giving each section a hub of its own broke `trailFor`. It skipped any
 *   node that did not own the path by string prefix, and `/app/earn` is not a
 *   prefix of `/app/shop/pricing` — so the walk never went inside Earn. Every
 *   section sat shut and nothing was marked current on sixty-odd screens.
 *
 *   A closed section still renders its links, because that is what lets the
 *   panel animate to its own height. They must be unreachable by keyboard
 *   while it is closed, or Tab walks into a section that is not on screen.
 */
import puppeteer from "puppeteer-core";
import { CHROME, APP, seededMemberToken } from "./_shared.mjs";
const tok = await seededMemberToken();
const b = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox"] });
const p = await b.newPage();
await p.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 2 });
await p.setCookie({ name: "access_token", value: tok, domain: "localhost", path: "/" });
await p.goto(APP + "/app/shop/pricing", { waitUntil: "domcontentloaded", timeout: 180000 });
await new Promise(x => setTimeout(x, 2600));
const m = await p.evaluate(() => {
  const rail = document.querySelector('aside nav[aria-label="Sections"]');
  const rows = [...rail.querySelectorAll(":scope > div")].map(d => {
    const link = d.querySelector("a");
    const rev = d.querySelector(".ux-reveal");
    const kids = rev ? [...rev.querySelectorAll("a")] : [];
    return {
      section: link.innerText.trim().split("\n")[0],
      open: rev?.getAttribute("data-open") === "true",
      panelH: rev ? Math.round(rev.getBoundingClientRect().height) : 0,
      kidsFocusable: kids.filter(a => a.tabIndex !== -1).length,
      kidsVisible: kids.filter(a => a.getBoundingClientRect().height > 1).length,
      current: kids.filter(a => a.getAttribute("aria-current") === "page").map(a => a.innerText.trim()),
    };
  });
  const marked = [...rail.querySelectorAll('[aria-current="page"]')].map(a => a.innerText.trim());
  return { rows, marked };
});
for (const r of m.rows)
  console.log(`  ${r.open ? "OPEN " : "shut "} ${r.section.padEnd(8)} panel ${String(r.panelH).padStart(4)}px · visible kids ${r.kidsVisible} · focusable ${r.kidsFocusable}${r.current.length ? " · current: " + r.current.join(",") : ""}`);
console.log(`\n  exactly one thing marked current: ${m.marked.length === 1 ? "yes — " + m.marked[0] : "NO — " + JSON.stringify(m.marked)}`);
if (process.env.OUT) await p.screenshot({ path: `${process.env.OUT}/rail.png`, clip: { x: 0, y: 80, width: 300, height: 900 } });
await b.close();

let bad = 0;
const open = m.rows.filter((r) => r.open);
const shut = m.rows.filter((r) => !r.open);
const say = (ok, msg) => { console.log(`  ${ok ? "ok  " : "FAIL"}  ${msg}`); if (!ok) bad++; };

say(open.length === 1, `exactly one section is open (${open.map((r) => r.section).join(",") || "none"})`);
say(open.every((r) => r.panelH > 40), "the open section has real height");
say(shut.every((r) => r.panelH === 0), "every other section is at zero height");
say(shut.every((r) => r.kidsFocusable === 0), "a closed section's links are not reachable by keyboard");
say(m.marked.length === 1, `exactly one item is marked current (${m.marked.join(",") || "none"})`);

console.log(bad ? `\n FAIL  ${bad} of 5` : "\n PASS");
process.exit(bad ? 1 : 0);

