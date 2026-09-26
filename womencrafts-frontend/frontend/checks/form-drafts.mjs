/** Unfinished high-effort member forms survive a reload for the same member. */
import { APP, launch, pageAs, seededMemberToken } from "./_shared.mjs";

const token = await seededMemberToken();
if (!token) throw new Error("Could not sign in as the seeded member");
const browser = await launch();
const page = await pageAs(browser, token);
let failures = 0;

try {
  for (const [route, label, value] of [
    ["/app/circles/create", "Circle name", "Draft Circle Check"],
    ["/app/documents/new", "Title", "Draft Listing Check"],
  ]) {
    await page.goto(`${APP}${route}`, { waitUntil: "domcontentloaded", timeout: 20000 });
    await new Promise((done) => setTimeout(done, 500));
    await page.evaluate(() => {
      for (const key of Object.keys(localStorage)) {
        if (key.startsWith("womsakhi.form.")) localStorage.removeItem(key);
      }
    });
    await page.reload({ waitUntil: "domcontentloaded" });
    await new Promise((done) => setTimeout(done, 500));
    const selector = `input[aria-label="${label}"]`;
    await page.type(selector, value);
    await new Promise((done) => setTimeout(done, 700));
    await page.reload({ waitUntil: "domcontentloaded" });
    await new Promise((done) => setTimeout(done, 700));
    const restored = await page.$eval(selector, (element) => element.value);
    const ok = restored === value;
    console.log(`${ok ? "PASS" : "FAIL"}: ${route} restores its unfinished draft`);
    if (!ok) failures++;
  }
} finally {
  await page.evaluate(() => {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith("womsakhi.form.")) localStorage.removeItem(key);
    }
  }).catch(() => {});
  await browser.close();
}

if (failures) process.exit(1);
