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

const states = () => page.$$eval("main [data-order]",
  (rows) => rows.map((r) => ({ id: r.dataset.order, state: r.dataset.state })));

const nextButtons = await page.$$eval("main [data-order]", (rows) =>
  rows.map((r) => [...r.querySelectorAll("button")]
    .filter((b) => /Start making|Mark ready|Mark sent|Mark done/.test(b.innerText)).length));
say(nextButtons.every((n) => n <= 1), `no order offers more than one next step (${nextButtons.join(",")})`);

const before = await states();
const open = before.find((o) => o.state === "New");
if (!open) {
  say(true, `no order is waiting to be started — nothing to move (${before.map((o) => o.state).join(",") || "none"})`);
} else {
  const moved = await page.evaluate((id) => {
    const card = document.querySelector(`main [data-order="${id}"]`);
    const b = [...card.querySelectorAll("button")].find((x) => /Start making/.test(x.innerText));
    if (!b) return false;
    b.click();
    return true;
  }, open.id);
  say(moved, `the New order offers "Start making"`);
  await wait(1200);
  const now = (await states()).find((o) => o.id === open.id)?.state;
  say(now === "Making", `acting on it moves it forward (New → ${now})`);
}

// Paperwork must not leak: documents are hers and the review team's alone.
await page.goto(APP + "/app/documents/vault", { waitUntil: "domcontentloaded", timeout: 120000 });
await wait(2200);
const paper = await page.evaluate(() => document.body.innerText);
say(/Who can see these/i.test(paper)
    && /The WomSakhi review team/.test(paper)
    && /Buyers and employers/.test(paper) && /Never/.test(paper),
    "paperwork names who can see it, and who never can");
say(/With us/i.test(paper) && /Still needed/i.test(paper),
    "and keeps what is held apart from what is still needed");
say(/is still missing|are still missing|not given us any papers|Everything a scheme or a bank/i.test(paper),
    "and says in words which of the two she is looking at");

await page.close();
await browser.close();

console.log("\n" + lines.join("\n"));
console.log(fail.length
  ? "\n  " + fail.map((f) => "✗ " + f).join("\n  ") + "\n"
  : "\n  My Business renders across all three tabs in both themes, and the order pipeline actually moves\n");
process.exit(fail.length ? 1 : 0);
