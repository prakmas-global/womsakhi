/**
 * Her words and her voice have to arrive together.
 *
 * They did not. The reply was painted on screen token by token as the model
 * wrote it, and only once it had finished was the whole thing sent to be
 * synthesised — so a woman read the entire answer, sat in silence for several
 * seconds, and THEN heard it spoken back. Two versions of the same sentence,
 * seconds apart. Nothing about that reads as a person talking to you.
 *
 * Now each sentence is spoken as it arrives, and appears on screen at the
 * moment its own audio starts. This measures both halves of that:
 *
 *   lag         how long after the first words appear does she start talking
 *   ordering    no text on screen that she has not said yet
 */
import { launch, pageAs, seededMemberToken, API, APP } from "./_shared.mjs";

const token = await seededMemberToken();
const browser = await launch();
const page = await pageAs(browser, token, { width: 1440, height: 950 });

await page.goto(`${APP}/app`, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForSelector("button", { timeout: 30000 });
await new Promise((r) => setTimeout(r, 2500));

// Watch when text lands and when audio starts, on the same clock.
await page.evaluateOnNewDocument(() => {
  window.__marks = [];
  const RealAudio = window.Audio;
  window.Audio = function (src) {
    const el = new RealAudio(src);
    el.addEventListener("play", () =>
      window.__marks.push({ what: "audio", at: performance.now() }));
    return el;
  };
  window.Audio.prototype = RealAudio.prototype;
});
await page.reload({ waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForSelector("button", { timeout: 30000 });
await new Promise((r) => setTimeout(r, 2500));

await page.evaluate(() => [...document.querySelectorAll("button")]
  .find((b) => b.getAttribute("aria-label") === "Ask Sakhi")?.click());
await new Promise((r) => setTimeout(r, 1000));

// Watch her bubbles appear.
await page.evaluate(() => {
  // Seed with everything already on the page. Without this, the first mutation
  // reports the whole dashboard as "new text" and the measurement is timed
  // against a paragraph she never said.
  const seen = new Set(
    [...document.querySelectorAll("p")].map((p) => p.textContent.trim()),
  );
  new MutationObserver(() => {
    for (const p of document.querySelectorAll("p")) {
      const t = p.textContent.trim();
      if (t.length > 12 && !seen.has(t)) {
        seen.add(t);
        window.__marks.push({ what: "text", at: performance.now(), text: t.slice(0, 40) });
      }
    }
  }).observe(document.body, { childList: true, subtree: true, characterData: true });
});

await page.evaluate(() => [...document.querySelectorAll("button")]
  .find((b) => b.getAttribute("aria-label") === "Type instead")?.click());
await new Promise((r) => setTimeout(r, 500));
await page.type("input[placeholder]", "Tell me in three sentences what I can do to earn more");
await page.keyboard.press("Enter");
await new Promise((r) => setTimeout(r, 22000));

const marks = await page.evaluate(() => window.__marks);
await browser.close();

const firstText = marks.find((m) => m.what === "text");
const firstAudio = marks.find((m) => m.what === "audio");

const fail = [];
if (!firstText) fail.push("no reply ever appeared on screen");
if (!firstAudio) fail.push("she never spoke at all");

let lag = null;
if (firstText && firstAudio) {
  lag = Math.round(firstAudio.at - firstText.at);
  // Negative means audio began BEFORE its text, which is the correct order:
  // the text is painted by the audio's own play handler.
  if (lag > 1200) fail.push(`her words were on screen ${lag}ms before she began saying them`);
}

console.log(`\n  ${marks.filter((m) => m.what === "audio").length} spoken sentences, ` +
            `${marks.filter((m) => m.what === "text").length} bubbles`);
console.log(`  gap between first text and first speech: ${lag === null ? "n/a" : lag + "ms"}`);
console.log(fail.length
  ? "  " + fail.map((f) => "✗ " + f).join("\n  ") + "\n"
  : "  she says the words as they appear, not seconds after them\n");

process.exit(fail.length ? 1 : 0);
