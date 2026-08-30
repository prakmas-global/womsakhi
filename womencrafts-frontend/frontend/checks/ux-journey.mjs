/**
 * Sakhi Journey — the long view.
 *
 * The claim this screen makes is that it reports OUTCOMES, not activity, and
 * that the numbers on it agree with the rest of the app. A journey screen that
 * says ₹1,48,500 while the wallet says something unrelated is worse than no
 * journey screen: it teaches her not to trust either.
 */
import { launch, pageAs, seededMemberToken, measureContrast } from "./_shared.mjs";

const APP = process.env.UX_URL || "http://localhost:3100";
const TABS = ["The story so far", "What changed"];
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
    await page.goto(APP + "/app/progress", { waitUntil: "domcontentloaded", timeout: 120000 });
    await page.waitForFunction(() => document.querySelector("aside") !== null, { timeout: 60000 });
    await wait(1900);
    if (tab !== TABS[0]) {
      await page.$$eval("main button", (bs, t) => bs.find((b) => b.innerText.trim() === t)?.click(), tab);
      await wait(900);
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
               `${tab.padEnd(17)} ${mode.padEnd(5)} ${m.chars} chars · overflow ${m.overflow} · ` +
               `contrast ${bad.length} · hits ${m.small.length} · 404s ${m.broken.length}`);
    if (m.overflow > 0) fail.push(`${tag}: scrolls sideways by ${m.overflow}px`);
    if (m.chars < 300) fail.push(`${tag}: rendered almost nothing`);
    if (errs.length) fail.push(`${tag}: ${errs[0]}`);
    for (const b of m.broken) fail.push(`${tag}: image 404 — ${b}`);
    for (const [k, n] of bad.slice(0, 2)) fail.push(`${tag}: contrast ${k} ×${n}`);
    for (const s of m.small.slice(0, 2)) fail.push(`${tag}: hit target ${s}`);
    await page.close();
  }
}

const page = await pageAs(browser, token, { width: 1536, height: 1024 });
const say = (ok, msg) => { lines.push(`  ${ok ? "ok  " : "✗   "} ${msg}`); if (!ok) fail.push(msg); };
await page.goto(APP + "/app/progress", { waitUntil: "domcontentloaded", timeout: 120000 });
await page.waitForFunction(() => document.querySelector("aside") !== null, { timeout: 60000 });
await wait(2600);   // the headline counts up

const j = await page.evaluate(() => {
  const t = document.body.innerText;
  const li = [...document.querySelectorAll("main ol li")];
  return {
    headline: (t.match(/Earned through WomSakhi so far\s*₹([\d,]+)/) || [])[1],
    milestones: li.length,
    reached: li.filter((e) => e.querySelector("svg")).length,
    next: li.filter((e) => /Next/.test(e.innerText)).length,
    growth: (t.match(/(\d+)% higher/) || [])[1],
  };
});
say(j.headline === "1,48,500", `the headline counted up to the real figure (₹${j.headline})`);
say(j.milestones === 6, `every milestone is on the spine (${j.milestones})`);
say(j.next === 1, `exactly one is marked as next (${j.next})`);
say(Number(j.growth) > 0, `growth is stated as a figure (${j.growth}%)`);

// The rail's next steps must lead somewhere real, not to a dead href.
const steps = await page.$$eval('aside ~ * a[href^="/app"], a[href^="/app"]', (as) =>
  as.map((a) => a.getAttribute("href")));
const bad = steps.filter((h) => !/^\/app(\/[a-z-]+)*(\?.*)?$/.test(h));
say(bad.length === 0, `every next-step link is a real route (${bad.length} malformed)`);

await page.$$eval("main button", (bs) => bs.find((b) => b.innerText.trim() === "What changed")?.click());
await wait(900);
const outcomes = await page.evaluate(() => {
  const t = document.querySelector("main").innerText;
  return {
    // Outcomes, not activity: money and orders, never "lessons watched".
    hasMoney: /₹1,48,500/.test(t),
    hasOrders: /Orders delivered/.test(t),
    hasVanity: /lessons watched|minutes spent|logins/i.test(t),
    bars: [...document.querySelectorAll('main [title*="₹"]')].length,
  };
});
say(outcomes.hasMoney && outcomes.hasOrders, "it reports money and orders");
say(!outcomes.hasVanity, "and no vanity metrics");
say(outcomes.bars >= 12, `the twelve-month chart is drawn (${outcomes.bars} bars)`);

await page.close();
await browser.close();
console.log("\n" + lines.join("\n"));
console.log(fail.length
  ? "\n  " + fail.map((f) => "✗ " + f).join("\n  ") + "\n"
  : "\n  Sakhi Journey renders in both themes and reports outcomes that add up\n");
process.exit(fail.length ? 1 : 0);
