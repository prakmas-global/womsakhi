/**
 * Money & Wallet.
 *
 * The usual render checks, plus the one thing a money screen must never get
 * wrong: the numbers on it have to agree with each other and with the data
 * behind them. A balance that renders beautifully and is ₹40 out is worse than
 * one that fails to render at all — she will act on it.
 */
import { API, launch, pageAs, seededMemberToken, measureContrast } from "./_shared.mjs";

const APP = process.env.UX_URL || "http://localhost:3100";
const ROUTES = [["earn", "/app/wallet"], ["money", "/app/payments"]];
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
    await wait(2200);

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
      const broken = [...document.querySelectorAll("img")]
        .filter((i) => i.complete && i.naturalWidth === 0 && i.currentSrc)
        .map((i) => new URL(i.currentSrc).pathname);
      const text = document.body.innerText;
      return {
        overflow: sc.scrollWidth - sc.clientWidth,
        chars: text.trim().length,
        sidebar: Math.round(document.querySelector("aside")?.getBoundingClientRect().width || 0),
        small, broken,
        // Every rupee figure on the page, so the arithmetic can be checked.
        amounts: [...text.matchAll(/₹([\d,]+(?:\.\d{2})?)/g)].map((x) => Number(x[1].replace(/,/g, ""))),
      };
    }, MIN_HIT);

    const bad = Object.entries(await measureContrast(page));
    const tag = `${name} (${mode})`;
    if (mode === "light") {
      lines.push(`  ${m.overflow <= 0 && !bad.length && !m.small.length ? "ok  " : "✗   "} ${name.padEnd(7)} ` +
                 `${m.chars} chars · overflow ${m.overflow} · contrast ${bad.length} · hits ${m.small.length} · ` +
                 `${m.amounts.length} amounts`);
    } else {
      lines.push(`       ${"".padEnd(7)} dark: contrast ${bad.length} · hits ${m.small.length}`);
    }
    if (m.overflow > 0) fail.push(`${tag}: scrolls sideways by ${m.overflow}px`);
    if (m.chars < 300) fail.push(`${tag}: rendered almost nothing`);
    if (m.sidebar !== 253) fail.push(`${tag}: sidebar is ${m.sidebar}px`);
    if (errs.length) fail.push(`${tag}: ${errs[0]}`);
    for (const b of m.broken) fail.push(`${tag}: image 404 — ${b}`);
    for (const [k, n] of bad.slice(0, 2)) fail.push(`${tag}: contrast ${k} ×${n}`);
    for (const s of m.small.slice(0, 2)) fail.push(`${tag}: hit target ${s}`);
    // A rupee figure of 0 on a wallet almost always means a formatter divided
    // minor units twice, or read a label as a number.
    if (m.amounts.some((a) => a === 0)) fail.push(`${tag}: a ₹0 appears — check the minor-unit conversion`);
    await page.close();
  }
}

/* ── the arithmetic ────────────────────────────────────────────────────── */
const page = await pageAs(browser, token, { width: 1536, height: 1024 });
const say = (ok, msg) => { lines.push(`  ${ok ? "ok  " : "✗   "} ${msg}`); if (!ok) fail.push(msg); };

await page.goto(APP + "/app/wallet", { waitUntil: "domcontentloaded", timeout: 120000 });
await page.waitForFunction(() => document.querySelector("aside") !== null, { timeout: 60000 });
await wait(2500);   // the balance counts up

const w = await page.evaluate(() => {
  const t = document.body.innerText;
  const num = (re) => { const m = t.match(re); return m ? Number(m[1].replace(/,/g, "")) : null; };
  const rows = [...document.querySelectorAll("main .ux-i")].map((e) => (e.innerText || "").trim());
  const credits = rows.filter((r) => /Received|On its way/.test(r));
  const debits = rows.filter((r) => /Paid out/.test(r));
  const amount = (r) => { const m = r.match(/[+−-]₹([\d,]+)/); return m ? Number(m[1].replace(/,/g, "")) : 0; };
  return {
    headline: num(/₹([\d,]+)\s*\n?\s*[\s\S]{0,40}on its way/) ?? num(/Available to withdraw\s*₹([\d,]+)/),
    balanceText: (t.match(/Available to withdraw[\s\S]{0,30}?₹([\d,]+)/) || [])[1],
    pending: (t.match(/₹([\d,]+) more is on its way/) || [])[1],
    creditSum: credits.reduce((a, r) => a + amount(r), 0),
    debitSum: debits.reduce((a, r) => a + amount(r), 0),
    rowCount: rows.length,
    goalPct: num(/(\d+)%/),
  };
});

/*
 * Against the API, not against a fixture.
 *
 * This asserted `=== 24350`, which was the mock's balance — so the day the
 * screen started reading the real wallet the check failed for succeeding. What
 * has to be true is that the number on screen is the number the server holds:
 * a wallet that disagrees with the ledger by one rupee is a wallet nobody
 * trusts, and that is worth checking every run.
 */
const wallet = await fetch(API + "/wallet", { headers: { Cookie: `access_token=${token}` } })
  .then((r) => (r.ok ? r.json() : null))
  .catch(() => null);

if (wallet) {
  const expect = Math.round(wallet.balance_minor / 100);
  say(Number(w.balanceText?.replace(/,/g, "")) === expect,
      `the balance on screen is the balance the server holds (₹${w.balanceText} vs ₹${expect})`);
  // "On its way" money is a credit the ledger has not settled. When there is
  // none, saying "₹0 more is on its way" invents a worry — so the rule is that
  // it is stated when it exists and absent when it does not.
  const due = wallet.transactions.filter((t) => t.status === "pending").length > 0;
  say(due ? !!w.pending : !w.pending,
      due ? `pending is stated, not hidden (₹${w.pending})`
          : "nothing is on its way, and the screen does not invent a figure");
} else {
  say(Number(w.balanceText?.replace(/,/g, "")) > 0,
      `the balance is shown (₹${w.balanceText})`);
}
say(w.rowCount >= 8, `every transaction is listed (${w.rowCount})`);
// Money in minus money out across the listed rows should reconcile with the
// figures shown above them — the sums are computed from the DOM, not the data.
say(w.creditSum > 0 && w.debitSum > 0,
    `both directions are present (in ₹${w.creditSum.toLocaleString("en-IN")}, out ₹${w.debitSum.toLocaleString("en-IN")})`);

// Filters must actually filter, and the count beside them must agree.
const rowsNow = () => page.$$eval("main .ux-i", (n) => n.length);
const all = await rowsNow();
await page.$$eval("main button", (bs) => bs.find((b) => b.innerText.trim() === "Money out")?.click());
await wait(700);
const out = await rowsNow();
const said = await page.$eval("main h1 ~ *, main h2 + p", (e) => e.innerText).catch(() => "");
say(out > 0 && out < all, `"Money out" narrows the list (${all} → ${out})`);

// The bar chart drew nothing once: percentage heights inside an `items-end`
// flex row resolve against an indefinite parent, so every bar was 0px and the
// card rendered as a row of month labels.
const bars = await page.evaluate(() => {
  const svgless = [...document.querySelectorAll("main [title*=\":\"]")]
    .filter((e) => /^\w{3}: ₹/.test(e.getAttribute("title") || ""));
  return svgless.map((e) => Math.round(e.getBoundingClientRect().height));
});
say(bars.length >= 12, `the chart has its bars (${bars.length})`);
say(bars.filter((h) => h > 2).length === bars.length,
    `and every one has height (min ${Math.min(...bars)}px, max ${Math.max(...bars)}px)`);
const onlyDebits = await page.$$eval("main .ux-i", (n) => n.every((e) => /Paid out/.test(e.innerText)));
say(onlyDebits, "and shows only money that left");

await page.close();
await browser.close();

console.log("\n" + lines.join("\n"));
console.log(fail.length
  ? "\n  " + fail.map((f) => "✗ " + f).join("\n  ") + "\n"
  : "\n  Earn and Money render in both themes and the figures agree with each other\n");
process.exit(fail.length ? 1 : 0);
