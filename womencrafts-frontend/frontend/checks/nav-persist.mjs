/**
 * The chrome survives a navigation; only the middle changes.
 *
 * Proved by branding the live DOM nodes and clicking a real rail link. If the
 * brand is still there afterwards the element was never destroyed. Before the
 * chrome moved into the layout every one of these was replaced on every click
 * — which is why the screen looked like it reloaded and the sidebar lost her
 * scroll position.
 */
import puppeteer from "puppeteer-core";
import { CHROME, APP, seededMemberToken } from "./_shared.mjs";

const tok = await seededMemberToken();
for (const r of ["/app/documents", "/app/wallet", "/app/collect"])
  await fetch(APP + r, { headers: { Cookie: `access_token=${tok}` } }).catch(() => {});

const b = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox"] });
const p = await b.newPage();
await p.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 1 });
await p.setCookie({ name: "access_token", value: tok, domain: "localhost", path: "/" });
await p.goto(APP + "/app/documents", { waitUntil: "networkidle2", timeout: 180000 });
// Wait for hydration, not a guess: the rail's links only work once React has
// attached, and on a loaded dev server that can take several seconds.
await p.waitForFunction(
  () => document.querySelectorAll('aside nav[aria-label="Sections"] a').length > 5,
  { timeout: 60000 });
await new Promise(x => setTimeout(x, 1200));

// Brand the chrome, and scroll the rail so we can see whether the position holds.
await p.evaluate(() => {
  document.querySelector("aside")?.setAttribute("data-brand", "rail-1");
  document.querySelector("header")?.setAttribute("data-brand", "top-1");
  document.querySelector("#ux-scroll")?.setAttribute("data-brand", "scroller-1");
  const aside = document.querySelector("aside");
  if (aside) aside.scrollTop = 120;
});
const before = await p.evaluate(() => ({
  scroll: document.querySelector("aside")?.scrollTop ?? -1,
  path: location.pathname,
}));

// Click a real rail link, the way she would.
const to = await p.evaluate(() => {
  const link = [...document.querySelectorAll('aside nav[aria-label="Sections"] a')]
    .find(a => a.getAttribute("href") === "/app/wallet");
  if (!link) return null;
  link.click();
  return "/app/wallet";
});
await p.waitForFunction((want) => location.pathname === want, { timeout: 30000 }, "/app/wallet")
  .catch(() => {});
// Wait for the DESTINATION, not for a stopwatch. With the view transition
// gone, React keeps the previous screen on display until the new route is
// ready — which is the correct behaviour and is what a fixed sleep kept
// mistaking for the new screen. It read the first `h1` in the document and
// found the one belonging to the page she had just left.
await p.waitForFunction(
  () => /wallet/i.test(document.querySelector("#content h1")?.innerText ?? ""),
  { timeout: 30000 },
).catch(() => {});

const after = await p.evaluate(() => ({
  path: location.pathname,
  rail: document.querySelector("aside")?.getAttribute("data-brand") ?? null,
  top: document.querySelector("header")?.getAttribute("data-brand") ?? null,
  scroller: document.querySelector("#ux-scroll")?.getAttribute("data-brand") ?? null,
  scroll: document.querySelector("aside")?.scrollTop ?? -1,
  h1: document.querySelector("#content h1")?.innerText.slice(0, 30) ?? "-",
}));

let bad = 0;
const say = (ok, msg) => { console.log(`  ${ok ? "ok  " : "FAIL"}  ${msg}`); if (!ok) bad++; };
say(to === "/app/wallet" && after.path === "/app/wallet", `the click navigated (${after.path})`);
say(after.top === "top-1", "the topbar element survived");
say(after.rail === "rail-1", "the rail element survived");
say(after.scroller === "scroller-1", "the scroll container survived");
say(after.scroll === before.scroll, `the rail kept her scroll position (${before.scroll} -> ${after.scroll})`);
say(/wallet/i.test(after.h1), `the middle shows the destination (h1: ${after.h1})`);

console.log(bad ? `\n FAIL  ${bad} of 6` : "\n PASS  only the middle re-rendered");
await b.close();
process.exit(bad ? 1 : 0);
