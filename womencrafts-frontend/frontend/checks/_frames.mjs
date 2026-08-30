import { APP, launch, seededMemberToken } from "./_shared.mjs";
const token = await seededMemberToken();
const browser = await launch();
const ctx = await browser.createBrowserContext();
const page = await ctx.newPage();
await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });
await page.setCookie({ name: "access_token", value: token, domain: "localhost", path: "/" });
await page.goto(`${APP}/app`, { waitUntil: "networkidle2", timeout: 60000 });
await new Promise((r) => setTimeout(r, 1500));
await page.evaluate(() => document.querySelector('button[aria-label="Ask Sakhi"]')?.click());

// wait for speech
for (let i = 0; i < 40; i++) {
  await new Promise((r) => setTimeout(r, 400));
  if (await page.evaluate(() => document.body.innerText.includes("Speaking"))) break;
}
const face = await page.$('div[aria-hidden] img[src="/sakhi-face.png"]');
const holder = face ? (await face.evaluateHandle((e) => e.closest("div").parentElement)) : null;

const shots = [];
for (let i = 0; i < 10; i++) {
  const el = await page.$('img[src="/sakhi-face.png"]');
  if (!el) break;
  const parent = await el.evaluateHandle((e) => e.parentElement.parentElement);
  await parent.asElement().screenshot({ path: `/tmp/f${i}.png` });
  shots.push(i);
  await new Promise((r) => setTimeout(r, 260));
}
console.log("captured frames:", shots.length);
await browser.close();
