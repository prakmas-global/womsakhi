/**
 * Learning, on the real member route.
 *
 * Four tabs, both themes, and the one behavioural claim the screen makes: that
 * "Keep going" opens first. A catalogue on open quietly tells her that starting
 * a fifth course matters more than finishing the three she has.
 */
import { launch, pageAs, seededMemberToken, measureContrast } from "./_shared.mjs";

const APP = process.env.UX_URL || "http://localhost:3100";
const TABS = ["Keep going", "Explore", "Paths", "Finished"];
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
    await page.goto(APP + "/app/programs", { waitUntil: "domcontentloaded", timeout: 120000 });
    await page.waitForFunction(() => document.querySelector("aside") !== null, { timeout: 60000 });
    await wait(1900);
    if (tab !== "Keep going") {
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
    lines.push(`  ${m.overflow <= 0 && !bad.length && !m.small.length && !m.broken.length ? "ok  " : "✗   "} ` +
               `${tab.padEnd(11)} ${mode.padEnd(5)} ${m.chars} chars · overflow ${m.overflow} · ` +
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
await page.goto(APP + "/app/programs", { waitUntil: "domcontentloaded", timeout: 120000 });
await page.waitForFunction(() => document.querySelector("aside") !== null, { timeout: 60000 });
await wait(2000);

const opened = await page.$eval('main [role="tab"][aria-selected="true"]', (e) => e.innerText.trim());
say(opened === "Keep going", `the unfinished work opens first (${opened})`);

const resuming = await page.$$eval("main .ux-i, main .ux-card", (n) =>
  n.filter((e) => /Continue|Resume|%/.test(e.innerText)).length);
say(resuming >= 3, `every course in progress is shown (${resuming})`);

await page.$$eval("main button", (bs) => bs.find((b) => b.innerText.trim() === "Explore")?.click());
await wait(800);
const all = await page.$$eval("main .ux-i", (n) => n.length);
await page.$$eval("main button", (bs) => bs.find((b) => b.innerText.trim() === "Personal")?.click());
await wait(800);
const some = await page.$$eval("main .ux-i", (n) => n.length);
say(some > 0 && some < all, `a category filters the catalogue (${all} → ${some})`);

// No category may be offered that has nothing behind it — a chip whose only
// possible outcome is an empty state is a dead end, and "Money" was one.
const chips = await page.$$eval('main [aria-pressed]', (bs) =>
  bs.map((b) => b.innerText.trim()).filter((t) => t && !/·|\d/.test(t)));
const dead = [];
for (const c of chips) {
  if (c === "All") continue;
  await page.$$eval("main button", (bs, t) => bs.find((b) => b.innerText.trim() === t)?.click(), c);
  await wait(420);
  const n = await page.$$eval("main .ux-i", (x) => x.length);
  if (n === 0) dead.push(c);
}
say(dead.length === 0, `every category offered has courses behind it (${chips.length - 1} checked${dead.length ? `, dead: ${dead.join(", ")}` : ""})`);

await page.close();
await browser.close();
console.log("\n" + lines.join("\n"));
console.log(fail.length
  ? "\n  " + fail.map((f) => "✗ " + f).join("\n  ") + "\n"
  : "\n  Learning renders across four tabs in both themes and opens on what she has not finished\n");
process.exit(fail.length ? 1 : 0);
