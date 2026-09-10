import { launch, pageAs, seededMemberToken, APP } from "./_shared.mjs";
const tok = await seededMemberToken();
const b = await launch();
const p = await pageAs(b, tok, { width: 390, height: 844 });
const errs = []; p.on("pageerror", (e) => errs.push(String(e).slice(0, 200)));
const settle = (ms) => new Promise((r) => setTimeout(r, ms));
for (let i = 0; i < 3; i++) {
  await p.goto(APP + "/app/documents", { waitUntil: "domcontentloaded", timeout: 180000 });
  await p.waitForSelector('nav[aria-label="Sections"] a', { timeout: 180000 });
  await settle(2400);
  const t0 = Date.now();
  await p.evaluate(() => [...document.querySelectorAll('nav[aria-label="Sections"] a')].find((a) => a.innerText.trim() === "Earn").click());
  const marks = [];
  for (const w of [300, 700, 1500, 2600, 5000, 9000]) {
    await settle(w - (marks.length ? [0,300,700,1500,2600,5000][marks.length] : 0));
    marks.push(`${w}ms=${await p.evaluate(() => location.pathname)}`);
  }
  console.log(`  run ${i}: ${marks.join("  ")}  (${Date.now() - t0}ms total)`);
}
console.log(errs.length ? "  errors: " + [...new Set(errs)].slice(0,3).join(" | ") : "  no page errors");
await b.close();
