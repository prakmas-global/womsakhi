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
for (let i = 0; i < 40; i++) {
  await new Promise((r) => setTimeout(r, 400));
  if (await page.evaluate(() => document.body.innerText.includes("Speaking"))) break;
}
for (let i = 0; i < 6; i++) {
  const svg = await page.$("svg[viewBox='0 0 400 400']");
  if (!svg) { console.log("avatar not found"); break; }
  await svg.screenshot({ path: `/tmp/v${i}.png` });
  await new Promise((r) => setTimeout(r, 300));
}
console.log("frames captured");
await browser.close();
