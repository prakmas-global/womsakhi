/**
 * Does any dashboard screen actually break on a phone?
 *
 * Measured two ways, because `scrollWidth > clientWidth` lies here: `body` is
 * `overflow-x: clip`, and a table inside its own `overflow-x-auto` container is
 * *supposed* to be wider than the viewport. Both inflate scrollWidth without
 * anything being wrong.
 *
 *   · realScroll — try to scroll the window sideways and see if it moves.
 *   · clipped    — content pushed past the right edge that is NOT inside a
 *                  horizontal scroll container, so it is genuinely unreachable.
 */
import { APP, launch, pageAs, staffToken, routes } from "./_shared.mjs";

const token = await staffToken();
const browser = await launch();
const page = await pageAs(browser, token, { width: 390, height: 844 });

const { admin } = routes();
const rows = [];
for (const r of admin) {
  try {
    await page.goto(`${APP}${r}`, { waitUntil: "domcontentloaded", timeout: 30000 });
    await new Promise((x) => setTimeout(x, 700));
    const m = await page.evaluate(() => {
      const de = document.documentElement;
      window.scrollTo(500, 0);
      const realScroll = Math.round(window.scrollX);
      window.scrollTo(0, 0);

      const inScroller = (el) => {
        for (let n = el.parentElement; n; n = n.parentElement) {
          const ox = getComputedStyle(n).overflowX;
          if (ox === "auto" || ox === "scroll") return true;
        }
        return false;
      };
      let worst = null;
      document.querySelectorAll("*").forEach((el) => {
        const rect = el.getBoundingClientRect();
        if (rect.right <= de.clientWidth + 1 || rect.width < 24) return;
        if (inScroller(el)) return;                       // allowed to be wide
        if (!worst || rect.right > worst.right) {
          worst = { right: Math.round(rect.right), tag: el.tagName,
                    cls: (el.className?.toString?.() || "").slice(0, 58) };
        }
      });
      return { realScroll, clipped: worst ? worst.right - de.clientWidth : 0, worst };
    });
    rows.push({ route: r, ...m });
  } catch (e) {
    rows.push({ route: r, realScroll: -1, clipped: -1, err: String(e).slice(0, 60) });
  }
}
// --- the drawer itself ------------------------------------------------------
// Overflow numbers only say the shell stopped squashing the page. They do not
// say the navigation is still reachable, which is the entire point of moving
// it off-canvas — so drive it.
const drawer = { pass: [], fail: [] };
const dcheck = (name, ok, detail = "") => {
  (ok ? drawer.pass : drawer.fail).push(name);
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${!ok && detail ? "  — " + detail : ""}`);
};

await page.goto(`${APP}/dashboard`, { waitUntil: "networkidle2", timeout: 30000 });
await new Promise((r) => setTimeout(r, 800));

const offscreen = () => page.$eval("aside", (el) => el.getBoundingClientRect().right);
dcheck("the rail starts off-screen on a phone", (await offscreen()) <= 1, `right=${await offscreen()}`);

const opener = await page.$('button[aria-label="Open navigation"]');
dcheck("there is a way to open it", !!opener);

if (opener) {
  await opener.click();
  await new Promise((r) => setTimeout(r, 500));
  dcheck("tapping it slides the rail in", (await offscreen()) > 100, `right=${await offscreen()}`);

  const navLinks = await page.$$eval("aside a", (as) => as.filter((a) => a.offsetParent).length);
  dcheck("the navigation is readable once open", navLinks > 3, `${navLinks} visible links`);

  // Escape closes it.
  await page.keyboard.press("Escape");
  await new Promise((r) => setTimeout(r, 500));
  dcheck("Escape closes it", (await offscreen()) <= 1, `right=${await offscreen()}`);

  // Tapping the backdrop closes it.
  await opener.click();
  await new Promise((r) => setTimeout(r, 500));
  await page.mouse.click(370, 500);
  await new Promise((r) => setTimeout(r, 500));
  dcheck("tapping away closes it", (await offscreen()) <= 1, `right=${await offscreen()}`);

  // Navigating closes it, rather than covering the screen just asked for.
  // Only a VISIBLE link counts: several nav entries are collapsed groups whose
  // children are in the DOM but not on screen, and clicking one of those
  // navigates nowhere — which would fail this check for the wrong reason.
  await opener.click();
  await new Promise((r) => setTimeout(r, 500));
  const before = page.url();
  const navigated = await page.evaluate(() => {
    const here = location.pathname;
    const a = [...document.querySelectorAll("aside a")].find((x) => {
      const href = x.getAttribute("href") || "";
      return href.startsWith("/dashboard/") && href !== here && x.offsetParent !== null;
    });
    if (!a) return null;
    a.click();
    return a.getAttribute("href");
  });
  await new Promise((r) => setTimeout(r, 2000));
  dcheck("a visible nav link was found to click", !!navigated, "every link was inside a collapsed group");
  if (navigated) {
    dcheck("the link actually navigated", page.url() !== before, `${before} -> ${page.url()}`);
    dcheck("navigating closes it", (await offscreen()) <= 1, `right=${await offscreen()}`);
  }
}

// And above the breakpoint the rail is a column again, always visible.
await page.setViewport({ width: 1440, height: 900 });
await page.goto(`${APP}/dashboard`, { waitUntil: "networkidle2", timeout: 30000 });
await new Promise((r) => setTimeout(r, 800));
dcheck("on a desktop it is a permanent column again", (await offscreen()) > 100, `right=${await offscreen()}`);

await browser.close();

const scrolls = rows.filter((r) => r.realScroll > 0);
const clips = rows.filter((r) => r.clipped > 0);
console.log(`${scrolls.length} of ${rows.length} screens actually scroll sideways`);
console.log(`${clips.length} of ${rows.length} screens push content off-screen outside a scroller\n`);
for (const r of clips.sort((a, b) => b.clipped - a.clipped).slice(0, 12)) {
  console.log(`  +${String(r.clipped).padStart(4)}px  ${r.route}` +
    (r.worst ? `   <${r.worst.tag}> ${r.worst.cls}` : ""));
}
console.log(`\ndrawer: ${drawer.pass.length} passed, ${drawer.fail.length} failed`);
process.exit(scrolls.length || clips.length || drawer.fail.length ? 1 : 0);
