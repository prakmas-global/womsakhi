/** The phone. Five tabs, a reachable map, and nothing truncated. */
import puppeteer from "puppeteer-core";
import { CHROME, APP, seededMemberToken } from "./_shared.mjs";
const OUT = process.env.OUT;
const tok = await seededMemberToken();
const b = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox"] });
const p = await b.newPage();
await p.setCookie({ name: "access_token", value: tok, domain: "localhost", path: "/" });
const errs = [];
p.on("pageerror", e => errs.push(String(e).slice(0, 140)));

for (const w of [430, 390, 360]) {
  await p.setViewport({ width: w, height: 844, deviceScaleFactor: 2 });
  await p.goto(APP + "/app/earn", { waitUntil: "domcontentloaded", timeout: 60000 });
  await new Promise(x => setTimeout(x, 2600));
  const m = await p.evaluate(() => {
    const bar = document.querySelector('nav[aria-label="Sections"]');
    const tabs = bar ? [...bar.querySelectorAll("a")] : [];
    const truncated = tabs.filter(a => {
      const s = a.querySelector("span:last-child") ?? a;
      return s.scrollWidth > s.clientWidth + 1;
    }).map(a => a.innerText.trim());
    const cards = [...document.querySelectorAll(".ux-card")].length;
    return {
      tabs: tabs.map(a => a.innerText.trim()),
      widths: tabs.map(a => Math.round(a.getBoundingClientRect().width)),
      truncated,
      cards,
      railHidden: !document.querySelector("aside")?.offsetParent,
      over: Math.max(0, document.documentElement.scrollWidth - innerWidth),
    };
  });
  console.log(`  ${w}px  tabs [${m.tabs.join(", ")}]  ${m.widths[0]}px each  truncated:${m.truncated.length ? m.truncated.join("/") : "none"}  hub cards:${m.cards}  rail hidden:${m.railHidden}  overflow:${m.over}`);
  if (w === 390) await p.screenshot({ path: `${OUT}/phone-earn.png` });
}

// The map must be reachable from a tab in one tap.
await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
await p.goto(APP + "/app/documents", { waitUntil: "domcontentloaded", timeout: 60000 });
await new Promise(x => setTimeout(x, 2400));
const hop = await p.evaluate(() => {
  const bar = document.querySelector('nav[aria-label="Sections"]');
  // "Learn" contains "earn" — match the label exactly.
  const earn = [...(bar?.querySelectorAll("a") ?? [])].find(a => a.innerText.trim() === "Earn");
  if (!earn) return null;
  earn.click();
  return earn.getAttribute("href");
});
await new Promise(x => setTimeout(x, 2600));
const landed = await p.evaluate(() => ({ url: location.pathname, cards: document.querySelectorAll(".ux-card").length }));
console.log(`  tap Earn from a deep page -> ${hop}  landed ${landed.url} with ${landed.cards} cards`);
console.log(errs.length ? "\n  errors: " + [...new Set(errs)].slice(0,3).join(" | ") : "\n  no page errors");

// Every tab must be tappable. `elementFromPoint` in the middle of each one has
// to land on the tab itself — a floating control over the fifth tab would make
// a whole section unreachable on a phone, and nothing else would catch it.
await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
await p.goto(APP + "/app/earn", { waitUntil: "domcontentloaded", timeout: 60000 });
await new Promise(x => setTimeout(x, 2400));
const taps = await p.evaluate(() => {
  // The Next.js dev badge lives in the corner in development only; it is not
  // part of the app and must not count as a blocker.
  document.querySelectorAll("nextjs-portal").forEach((n) => { n.style.display = "none"; });
  const bar = document.querySelector('nav[aria-label="Sections"]');
  return [...bar.querySelectorAll("a")].map((a) => {
    const r = a.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return { label: a.innerText.trim(), ok: a === hit || a.contains(hit) };
  });
});
for (const t of taps) console.log(`  ${t.ok ? "ok  " : "FAIL"}  ${t.label} is tappable`);

// The panic pill and the Help section must not both be called the same thing.
const names = await p.evaluate(() => {
  const pill = [...document.querySelectorAll("a")]
    .find((a) => /get help now/i.test(a.getAttribute("aria-label") || ""));
  const help = [...document.querySelectorAll("a")]
    .find((a) => (a.getAttribute("href") || "") === "/app/helpdesk");
  return { pill: pill?.innerText.trim() ?? null, pillHref: pill?.getAttribute("href") ?? null,
           help: help?.getAttribute("aria-label") ?? null };
});
console.log(`  ${names.pill && names.pill !== names.help ? "ok  " : "FAIL"}  "${names.pill}" (${names.pillHref}) is not also what the Help section is called ("${names.help}")`);

await b.close();
