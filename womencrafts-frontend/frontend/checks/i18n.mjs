/**
 * Every language, driven for real.
 *
 * Static checks already prove each catalogue is complete and in its own script.
 * They cannot prove the app RENDERS it, and those are different failures:
 *
 *   · a locale that never loads → she picks Tamil and the screen stays English
 *   · a missing font           → she picks Tamil and the screen is empty boxes
 *   · a missing dir="rtl"      → Arabic renders left-to-right and reads as broken
 *
 * All three look like "the language switch is broken" to her and like "shipped"
 * to us, which is exactly why this drives a browser instead of reading files.
 */
import { readFileSync } from "fs";
import { APP, API, launch, seededMemberToken } from "./_shared.mjs";

const SCRIPTS = {
  hi: [0x0900, 0x097f], mr: [0x0900, 0x097f], ur: [0x0600, 0x06ff], ar: [0x0600, 0x06ff],
  ta: [0x0b80, 0x0bff], bn: [0x0980, 0x09ff], te: [0x0c00, 0x0c7f], gu: [0x0a80, 0x0aff],
  kn: [0x0c80, 0x0cff], ml: [0x0d00, 0x0d7f], pa: [0x0a00, 0x0a7f], or: [0x0b00, 0x0b7f],
};
const LATIN = ["es", "fr", "pt", "id", "sw"];

const locales = readFileSync("src/i18n/locales.ts", "utf8");
const CODES = [...locales.matchAll(/code: "([a-z]{2})"[^}]*translated: true/g)].map((m) => m[1])
  .filter((c) => c !== "en");

const token = await seededMemberToken();
if (!token) { console.log(" FAIL  could not sign in"); process.exit(1); }

const browser = await launch();
const pass = [], fail = [];

for (const code of CODES) {
  // A FRESH browser context per language. Pages share the default cookie jar,
  // so `womsakhi_locale` from the previous language leaks into the next one and
  // wins the first paint — which reported Odia as broken when it was fine. The
  // same trap is why admin and member sessions need separate contexts.
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.setViewport({ width: 420, height: 900 });
  await page.setCookie({ name: "access_token", value: token, domain: "localhost", path: "/" });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  try {
    await fetch(`${API}/me/profile`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ locale: code }),
    });
    await page.goto(`${APP}/app`, { waitUntil: "networkidle2", timeout: 45000 });
    await new Promise((r) => setTimeout(r, 1800));

    const info = await page.evaluate(() => {
      const html = document.documentElement;
      const nav = document.body.innerText || "";
      // A visible element whose text we can measure the font of.
      const el = [...document.querySelectorAll("h1,h2,p,span,a")]
        .find((n) => n.offsetParent && (n.textContent || "").trim().length > 3);
      return {
        lang: html.getAttribute("lang"),
        dir: html.getAttribute("dir"),
        text: nav.slice(0, 400),
        font: el ? getComputedStyle(el).fontFamily : "",
      };
    });

    const range = SCRIPTS[code];
    const inScript = range
      ? [...info.text].some((ch) => ch.codePointAt(0) >= range[0] && ch.codePointAt(0) <= range[1])
      : /[a-z]/i.test(info.text);

    // Tofu proxy: the stack must actually name a family for this script.
    const fontOk = !range || /Noto/i.test(info.font);
    const rtlOk = !["ur", "ar"].includes(code) || info.dir === "rtl";
    const langOk = info.lang === code;
    const clean = errors.filter((e) => !/favicon|DevTools/i.test(e)).length === 0;
    // For Latin-script languages, prove it is not just English left behind.
    const notEnglish = range ? true : !/Good morning|Your bookings|Explore/i.test(info.text);

    const ok = inScript && fontOk && rtlOk && langOk && clean && notEnglish;
    (ok ? pass : fail).push(code);
    console.log(
      `${ok ? "  ok  " : " FAIL "} ${code}  lang=${info.lang} dir=${info.dir ?? "ltr"} ` +
      `script=${inScript} font=${fontOk} rtl=${rtlOk} clean=${clean}` +
      (ok ? "" : `\n         font-family: ${info.font}\n         text: ${info.text.slice(0, 90).replace(/\n/g, " ")}`)
    );
  } catch (e) {
    fail.push(code);
    console.log(` FAIL  ${code}  ${String(e).slice(0, 70)}`);
  }
  await page.close();
  await ctx.close();
}

// leave her on English
await fetch(`${API}/me/profile`, {
  method: "PATCH",
  headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
  body: JSON.stringify({ locale: "en" }),
});
await browser.close();
console.log(`\n${pass.length} languages render, ${fail.length} failed`);
if (fail.length) { console.log("failed:", fail.join(", ")); process.exit(1); }
