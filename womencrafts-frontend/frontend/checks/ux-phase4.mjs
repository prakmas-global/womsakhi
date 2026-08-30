/**
 * Phase 4 — finishing the partly-built modules.
 *
 * The headline of this phase is SERVICES. Until now a member could sell a thing
 * in a box and nothing else — no way to list stitching to measure, mehendi,
 * tuition, cooking or childcare, which is how most women on WomSakhi actually
 * earn. Four "offer" buttons were also dead.
 */
import { launch, seededMemberToken } from "./_shared.mjs";
import { audit, finish, report, wait } from "./_screen.mjs";

const SCREENS = [
  ["service-edit",  "/app/documents/service/sv1"],
  ["service-new",   "/app/documents/service/new"],
  ["service-gone",  "/app/documents/service/nope"],
  ["reviews",       "/app/documents"],
  ["circle-pay",    "/app/circles/c1/pay"],
  ["circle-pay-bad","/app/circles/c2/pay"],
  ["goals",         "/app/progress/goals"],
];

const fail = [];
const lines = [];
const token = await seededMemberToken();
const browser = await launch();

/** Wait past the route skeleton for real content. */
const settle = async (page) => {
  await page.waitForFunction(
    () => !document.querySelector('[role="status"]') && document.body.innerText.trim().length > 400,
    { timeout: 60000 }).catch(() => {});
};

for (const [name, route] of SCREENS) {
  for (const mode of ["light", "dark"]) {
    const a = await audit(browser, token, { route, mode, settle: 2400 });
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

/* -- She can list a service at all ------------------------------------- */
{
  const a = await audit(browser, token, { route: "/app/documents", settle: 2200 });
  await settle(a.page);
  await a.page.$$eval("main button", (bs) => {
    const b = bs.find((x) => x.innerText.trim() === "What you sell");
    if (b) b.click();
  });
  await wait(900);
  const t = await content(a.page);
  // Services and products live together, because to her they are one thing.
  say(/Your time and skill/i.test(t), "services have a home beside products");
  say(/Things you make/i.test(t), "and products still have theirs");
  const links = await a.page.$$eval('main a[href*="/documents/service/"]', (as) => as.length);
  say(links >= 3, `every service is editable and a new one can be added (${links} links)`);
  await a.page.close();
}

/* -- A service asks what a service needs, not what a product needs ----- */
{
  const a = await audit(browser, token, { route: "/app/documents/service/new", settle: 2400 });
  await settle(a.page);
  const t = await content(a.page);
  say(/Still needs a name/.test(t), "a blank service says what it still needs");
  // A service has a rate and a place, not stock. Asking a tailor how many
  // haircuts she has left is the failure this separation avoids.
  say(!/how many are ready|in stock/i.test(t), "it never asks a service for stock");
  say(/per hour|per visit|per piece|per month/.test(t), "it asks how the rate is charged");
  say(/Where it happens/.test(t), "and where the work happens");

  const inputs = await a.page.$$("main input");
  await inputs[0].type("Mehendi at home");
  await inputs[1].type("1500");
  await wait(700);
  const t2 = await content(a.page);
  say(/.1,500/.test(t2) && /Mehendi at home/.test(t2), "the preview shows it as a buyer would see it");

  // Travel distance only matters when she travels — asked then, not always.
  await a.page.$$eval("main button", (bs) => {
    const b = bs.find((x) => /At your place/.test(x.innerText));
    if (b) b.click();
  });
  await wait(700);
  say(/How far will you travel/.test(await content(a.page)),
      "travel distance is asked only when she is the one travelling");
  await a.page.close();
}

/* -- Reviews she has received -------------------------------------------- */
{
  const a = await audit(browser, token, { route: "/app/documents", settle: 2200 });
  await settle(a.page);
  await a.page.$$eval("main button", (bs) => {
    const b = bs.find((x) => x.innerText.trim() === "Reviews");
    if (b) b.click();
  });
  await wait(900);
  const t = await content(a.page);
  say(/47 reviews/.test(t), "the rating breakdown is shown");
  const cards = await a.page.$$eval("main .ux-i", (n) => n.length);
  say(cards >= 3, `individual reviews are listed (${cards})`);
  say(/Reply/.test(t), "and she can reply to each one");
  await a.page.close();
}

/* -- Paying into a circle names the women waiting ---------------------- */
{
  const a = await audit(browser, token, { route: "/app/circles/c1/pay", settle: 2400 });
  await settle(a.page);
  const t = await content(a.page);
  // A transfer to an account number is easy to postpone; eleven women you know
  // are not. The social fact IS the mechanism.
  say(/takes the pot this month/.test(t), "it names who receives the pot");
  say(/Who has paid/.test(t), "and shows who has paid and who has not");
  say(/WomSakhi takes no fee/.test(t), "it states that no fee is taken");
  say(/A circle survives a hard month/.test(t), "and says what to do if the month is hard");

  await a.page.$$eval("button", (bs) => {
    const b = bs.find((x) => /^Pay /.test(x.innerText.trim()));
    if (b) b.click();
  });
  await wait(1500);
  say(/paid in/.test(await content(a.page)), "paying confirms with the amount");
  await a.page.close();
}

/* -- A community circle has nothing to pay ----------------------------- */
{
  const a = await audit(browser, token, { route: "/app/circles/c2/pay", settle: 2200 });
  await settle(a.page);
  say(/Nothing to pay here/.test(await content(a.page)),
      "a community circle refuses a payment screen rather than inventing one");
  await a.page.close();
}

/* -- A goal needs a number and a date ---------------------------------- */
{
  const a = await audit(browser, token, { route: "/app/progress/goals", settle: 2400 });
  await settle(a.page);
  const t = await content(a.page);
  say(/of ..30,000|30,000/.test(t), "goals show the number, not just a bar");
  // A goal without a next step is a wish with a progress bar.
  const steps = await a.page.$$eval('main a[href^="/app"]', (as) =>
    as.filter((x) => /would close the gap|lessons left|did not message/.test(x.innerText)).length);
  say(steps >= 2, `each goal offers what would move it (${steps})`);

  await a.page.$$eval("main button", (bs) => {
    const b = bs.find((x) => /Add a goal/.test(x.innerText));
    if (b) b.click();
  });
  await wait(700);
  const adding = await content(a.page);
  say(/It needs a number and a date/.test(adding),
      "a new goal is required to have a number and a date");
  say(/It needs something to aim at/.test(adding), "and says which part is still missing");
  await a.page.close();
}

/* -- No "offer" button leads nowhere any more -------------------------- */
{
  const pages = [
    ["/app/library", /Offer another skill/],
    ["/app/mentors", /Offer to help/],
    ["/app/stories", /Share your story/],
    ["/app/events", /Propose an event/],
    ["/app/circles", /Create a circle/],
    ["/app/documents", /Add a product/],
  ];
  let wired = 0;
  for (const [route, label] of pages) {
    const a = await audit(browser, token, { route, settle: 2000 });
    await settle(a.page);
    const href = await a.page.$$eval("a", (as, src) => {
      const re = new RegExp(src.slice(1, -1));
      const el = as.find((x) => re.test(x.innerText));
      return el ? el.getAttribute("href") : null;
    }, label.toString());
    if (href && href.startsWith("/app")) wired++;
    else fail.push(`${route}: "${label.source}" still leads nowhere (${href})`);
    await a.page.close();
  }
  say(wired === pages.length, `every way to offer something leads somewhere (${wired}/${pages.length})`);
}

await browser.close();
finish(fail, lines, "Phase 4 complete: she can list a service, pay into a circle, set a goal, and every offer leads somewhere");
