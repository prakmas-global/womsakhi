/**
 * How long a tab tap takes to put the destination on screen.
 *
 * Measured in the page, from the click to the frame after the router has both
 * changed the URL and swapped the contents of #content. Warm-up first: this is
 * `next dev`, so the first visit to a route compiles it and that number is
 * about Turbopack, not about navigation.
 */
import { launch, pageAs, seededMemberToken, APP } from "./_shared.mjs";

const LABEL = process.env.LABEL || "run";
const tok = await seededMemberToken();
if (!tok) { console.error("no token"); process.exit(1); }
const b = await launch();
const p = await pageAs(b, tok, { width: 390, height: 844 });
// Headless Chrome reports `prefers-reduced-motion: reduce` unless told
// otherwise, which silently switches every animation off.
await p.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: process.env.MOTION || "reduce" }]);
const errs = [];
p.on("pageerror", (e) => errs.push(String(e).slice(0, 160)));

const settle = (ms = 1500) => new Promise((r) => setTimeout(r, ms));

await p.goto(APP + "/app", { waitUntil: "domcontentloaded", timeout: 180000 });
try {
  await p.waitForSelector('nav[aria-label="Sections"] a', { timeout: 180000 });
} catch (e) {
  console.log("no tab bar. url=", p.url(), "errs=", errs.slice(0, 3));
  console.log((await p.evaluate(() => document.body.innerText)).slice(0, 400));
  await p.screenshot({ path: process.env.SHOTS + "/debug-no-bar.png" });
  throw e;
}
await settle(4000);

/** One tap on a bottom-bar tab, timed until the new screen is in #content. */
async function tap(label, dest) {
  await p.waitForSelector('nav[aria-label="Sections"] a', { timeout: 60000 });
  return p.evaluate(async ({ label, dest }) => {
    const bar = document.querySelector('nav[aria-label="Sections"]');
    const a = [...bar.querySelectorAll("a")].find((x) => x.innerText.trim() === label);
    if (!a) return { err: "no tab " + label };
    const main = document.querySelector("#content");
    const before = main.firstElementChild;
    const t0 = performance.now();
    const done = new Promise((res) => {
      const tick = () => {
        if (location.pathname === dest && main.firstElementChild && main.firstElementChild !== before) {
          requestAnimationFrame(() => res(performance.now() - t0));
        } else if (performance.now() - t0 > 15000) res(-1);
        else requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    a.click();
    return { ms: await done };
  }, { label, dest });
}

// Warm every route the run touches, four times: this is `next dev`, so the
// first visit compiles the route, and the first few also fill the query cache.
for (let i = 0; i < 4; i++) {
  for (const [l, d] of [["Learn", "/app/learn"], ["Earn", "/app/earn"], ["Home", "/app"]]) {
    await tap(l, d); await settle(2500);
  }
}

const runs = { "Home→Learn": [], "Learn→Home": [], "Home→Earn": [], "Earn→Home": [] };
for (let i = 0; i < 10; i++) {
  let r = await tap("Learn", "/app/learn"); runs["Home→Learn"].push(r.ms); await settle(900);
  r = await tap("Home", "/app");            runs["Learn→Home"].push(r.ms); await settle(900);
  r = await tap("Earn", "/app/earn");       runs["Home→Earn"].push(r.ms); await settle(900);
  r = await tap("Home", "/app");            runs["Earn→Home"].push(r.ms); await settle(900);
}

const q = (a, f) => { const s = [...a].filter((x) => x > 0).sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(s.length * f))] : -1; };
const all = [];
console.log(`\n── ${LABEL} ─────────────────────────────`);
for (const [k, v] of Object.entries(runs)) {
  all.push(...v.filter((x) => x > 0));
  console.log(`  ${k.padEnd(12)} min ${q(v,0).toFixed(0)}  p25 ${q(v,0.25).toFixed(0)}  median ${q(v,0.5).toFixed(0)}ms   [${v.map((x) => x.toFixed(0)).join(", ")}]`);
}
console.log(`  ALL          min ${q(all,0).toFixed(0)}  p25 ${q(all,0.25).toFixed(0)}  median ${q(all,0.5).toFixed(0)}ms  over ${all.length} taps`);
console.log(errs.length ? "  page errors: " + [...new Set(errs)].slice(0, 3).join(" | ") : "  no page errors");
await b.close();
