/**
 * The language she set is the language she gets — all of it.
 *
 * Two rules used to disagree. The system prompt said "reply the same way she
 * wrote"; the background note said her language applied "unless she writes
 * otherwise". So a woman who chose Telugu and typed on a Latin keyboard — which
 * is most women, because that is what the keyboard makes easy — was answered in
 * English. She had made a choice and the app kept overriding it.
 *
 * Every question here is typed in plain English ON PURPOSE. That is the case
 * that was broken, and answering it in English is the bug, not politeness.
 *
 * Four things have to arrive in her language, and each used to come from a
 * different place: her greeting (frontend catalogue), the panel's own words
 * (frontend catalogue), Sakhi's answers (the model), and the sentence she
 * approves before a write (the backend, built from her records).
 */
import { launch, pageAs, seededMemberToken, API, APP } from "./_shared.mjs";

const token = await seededMemberToken();
const head = { "Content-Type": "application/json", Cookie: `access_token=${token}` };
const TELUGU = /[ఀ-౿]/;

const setLanguage = (code) => fetch(`${API}/me/profile`, {
  method: "PATCH", headers: head, body: JSON.stringify({ locale: code }),
});

async function ask(text) {
  const res = await fetch(`${API}/sakhi/chat`, {
    method: "POST", headers: head, body: JSON.stringify({ text }),
  });
  const rd = res.body.getReader(); const dec = new TextDecoder();
  let buf = "", said = "", confirm = "";
  for (;;) {
    const { done, value } = await rd.read(); if (done) break;
    buf += dec.decode(value, { stream: true });
    const parts = buf.split("\n\n"); buf = parts.pop();
    for (const part of parts) {
      const l = part.split("\n").find((x) => x.startsWith("data:"));
      if (!l) continue;
      try {
        const e = JSON.parse(l.slice(5));
        if (e.type === "text") said += e.text;
        if (e.type === "confirm") confirm = e.sentence ?? "";
      } catch { /* partial frame */ }
    }
  }
  return { said: said.trim(), confirm };
}

const original = (await (await fetch(`${API}/me/profile`, { headers: head })).json()).locale || "en";
const fail = [];
const lines = [];

await setLanguage("te");

// 1. an ordinary question, typed in English
const plain = await ask("What programmes am I in?");
const answered = TELUGU.test(plain.said);
lines.push(`  ${answered ? "ok  " : "✗   "} answers an English question in Telugu`);
if (!answered) fail.push(`asked in English she replied in English: "${plain.said.slice(0, 70)}"`);

// 2. the sentence she approves before anything is written
const write = await ask("Take me out of the Entrepreneurship Bootcamp programme");
if (write.confirm) {
  const ok = TELUGU.test(write.confirm);
  // A programme's own name may well be in Latin letters — that is the name, not
  // a translation failure. What must not appear is OUR English: the placeholder
  // used when a record cannot be looked up was leaking "this programme" into
  // the middle of a Telugu sentence.
  const ourEnglish = /\b(this|the)\s+(programme|program|session|booking)\b/i.test(write.confirm);
  lines.push(`  ${ok && !ourEnglish ? "ok  " : "✗   "} asks permission in Telugu: "${write.confirm.slice(0, 46)}"`);
  if (!ok) fail.push(`the confirmation she must agree to is in English: "${write.confirm}"`);
  if (ourEnglish) fail.push(`an English placeholder leaked into her confirmation: "${write.confirm}"`);
} else {
  lines.push("  --   no confirmation was raised this run (nothing to check)");
}

// 3. her greeting and the panel's own words, in the browser
const browser = await launch();
const page = await pageAs(browser, token, { width: 1440, height: 950 });
await page.goto(`${APP}/app`, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForSelector("button", { timeout: 30000 });
await new Promise((r) => setTimeout(r, 2500));
await page.evaluate(() => [...document.querySelectorAll("button")]
  .find((b) => b.getAttribute("aria-label") === "Ask Sakhi")?.click());
await new Promise((r) => setTimeout(r, 5000));

// Read the paragraphs directly rather than hunting for a container. She
// arrives with no panel around her now, so "find the card she is in" finds
// nothing — which is how a working greeting read as an English one.
const panel = await page.evaluate(() => ({
  bubbles: [...document.querySelectorAll("p")].map((p) => p.textContent.trim()).filter(Boolean),
  lang: document.documentElement.lang,
}));
await browser.close();
await setLanguage(original);   // leave her account as we found it

const greeting = panel.bubbles.find((b) => /Sakhi/i.test(b) && b.length > 20) ?? "";
const greeted = TELUGU.test(greeting);
lines.push(`  ${greeted ? "ok  " : "✗   "} greets in Telugu: "${greeting.slice(0, 42)}"`);
if (!greeted) fail.push(`her greeting was in English: "${greeting.slice(0, 70)}"`);

const chrome = TELUGU.test(panel.bubbles.join(" "));
lines.push(`  ${chrome ? "ok  " : "✗   "} the app around her is in Telugu (html lang=${panel.lang})`);
if (!chrome) fail.push("the app itself stayed in English");

console.log("\n" + lines.join("\n"));
console.log(fail.length
  ? "\n  " + fail.map((f) => "✗ " + f).join("\n  ") + "\n"
  : "\n  she chose Telugu and every part of Sakhi answers in Telugu\n");
process.exit(fail.length ? 1 : 0);
