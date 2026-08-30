import { APP, launch, seededMemberToken } from "./_shared.mjs";
const token = await seededMemberToken();
const browser = await launch();

for (const [label, w, h] of [["desktop", 1440, 900], ["phone", 430, 900]]) {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.setViewport({ width: w, height: h });
  await page.setCookie({ name: "access_token", value: token, domain: "localhost", path: "/" });
  await page.goto(`${APP}/app`, { waitUntil: "networkidle2", timeout: 60000 });
  await new Promise((r) => setTimeout(r, 1500));
  // Click via JS: Next's dev badge overlays the corner and a coordinate click
  // lands on it instead of her.
  await page.evaluate(() => document.querySelector('button[aria-label="Ask Sakhi"]')?.click());
  await new Promise((r) => setTimeout(r, 2500));

  const m = await page.evaluate(() => {
    const panel = [...document.querySelectorAll(".wc-card")]
      .find((e) => e.innerText.includes("Sakhi") && e.querySelector('img[src="/sakhi.png"]'));
    if (!panel) return null;
    const r = panel.getBoundingClientRect();
    const face = panel.querySelector('img[src="/sakhi.png"]').getBoundingClientRect();
    return {
      left: Math.round(r.left), right: Math.round(r.right),
      width: Math.round(r.width), height: Math.round(r.height),
      vw: window.innerWidth, vh: window.innerHeight,
      face: Math.round(face.width),
      appVisible: Math.round(r.left) > 40,
      mic: !!panel.querySelector('button[aria-label="Talk to Sakhi"], button[aria-label="Stop"]'),
    };
  });
  console.log(`${label.padEnd(8)}`, JSON.stringify(m));
  console.log(`         covers ${m ? Math.round((m.width*m.height)/(m.vw*m.vh)*100) : "?"}% of screen · app visible behind: ${m?.appVisible}`);
  await page.screenshot({ path: `/tmp/dock-${label}.png` });
  await ctx.close();
}
await browser.close();
