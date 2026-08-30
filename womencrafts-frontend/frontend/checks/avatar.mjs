/**
 * Sakhi has to read as a person who came over, not as a chat window with a
 * picture on it. Four things carry that, and each is easy to lose:
 *
 *   she arrives ALONE          no transcript wrapped around her by default
 *   the transcript is a choice  a button beside her opens it
 *   it opens BESIDE her         not around her, not on top of her
 *   her cut-out is really cut   a degraded alpha channel paints a grey box
 *
 * The last one is why this reads pixels rather than the DOM. A lossy encoder
 * leaves "transparent" pixels at alpha 3 or 4 — invisible to any DOM
 * assertion, but CSS drop-shadow treats the frame as solid and draws a
 * rectangle behind her, which is exactly how it was first reported.
 */
import { launch, pageAs, seededMemberToken, APP } from "./_shared.mjs";

const browser = await launch();
const page = await pageAs(browser, await seededMemberToken(), { width: 1440, height: 950 });

// A preloading animation keeps the connection busy, so `networkidle` never
// fires here — wait for the page's own readiness instead.
await page.goto(`${APP}/app`, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForSelector("button", { timeout: 30000 });
await new Promise((r) => setTimeout(r, 2500));

// Match the launcher exactly: /sakhi/i also hits the "WomSakhi" theme card.
const opened = await page.evaluate(() => {
  const b = [...document.querySelectorAll("button")]
    .find((x) => x.getAttribute("aria-label") === "Ask Sakhi");
  if (!b) return false;
  b.click();
  return true;
});
if (!opened) {
  console.log("\n  could not find the Sakhi launcher\n");
  await browser.close();
  process.exit(1);
}
await new Promise((r) => setTimeout(r, 5000));

const panelBox = () => page.evaluate(() => {
  const c = [...document.querySelectorAll(".wc-card")]
    .find((x) => [...x.querySelectorAll("p")].some((t) => t.textContent.trim() === "Sakhi"));
  if (!c) return null;
  const r = c.getBoundingClientRect();
  return { left: r.left, right: r.right, bottom: r.bottom, width: r.width };
});

const her = await page.evaluate(() => {
  const el = document.querySelector('img[src*="sakhi-talking"], img[src*="sakhi-still"]');
  if (!el) return { found: false };
  const v = el.getBoundingClientRect();

  let worstAlpha = -1;
  try {
    const c = document.createElement("canvas");
    c.width = el.naturalWidth;
    c.height = el.naturalHeight;
    const g = c.getContext("2d", { willReadFrequently: true });
    g.drawImage(el, 0, 0);
    const d = g.getImageData(0, 0, 16, 16).data;   // a corner that must be empty
    worstAlpha = 0;
    for (let i = 3; i < d.length; i += 4) worstAlpha = Math.max(worstAlpha, d[i]);
  } catch { /* reported below */ }

  return {
    found: true, natural: el.naturalWidth, complete: el.complete,
    box: [Math.round(v.width), Math.round(v.height)],
    right: v.right, bottom: v.bottom, worstAlpha,
  };
});

const aloneHasPanel = await panelBox();
const spoke = await page.evaluate(() =>
  [...document.querySelectorAll("p")].some((p) => /I am Sakhi/i.test(p.textContent)));

// now ask for the transcript
const toggled = await page.evaluate(() => {
  const b = [...document.querySelectorAll("button")]
    .find((x) => x.getAttribute("aria-label") === "Show the conversation");
  if (!b) return false;
  b.click();
  return true;
});
await new Promise((r) => setTimeout(r, 1200));
const openPanel = await panelBox();

const fail = [];
if (!her.found) fail.push("she is not on the page");
else {
  if (!her.complete || !her.natural) fail.push("her image never decoded");
  if (her.box[0] < 80) fail.push(`she renders too small (${her.box.join("x")})`);
  if (her.worstAlpha < 0) fail.push("could not read her alpha channel");
  else if (her.worstAlpha > 6) fail.push(`her cut-out is not transparent (corner alpha ${her.worstAlpha}) — the encoder degraded it, and drop-shadow will paint a box behind her`);
}
if (aloneHasPanel) fail.push("a transcript panel opened with her — she is supposed to arrive on her own");
if (!spoke) fail.push("nothing she said is visible while the transcript is shut");
if (!toggled) fail.push("there is no button to open the conversation");
else if (!openPanel) fail.push("the button did not open the conversation");
else {
  if (openPanel.right > her.right - 20) fail.push("the transcript opened on top of her rather than beside her");
  if (Math.abs(openPanel.bottom - her.bottom) > 120) fail.push("she and the transcript are not standing on the same floor");
}
// Closing must survive a REAL mouse click, not just a DOM .click(). The
// bottom-right corner is contested — the phone tab bar lives there, and in
// development Next draws its own badge over everything — and an element drawn
// on top of a button silently swallows the tap. A programmatic click cannot
// see that, which is exactly how a dead close button ships.
const closing = await page.evaluate(() => {
  const btn = [...document.querySelectorAll("button")]
    .find((x) => x.getAttribute("aria-label") === "Close");
  if (!btn) return null;
  const r = btn.getBoundingClientRect();
  const cx = Math.round(r.left + r.width / 2);
  const cy = Math.round(r.top + r.height / 2);
  return { cx, cy, clear: btn.contains(document.elementFromPoint(cx, cy)) };
});

// She must not block the page she is standing on.
const behind = await page.evaluate(() => {
  const el = document.elementFromPoint(300, innerHeight - 60);
  return !!el && !el.closest(".pointer-events-none");
});
if (!behind) fail.push("her container swallows clicks meant for the page behind her");

if (!closing) fail.push("there is no way to close her");
else {
  if (!closing.clear) fail.push("something is drawn over the close button — a real tap will not reach it");
  await page.mouse.click(closing.cx, closing.cy);
  await new Promise((r) => setTimeout(r, 900));
  const gone = await page.evaluate(() =>
    !document.querySelector('img[src*="sakhi-talking"], img[src*="sakhi-still"]'));
  if (!gone) fail.push("clicking close did not close her");
}

console.log(`\n  ${her.found
  ? `${her.natural}px source, drawn at ${her.box.join("x")}, corner alpha ${her.worstAlpha}`
  : "not on the page"}`);
console.log(fail.length
  ? "  " + fail.map((f) => "✗ " + f).join("\n  ") + "\n"
  : "  she arrives alone, closes on a real click, and never blocks the page behind her\n");

await page.screenshot({ path: "/tmp/sakhi-beside.png" });
await browser.close();
process.exit(fail.length ? 1 : 0);
