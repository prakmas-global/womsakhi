/*
  The mobile design audit — every member route at 390x844.

  Not "is this screen broken" but "is this app ONE system". A world-class
  mobile app uses a handful of type sizes, one spacing rhythm, one button, one
  pill, one card. This counts how many of each the app actually uses.
*/
import puppeteer from "puppeteer-core";
import { readFileSync, writeFileSync } from "node:fs";
import { CHROME, APP, seededMemberToken } from "./_shared.mjs";

const ROUTES = JSON.parse(readFileSync(process.argv[2], "utf8"));
const OUT = process.argv[3];
const tok = await seededMemberToken();
const b = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox"] });
const results = [];
for (const r of ROUTES) {
  // A fresh tab per screen. Reusing one meant a single timeout detached the
  // frame and every screen after it failed with "detached Frame" — 90 of 110
  // reported as broken for no fault of their own.
  const p = await b.newPage();
  await p.setCookie({ name: "access_token", value: tok, domain: "localhost", path: "/" });
  await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  try {
    await p.goto(APP + r, { waitUntil: "domcontentloaded", timeout: 20000 });
    await new Promise(x => setTimeout(x, 1100));
    const m = await p.evaluate(() => {
      const root = document.querySelector("#content") || document.body;
      if (root.innerText.trim().length < 40) return { broken: true };
      const vis = e => { const r = e.getClientRects(); return r.length > 0 && e.getBoundingClientRect().width > 2; };
      const textEls = [...root.querySelectorAll("*")].filter(vis)
        .filter(e => [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim().length > 1));
      const size = {}, weight = {}, color = {}, lh = {};
      for (const e of textEls) {
        const cs = getComputedStyle(e);
        const fs = Math.round(parseFloat(cs.fontSize) * 2) / 2;
        size[fs] = (size[fs] || 0) + 1;
        weight[cs.fontWeight] = (weight[cs.fontWeight] || 0) + 1;
        color[cs.color] = (color[cs.color] || 0) + 1;
        const l = Math.round((parseFloat(cs.lineHeight) / parseFloat(cs.fontSize)) * 10) / 10;
        if (!isNaN(l)) lh[l] = (lh[l] || 0) + 1;
      }
      // Controls: anything clickable, bucketed by the shape it is drawn as.
      const ctrls = [...root.querySelectorAll("a,button,[role=button],input,select")].filter(vis);
      const btnH = {}, radius = {}, small = [];
      for (const c of ctrls) {
        const r = c.getBoundingClientRect(), cs = getComputedStyle(c);
        const bg = cs.backgroundColor !== "rgba(0, 0, 0, 0)" || cs.backgroundImage !== "none";
        const bordered = parseFloat(cs.borderTopWidth) > 0;
        if (bg || bordered) {
          btnH[Math.round(r.height)] = (btnH[Math.round(r.height)] || 0) + 1;
          radius[cs.borderTopLeftRadius] = (radius[cs.borderTopLeftRadius] || 0) + 1;
        }
        if ((r.width < 44 || r.height < 44) && !c.closest("p") && r.width > 2)
          small.push(`${Math.round(r.width)}x${Math.round(r.height)}`);
      }
      // Card padding: the inner spacing of anything drawn as a card.
      const cards = [...root.querySelectorAll(".ux-card,[class*='rounded-']")].filter(vis)
        .filter(e => { const cs = getComputedStyle(e); return cs.backgroundColor !== "rgba(0, 0, 0, 0)" && e.getBoundingClientRect().width > 200; });
      const pad = {};
      for (const c of cards) { const v = getComputedStyle(c).paddingLeft; pad[v] = (pad[v] || 0) + 1; }
      // Gaps between stacked siblings — the vertical rhythm.
      const gaps = {};
      for (const par of [...root.querySelectorAll("*")].filter(vis)) {
        const kids = [...par.children].filter(vis);
        for (let i = 1; i < kids.length; i++) {
          const g = Math.round(kids[i].getBoundingClientRect().top - kids[i-1].getBoundingClientRect().bottom);
          if (g > 0 && g < 64) gaps[g] = (gaps[g] || 0) + 1;
        }
      }
      const tiny = textEls.filter(e => parseFloat(getComputedStyle(e).fontSize) < 12).length;
      const clipped = textEls.filter(e => getComputedStyle(e).textOverflow !== "ellipsis")
        .filter(e => e.scrollWidth > e.clientWidth + 3).length;
      const scrollRows = [...root.querySelectorAll("*")].filter(vis).filter(e => {
        const cs = getComputedStyle(e);
        return (cs.overflowX === "auto" || cs.overflowX === "scroll") && e.scrollWidth > e.clientWidth + 12;
      }).length;
      const hasBack = [...document.querySelectorAll("header a, header button, #content a, #content button")]
        .filter(vis).some(e => /back|←|‹/i.test((e.getAttribute("aria-label") || "") + " " + (e.innerText || "")));
      return { size, weight, color, lh, btnH, radius, pad, gaps, small: small.length, tiny, clipped, scrollRows, hasBack,
        doc: Math.round(document.documentElement.scrollWidth - document.documentElement.clientWidth) };
    });
    results.push({ r, ...m });
  } catch (e) { results.push({ r, err: String(e).slice(0, 60) }); }
  await p.close().catch(() => {});
}
await b.close();
writeFileSync(OUT, JSON.stringify(results));
console.log("audited", results.length, "routes ->", OUT);
