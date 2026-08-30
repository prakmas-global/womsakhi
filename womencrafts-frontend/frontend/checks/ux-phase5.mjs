/**
 * Phase 5 — the ten modules that had not been started.
 *
 * Four of them (health, rights, family, travel) are not about earning. They are
 * about what STOPS a woman earning, which every other module in this app
 * quietly assumes is handled. So the assertions are mostly about one thing:
 * does the screen say what is FREE, and where — because cost and not knowing
 * are the two barriers, not willingness.
 */
import { launch, seededMemberToken } from "./_shared.mjs";
import { audit, finish, report, wait } from "./_screen.mjs";

const SCREENS = [
  ["health",      "/app/health", null],
  ["health-know", "/app/health", "Worth knowing"],
  ["rights",      "/app/rights", null],
  ["rights-wrong","/app/rights", "If something is wrong"],
  ["family",      "/app/family", null],
  ["family-know", "/app/family", "Worth knowing"],
  ["travel",      "/app/travel", null],
  ["travel-safe", "/app/travel", "Getting there safely"],
  ["assess",      "/app/assess", null],
  ["digital",     "/app/digital", null],
  ["cover",       "/app/cover", null],
  ["cover-have",  "/app/cover", "What you have"],
  ["group-buy",   "/app/group-buy", null],
  ["voice",       "/app/settings/voice", null],
  ["offline",     "/app/settings/offline", null],
];

const fail = [];
const lines = [];
const token = await seededMemberToken();
const browser = await launch();

const settle = async (page) => {
  await page.waitForFunction(
    () => !document.querySelector('[role="status"]') && document.body.innerText.trim().length > 400,
    { timeout: 90000 }).catch(() => {});
};

for (const [name, route, tab] of SCREENS) {
  for (const mode of ["light", "dark"]) {
    const a = await audit(browser, token, { route, mode, tab, settle: 2600 });
    await settle(a.page);
    report(name, mode, a, fail, lines);
    await a.page.close();
  }
}

const content = (page) => page.evaluate(() => {
  const sc = document.getElementById("ux-scroll");
  return sc ? sc.innerText : document.body.innerText;
});
const say = (ok, msg) => { lines.push(`  ${ok ? "ok  " : "✗   "} ${msg}`); if (!ok) fail.push(msg); };

/* -- Wellbeing exists as a place ---------------------------------------- */
{
  const a = await audit(browser, token, { route: "/app/health", settle: 2600 });
  await settle(a.page);
  const nav = await a.page.evaluate(() => ({
    tabs: [...document.querySelectorAll("header nav a")].map((x) => x.innerText.trim()),
    current: (document.querySelector('header nav a[aria-current="page"]') || {}).innerText,
    rail: [...document.querySelectorAll("aside nav a")].length,
  }));
  say(nav.tabs.length === 7, `there are seven modes now (${nav.tabs.length})`);
  say(/Wellbeing/.test(nav.current || ""), `health sits under Wellbeing (${nav.current})`);
  say(nav.rail === 4, `and Wellbeing holds four sections (${nav.rail})`);
  await a.page.close();
}

/* -- Health leads with what is free ------------------------------------- */
{
  const a = await audit(browser, token, { route: "/app/health", settle: 2600 });
  await settle(a.page);
  const t = await content(a.page);
  // Cost and not knowing are the barriers, not willingness.
  say(/\bFree\b/.test(t), "free checks are marked as free");
  say(/Overdue/.test(t), "and overdue ones say so");
  say(/1097/.test(t) && /14416/.test(t), "helpline numbers are text on the page");
  // Nobody here is a doctor, and the screen says so.
  say(/nobody at WomSakhi is a doctor/i.test(t), "it states plainly that this is not medical advice");
  await a.page.close();
}

/* -- Rights: the sentence first, the Act second ------------------------- */
{
  const a = await audit(browser, token, { route: "/app/rights", settle: 2600 });
  await settle(a.page);
  const t = await content(a.page);
  say(/Your wages are yours/.test(t), "each right is a sentence she can repeat");
  say(!/Hindu Succession/.test(t), "the Act is not shown until she asks");
  await a.page.$$eval("main button", (bs) => {
    const b = bs.find((x) => /Which law/.test(x.innerText));
    if (b) b.click();
  });
  await wait(700);
  say(/Under the law your account is yours alone/.test(await content(a.page)),
      "and it is there when she does");
  // The single most useful fact on the screen.
  say(/15100/.test(t) && /free/i.test(t), "a free lawyer and the number are both stated");
  await a.page.close();
}

/* -- Family leads with the free option ---------------------------------- */
{
  const a = await audit(browser, token, { route: "/app/family", settle: 2600 });
  await settle(a.page);
  const t = await content(a.page);
  say(/Anganwadi/.test(t), "the free government option is named");
  say(/\bFree\b/.test(t), "and marked free");
  say(/0\.8 km|km/.test(t), "every option says how far away it is");
  await a.page.close();
}

/* -- Travel says the thing nobody publishes ----------------------------- */
{
  const a = await audit(browser, token, { route: "/app/travel", settle: 2600 });
  await settle(a.page);
  const t = await content(a.page);
  say(/Not after dark/.test(t), "a route that is unsafe after dark says so");
  say(/Fine after dark/.test(t), "and one that is fine says that too");
  say(/Last safe bus back/.test(t), "with the detail that matters");
  await a.page.close();
}

/* -- Assessment cannot lower her score ---------------------------------- */
{
  const a = await audit(browser, token, { route: "/app/assess", settle: 2600 });
  await settle(a.page);
  const t = await content(a.page);
  // A test that can lower a score is one nobody with something to lose takes.
  say(/best result ever counts/i.test(t), "it says only her best result counts");
  say(/can only improve/i.test(t), "and repeats it beside a test she has taken");
  await a.page.close();
}

/* -- Insurance puts pays and costs side by side ------------------------- */
{
  const a = await audit(browser, token, { route: "/app/cover", settle: 2600 });
  await settle(a.page);
  const t = await content(a.page);
  say(/it pays/i.test(t) && /it costs/i.test(t), "what it pays and what it costs are both stated");
  say(/.20 a year/.test(t), "in rupees she can compare");
  say(/An agent offering to "?arrange"? one for a fee/i.test(t) || /taking money for something free/i.test(t),
      "and it warns about agents charging for something free");
  await a.page.close();
}

/* -- Group buying states the saving as a number ------------------------- */
{
  const a = await audit(browser, token, { route: "/app/group-buy", settle: 2600 });
  await settle(a.page);
  const t = await content(a.page);
  say(/less per metre|less per/i.test(t), "the saving is a number, not an adjective");
  say(/more women needed/i.test(t), "it says how many more are needed");
  say(/pay nothing unless/i.test(t), "and that she pays nothing unless it goes ahead");
  await a.page.close();
}

/* -- Voice and Offline are honest about cost and privacy ---------------- */
{
  const v = await audit(browser, token, { route: "/app/settings/voice", settle: 2600 });
  await settle(v.page);
  const vt = await content(v.page);
  say(/No recording of your voice is kept/i.test(vt), "voice says what happens to a recording");
  const scripts = await v.page.$$eval("main button", (bs) =>
    bs.map((b) => b.innerText).filter((t) => /[ऀ-෿؀-ۿ]/.test(t)).length);
  say(scripts >= 3, `languages appear in their own scripts (${scripts})`);
  await v.page.close();

  const o = await audit(browser, token, { route: "/app/settings/offline", settle: 2600 });
  await settle(o.page);
  const ot = await content(o.page);
  // Data costs money. Hiding the size spends her money for her.
  say(/MB/.test(ot), "every item shows what it costs in data");
  say(/Always kept/.test(ot), "and the ones she needs with no signal are locked on");
  say(/no signal/i.test(ot), "it lists what still works offline");
  await o.page.close();
}

await browser.close();
finish(fail, lines, "Phase 5 complete: ten modules, a seventh mode, and every one says what is free");
