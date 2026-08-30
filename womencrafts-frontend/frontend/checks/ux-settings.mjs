/**
 * The settings hub and its five pages.
 *
 * Settings is where irreversible things live, so the assertions are about
 * consequence: a switch must say what silence means, a password bar must say
 * why, and closing an account must not be a single tap next to a sign-out.
 */
import { launch, seededMemberToken } from "./_shared.mjs";
import { audit, finish, report, wait } from "./_screen.mjs";

const SCREENS = [
  ["more", "/app/settings"],
  ["account", "/app/settings/account"],
  ["language", "/app/settings/language"],
  ["appearance", "/app/settings/appearance"],
  ["notifications", "/app/settings/notifications"],
  ["security", "/app/settings/security"],
];

const fail = [];
const lines = [];
const token = await seededMemberToken();
const browser = await launch();

for (const [name, route] of SCREENS) {
  for (const mode of ["light", "dark"]) {
    const a = await audit(browser, token, { route, mode });
    report(name, mode, a, fail, lines);
    await a.page.close();
  }
}

const say = (ok, msg) => { lines.push(`  ${ok ? "ok  " : "✗   "} ${msg}`); if (!ok) fail.push(msg); };

/* -- The hub reaches everything it claims to -------------------------- */
{
  const a = await audit(browser, token, { route: "/app/settings" });
  const hrefs = await a.page.$$eval('main a[href^="/app"]', (as) => as.map((x) => x.getAttribute("href")));
  say(hrefs.length >= 12, `the hub links to everything occasional (${hrefs.length} links)`);
  for (const h of new Set(hrefs)) {
    const res = await a.page.goto("http://localhost:3100" + h, { waitUntil: "domcontentloaded", timeout: 120000 });
    await a.page.waitForFunction(() => document.body.innerText.trim().length > 200, { timeout: 45000 }).catch(() => {});
    const chars = await a.page.evaluate(() => document.body.innerText.trim().length);
    if (!res || res.status() >= 400 || chars < 200) fail.push(`hub to ${h}: ${res && res.status()}, ${chars} chars`);
  }
  say(true, `and every one of them renders (${new Set(hrefs).size} checked)`);
  await a.page.close();
}

/* -- A switch has to say what OFF means ------------------------------- */
{
  const a = await audit(browser, token, { route: "/app/settings/notifications" });
  const switches = await a.page.$$eval('[role="switch"]', (n) => n.length);
  say(switches >= 8, `every preference is a switch (${switches})`);

  const rowText = () => a.page.evaluate(() => {
    const row = [...document.querySelectorAll("main div")].find((d) => /^Money\n/.test(d.innerText || ""));
    return row ? row.innerText : "";
  });
  say(/told when a payment arrives/.test(await rowText()), "an ON switch says what it does");

  await a.page.$$eval('[role="switch"][aria-label="Money"]', (n) => n[0] && n[0].click());
  await wait(500);
  // The thing she is actually deciding is what silence costs her.
  say(/only find out by opening the wallet/.test(await rowText()),
      "and an OFF switch says what silence would mean");

  const text = await a.page.evaluate(() => document.querySelector("main").innerText);
  say(/Safety alerts always reach you/.test(text), "safety alerts are stated as not switchable");
  await a.page.close();
}

/* -- Language is offered in its own script ---------------------------- */
{
  const a = await audit(browser, token, { route: "/app/settings/language" });
  const opts = await a.page.$$eval("main button[aria-pressed]", (bs) => bs.map((b) => b.innerText.trim()));
  say(opts.length >= 3, `languages are listed (${opts.length})`);
  // A woman looking for Hindi is looking for the Devanagari, not the Latin word.
  const nonLatin = opts.filter((t) => /[ऀ-෿؀-ۿ]/.test(t));
  say(nonLatin.length > 0, `written in their own scripts, not transliterated (${nonLatin.length})`);
  const rtl = await a.page.$$eval('main button[dir="rtl"]', (n) => n.length);
  say(rtl > 0, `right-to-left languages are marked as such (${rtl})`);
  await a.page.close();
}

/* -- The password bar explains itself --------------------------------- */
{
  const a = await audit(browser, token, { route: "/app/settings/security" });
  // Sessions before the password form: somebody else being signed in is the
  // urgent thing on this page.
  const order = await a.page.evaluate(() => {
    const t = document.querySelector("main").innerText;
    return { sessions: t.indexOf("Where you are signed in"), pw: t.indexOf("Change your password") };
  });
  say(order.sessions >= 0 && order.sessions < order.pw,
      "where she is signed in comes before the password form");

  const inputs = await a.page.$$('main input[type="password"]');
  await inputs[1].type("abc");
  await wait(450);
  const weak = await a.page.evaluate(() => document.querySelector("main").innerText);
  say(/Too easy to guess|Weak/.test(weak), "a weak password is named, not just coloured");
  say(/Make it longer|Twelve characters/.test(weak), "and the bar says why");

  await inputs[1].type("orange-harbour-lantern-92");
  await wait(450);
  const strong = await a.page.evaluate(() => document.querySelector("main").innerText);
  say(/Strong|Very strong/.test(strong), "a strong one is recognised");

  // Closing an account must not be one tap beside a sign-out.
  await a.page.$$eval("main button", (bs) => {
    const b = bs.find((x) => /Close my account/.test(x.innerText));
    if (b) b.click();
  });
  await wait(600);
  const closing = await a.page.evaluate(() => document.querySelector("main").innerText);
  say(/Type\s+CLOSE/.test(closing), "closing an account asks her to type a word");
  say(/cannot bring them back/.test(closing), "and says plainly what is lost");
  await a.page.close();
}

await browser.close();
finish(fail, lines, "The settings hub and all five pages render in both themes and state their consequences");
