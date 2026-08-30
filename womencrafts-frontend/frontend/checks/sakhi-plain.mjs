/**
 * Nothing she says should contain characters a voice will read out.
 *
 * The library guides are written with **bold** headings. The model quoted them
 * back exactly as it found them, and Azure said the punctuation aloud — so a
 * woman asking what to charge heard "asterisk asterisk What should I charge
 * asterisk asterisk". The text on screen looked fine, which is why it was only
 * findable by listening.
 *
 * This measures the two surfaces a woman actually meets — the words on her
 * screen and the words in her ear — rather than the raw token stream. The
 * distinction matters: the model is asked not to write asterisks and, on this
 * model, still does when quoting a guide that uses them. Checking the raw
 * stream would fail on something she never sees. Checking what is delivered
 * fails only when something is actually wrong for her.
 *
 * Four things had to change: the passages are cleaned before the model sees
 * them, the model is asked to write plainly, the browser strips each whole
 * sentence before showing and speaking it, and the stored transcript is
 * cleaned so reopening a conversation does not show stars either.
 */
import { launch, pageAs, seededMemberToken, API, APP } from "./_shared.mjs";

const token = await seededMemberToken();
const head = { "Content-Type": "application/json", Cookie: `access_token=${token}` };

const fail = [];
const lines = [];

// --- 1. the screen ---------------------------------------------------------
const browser = await launch();
const page = await pageAs(browser, token, { width: 1440, height: 950 });
await page.goto(`${APP}/app`, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForSelector("button", { timeout: 30000 });
await new Promise((r) => setTimeout(r, 2500));
await page.evaluate(() => [...document.querySelectorAll("button")]
  .find((b) => b.getAttribute("aria-label") === "Ask Sakhi")?.click());
await new Promise((r) => setTimeout(r, 4500));
await page.evaluate(() => [...document.querySelectorAll("button")]
  .find((b) => b.getAttribute("aria-label") === "Type instead")?.click());
await new Promise((r) => setTimeout(r, 500));
await page.type("input[placeholder]", "What should I charge for my work?");
await page.keyboard.press("Enter");
await new Promise((r) => setTimeout(r, 24000));

const onScreen = await page.evaluate(() => {
  const card = [...document.querySelectorAll("p")]
    .map((p) => p.textContent || "")
    .filter((t) => t.length > 30);
  return card.join("\n");
});
await browser.close();

const stars = (onScreen.match(/\*/g) || []).length;
const ticks = (onScreen.match(/`/g) || []).length;
const heads = (onScreen.match(/^#{1,6}\s/gm) || []).length;
lines.push(`  ${!stars && !ticks && !heads ? "ok  " : "✗   "} on screen: stars=${stars} backticks=${ticks} headings=${heads}`);
if (stars || ticks || heads)
  fail.push(`formatting is visible in her bubbles: ${JSON.stringify(onScreen.slice(0, 120))}`);
if (onScreen.length < 40) fail.push("she said nothing on screen — the check could not read her reply");

// --- 2. the voice ----------------------------------------------------------
// Identical duration for formatted and plain text is the proof: if the voice
// were saying "asterisk asterisk", the formatted one would take longer.
const say = async (text) => {
  const r = await fetch(`${API}/sakhi/speak`, {
    method: "POST", headers: head, body: JSON.stringify({ text, locale: "en" }),
  });
  return (await r.json()).duration_ms ?? 0;
};
const withMd = await say("**Bold** and *italic* and `code` and # heading.");
const without = await say("Bold and italic and code and heading.");
const same = withMd > 0 && Math.abs(withMd - without) < 150;
lines.push(`  ${same ? "ok  " : "✗   "} in her ear: ${withMd}ms formatted vs ${without}ms plain`);
if (!same) fail.push(`the voice is reading the punctuation: ${withMd}ms against ${without}ms for the same words plain`);

// --- 3. the stored transcript ---------------------------------------------
const convos = await (await fetch(`${API}/sakhi/conversations`, { headers: head })).json();
const list = Array.isArray(convos) ? convos : (convos.items ?? []);
let savedStars = 0;
if (list.length) {
  const detail = await (await fetch(`${API}/sakhi/conversations/${list[0].id}`, { headers: head })).json();
  const msgs = detail.messages ?? detail.items ?? [];
  savedStars = msgs.reduce((n, m) => n + ((m.text || "").match(/\*/g) || []).length, 0);
}
lines.push(`  ${!savedStars ? "ok  " : "✗   "} saved transcript: ${savedStars} stars`);
if (savedStars) fail.push(`the stored conversation has ${savedStars} asterisks — reopening it will show them`);

console.log("\n" + lines.join("\n"));
console.log(fail.length
  ? "\n  " + fail.map((f) => "✗ " + f).join("\n  ") + "\n"
  : "\n  nothing she shows or says carries formatting a voice would read out\n");
process.exit(fail.length ? 1 : 0);
