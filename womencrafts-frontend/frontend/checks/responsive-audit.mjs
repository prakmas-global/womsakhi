/**
 * Where is this app not usable on a phone?
 *
 * Not a review — a measurement. Every member route is opened at real device
 * widths and interrogated for the four failures that actually stop a woman
 * using a screen, each of which is invisible in a desktop browser:
 *
 *   OVERFLOW  the page scrolls sideways. The single worst one: it makes every
 *             vertical scroll feel broken and hides content off the right edge.
 *   SPILL     an element is wider than its own container, so it is clipped or
 *             it is what is causing the overflow.
 *   TAP       an interactive target under 44x44 (WCAG 2.5.5 / Apple HIG).
 *   TEXT      body text under 12px, which is unreadable on a 390px screen in
 *             daylight.
 *
 * It reports per-route AND rolls up by component, because 129 routes with the
 * same broken card is one fix, not 129.
 */
import puppeteer from "puppeteer-core";
import { CHROME, APP, seededMemberToken } from "./_shared.mjs";
import { readFileSync, writeFileSync } from "node:fs";

const DEVICES = [
  { name: "iphone-se", w: 375, h: 667 },
  { name: "iphone-14", w: 390, h: 844 },
  { name: "pixel-7", w: 412, h: 915 },
  { name: "ipad-mini", w: 768, h: 1024 },
];

const ROUTES = JSON.parse(readFileSync(new URL("./_routes.json", import.meta.url), "utf8"));

const tok = await seededMemberToken();
if (!tok) { console.error("no token — is the backend seeded?"); process.exit(1); }

const b = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox"] });
const findings = [];

for (const dev of DEVICES) {
  const page = await b.newPage();
  await page.setCookie({ name: "access_token", value: tok, domain: "localhost", path: "/" });
  await page.setViewport({ width: dev.w, height: dev.h, deviceScaleFactor: 2, isMobile: true, hasTouch: true });

  for (const route of ROUTES) {
    try {
      await page.goto(APP + route, { waitUntil: "domcontentloaded", timeout: 45000 });
      await new Promise(r => setTimeout(r, 900));

      const r = await page.evaluate((vw) => {
        const de = document.documentElement;
        const overflow = Math.round(de.scrollWidth - de.clientWidth);

        // Who is actually sticking out past the viewport? Report the widest
        // few, with enough identity to find them in the source.
        const spills = [];
        for (const el of document.querySelectorAll("body *")) {
          const b = el.getBoundingClientRect();
          if (b.width === 0 || b.height === 0) continue;
          const over = Math.round(b.right - vw);
          if (over > 2 || b.left < -2) {
            const cs = getComputedStyle(el);
            if (cs.position === "fixed" && b.width <= vw + 2) continue; // off-canvas drawers are fine
            spills.push({
              tag: el.tagName.toLowerCase(),
              cls: (typeof el.className === "string" ? el.className : "").slice(0, 70),
              w: Math.round(b.width), over, left: Math.round(b.left),
              txt: (el.textContent || "").trim().slice(0, 28),
            });
          }
        }
        spills.sort((a, b) => b.over - a.over);

        const taps = [];
        for (const el of document.querySelectorAll('a,button,[role="button"],input,select,textarea,summary')) {
          const b = el.getBoundingClientRect();
          if (b.width === 0 || b.height === 0) continue;
          if (getComputedStyle(el).visibility === "hidden") continue;
          if (b.width < 44 || b.height < 44) {
            taps.push({ tag: el.tagName.toLowerCase(),
                        cls: (typeof el.className === "string" ? el.className : "").slice(0, 60),
                        w: Math.round(b.width), h: Math.round(b.height),
                        txt: (el.textContent || "").trim().slice(0, 24) });
          }
        }

        const small = [];
        for (const el of document.querySelectorAll("p,span,li,td,label,div")) {
          if (!el.childNodes.length) continue;
          const direct = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim().length > 12);
          if (!direct) continue;
          const fs = parseFloat(getComputedStyle(el).fontSize);
          if (fs && fs < 12) small.push({ fs: +fs.toFixed(1), txt: (el.textContent || "").trim().slice(0, 30) });
        }

        return { overflow, spills: spills.slice(0, 6), taps: taps.slice(0, 8), small: small.slice(0, 5),
                 title: document.title };
      }, dev.w);

      if (r.overflow > 0 || r.spills.length || r.taps.length || r.small.length) {
        findings.push({ device: dev.name, vw: dev.w, route, ...r });
      }
    } catch (e) {
      findings.push({ device: dev.name, vw: dev.w, route, error: String(e).slice(0, 90) });
    }
  }
  await page.close();
  console.error(`  ${dev.name} done`);
}
await b.close();

writeFileSync(new URL("./_responsive.json", import.meta.url), JSON.stringify(findings, null, 1));

/* ── roll it up, because 129 routes with one broken card is one fix ─────── */
const byClass = {};
for (const f of findings) {
  for (const s of f.spills || []) {
    const key = s.cls.split(/\s+/).filter(c => c.startsWith("ux-") || c.includes("grid") || c.includes("flex")).slice(0,3).join(" ") || s.tag;
    (byClass[key] ||= { n: 0, worst: 0, routes: new Set() });
    byClass[key].n++; byClass[key].worst = Math.max(byClass[key].worst, s.over);
    byClass[key].routes.add(f.route);
  }
}
const overflowRoutes = [...new Set(findings.filter(f => f.overflow > 0).map(f => f.route))];
console.log(`\n  routes audited: ${ROUTES.length} x ${DEVICES.length} devices`);
console.log(`  routes with sideways scroll: ${overflowRoutes.length}`);
console.log(`  routes with any finding:     ${new Set(findings.map(f => f.route)).size}`);
console.log(`\n  worst offenders by class:`);
Object.entries(byClass).sort((a,b) => b[1].n - a[1].n).slice(0, 15)
  .forEach(([k, v]) => console.log(`    ${String(v.n).padStart(4)}x  over ${String(v.worst).padStart(4)}px  ${v.routes.size} routes  ${k.slice(0,60)}`));
console.log(`\n  full detail in checks/_responsive.json`);
