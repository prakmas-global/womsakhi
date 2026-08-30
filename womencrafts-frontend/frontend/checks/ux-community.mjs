/**
 * Skill Exchange, Sakhi Local and Messages.
 *
 * Three community screens with three claims worth guarding: an exchange never
 * offers her own post back to her, Local stays local, and a reply she types
 * actually appears in the conversation rather than vanishing into a state that
 * looks like it worked.
 */
import { launch, seededMemberToken } from "./_shared.mjs";
import { audit, finish, report, wait } from "./_screen.mjs";

const SCREENS = [
  ["exchange", "/app/library", null],
  ["exchange-mine", "/app/library", "Your exchanges"],
  ["local", "/app/stories", null],
  ["local-groups", "/app/stories", "Groups"],
  ["messages", "/app/messages", null],
];

const fail = [];
const lines = [];
const token = await seededMemberToken();
const browser = await launch();

for (const [name, route, tab] of SCREENS) {
  for (const mode of ["light", "dark"]) {
    const a = await audit(browser, token, { route, mode, tab });
    report(name, mode, a, fail, lines);
    await a.page.close();
  }
}

const say = (ok, msg) => { lines.push(`  ${ok ? "ok  " : "✗   "} ${msg}`); if (!ok) fail.push(msg); };

/* ── Skill Exchange ────────────────────────────────────────────────────── */
{
  const a = await audit(browser, token, { route: "/app/library" });
  const rows = await a.page.$$eval("main .ux-i", (n) => n.map((e) => e.innerText));
  // Her own offer must not be listed back to her as something to swap with.
  say(!rows.some((t) => /Priya Sharma/.test(t)), "her own post is not offered back to her");
  say(rows.every((t) => /Offering|Looking for/.test(t)), "every post says which side it is");
  // Both directions are always stated — an exchange is not a favour.
  say(rows.every((t) => /would like in return|can teach in return/.test(t)),
      "and what is wanted in return is always stated");

  const before = rows.length;
  await a.page.$$eval("main button", (bs) => bs.find((b) => b.innerText.trim() === "Offering")?.click());
  await wait(700);
  const off = await a.page.$$eval("main .ux-i", (n) => n.map((e) => e.innerText));
  say(off.length > 0 && off.length < before, `filtering by side narrows it (${before} → ${off.length})`);
  say(off.every((t) => /Offering/.test(t)), "and leaves only that side");
  await a.page.close();
}

/* ── Sakhi Local stays local ───────────────────────────────────────────── */
{
  const a = await audit(browser, token, { route: "/app/stories" });
  const text = await a.page.evaluate(() => document.querySelector("main").innerText);
  const rows = await a.page.$$eval("main .ux-i", (n) => n.map((e) => e.innerText));
  say(/Jaipur/.test(text), "the city is named on the page");
  // A "local" screen showing the whole country is just the home page again.
  say(rows.every((t) => /km away|Jaipur|Bagru/.test(t)),
      `every story says how far away she is (${rows.length} checked)`);
  const help = await a.page.evaluate(() => document.body.innerText);
  say(/181/.test(help), "the helpline number is on the page, not behind a link");
  await a.page.close();
}

/* ── Messages: a reply must actually land ──────────────────────────────── */
{
  const a = await audit(browser, token, { route: "/app/messages" });
  const bubbles = () => a.page.$$eval("main .ux-rise", (n) => n.length);
  const before = await bubbles();
  say(before >= 3, `the open conversation shows its history (${before} messages)`);

  // The role beside a name decides how fast she needs to reply.
  const roles = await a.page.$$eval("main button", (bs) =>
    bs.map((b) => b.innerText).filter((t) => /Bought|Mentor|members|You applied/.test(t)).length);
  say(roles >= 3, `each conversation says who the person is (${roles})`);

  await a.page.type('input[aria-label="Write a reply"]', "Two inches longer is fine.");
  await a.page.keyboard.press("Enter");
  await wait(700);
  const after = await bubbles();
  const text = await a.page.evaluate(() => document.querySelector("main").innerText);
  say(after === before + 1, `sending adds exactly one message (${before} → ${after})`);
  say(/Two inches longer is fine\./.test(text), "and the text she typed is what appears");
  const cleared = await a.page.$eval('input[aria-label="Write a reply"]', (e) => e.value);
  say(cleared === "", "the box clears, so she cannot send it twice by accident");

  // An empty reply must not be sendable at all.
  await a.page.keyboard.press("Enter");
  await wait(400);
  say((await bubbles()) === after, "pressing Enter on an empty box sends nothing");
  await a.page.close();
}

await browser.close();
finish(fail, lines, "Skill Exchange, Sakhi Local and Messages render in both themes and behave honestly");
