/**
 * What the slide costs, measured against itself.
 *
 * The dev server is shared with other work, so absolute numbers taken an hour
 * apart are not comparable. This alternates blocks WITH the transition and
 * WITHOUT it inside one browser session, so ambient load falls on both.
 *
 * `prefers-reduced-motion: reduce` turns off BOTH this file's slide and the
 * fade tokens.css already had, so that arm is a true "no transition" baseline.
 */
import { launch, pageAs, seededMemberToken, APP } from "./_shared.mjs";

const tok = await seededMemberToken();
const b = await launch();
const p = await pageAs(b, tok, { width: 390, height: 844 });
const settle = (ms) => new Promise((r) => setTimeout(r, ms));
const motion = (v) => p.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: v }]);

await motion("no-preference");
await p.goto(APP + "/app", { waitUntil: "domcontentloaded", timeout: 180000 });
await p.waitForSelector('nav[aria-label="Sections"] a', { timeout: 180000 });
await settle(4000);

async function tap(label, dest) {
  await p.waitForSelector('nav[aria-label="Sections"] a', { timeout: 60000 });
  return p.evaluate(async ({ label, dest }) => {
    const a = [...document.querySelectorAll('nav[aria-label="Sections"] a')].find((x) => x.innerText.trim() === label);
    const main = document.querySelector("#content");
    const before = main.firstElementChild;
    const t0 = performance.now();
    const done = new Promise((res) => {
      const tick = () => {
        if (location.pathname === dest && main.firstElementChild && main.firstElementChild !== before)
          requestAnimationFrame(() => res(performance.now() - t0));
        else if (performance.now() - t0 > 15000) res(-1);
        else requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    a.click();
    return await done;
  }, { label, dest });
}

const ROUTE = [["Learn", "/app/learn"], ["Home", "/app"], ["Earn", "/app/earn"], ["Home", "/app"]];
for (let i = 0; i < 4; i++) for (const [l, d] of ROUTE) { await tap(l, d); await settle(1400); }

const arm = { "with the slide": [], "no transition at all": [] };
for (let block = 0; block < 6; block++) {
  for (const [name, mode] of [["with the slide", "no-preference"], ["no transition at all", "reduce"]]) {
    await motion(mode);
    await settle(500);
    for (const [l, d] of ROUTE) { const ms = await tap(l, d); if (ms > 0) arm[name].push(ms); await settle(900); }
  }
}

const q = (a, f) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(s.length * f))]; };
console.log("\n── tap → destination screen in the DOM, painted next frame ──");
for (const [k, v] of Object.entries(arm))
  console.log(`  ${k.padEnd(22)} n=${v.length}  min ${q(v,0).toFixed(0)}  p25 ${q(v,0.25).toFixed(0)}  median ${q(v,0.5).toFixed(0)}  p75 ${q(v,0.75).toFixed(0)}ms`);
console.log(`  difference at the median: ${(q(arm["with the slide"],0.5) - q(arm["no transition at all"],0.5)).toFixed(0)}ms`);
await b.close();
