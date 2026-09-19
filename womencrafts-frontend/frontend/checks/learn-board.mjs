/** Browser check for the Learn dashboard and its mobile layout. */
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
    await page.goto(`${APP}/app/learn`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForFunction(() => document.querySelector("#content h1")?.textContent === "Learn Without Limits", { timeout: 30000 });
    await page.evaluate(() => Promise.all([...document.querySelectorAll("#content img")].map(img => img.decode().catch(() => {}))));

    const state = await page.evaluate(() => {
      const content = document.querySelector("#content");
      const text = content?.innerText ?? "";
      const links = [...content.querySelectorAll("a")].map(a => a.getAttribute("href"));
      const images = [...content.querySelectorAll("img")];
      return {
        text,
        links,
        imageCount: images.length,
        brokenImages: images.filter(img => img.naturalWidth === 0).map(img => img.getAttribute("src")),
        sideways: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        paths: text.includes("Learning Paths"),
      };
    });

    check(state.text.includes("Continue Learning") && state.text.includes("Recommended for You") && state.paths,
      `${width}px: all main learning sections render`);
    check(["/app/programs", "/app/mentors", "/app/certificates", "/app/schedule", "/app/goals"].every(href => state.links.includes(href)),
      `${width}px: dashboard actions reach existing destinations`);
    check(state.imageCount === 6 && state.brokenImages.length === 0,
      `${width}px: all six generated images decode`);
    check(state.sideways === 0, `${width}px: no horizontal overflow`);
    await page.close();
  }
} finally {
  await browser.close();
}

console.log(failures ? `FAIL: ${failures} Learn dashboard checks` : "PASS: Learn dashboard");
process.exit(failures ? 1 : 0);
