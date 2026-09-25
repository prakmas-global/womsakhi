/* Renders the document to PDF and VERIFIES the page count matches the number of
   sections in the HTML. Chrome intermittently truncates a long print job with
   large embedded images; a short render is silent, so it is checked and retried
   rather than trusted. */
import { createRequire } from "node:module";
import { readFileSync, statSync } from "node:fs";
const require = createRequire("/Users/praveenmaddela/Desktop/PRAKMAS-GLOBAL/womencrafts-frontend/frontend/package.json");
const puppeteer = require("puppeteer-core");
const [src, out] = process.argv.slice(2);
const expected = (readFileSync(src, "utf8").match(/class="page/g) || []).length;
const countPages = (f) => {
  const raw = readFileSync(f);
  return (raw.toString("latin1").match(/\/Type\s*\/Page[^s]/g) || []).length;
};

let ok = false;
for (let attempt = 1; attempt <= 5 && !ok; attempt++) {
  const b = await puppeteer.launch({
    executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    headless: "new", args: ["--no-sandbox", "--font-render-hinting=none"] });
  const p = await b.newPage();
  await p.setViewport({ width: 1123, height: 794 });
  await p.goto("file://" + src, { waitUntil: "networkidle0", timeout: 120000 });
  await p.evaluateHandle("document.fonts.ready");
  const imgs = await p.evaluate(async () => {
    const all = [...document.images];
    await Promise.all(all.map(i => i.decode().catch(() => {})));
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    return all.length;
  });
  await new Promise(r => setTimeout(r, 1200 + attempt * 600));
  await p.pdf({ path: out, width: "297mm", height: "210mm", printBackground: true,
    preferCSSPageSize: true, timeout: 180000, margin: { top: 0, right: 0, bottom: 0, left: 0 } });
  await b.close();
  const got = countPages(out);
  ok = got >= expected;
  console.log(`attempt ${attempt}: ${got}/${expected} pages, ${imgs} images, ` +
              `${(statSync(out).size / 1048576).toFixed(1)} MB${ok ? " ✓" : " — short, retrying"}`);
}
if (!ok) { console.error("FAILED: the render kept coming out short"); process.exit(1); }
