/**
 * Mentors.
 *
 * Two things carry real cost if they break. Language is a filter she relies on
 * — a mentor she cannot talk to is not a mentor — so filtering by it must
 * actually narrow the list to people who speak it. And asking for a session
 * must be one-way: a mentor receiving the same request four times because a
 * slow connection hid the confirmation is a cost to a real person's evening.
 */
import { launch, pageAs, seededMemberToken, measureContrast } from "./_shared.mjs";
import { gotoWithApi } from "./_screen.mjs";

const APP = process.env.UX_URL || "http://localhost:3100";
const ROUTES = [["list", "/app/mentors"], ["detail", "/app/mentors/m1"], ["missing", "/app/mentors/nope"]];
const MIN_HIT = 24;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const fail = [];
const lines = [];

const token = await seededMemberToken();
const browser = await launch();

for (const [name, route] of ROUTES) {
  for (const mode of ["light", "dark"]) {
    const page = await pageAs(browser, token, { width: 1536, height: 1024, mode });
    await page.evaluateOnNewDocument((m) => { try { localStorage.setItem("theme", m); } catch {} }, mode);
    const errs = [];
    page.on("pageerror", (e) => errs.push(String(e).slice(0, 100)));
    page.on("console", (m) => {
      const t = m.text();
      if (m.type() === "error" && !t.includes("ERR_CONNECTION") && !t.includes("Failed to load resource")) errs.push(t.slice(0, 100));
    });
    await page.goto(APP + route, { waitUntil: "domcontentloaded", timeout: 120000 });
    await page.waitForFunction(() => document.querySelector("aside") !== null, { timeout: 60000 });
    await wait(1900);

    const m = await page.evaluate((MIN) => {
      const sc = document.getElementById("ux-scroll") || document.documentElement;
      const small = [];
      for (const el of document.querySelectorAll('a,button,[role="button"],select,input')) {
        const r = el.getBoundingClientRect();
        if (r.width < 1 || r.height < 1) continue;
        const cs = getComputedStyle(el);
        if (cs.visibility === "hidden" || String(el.className).includes("sr-only")) continue;
        if (r.height < MIN || r.width < MIN) small.push(`${r.width | 0}x${r.height | 0} "${(el.innerText || el.getAttribute("aria-label") || "").trim().slice(0, 22)}"`);
      }
      return {
        overflow: sc.scrollWidth - sc.clientWidth,
        chars: document.body.innerText.trim().length,
        small,
        broken: [...document.querySelectorAll("img")]
          .filter((i) => i.complete && i.naturalWidth === 0 && i.currentSrc)
          .map((i) => new URL(i.currentSrc).pathname),
      };
    }, MIN_HIT);

    const bad = Object.entries(await measureContrast(page));
    const tag = `${name} (${mode})`;
    lines.push(`  ${m.overflow <= 0 && !bad.length && !m.small.length && !m.broken.length ? "ok  " : "✗   "} ` +
               `${name.padEnd(8)} ${mode.padEnd(5)} ${m.chars} chars · overflow ${m.overflow} · ` +
               `contrast ${bad.length} · hits ${m.small.length} · 404s ${m.broken.length}`);
    if (m.overflow > 0) fail.push(`${tag}: scrolls sideways by ${m.overflow}px`);
    if (m.chars < 250) fail.push(`${tag}: rendered almost nothing`);
    if (errs.length) fail.push(`${tag}: ${errs[0]}`);
    for (const b of m.broken) fail.push(`${tag}: image 404 — ${b}`);
    for (const [k, n] of bad.slice(0, 2)) fail.push(`${tag}: contrast ${k} ×${n}`);
    for (const s of m.small.slice(0, 2)) fail.push(`${tag}: hit target ${s}`);
    await page.close();
  }
}

const page = await pageAs(browser, token, { width: 1536, height: 1024 });
const say = (ok, msg) => { lines.push(`  ${ok ? "ok  " : "✗   "} ${msg}`); if (!ok) fail.push(msg); };

await gotoWithApi(page, APP + "/app/mentors", "/growth/mentors", { settle: 1200 });
await page.waitForFunction(() => document.querySelector("aside") !== null, { timeout: 60000 });

const rows = () => page.$$eval("main .ux-i", (n) => n.map((e) => e.innerText));

const all = await rows();
say(all.length > 0, `every mentor is listed (${all.length})`);

// Filtering by language must leave only mentors who actually speak it.
await page.$$eval("main button", (bs) => bs.find((b) => b.innerText.trim() === "Tamil")?.click());
await wait(700);
const tamil = await rows();
say(tamil.length > 0 && tamil.length < all.length, `a language narrows the list (${all.length} → ${tamil.length})`);
say(tamil.every((t) => /Tamil/.test(t)), "and everyone left actually speaks it");

await page.$$eval("main button", (bs) => bs.find((b) => b.innerText.trim() === "Clear")?.click());
await wait(700);
say((await rows()).length === all.length, "clearing brings everyone back");

// Asking is one-way.
await page.goto(APP + "/app/mentors/m1", { waitUntil: "domcontentloaded", timeout: 120000 });
await page.waitForFunction(() => document.querySelector("aside") !== null, { timeout: 60000 });
await wait(1900);
await page.$$eval("aside ~ * button, main button", (bs) => bs.find((b) => /11:00 AM/.test(b.innerText))?.click());
await wait(400);
const askBtn = () => page.$$eval("button", (bs) => bs.filter((b) => /Ask (for this time|her to suggest)/.test(b.innerText)).length);
await page.$$eval("button", (bs) => bs.find((b) => /Ask (for this time|her to suggest)/.test(b.innerText))?.click());
await wait(120);
await page.$$eval("button", (bs) => bs.find((b) => /Ask (for this time|her to suggest)|Sending/.test(b.innerText))?.click());
await wait(1400);
const asked = await page.evaluate(() => document.body.innerText);
say(/Sent to Neha/.test(asked), "asking confirms who it went to");
say((await askBtn()) === 0, "and the ask button is gone, so it cannot be sent twice");
say((asked.match(/Sent to Neha/g) || []).length === 1, "exactly one confirmation");

await page.close();
await browser.close();
console.log("\n" + lines.join("\n"));
console.log(fail.length
  ? "\n  " + fail.map((f) => "✗ " + f).join("\n  ") + "\n"
  : "\n  Mentors renders in both themes, language filtering is honest, and asking is one-way\n");
process.exit(fail.length ? 1 : 0);
