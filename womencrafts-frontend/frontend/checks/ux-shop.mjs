/**
 * My Business — orders, products, paperwork.
 *
 * The behaviour worth guarding is the order pipeline: each order offers exactly
 * one next step, acting on it moves the order forward, and the counts beside
 * each state follow. A pipeline whose buttons do nothing looks identical to one
 * that works.
 */
import { launch, pageAs, seededMemberToken, measureContrast } from "./_shared.mjs";

const APP = process.env.UX_URL || "http://localhost:3100";
const TABS = ["Orders", "What you sell", "Paperwork"];
const MIN_HIT = 24;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const fail = [];
const lines = [];

const token = await seededMemberToken();
const browser = await launch();

for (const mode of ["light", "dark"]) {
  for (const tab of TABS) {
    const page = await pageAs(browser, token, { width: 1536, height: 1024, mode });
    await page.evaluateOnNewDocument((m) => { try { localStorage.setItem("theme", m); } catch {} }, mode);
    const errs = [];
    page.on("pageerror", (e) => errs.push(String(e).slice(0, 100)));
    page.on("console", (m) => {
      const t = m.text();
      if (m.type() === "error" && !t.includes("ERR_CONNECTION") && !t.includes("Failed to load resource")) errs.push(t.slice(0, 100));
    });
    await page.goto(APP + "/app/documents", { waitUntil: "domcontentloaded", timeout: 120000 });
    await page.waitForFunction(() => document.querySelector("aside") !== null, { timeout: 60000 });
    await wait(1900);
    if (tab !== "Orders") {
      await page.$$eval("main button", (bs, t) => bs.find((b) => b.innerText.trim() === t)?.click(), tab);
      await wait(800);
    }

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
    const tag = `${tab} (${mode})`;
    lines.push(`  ${m.overflow <= 0 && !bad.length && !m.small.length ? "ok  " : "✗   "} ${tab.padEnd(14)} ` +
               `${mode.padEnd(5)} ${m.chars} chars · overflow ${m.overflow} · contrast ${bad.length} · hits ${m.small.length}`);
    if (m.overflow > 0) fail.push(`${tag}: scrolls sideways by ${m.overflow}px`);
    if (m.chars < 300) fail.push(`${tag}: rendered almost nothing`);
    if (errs.length) fail.push(`${tag}: ${errs[0]}`);
    for (const b of m.broken) fail.push(`${tag}: image 404 — ${b}`);
    for (const [k, n] of bad.slice(0, 2)) fail.push(`${tag}: contrast ${k} ×${n}`);
    for (const s of m.small.slice(0, 2)) fail.push(`${tag}: hit target ${s}`);
    await page.close();
  }
}

/* ── the order pipeline ────────────────────────────────────────────────── */
const page = await pageAs(browser, token, { width: 1536, height: 1024 });
const say = (ok, msg) => { lines.push(`  ${ok ? "ok  " : "✗   "} ${msg}`); if (!ok) fail.push(msg); };

await page.goto(APP + "/app/documents", { waitUntil: "domcontentloaded", timeout: 120000 });
await page.waitForFunction(() => document.querySelector("aside") !== null, { timeout: 60000 });
await wait(2200);

const firstOrder = () => page.$eval("main .ux-i", (e) => e.innerText.trim());
const before = await firstOrder();
const stateOf = (t) => (t.match(/\b(New|Making|Ready|Sent|Done|Cancelled)\b/) || [])[1];

// Each open order offers exactly one next step — a row of every possible state
// change would be a quiz, not an action.
const nextButtons = await page.$$eval("main .ux-i", (rows) =>
  rows.map((r) => [...r.querySelectorAll("button")]
    .filter((b) => /Start making|Mark ready|Mark sent|Mark done/.test(b.innerText)).length));
say(nextButtons.every((n) => n <= 1), `no order offers more than one next step (${nextButtons.join(",")})`);

say(stateOf(before) === "New", `the first order starts New (${stateOf(before)})`);
await page.$$eval("main .ux-i button", (bs) => bs.find((b) => /Start making/.test(b.innerText))?.click());
await wait(700);
const after = await firstOrder();
say(stateOf(after) === "Making", `acting on it moves it forward (${stateOf(before)} → ${stateOf(after)})`);

// And the state filters must follow the change, not the original data.
const counts = await page.$$eval("main button", (bs) =>
  Object.fromEntries(bs
    .map((b) => b.innerText.trim().match(/^(New|Making|Ready|Sent|Done|Cancelled|All)\s+(\d+)$/))
    .filter(Boolean)
    .map((m) => [m[1], Number(m[2])])));
say(counts.Making === 2 && counts.New === undefined || counts.New === 0,
    `the state counts followed it (Making ${counts.Making}, New ${counts.New ?? 0})`);

// Paperwork must not leak: documents are hers and the review team's alone.
await page.$$eval("main button", (bs) => bs.find((b) => b.innerText.trim() === "Paperwork")?.click());
await wait(800);
const paper = await page.evaluate(() => document.querySelector("main").innerText);
say(/Only you and the WomSakhi review team/.test(paper), "paperwork says who can see it");
say(/Verified/.test(paper) && /Add/.test(paper), "and separates what is done from what is missing");

await page.close();
await browser.close();

console.log("\n" + lines.join("\n"));
console.log(fail.length
  ? "\n  " + fail.map((f) => "✗ " + f).join("\n  ") + "\n"
  : "\n  My Business renders across all three tabs in both themes, and the order pipeline actually moves\n");
process.exit(fail.length ? 1 : 0);
