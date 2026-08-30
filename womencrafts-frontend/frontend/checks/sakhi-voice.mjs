/**
 * She has to be heard in the language she is read in.
 *
 * The bug this exists for: a woman set the app to Telugu, Sakhi replied in
 * Telugu on screen, and spoke it aloud in English. The backend had a Telugu
 * voice all along — seventeen voices, none of them ever chosen — because the
 * launcher never handed the panel a locale and `say()` never passed one on.
 * Two silent drops in a row, and no test between them.
 *
 * Also checked here: the brand name. Left to the voice, "WomSakhi" comes out
 * with the wrong vowel, close enough to "W-M-Sakhi" to be heard as letters. It
 * is given explicitly in IPA now, which is only verifiable by ear — but what
 * CAN be measured is that every spelling of it produces identical audio, which
 * is what proves the pronunciation rule is being applied at all.
 */
import { launch, pageAs, seededMemberToken, API, APP } from "./_shared.mjs";

const token = await seededMemberToken();
const head = { "Content-Type": "application/json", Cookie: `access_token=${token}` };

const speak = async (text, locale) => {
  const r = await fetch(`${API}/sakhi/speak`, {
    method: "POST", headers: head, body: JSON.stringify({ text, locale }),
  });
  if (!r.ok) return { voice: null, ms: 0, visemes: 0 };
  const b = await r.json();
  return { voice: b.voice ?? null, ms: b.duration_ms ?? 0, visemes: (b.mouth ?? []).length };
};

const fail = [];
const lines = [];

// The language lives on her ACCOUNT, so that is what these set — passing a
// locale in the request no longer decides anything (see 3 below).
const startedAs = (await (await fetch(`${API}/me/profile`, { headers: head })).json()).locale || "en";
const setLanguage = (code) => fetch(`${API}/me/profile`, {
  method: "PATCH", headers: head, body: JSON.stringify({ locale: code }),
});

// 1. every language reaches its own voice
const EXPECT = {
  te: "te-IN", hi: "hi-IN", ta: "ta-IN", bn: "bn-IN",
  kn: "kn-IN", ml: "ml-IN", mr: "mr-IN", gu: "gu-IN", en: "en-IN",
};
for (const [code, prefix] of Object.entries(EXPECT)) {
  await setLanguage(code);
  const { voice, ms } = await speak("Namaste");
  const ok = voice?.startsWith(prefix);
  lines.push(`  ${ok ? "ok  " : "✗   "} ${code} → ${voice ?? "no voice"}`);
  if (!ok) fail.push(`${code} was spoken by ${voice ?? "nothing"}, not a ${prefix} voice`);
  if (ok && ms <= 0) fail.push(`${code} produced a voice but no audio`);
}

// 2. the brand is pronounced by rule, not by luck. Every spelling must give
//    byte-identical timing — if it did not, the rule missed one of them.
for (const code of ["en", "te"]) {
  await setLanguage(code);
  const camel = await speak("WomSakhi");
  const spaced = await speak("Wom Sakhi");
  const hyphen = await speak("Wom-Sakhi");
  const same = camel.ms === spaced.ms && camel.ms === hyphen.ms;
  lines.push(`  ${same ? "ok  " : "✗   "} ${code} brand: ${camel.ms}/${spaced.ms}/${hyphen.ms}ms`);
  if (!same) fail.push(`in ${code} the brand is said differently depending on how it is written (${camel.ms}/${spaced.ms}/${hyphen.ms}ms)`);
}

// 3. the voice follows her ACCOUNT, never the browser.
//
// The words are written in the language on her account. If the voice could be
// chosen by the client instead, the two could disagree — and they did: a tab
// left open from before she switched, or a switch made on another device, sends
// a stale locale, and she reads Telugu while hearing English. There is no
// useful meaning to "speak this in a language other than the one it is written
// in", so the client cannot override.
{
  await setLanguage("te");
  const stale = await speak("Namaste", "en");     // a browser that has not caught up
  const silent = await speak("Namaste", undefined);
  const held = stale.voice?.startsWith("te-IN") && silent.voice?.startsWith("te-IN");
  lines.push(`  ${held ? "ok  " : "✗   "} a stale browser locale cannot override her account (${stale.voice})`);
  if (!held) fail.push(`her account said Telugu and the voice came out as ${stale.voice} — she would read one language and hear another`);
}

// 4. her words go into an XML document now, so anything she says must survive it
await setLanguage("en");
const tricky = await speak('5 < 6 & 7 > 2 — "quoted" and WomSakhi');
lines.push(`  ${tricky.visemes > 0 ? "ok  " : "✗   "} angle brackets and ampersands survive SSML`);
if (!tricky.visemes) fail.push("a reply containing < > or & broke the SSML document and produced no audio");

// 5. and the whole way through the app: her language must reach the request.
//
// The language lives on her ACCOUNT, not in a cookie — the app writes the
// cookie from her profile on load, so setting the cookie by hand is overwritten
// before anything reads it. (That cost a false failure here: the cookie said
// Telugu, the app said English, and the app was right.)
await setLanguage("te");

const browser = await launch();
const page = await pageAs(browser, token, { width: 1440, height: 950 });
const sent = [];
await page.setRequestInterception(true);
page.on("request", (r) => {
  if (r.url().includes("/sakhi/speak") && r.method() === "POST") {
    try {
      const body = JSON.parse(r.postData() ?? "{}");
      sent.push({ locale: body.locale, text: body.text ?? "" });
    } catch { /* not json */ }
  }
  void r.continue();
});
await page.goto(`${APP}/app`, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForSelector("button", { timeout: 30000 });
await new Promise((r) => setTimeout(r, 2500));
await page.evaluate(() => [...document.querySelectorAll("button")]
  .find((b) => b.getAttribute("aria-label") === "Ask Sakhi")?.click());
await new Promise((r) => setTimeout(r, 5000));
await browser.close();
await setLanguage(startedAs);   // leave her account as we found it

const asked = sent.filter(Boolean);
const locales = asked.map((a) => a.locale);
lines.push(`  ${locales.includes("te") ? "ok  " : "✗   "} the app asked for: ${locales.join(", ") || "(no locale at all)"}`);
if (!asked.length) fail.push("the app asked for speech without naming a language — every woman gets the default voice");
else if (!locales.includes("te")) fail.push(`the app is set to Telugu but asked for "${locales[0]}"`);

// The right voice reading English words is still the wrong thing. Her opening
// line was a hardcoded English string, so a woman who chose Telugu was greeted
// in English by a Telugu voice before she had said anything.
const first = asked[0]?.text ?? "";
const telugu = /[\u0C00-\u0C7F]/.test(first);
lines.push(`  ${telugu ? "ok  " : "✗   "} her greeting is in Telugu script: "${first.slice(0, 40)}"`);
if (first && !telugu) fail.push("her greeting was sent to the voice in English while the app was set to Telugu");

console.log("\n" + lines.join("\n"));
console.log(fail.length
  ? "\n  " + fail.map((f) => "✗ " + f).join("\n  ") + "\n"
  : "\n  she is heard in the language she is read in, and says her own name by rule\n");
process.exit(fail.length ? 1 : 0);
