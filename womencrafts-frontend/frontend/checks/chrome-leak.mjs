/**
 * A screen wears only the rail it asked for.
 *
 * The chrome lives in the layout now, so it survives a navigation — including
 * whatever the PREVIOUS screen registered. Twenty-one member screens never
 * call `HomeShell` (the six section hubs and the redirect stubs); without a
 * guard, opening Your shop and then Learn showed Learn wearing the shop's
 * rail.
 *
 * This check used to point at Settings, on the belief that it registered no
 * chrome. It does — `settings/page.tsx:79` passes a rail of its own headed
 * "Appearance" — so the check was asserting the absence of something that was
 * supposed to be there, and failed for a reason that had nothing to do with
 * leaking. It now uses a section hub, which really does register nothing, and
 * adds the case the old one could not see: two screens that BOTH have a rail,
 * where a leak shows up as the wrong rail rather than as any rail at all.
 */
import puppeteer from "puppeteer-core";
import { CHROME, APP, seededMemberToken } from "./_shared.mjs";

const tok = await seededMemberToken();
for (const r of ["/app/documents", "/app/settings", "/app/learn"])
  await fetch(APP + r, { headers: { Cookie: `access_token=${tok}` } }).catch(() => {});

const b = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox"] });
const p = await b.newPage();
await p.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 1 });
await p.setCookie({ name: "access_token", value: tok, domain: "localhost", path: "/" });

const rail = () => p.evaluate(() => {
  const el = document.querySelector('[style*="ux-rail"]');
  const t = el ? el.innerText.trim() : "";
  return { has: t.length > 0, head: t.split("\n")[0]?.slice(0, 32) ?? "" };
});

const go = async (href) => {
  await p.evaluate((h) => {
    const a = [...document.querySelectorAll("aside nav a")].find(x => x.getAttribute("href") === h);
    if (a) a.click(); else location.href = h;
  }, href);
  await p.waitForFunction((h) => location.pathname === h, { timeout: 30000 }, href).catch(() => {});
  await new Promise(x => setTimeout(x, 1800));
};

let bad = 0;
const say = (ok, msg) => { console.log(`  ${ok ? "ok  " : "FAIL"}  ${msg}`); if (!ok) bad++; };

await p.goto(APP + "/app/documents", { waitUntil: "domcontentloaded", timeout: 180000 });
await p.waitForFunction(() => document.querySelectorAll("aside nav a").length > 5, { timeout: 60000 });
await new Promise(x => setTimeout(x, 1500));
const shop = await rail();
say(shop.has, `Your shop shows its own rail ("${shop.head}")`);

// A screen that registers nothing must show nothing.
await go("/app/learn");
const hub = await rail();
say(!hub.has, `the Learn hub borrows no rail (found: "${hub.head || "nothing"}")`);
say(await p.evaluate(() => document.body.innerText.length) > 900, "the Learn hub still rendered");

// Two screens that both have one: the rail must swap, not stick.
await go("/app/settings");
const set = await rail();
say(set.has && set.head !== shop.head,
    `Settings shows its own rail, not the shop's ("${set.head}")`);

await go("/app/documents");
const back = await rail();
say(back.head === shop.head,
    `back on Your shop the rail is the shop's again ("${back.head}")`);

console.log(bad ? `\n FAIL  ${bad} of 5` : "\n PASS  each screen wears only its own chrome");
await b.close();
process.exit(bad ? 1 : 0);
