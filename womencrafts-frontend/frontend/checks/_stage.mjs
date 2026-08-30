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
await new Promise((r) => setTimeout(r, 1500));
await page.click('button[aria-label="Ask Sakhi"]');

// she should greet and speak WITHOUT any further interaction
let spokeBy = -1;
for (let i = 0; i < 40; i++) {
  await new Promise((r) => setTimeout(r, 500));
  const t = await page.evaluate(() => document.body.innerText);
  if (/Speaking/.test(t)) { spokeBy = i * 0.5; break; }
}
console.log("greeted + spoke unprompted:", spokeBy >= 0, spokeBy >= 0 ? `after ${spokeBy}s` : "");

const ui = await page.evaluate(() => ({
  fullscreen: !!document.querySelector(".fixed.inset-0"),
  mic: !!document.querySelector('button[aria-label="Talk to Sakhi"], button[aria-label="Stop"]'),
  faceSize: (() => { const i = document.querySelector('img[src="/sakhi.png"]');
                     return i ? Math.round(i.getBoundingClientRect().width) : 0; })(),
  status: document.body.innerText.split("\n").find((l) => /Listening|Thinking|Speaking|Tap the micro/.test(l)),
  greeting: document.body.innerText.includes("I am Sakhi"),
}));
console.log("full-screen stage :", ui.fullscreen);
console.log("microphone present:", ui.mic);
console.log("her face width    :", ui.faceSize, "px");
console.log("status            :", ui.status);
console.log("greeting on screen:", ui.greeting);
await page.screenshot({ path: "/tmp/stage.png" });
console.log("console errors    :", errs.filter((e) => !/favicon|DevTools|autoplay|play\(\)/i.test(e)).slice(0,3));
await browser.close();
