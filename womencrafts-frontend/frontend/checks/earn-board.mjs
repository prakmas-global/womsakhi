/** Browser checks for the live Earn dashboard. */
import { launch, pageAs, seededMemberToken, APP } from "./_shared.mjs";

const token = await seededMemberToken();
if (!token) throw new Error("Seeded member sign-in is unavailable");
const browser = await launch();
let failures = 0;
const check = (ok, label) => {
  console.log(`${ok ? "ok  " : "FAIL"}  ${label}`);
  if (!ok) failures++;
};

try {
  for (const [width, height] of [[1536, 1024], [390, 844]]) {
    const page = await pageAs(browser, token, { width, height });
    await page.goto(`${APP}/app/earn`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForSelector("[data-earn-dashboard] h1", { timeout: 30000 });
    await page.waitForFunction(() => document.querySelectorAll("#content article").length > 0, { timeout: 30000 });
    const state = await page.evaluate(async () => {
      const root = document.querySelector("[data-earn-dashboard]");
      const image = root.querySelector('img[src="/ux/art/earn-dashboard-hero.png"]');
      await image.decode().catch(() => {});
      const cardImages = await Promise.all([...root.querySelectorAll("article")].map(async card => {
        const art = card.firstElementChild;
        const url = getComputedStyle(art).backgroundImage.match(/url\(["']?(.*?)["']?\)/)?.[1];
        if (!url) return false;
        const loaded = new Image();
        loaded.src = url;
        await loaded.decode().catch(() => {});
        return loaded.naturalWidth > 0;
      }));
      const scroll = document.getElementById("ux-scroll");
      return {
        text: root.innerText,
        links: [...root.querySelectorAll("a")].map(a => a.getAttribute("href")),
        cards: root.querySelectorAll("article").length,
        imageWidth: image.naturalWidth,
        cardImages,
        rail: !!document.querySelector('nav[aria-label="Sections"]'),
        sideways: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        scrolls: scroll.scrollHeight > scroll.clientHeight,
        canvas: getComputedStyle(document.querySelector(".ux")).getPropertyValue("--ux-canvas").trim(),
        heroInk: getComputedStyle(root.querySelector("h1")).color,
        helpInk: getComputedStyle([...root.querySelectorAll("h2")].find(el => el.textContent === "Need Help Getting Started?")).color,
      };
    });
    check(["Ways You Can Earn", "Recommended For You", "Your Earnings", "Your Progress"].every(s => state.text.includes(s)), `${width}px: main sections render`);
    check(["/app/documents/new", "/app/shop", "/app/opportunities", "/app/wallet"].every(href => state.links.includes(href)), `${width}px: actions reach existing routes`);
    check(state.cards > 0 && state.imageWidth > 0 && state.cardImages.every(Boolean), `${width}px: live opportunities and images render`);
    check(state.sideways === 0, `${width}px: no horizontal overflow`);
    check(state.canvas === "#fcf8f7", `${width}px: Earn respects light mode`);
    check(state.heroInk === "rgb(255, 255, 255)" && state.helpInk === "rgb(255, 255, 255)", `${width}px: text on dark media stays legible`);
    if (width === 1536) check(state.rail, "1536px: Earn navigation remains available");
    if (width === 390) check(state.scrolls, "390px: content remains scrollable");
    if (width === 1536) {
      await page.click('button[aria-label="Switch to dark"]');
      check(await page.evaluate(() => getComputedStyle(document.querySelector(".ux")).getPropertyValue("--ux-canvas").trim()) === "#190e14", "theme toggle applies Earn dark mode");
      await page.click('button[aria-label="Switch to light"]');
      check(await page.evaluate(() => getComputedStyle(document.querySelector(".ux")).getPropertyValue("--ux-canvas").trim()) === "#fcf8f7", "theme toggle returns to light mode");
      await page.click('button[aria-pressed="false"]');
      check(await page.$eval('button[aria-pressed="true"]', el => el.textContent.trim()) === "Trending", "filter switches opportunity order");
      await page.type('input[aria-label="Search earning opportunities"]', "not-a-real-opportunity");
      await page.click('button[type="submit"]');
      check((await page.$eval("#content", el => el.innerText)).includes("No opportunities match"), "search shows honest empty state");
    }
    await page.close();
  }
} finally {
  await browser.close();
}

console.log(failures ? `FAIL: ${failures} Earn dashboard checks` : "PASS: Earn dashboard");
process.exit(failures ? 1 : 0);
