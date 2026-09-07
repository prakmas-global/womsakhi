/**
 * Back, and deep links (§85, §87).
 *
 * Two things a woman does constantly and nobody tests: she opens a link
 * someone sent her, and she presses back. If a deep link 404s or back lands
 * her on Home instead of the list she came from, the app is broken in the way
 * that makes people stop using it.
 */
import { launch, pageAs, seededMemberToken, APP } from "./_shared.mjs";
const tok = await seededMemberToken();
const b = await launch();
let bad = 0;

// 1. Deep links — arriving cold, no history.
const DEEP = ["/app/market/m1", "/app/journey", "/app/goals", "/app/contracts/together",
              "/app/vault/showing", "/app/shop/slots", "/s/priya-tailoring", "/pay/PR-4820"];
console.log("── deep links (cold arrival) ──");
for (const r of DEEP) {
  const p = await pageAs(b, r.startsWith("/app") ? tok : "", { width: 1280, height: 900 });
  let st = 0;
  try { st = (await p.goto(APP + r, { waitUntil: "networkidle0", timeout: 90000 }))?.status() ?? 0; }
  catch { st = 0; }
  await new Promise(x => setTimeout(x, 700));
  const t = await p.evaluate(() => (document.body.innerText || "").trim().length).catch(() => 0);
  const ok = st === 200 && t > 200;
  if (!ok) bad++;
  console.log(`  ${ok ? "ok  " : "FAIL"} ${r.padEnd(26)} ${st} text=${t}`);
  await p.close();
}

// 2. Back preserves context, rather than dumping her on Home.
console.log("\n── back from a detail page ──");
for (const [list, detailLink] of [["/app/market", "a[href^='/app/market/']"],
                                  ["/app/opportunities", "a[href^='/app/opportunities/']"]]) {
  const p = await pageAs(b, tok, { width: 1280, height: 900 });
  await p.goto(APP + list, { waitUntil: "networkidle0", timeout: 90000 });
  await new Promise(x => setTimeout(x, 1000));
  const went = await p.evaluate((sel) => {
    const a = document.querySelector(sel); if (!a) return null;
    a.click(); return a.getAttribute("href");
  }, detailLink).catch(() => null);
  if (!went) { console.log(`  skip ${list} — no detail link found`); await p.close(); continue; }
  await new Promise(x => setTimeout(x, 1600));
  const on = new URL(p.url()).pathname;
  await p.goBack({ waitUntil: "networkidle0", timeout: 60000 }).catch(() => {});
  await new Promise(x => setTimeout(x, 1200));
  const back = new URL(p.url()).pathname;
  const ok = back === list;
  if (!ok) bad++;
  console.log(`  ${ok ? "ok  " : "FAIL"} ${list} → ${on} → back → ${back}`);
  await p.close();
}
await b.close();
console.log(bad === 0 ? "\nDeep links resolve and back returns to context." : `\n${bad} navigation failures.`);
process.exit(bad === 0 ? 0 : 1);
