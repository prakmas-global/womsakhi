/**
 * Is her mouth ACTUALLY moving with the words?
 *
 * A screenshot proves she rendered. It cannot prove lip-sync. This samples the
 * mouth transform many times across one spoken sentence and checks that it
 * changes, closes fully at least once (p/b/m and silence), and opens wide at
 * least once — the three things that separate real viseme animation from a
 * static face or a jaw bouncing on a timer.
 */
import { APP, launch, seededMemberToken } from "./_shared.mjs";

const token = await seededMemberToken();
const browser = await launch();
const ctx = await browser.createBrowserContext();
const page = await ctx.newPage();
await page.setViewport({ width: 430, height: 900 });
await page.setCookie({ name: "access_token", value: token, domain: "localhost", path: "/" });
// Autoplay needs a gesture; puppeteer's click counts, but allow it explicitly.
await page.goto(`${APP}/app`, { waitUntil: "networkidle2", timeout: 60000 });
await new Promise((r) => setTimeout(r, 1500));
await page.click('button[aria-label="Ask Sakhi"]');
await new Promise((r) => setTimeout(r, 1200));

// layout first
const box = await page.evaluate(() => {
  const panel = document.querySelector(".wc-card");
  const r = panel.getBoundingClientRect();
  return { left: Math.round(r.left), right: Math.round(r.right), width: Math.round(r.width),
           viewport: window.innerWidth };
});
console.log("panel:", JSON.stringify(box), box.right <= box.viewport ? "· fits" : "· OVERFLOWS");

await page.evaluate(() => {
  const b = [...document.querySelectorAll("button")].find((x) => /What sessions do I have/i.test(x.innerText));
  b?.click();
});

// wait for speech to begin
let began = false;
for (let i = 0; i < 90; i++) {
  await new Promise((r) => setTimeout(r, 500));
  began = await page.evaluate(() => document.body.innerText.includes("Speaking"));
  if (began) break;
}
console.log("speech started:", began);

const samples = [];
for (let i = 0; i < 70; i++) {
  const s = await page.evaluate(() => {
    const m = document.querySelector('[style*="background-image"][style*="sakhi.png"]');
    if (!m) return null;
    const t = getComputedStyle(m).transform;
    const seal = m.querySelector("div");
    return { t, seal: seal ? parseFloat(getComputedStyle(seal).opacity) : -1 };
  });
  if (s) samples.push(s);
  await new Promise((r) => setTimeout(r, 70));
}

const mats = samples.map((s) => s.t).filter((t) => t && t !== "none");
const uniq = new Set(mats);
// scaleY is matrix(a,b,c,d,e,f) -> d
const scaleY = mats.map((t) => parseFloat(t.split("(")[1]?.split(",")[3] ?? "1")).filter(Number.isFinite);
const seals = samples.map((s) => s.seal).filter((v) => v >= 0);

console.log("samples          :", samples.length);
console.log("distinct transforms:", uniq.size);
console.log("scaleY min/max   :", Math.min(...scaleY).toFixed(3), "/", Math.max(...scaleY).toFixed(3));
console.log("seal opacity max :", Math.max(...seals).toFixed(2), "(1 = lips fully closed)");

const moving = uniq.size > 8;
const opensWide = Math.max(...scaleY) > 1.25;
const closes = Math.max(...seals) > 0.8;
console.log(`\n${moving ? "  ok  " : " FAIL "} the mouth changes shape (${uniq.size} distinct)`);
console.log(`${opensWide ? "  ok  " : " FAIL "} it opens wide for vowels`);
console.log(`${closes ? "  ok  " : " FAIL "} it closes fully for p/b/m and silence`);
await browser.close();
