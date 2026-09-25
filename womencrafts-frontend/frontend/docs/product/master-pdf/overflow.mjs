import { createRequire } from "node:module";
const require = createRequire("/Users/praveenmaddela/Desktop/PRAKMAS-GLOBAL/womencrafts-frontend/frontend/package.json");
const puppeteer = require("puppeteer-core");
const b = await puppeteer.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: "new", args: ["--no-sandbox"] });
const p = await b.newPage();
await p.setViewport({ width: 1123, height: 794 });
await p.goto("file://" + process.argv[2], { waitUntil: "networkidle0", timeout: 90000 });
await p.evaluateHandle("document.fonts.ready");
await new Promise(r => setTimeout(r, 900));
const res = await p.evaluate(() => {
  const out = [];
  document.querySelectorAll(".page").forEach((pg, i) => {
    const cs = getComputedStyle(pg);
    const padB = parseFloat(cs.paddingBottom), padR = parseFloat(cs.paddingRight);
    const r = pg.getBoundingClientRect();
    const limitY = r.bottom - padB, limitX = r.right - padR;
    let worstY = 0, worstX = 0, whoY = "", whoX = "";
    pg.querySelectorAll("*").forEach(e => {
      const er = e.getBoundingClientRect();
      if (!er.height) return;
      // decoration is allowed to bleed; content is not. Marked explicitly so
      // this is a decision in the document, not a guess in the checker.
      if (e.hasAttribute("data-decor") || e.closest("[data-decor]")) return;
      let n = e.parentElement, clipped = false;
      while (n && n !== pg) {
        const s2 = getComputedStyle(n);
        if (s2.overflow === "hidden" || s2.overflowX === "hidden" || s2.overflowY === "hidden") { clipped = true; break; }
        n = n.parentElement;
      }
      if (clipped) return;
      const oy = er.bottom - limitY, ox = er.right - limitX;
      if (oy > worstY) { worstY = oy; whoY = (e.className||e.tagName).toString().split(" ")[0] + " «" + (e.textContent||"").trim().slice(0,28) + "»"; }
      if (ox > worstX) { worstX = ox; whoX = (e.className||e.tagName).toString().split(" ")[0]; }
    });
    const title = (pg.querySelector(".ptitle")?.textContent || pg.querySelector(".dv-body h2")?.textContent || pg.querySelector("h1")?.textContent || "—").trim().replace(/\s+/g," ").slice(0, 34);
    out.push({ i: i + 1, title, scroll: Math.round(pg.scrollHeight - pg.clientHeight),
               overY: Math.round(worstY), whoY, overX: Math.round(worstX), whoX });
  });
  return out;
});
for (const r of res) {
  const bad = r.overY > 1 || r.overX > 1 || r.scroll > 2;
  console.log(`${bad ? "OVERFLOW" : "   ok   "} p${String(r.i).padStart(2)} ${r.title.padEnd(34)}` +
    (bad ? ` scroll +${r.scroll}px · down ${r.overY}px · right ${r.overX}px [${r.whoX || r.whoY}]` : ""));
}
await b.close();
