/** One browser, all six shots of /app/learn. */
import { launch, pageAs, seededMemberToken, APP } from "./_shared.mjs";
const tag = process.env.TAG || "before";
const out = process.env.OUT || "/private/tmp/claude-501/-Users-praveenmaddela-Desktop-PRAKMAS-GLOBAL/ab20bff5-1632-4dd1-8eb2-2ed0e468a687/scratchpad/shots";
const tok = await seededMemberToken();
const b = await launch();
const SIZES = [[1586, 992], [1440, 900], [1366, 768], [390, 844]];
for (const mode of ["light", "dark"]) {
  const p = await pageAs(b, tok, { width: 1586, height: 992, mode });
  await p.evaluateOnNewDocument((m) => { try { localStorage.setItem("theme", m); } catch {} }, mode);
  await p.goto(APP + "/app/learn", { waitUntil: "domcontentloaded", timeout: 180000 });
  await p.waitForFunction(() => /Learn\. Grow/.test(document.querySelector("#content")?.innerText ?? ""), { timeout: 90000 });
  await new Promise((z) => setTimeout(z, 2500));
  for (const [w, h] of SIZES) {
    await p.setViewport({ width: w, height: h, deviceScaleFactor: 2 });
    await new Promise((z) => setTimeout(z, 1200));
    const full = w === 390;
    await p.screenshot({ path: `${out}/${tag}-${mode}-${w}x${h}.png`, fullPage: full });
    const m = await p.evaluate(() => {
      const sc = document.getElementById("ux-scroll");
      return { over: sc.scrollHeight - sc.clientHeight };
    });
    console.log(`  ${tag} ${mode} ${w}x${h}  overflow ${m.over}`);
  }
  await p.close();
}
await b.close();
