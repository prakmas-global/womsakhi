import { APP, launch, seededMemberToken } from "./_shared.mjs";
const token = await seededMemberToken();
const browser = await launch();
const ctx = await browser.createBrowserContext();
const page = await ctx.newPage();
await page.setViewport({ width: 430, height: 900 });
await page.setCookie({ name: "access_token", value: token, domain: "localhost", path: "/" });
const errs = [];
page.on("pageerror", (e) => errs.push(String(e)));
page.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });

await page.goto(`${APP}/app`, { waitUntil: "networkidle2", timeout: 60000 });
await new Promise((r) => setTimeout(r, 2000));

const launcher = await page.$('button[aria-label="Ask Sakhi"]');
console.log("launcher present:", !!launcher);
await page.screenshot({ path: "/tmp/sakhi-1-launcher.png" });

if (launcher) {
  await launcher.click();
  await new Promise((r) => setTimeout(r, 1500));
  const opened = await page.evaluate(() => document.body.innerText.includes("Sakhi is an assistant"));
  console.log("panel opened   :", opened);
  const face = await page.$('img[src="/sakhi.png"]');
  console.log("her face shown :", !!face);
  await page.screenshot({ path: "/tmp/sakhi-2-open.png" });

  // ask something and let her answer + speak
  await page.evaluate(() => {
    const b = [...document.querySelectorAll("button")].find((x) => /What sessions do I have/i.test(x.innerText));
    b?.click();
  });
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    const t = await page.evaluate(() => document.body.innerText);
    if (/Speaking|sessions|booking|nothing/i.test(t) && !/Thinking/.test(t)) break;
  }
  await new Promise((r) => setTimeout(r, 1500));
  const state = await page.evaluate(() => ({
    status: document.body.innerText.split("\n").find((l) => /Speaking|Thinking|Ask me anything/.test(l)),
    reply: [...document.querySelectorAll("p")].map((p) => p.innerText).find((t) => t.length > 40) ?? "",
  }));
  console.log("status line    :", state.status);
  console.log("her reply      :", state.reply.slice(0, 110));
  await page.screenshot({ path: "/tmp/sakhi-3-answer.png" });
}
console.log("console errors :", errs.filter((e) => !/favicon|DevTools/i.test(e)).slice(0, 3));
await browser.close();
