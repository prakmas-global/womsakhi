/** Browser checks for the Circle dashboard in both app themes. */
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
    await page.goto(`${APP}/app/circle`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForSelector("[data-circle-dashboard] h1", { timeout: 30000 });
    await page.waitForFunction(() => document.querySelectorAll("[data-circle-dashboard] article").length > 0, { timeout: 30000 });
    const state = await page.evaluate(async () => {
      const root = document.querySelector("[data-circle-dashboard]");
      const hero = root.querySelector('img[src="/ux/art/circle-dashboard-hero-v2.png"]');
      const leaves = root.querySelector('img[src="/ux/art/circle-dashboard-leaves.png"]');
      await Promise.all([hero.decode().catch(() => {}), leaves.decode().catch(() => {})]);
      const cardArts = [...root.querySelectorAll("article")].slice(0, 4).map(card => {
        const css = getComputedStyle(card.firstElementChild);
        return `${css.backgroundImage} ${css.backgroundPosition}`;
      });
      return {
        text: root.innerText,
        links: [...root.querySelectorAll("a")].map(link => link.getAttribute("href")),
        count: root.querySelectorAll("article").length,
        cardArtCount: new Set(cardArts).size,
        heroWidth: hero.naturalWidth,
        leavesWidth: leaves.naturalWidth,
        sideways: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        scrolls: document.getElementById("ux-scroll").scrollHeight > document.getElementById("ux-scroll").clientHeight,
      };
    });
    check(["Real Women.", "My Circles", "Upcoming Events", "Your Circle Journey"].every(label => state.text.includes(label)), `${width}px: dashboard sections render`);
    check(["/app/circles/create", "/app/circles", "/app/messages", "/app/events", "/app/together", "/app/swap"].every(href => state.links.includes(href)), `${width}px: actions reach existing routes`);
    check(state.count > 0 && state.heroWidth > 0 && state.leavesWidth > 0 && state.cardArtCount > 1, `${width}px: generated artwork renders with distinct circle images`);
    check(state.sideways === 0, `${width}px: no horizontal overflow`);
    if (width === 390) check(state.scrolls, "390px: the full dashboard remains scrollable");
    if (width === 1536) {
      await page.click('button[aria-label="Switch to dark"]');
      check(await page.evaluate(() => document.documentElement.classList.contains("dark")), "dark theme toggle works");
      await page.click('button[aria-label="Switch to light"]');
      check(await page.evaluate(() => !document.documentElement.classList.contains("dark")), "light theme toggle works");
    }
    await page.close();
  }
} finally {
  await browser.close();
}

console.log(failures ? `FAIL: ${failures} Circle dashboard checks` : "PASS: Circle dashboard");
process.exit(failures ? 1 : 0);
