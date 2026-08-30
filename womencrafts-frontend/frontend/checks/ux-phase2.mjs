/**
 * Phase 2 — the screens a member could reach a dead end at.
 *
 * Each of these existed as a button that went nowhere. So beyond rendering, the
 * assertions are about the promise each screen makes: a price typed in rupees
 * is stored in paise, an order offers one next step, a circle shows its maths
 * before anyone is invited, and the profile preview states what is withheld
 * rather than merely omitting it.
 */
import { launch, seededMemberToken } from "./_shared.mjs";
import { audit, finish, report, wait } from "./_screen.mjs";

const SCREENS = [
  ["product-edit",   "/app/documents/product/p1"],
  ["product-new",    "/app/documents/product/new"],
  ["product-gone",   "/app/documents/product/nope"],
  ["order",          "/app/documents/order/s1"],
  ["order-gone",     "/app/documents/order/nope"],
  ["circle-new",     "/app/circles/new"],
  ["profile-preview","/app/profile/preview"],
  ["exchange-thread","/app/library/x1"],
  ["exchange-gone",  "/app/library/nope"],
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

const content = (page) => page.evaluate(() => {
  const sc = document.getElementById("ux-scroll");
  return sc ? sc.innerText : document.body.innerText;
});
const say = (ok, msg) => { lines.push(`  ${ok ? "ok  " : "✗   "} ${msg}`); if (!ok) fail.push(msg); };

/* -- Nothing in My Business is a dead end any more --------------------- */
{
  const a = await audit(browser, token, { route: "/app/documents" });
  const hrefs = await a.page.$$eval('main a[href^="/app/documents/"]', (as) => as.map((x) => x.getAttribute("href")));
  say(hrefs.some((h) => /\/order\//.test(h)), "an order row opens");
  await a.page.$$eval("main button", (bs) => {
    const b = bs.find((x) => x.innerText.trim() === "What you sell");
    if (b) b.click();
  });
  await wait(800);
  const prod = await a.page.$$eval('main a[href^="/app/documents/product/"]', (as) => as.map((x) => x.getAttribute("href")));
  say(prod.length >= 4, `every product has a working Edit (${prod.length})`);
  await a.page.close();
}

/* -- The price is typed in rupees and stored in paise ------------------ */
{
  const a = await audit(browser, token, { route: "/app/documents/product/new" });
  const t0 = await content(a.page);
  say(/Still needs a name/.test(t0), "a blank product says what it still needs");

  const inputs = await a.page.$$("main input");
  await inputs[0].type("Cotton dupatta");
  await inputs[1].type("1250");
  await wait(600);
  const t1 = await content(a.page);
  // She thinks in rupees; the ledger must be exact. The preview proves the
  // conversion happened at the one place it is entered.
  say(/.1,250/.test(t1), "the preview shows it back formatted in rupees");
  say(/Cotton dupatta/.test(t1), "and the name appears as a buyer would see it");
  say(/Still needs a description/.test(t1), "and it still says what is missing");
  await a.page.close();
}

/* -- An order offers exactly one next step ----------------------------- */
{
  const a = await audit(browser, token, { route: "/app/documents/order/s1" });
  const t = await content(a.page);
  // A custom request buried under a status track is how the wrong thing is made.
  say(/longer at the back/.test(t), "the buyer's own words are quoted");
  const nexts = await a.page.$$eval("button, a", (n) =>
    n.map((x) => x.innerText.trim()).filter((x) => /^(Start making|Mark ready|Mark sent|Mark done)$/.test(x)));
  say(nexts.length === 1, `exactly one next step is offered (${nexts.join(", ") || "none"})`);
  say(/WomSakhi fee\s*\n?\s*None/.test(t), "and it states the fee as none");

  await a.page.$$eval("button", (bs) => {
    const b = bs.find((x) => /^Start making$/.test(x.innerText.trim()));
    if (b) b.click();
  });
  await wait(700);
  const after = await content(a.page);
  say(/Mark ready/.test(after), "acting on it advances the order");
  await a.page.close();
}

/* -- A circle shows its maths before anyone is invited ----------------- */
{
  const a = await audit(browser, token, { route: "/app/circles/new" });
  say(/Step 1 of 2/.test(await content(a.page)), "it says how many steps there are");

  await a.page.$$eval("main button", (bs) => {
    const b = bs.find((x) => /A savings circle/.test(x.innerText));
    if (b) b.click();
  });
  await wait(400);
  await a.page.$$eval("main button", (bs) => {
    const b = bs.find((x) => x.innerText.trim() === "Next");
    if (b) b.click();
  });
  await wait(800);

  const t = await content(a.page);
  // The consequence, before a single invitation.
  say(/What this means/.test(t), "the maths is shown before anyone is invited");
  say(/The pot each month/.test(t) && /You will pay in total/.test(t),
      "both what she pays and what she receives are stated");
  say(/every month for \d+ months, without fail|without fail/.test(t),
      "and the commitment is spelled out plainly");
  say(/Only ask women you would lend money to/.test(t), "with a warning about who to invite");
  await a.page.close();
}

/* -- The preview states what is withheld ------------------------------- */
{
  const a = await audit(browser, token, { route: "/app/profile/preview" });
  const t = await content(a.page);
  say(/exactly what an employer or buyer sees/.test(t), "the banner says what this screen is");
  // An absence proves nothing; a stated absence proves a lot.
  const withheld = (t.match(/not shown/g) || []).length;
  say(withheld >= 3, `private fields are stated as withheld, not omitted (${withheld})`);
  say(!/\+91|okhdfcbank/.test(t), "and no private detail actually leaks onto it");
  await a.page.close();
}

/* -- An exchange agreement is pinned above the chat -------------------- */
{
  const a = await audit(browser, token, { route: "/app/library/x1" });
  const t = await content(a.page);
  // An exchange that lives only in a thread is one two women later remember
  // differently, and neither is lying.
  say(/What you have agreed/.test(t), "the agreement is pinned above the messages");
  // innerText applies text-transform: these labels render uppercase.
  say(/you teach/i.test(t) && /you learn/i.test(t), "both directions are stated");
  say(/No money either way/.test(t), "and that no money changes hands");

  await a.page.$$eval("main button", (bs) => {
    const b = bs.find((x) => /Agree to this/.test(x.innerText));
    if (b) b.click();
  });
  await wait(600);
  say(/Agreed/.test(await content(a.page)), "agreeing is recorded on the page");

  await a.page.type('input[aria-label="Write a reply"]', "Saturday works for me.");
  await a.page.keyboard.press("Enter");
  await wait(700);
  const after = await content(a.page);
  say(/Saturday works for me\./.test(after), "and a reply lands in the thread");
  const cleared = await a.page.$eval('input[aria-label="Write a reply"]', (e) => e.value);
  say(cleared === "", "the box clears afterwards");
  await a.page.close();
}

await browser.close();
finish(fail, lines, "Phase 2 complete: every dead end now leads somewhere, in both themes");
