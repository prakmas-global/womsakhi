/** Browser check for the Work dashboard and its narrow layout. */
import { launch, pageAs, seededMemberToken, APP } from "./_shared.mjs";

const token = await seededMemberToken();
if (!token) throw new Error("Seeded member sign-in is unavailable");

const browser = await launch();
let failures = 0;
const check = (ok, message) => {
  console.log(`${ok ? "ok  " : "FAIL"}  ${message}`);
  if (!ok) failures++;
};

try {
  for (const [width, height] of [[1586, 992], [390, 844]]) {
    const page = await pageAs(browser, token, { width, height });
    await page.goto(`${APP}/app/work`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForFunction(() => document.querySelector("#content h1")?.textContent?.includes("Work on"), { timeout: 30000 });
    await page.waitForFunction(() => document.querySelectorAll("#content article").length > 0, { timeout: 30000 });
    await page.evaluate(() => Promise.all([...document.querySelectorAll('#content article img, #content img[src*="work-dashboard-hero"]')].map(async img => {
      img.loading = "eager";
      await img.decode().catch(() => {});
    })));
    const state = await page.evaluate(() => {
      const content = document.querySelector("#content");
      const text = content.innerText;
      const links = [...content.querySelectorAll("a")].map(a => a.getAttribute("href"));
      const images = [...content.querySelectorAll('article img, img[src*="work-dashboard-hero"]')];
      return {
        text, links, imageCount: images.length,
        broken: images.filter(img => img.naturalWidth === 0).map(img => img.getAttribute("src")),
        cards: content.querySelectorAll("article").length,
        sideways: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };
    });
    check(["Recommended Opportunities", "Earnings Overview", "Top Skills in Demand", "Your Progress"].every(label => state.text.includes(label)), `${width}px: dashboard sections render`);
    check(["/app/opportunities", "/app/applications", "/app/profile", "/app/trust"].every(href => state.links.includes(href)), `${width}px: actions reach existing routes`);
    check(state.cards > 0 && state.imageCount >= 2 && state.broken.length === 0, `${width}px: live cards and artwork render`);
    check(state.sideways === 0, `${width}px: no horizontal overflow`);

    if (width === 1586) {
      await page.click('button[aria-pressed="false"]');
      const selected = await page.$eval('button[aria-pressed="true"]', button => button.textContent.trim());
      check(selected === "Remote", "opportunity filter changes selection");
      await page.type('input[aria-label="Search opportunities"]', "content");
      await page.click('button[type="submit"]');
      const searched = await page.$eval("#content", element => element.innerText);
      check(searched.includes("content") || searched.includes("No opportunities match"), "search updates opportunity results");
    }
    await page.close();
  }
} finally {
  await browser.close();
}

console.log(failures ? `FAIL: ${failures} Work dashboard checks` : "PASS: Work dashboard");
process.exit(failures ? 1 : 0);
