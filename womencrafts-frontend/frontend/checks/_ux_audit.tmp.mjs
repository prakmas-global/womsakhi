/** Per-screen mobile/desktop audit for the Circle / chat / You screens. */
import puppeteer from "puppeteer-core";
import { CHROME, APP, seededMemberToken } from "./_shared.mjs";

const OUT = "/private/tmp/claude-501/-Users-praveenmaddela-Desktop-PRAKMAS-GLOBAL/ab20bff5-1632-4dd1-8eb2-2ed0e468a687/scratchpad/shots";
const TAG = process.argv[2] || "before";
const ONLY = process.argv[3] ? process.argv[3].split(",") : null;

const ROUTES = [
  ["circle", "/app/circle"],
  ["circles", "/app/circles"],
  ["circles-new", "/app/circles/new"],
  ["sakhi", "/app/sakhi"],
  ["messages", "/app/messages"],
  ["you", "/app/you"],
  ["profile", "/app/profile"],
  ["settings", "/app/settings"],
  ["settings-notifications", "/app/settings/notifications"],
  ["settings-account", "/app/settings/account"],
  ["settings-quiet", "/app/settings/quiet-hours"],
  ["help", "/app/help"],
];

const MEASURE = `(() => {
  const doc = document.documentElement;
  const scroller = document.querySelector('#ux-scroll') || doc;
  const vis = (el) => {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  const small = [];
  for (const el of document.querySelectorAll('button, a, [role="button"], [role="tab"], input[type=checkbox], input[type=radio], select, summary')) {
    if (!vis(el)) continue;
    if (el.closest('.ux-tap-exempt') || el.classList.contains('ux-tap-exempt')) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 44 || r.height < 44) small.push({ t: (el.textContent||el.getAttribute('aria-label')||el.tagName).trim().slice(0,32), w: Math.round(r.width), h: Math.round(r.height), c: el.className.toString().slice(0,60) });
  }
  const tiny = [];
  const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const seen = new Set();
  let n;
  while ((n = walk.nextNode())) {
    const txt = n.nodeValue.trim();
    if (!txt) continue;
    const el = n.parentElement;
    if (!el || seen.has(el) || !vis(el)) continue;
    seen.add(el);
    const fs = parseFloat(getComputedStyle(el).fontSize);
    if (fs < 12) tiny.push({ t: txt.slice(0, 32), fs, c: el.className.toString().slice(0,50) });
  }
  // tab bar overlap
  const bar = document.querySelector('.ux-tabbar') || document.querySelector('nav[class*="fixed"][class*="bottom-0"]');
  const overlaps = [];
  if (bar && vis(bar)) {
    const b = bar.getBoundingClientRect();
    for (const el of document.querySelectorAll('button, a, input, textarea, h1, h2, p, [role="button"]')) {
      if (!vis(el) || bar.contains(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.bottom > b.top + 2 && r.top < b.bottom - 2 && r.right > b.left && r.left < b.right) {
        overlaps.push({ t: (el.textContent||el.getAttribute('aria-label')||el.tagName).trim().slice(0,30), top: Math.round(r.top), bottom: Math.round(r.bottom) });
      }
    }
  }
  return {
    coarse: matchMedia('(pointer: coarse)').matches,
    overflowDoc: Math.round(doc.scrollWidth - doc.clientWidth),
    overflowScroller: Math.round(scroller.scrollWidth - scroller.clientWidth),
    small: small.slice(0, 12), smallN: small.length,
    tiny: tiny.slice(0, 10), tinyN: tiny.length,
    overlaps: overlaps.slice(0, 8), overlapN: overlaps.length,
  };
})()`;

const tok = await seededMemberToken();
if (!tok) { console.error("NO TOKEN — backend down?"); process.exit(1); }
const b = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox"] });

for (const [w, h, label, isMobile] of [[390, 844, "m", true], [1440, 900, "d", false]]) {
  const p = await b.newPage();
  await p.setCookie({ name: "access_token", value: tok, domain: "localhost", path: "/" });
  await p.setViewport({ width: w, height: h, deviceScaleFactor: 2, isMobile, hasTouch: isMobile });
  if (isMobile) {
    const cdp = await p.createCDPSession();
    await cdp.send("Emulation.setEmulatedMedia", { features: [{ name: "pointer", value: "coarse" }, { name: "any-pointer", value: "coarse" }, { name: "hover", value: "none" }] });
  }
  for (const [name, route] of ROUTES) {
    if (ONLY && !ONLY.includes(name)) continue;
    try {
      await p.goto(APP + route, { waitUntil: "domcontentloaded", timeout: 120000 });
      await new Promise((r) => setTimeout(r, 3200));
      await p.screenshot({ path: `${OUT}/${TAG}-${label}-${name}.png` });
      const m = await p.evaluate(MEASURE);
      const bad = [];
      if (m.overflowDoc !== 0 || m.overflowScroller !== 0) bad.push(`OVERFLOW doc=${m.overflowDoc} scr=${m.overflowScroller}`);
      if (m.smallN) bad.push(`SMALL=${m.smallN}`);
      if (m.tinyN) bad.push(`TINY=${m.tinyN}`);
      if (m.overlapN) bad.push(`OVERLAP=${m.overlapN}`);
      console.log(`${label} ${route.padEnd(30)} ${bad.length ? bad.join(" ") : "ok"}${label==="m"&&!m.coarse?" [NOT-COARSE]":""}`);
      if (m.smallN) console.log("    small:", JSON.stringify(m.small));
      if (m.tinyN) console.log("    tiny:", JSON.stringify(m.tiny));
      if (m.overlapN) console.log("    overlap:", JSON.stringify(m.overlaps));
    } catch (e) {
      console.log(`${label} ${route} ERROR ${e.message.slice(0, 120)}`);
    }
  }
  await p.close();
}
await b.close();
