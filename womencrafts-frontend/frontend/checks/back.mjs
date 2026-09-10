/**
 * Back must return her to where she came from (§87).
 *
 * The bug: every back control was a hard link to a fixed parent, so reaching a
 * screen from anywhere unexpected and pressing back moved her sideways into a
 * page she had never seen.
 *
 * Both halves are tested, because fixing only the first breaks deep links:
 *   in-app arrival  → back returns to the actual previous page
 *   cold arrival    → back goes to the declared parent, not out of the app
 */
import { launch, pageAs, seededMemberToken, APP } from "./_shared.mjs";

const TRIPS = [
  ["/app/journey",  "/app/vault/rules",   "/app/vault"],
  ["/app/discover", "/app/shop/voice",    "/app/shop"],
  ["/app/money",    "/app/vault/showing", "/app/vault"],
  ["/app/goals",    "/app/shop/pricing",  "/app/shop"],
];

const tok = await seededMemberToken();
const b = await launch();
let bad = 0;

const pressBack = (p) => p.evaluate(() => {
  const el = [...document.querySelectorAll("a,button")]
    .find((e) => /^back\b/i.test(e.innerText.trim()));
  if (!el) return null;
  el.click();
  return el.innerText.trim();
});

console.log("── arrived from inside the app ──");
for (const [from, deep] of TRIPS) {
  const p = await pageAs(b, tok, { width: 1280, height: 900 });
  await p.goto(APP + from, { waitUntil: "networkidle0", timeout: 90000 });
  await new Promise((x) => setTimeout(x, 800));
  // A real in-app click, so the referrer is set the way it would be for her.
  await p.evaluate((d) => {
    const a = document.createElement("a"); a.href = d; a.textContent = "go";
    document.body.appendChild(a); a.click();
  }, deep);
  await new Promise((x) => setTimeout(x, 1600));
  const label = await pressBack(p);
  await new Promise((x) => setTimeout(x, 1400));
  const landed = new URL(p.url()).pathname;
  const ok = landed === from;
  if (!ok) bad++;
  console.log(`  ${ok ? "ok  " : "FAIL"} ${from} → ${deep} → "${label}" → ${landed}`);
  await p.close();
}

console.log("\n── arrived cold (a link someone sent her) ──");
for (const [, deep, parent] of TRIPS) {
  const p = await pageAs(b, tok, { width: 1280, height: 900 });
  await p.goto(APP + deep, { waitUntil: "networkidle0", timeout: 90000 });
  await new Promise((x) => setTimeout(x, 1000));
  const label = await pressBack(p);
  await new Promise((x) => setTimeout(x, 1400));
  const landed = new URL(p.url()).pathname;
  const ok = landed === parent;
  if (!ok) bad++;
  console.log(`  ${ok ? "ok  " : "FAIL"} ${deep} → "${label}" → ${landed}  (expected ${parent})`);
  await p.close();
}

await b.close();
console.log(bad === 0 ? "\nBack returns to context, and never strands a deep link."
                      : `\n${bad} back failures.`);
process.exit(bad === 0 ? 0 : 1);
