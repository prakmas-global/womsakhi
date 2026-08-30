/**
 * Diagnostic, not a check: dumps every unnamed control and unlabelled input
 * with enough shape to group them. 792 offenders on 129 screens is not 129
 * problems — it is a handful of shared components rendered many times, and the
 * only way to know which is to look at what they are.
 */
import { createRequire } from "module";
import { APP, launch, pageAs, staffToken, memberToken } from "./_shared.mjs";
const require = createRequire(import.meta.url);
const fs = require("fs"), path = require("path");

const ROOT = "/Users/praveenmaddela/Desktop/PRAKMAS-GLOBAL/womencrafts-frontend/frontend";
const walk = (dir, base) => {
  let out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name.startsWith("[")) continue; out = out.concat(walk(p, `${base}/${e.name}`)); }
    else if (e.name === "page.tsx") out.push(base || "/");
  }
  return out;
};
const ADMIN = walk(`${ROOT}/src/app/dashboard`, "/dashboard");
const MEMBER = walk(`${ROOT}/src/app/app`, "/app");

const dump = (page) => page.evaluate(() => {
  const vis = (el) => {
    const r = el.getBoundingClientRect(); if (r.width < 1 || r.height < 1) return false;
    for (let n = el; n && n !== document.body; n = n.parentElement) {
      const c = getComputedStyle(n);
      if (c.display === "none" || c.visibility === "hidden" || c.opacity === "0") return false;
    } return true;
  };
  // Where in the page is it? Landmark ancestry tells me which component owns it.
  const zone = (el) => {
    for (let n = el; n && n !== document.body; n = n.parentElement) {
      if (n.tagName === "NAV") return "nav";
      if (n.tagName === "HEADER") return "header";
      if (n.tagName === "TABLE") return "table";
      if (n.getAttribute?.("role") === "dialog") return "dialog";
      if (n.tagName === "MAIN") return "main";
    }
    return "?";
  };
  const shape = (el) => {
    const icon = el.querySelector("svg");
    const cls = (el.getAttribute("class") || "").split(/\s+/).filter((c) =>
      /rounded|p-|px-|h-|w-|border|bg-|absolute|flex/.test(c)).slice(0, 6).join(" ");
    return `${el.tagName.toLowerCase()}${icon ? "+svg" : ""} [${zone(el)}] ${cls}`;
  };
  const out = { unnamed: [], unlabelled: [] };
  for (const el of document.querySelectorAll("button,a[href]")) {
    if (!vis(el)) continue;
    if ((el.getAttribute("aria-label") || el.getAttribute("title") || el.textContent || "").trim()) continue;
    out.unnamed.push({ shape: shape(el), html: el.outerHTML.slice(0, 220) });
  }
  for (const el of document.querySelectorAll("input,select,textarea")) {
    if (!vis(el) || el.type === "hidden") continue;
    if (el.getAttribute("aria-label") || el.getAttribute("placeholder") || el.getAttribute("aria-labelledby")) continue;
    if (el.id && document.querySelector(`label[for="${CSS.escape(el.id)}"]`)) continue;
    out.unlabelled.push({ shape: shape(el), html: el.outerHTML.slice(0, 220) });
  }
  return out;
});

const staff = await staffToken();
const member = await memberToken(staff);
const byShape = new Map();
const record = (kind, mod, route, items) => {
  for (const it of items) {
    const key = `${kind} | ${it.shape}`;
    if (!byShape.has(key)) byShape.set(key, { count: 0, routes: new Set(), html: it.html });
    const e = byShape.get(key); e.count++; e.routes.add(`${mod}${route}`);
  }
};

for (const [mod, tok, list] of [["admin", staff, ADMIN], ["member", member, MEMBER]]) {
  const browser = await launch();
  const p = await pageAs(browser, tok, { width: 1600, height: 1000, name: "desktop", mode: "light" });
  for (const route of list) {
    if (route.endsWith("/logout")) continue;
    try {
      await p.goto(`${APP}${route}`, { waitUntil: "networkidle2", timeout: 30000 });
      await p.waitForFunction(() => ![...document.querySelectorAll('.wc-skeleton,[class*="animate-pulse"],[class*="animate-spin"]')]
        .some((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; }), { timeout: 6000 }).catch(() => {});
      await new Promise((r) => setTimeout(r, 200));
      const d = await dump(p);
      record("unnamed", mod, route, d.unnamed);
      record("unlabelled", mod, route, d.unlabelled);
    } catch (e) { console.log(`  ${mod}${route}: ${String(e).slice(0, 80)}`); }
  }
  await browser.close();
}

const rows = [...byShape.entries()].sort((a, b) => b[1].count - a[1].count);
console.log(`\n  ${rows.length} distinct shapes\n`);
for (const [key, e] of rows) {
  console.log(`  ${String(e.count).padStart(4)}×  ${key}`);
  console.log(`        on ${e.routes.size} route(s), e.g. ${[...e.routes].slice(0, 3).join(", ")}`);
  console.log(`        ${e.html.replace(/\s+/g, " ").slice(0, 190)}`);
}
