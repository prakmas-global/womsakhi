/**
 * The certificate is a legal instrument, so it is checked like one.
 *
 * It is the only thing this app produces that leaves it and is read by someone
 * who has never heard of WomSakhi — a bank officer, an employer, a government
 * clerk. It therefore has requirements the rest of the app does not:
 *
 * - **One template.** It existed twice before, once per screen. Two copies of a
 *   legal document is one too many: they drift, and the day they drift an
 *   employer holds two WomSakhi certificates that do not match and believes
 *   neither.
 * - **It must not reflow.** A certificate whose footer moves depending on how
 *   long the programme title is looks forged. The foot lands on the same line
 *   for a two-word title and a nine-word one, or this fails.
 * - **It must never contradict itself.** A withdrawn certificate that still
 *   says "valid without signature" in its own footer is worse than no
 *   certificate at all.
 */
import { readFileSync, globSync } from "node:fs";

import { launch, pageAs, seededMemberToken } from "./_shared.mjs";
import { APP, finish, wait } from "./_screen.mjs";

const fail = [];
const lines = [];
const say = (ok, msg) => { lines.push(`  ${ok ? "ok  " : "✗   "} ${msg}`); if (!ok) fail.push(msg); };

/* ── 1. One template, in the kit, used by every screen ────────────────── */
{
  const defs = [];
  for (const f of [...globSync("src/app/**/*.tsx"), ...globSync("src/components/**/*.ts*")]) {
    if (f.includes(".bak")) continue;
    const src = readFileSync(f, "utf8");
    if (/function\s+(printCertificate|certificateHtml)\b/.test(src)) defs.push(f);
  }
  say(defs.length === 1 && defs[0].includes("kit/download"),
      `the certificate is defined exactly once, in the kit (${defs.join(", ") || "nowhere"})`);

  // And nobody hand-rolls one beside it. Matched on the certifying formula
  // alone — "Certificate of completion" is also a legitimate label on the
  // Certificates screen itself, and a check that cannot tell a page's heading
  // from a printed deed fails on correct code.
  const rogue = globSync("src/app/app/**/*.tsx").filter((f) =>
    /This is to certify that/i.test(readFileSync(f, "utf8")));
  say(rogue.length === 0, `no screen writes its own certificate markup (${rogue.length})`);
}

/* ── 2. What it says, and what it refuses to say ──────────────────────── */
const token = await seededMemberToken();
const browser = await launch();
const page = await pageAs(browser, token, { width: 1400, height: 900 });

// Capture the real document rather than rebuilding it: a check that renders its
// own copy is a third copy of the thing it exists to keep single.
await page.evaluateOnNewDocument(() => {
  window.__printed = "";
  window.open = () => ({ document: { write(h) { window.__printed += h; }, close() {} },
                         setTimeout() {}, focus() {}, print() {} });
});
await page.goto(APP + "/app/certificates", { waitUntil: "domcontentloaded", timeout: 180000 });
await page.waitForFunction(() => document.querySelector("aside") !== null, { timeout: 60000 });
await wait(2600);
const clicked = await page.$$eval("#ux-scroll button", (bs) => {
  const b = bs.find((x) => x.innerText.trim() === "Download");
  if (b) b.click();
  return !!b;
});
say(clicked, "the Certificates screen offers a download");
await wait(500);
const html = await page.evaluate(() => window.__printed);
await page.close();

say(html.length > 1000, `a document is produced (${html.length} chars)`);

// Landscape and zero margin. Chrome only prints its own header and footer if
// the page reserves margin for them — with none they are dropped, which is the
// difference between a formal document and one with "about:blank" across it.
say(/@page\s*\{[^}]*landscape/.test(html), "the sheet is landscape");
say(/@page\s*\{[^}]*margin:\s*0/.test(html),
    "and has no page margin, so the browser prints no header or footer on it");

// No emblem, by instruction. The issuer is named in type, the way a degree
// names a university.
say(!/<img|<svg|background-image/i.test(html), "it carries no logo or image");

const must = [
  [/This is to certify that/, "the certifying formula"],
  [/Certificate of Completion/i, "what kind of certificate it is"],
  [/Certificate number/i, "a certificate number, labelled"],
  [/Date of issue/i, "a date of issue, labelled"],
  [/Authorised Signatory/i, "a signatory block"],
  [/womsakhi\.in\/verify/, "where to verify it"],
  [/WS-[A-Z0-9-]{4,}/, "the number itself"],
];
for (const [re, what] of must) say(re.test(html), `it carries ${what}`);

/* ── 3. It holds its shape whatever the content ───────────────────────── */
{
  const head = html.slice(0, html.indexOf("<body>") + 6);
  const body = html.slice(html.indexOf("<body>") + 6, html.lastIndexOf("</body>"));
  const swap = (name, programme) =>
    body.replace(/(<p class="c-name">)[^<]*/, `$1${name}`)
        .replace(/(<p class="c-programme">)[^<]*/, `$1${programme}`);

  const sheet = await browser.newPage();
  await sheet.setViewport({ width: 1123, height: 794, deviceScaleFactor: 1 });

  const feet = [];
  for (const [name, programme] of [
    ["Sita Devi", "Tailoring"],
    ["Lakshmi Venkataraman Subramaniam", "Digital Marketing for Small Businesses and Home Enterprises"],
  ]) {
    await sheet.setContent(head + swap(name, programme) + "</body></html>",
                           { waitUntil: "domcontentloaded" });
    await wait(350);
    const m = await sheet.evaluate(() => {
      const s = document.querySelector(".c-sheet");
      return { over: s.scrollHeight - s.clientHeight,
               foot: Math.round(document.querySelector(".c-foot").getBoundingClientRect().top) };
    });
    feet.push(m);
  }
  say(feet.every((m) => m.over === 0), `it fits one sheet in every case (${feet.map((m) => m.over + "px").join(", ")})`);
  say(feet[0].foot === feet[1].foot,
      `the foot lands on the same line whatever the content (y=${feet.map((m) => m.foot).join(" vs ")})`);
  await sheet.close();
}

/* ── 4. A withdrawn certificate never calls itself valid ──────────────── */
{
  const src = readFileSync("src/components/ux/kit/download.ts", "utf8");
  const block = src.slice(src.indexOf("export function certificateHtml"));
  say(/revoked[\s\S]{0,400}withdrawn/i.test(block), "a withdrawn certificate says so on its face");
  // The valid-without-signature line must be inside the not-revoked branch.
  const verify = block.slice(block.indexOf('class="c-verify"'), block.indexOf('class="c-verify"') + 600);
  say(/c\.revoked\s*\?/.test(verify),
      "and its footer does not still claim to be valid");
}

await browser.close();
finish(fail, lines, "the certificate is one template, formal, and never contradicts itself");
