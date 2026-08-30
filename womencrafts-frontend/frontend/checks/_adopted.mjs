import { APP, launch, pageAs, staffToken } from "./_shared.mjs";
const SEL = '[role="separator"][aria-label="Resize panels"]';
// screen -> how many dividers it should have (columns - 1)
const SCREENS = {
  "calendar":1,"content":1,"feedback":1,"notifications":1,"programs":1,"reports":1,"services":1,
  "settings":1,"settings/appearance":1,"settings/backup":1,"settings/billing":1,"settings/help":1,
  "settings/integrations":1,"settings/logs":1,"settings/notifications":1,"settings/profile":1,
  "settings/roles":1,"settings/security":1,"settings/support":1,"users/roles":1,"users/segments":1,
  "messages/members":1, "analytics":2, "appointments":2, "messages":2,
};
const token = await staffToken();
const browser = await launch();
const page = await pageAs(browser, token, { width: 1600, height: 1000 });
const ok = [], bad = [];
for (const [s, want] of Object.entries(SCREENS)) {
  const errors = [];
  const onErr = (e) => errors.push(String(e));
  page.on("pageerror", onErr);
  try {
    await page.goto(`${APP}/dashboard/${s}`, { waitUntil: "networkidle2", timeout: 45000 });
    await new Promise((r) => setTimeout(r, 2600));
    const n = await page.$$eval(SEL, (els) => els.length).catch(() => 0);
    const side = await page.evaluate(() => { window.scrollTo(500,0); const x=Math.round(window.scrollX); window.scrollTo(0,0); return x; });
    if (n === want && !side && !errors.length) ok.push(s);
    else bad.push(`${s}  dividers=${n}/${want} sideScroll=${side} errors=${errors.length}${errors[0] ? " :: " + errors[0].slice(0,70) : ""}`);
  } catch (e) { bad.push(`${s}  ${String(e).slice(0, 60)}`); }
  page.off("pageerror", onErr);
}
await browser.close();
console.log(`correct: ${ok.length}/${Object.keys(SCREENS).length}`);
if (bad.length) { console.log("\nPROBLEMS:"); bad.forEach((b) => console.log("   ", b)); }
process.exit(bad.length ? 1 : 0);
