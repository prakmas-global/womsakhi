/**
 * Phase 6 — no button in this app does nothing.
 *
 * A sweep for `<Btn>` with neither `href` nor `onClick` found **66 dead
 * buttons across 33 screens**. Not one of them was visible in review: they look
 * exactly like working buttons, they highlight on hover, they ripple on press.
 * A woman presses "Withdraw", nothing happens, she presses again, and then she
 * decides the app has taken her money.
 *
 * So this check is the durable half of the fix. It runs in two layers:
 *
 * 1. **Source** — every `<Btn>` and every `SectionHead action=` in the member
 *    app must carry a handler or a destination. Exhaustive, instant, no flake,
 *    and it fails on a button written dead *today* rather than a screen
 *    somebody remembers to open.
 * 2. **Surface** — the six screens Phase 6 added are rendered in both themes
 *    and audited like every other screen: contrast, hit targets, clipping,
 *    sideways scroll.
 *
 * The one exemption is a **busy label** — "Sending…", "Getting it ready…".
 * Those are the disabled half of a conditional whose live half carries the
 * handler, and giving them one would let her press twice.
 */
import { readFileSync } from "node:fs";
import { globSync } from "node:fs";

import { launch, seededMemberToken } from "./_shared.mjs";
import { audit, finish, report, wait } from "./_screen.mjs";

const fail = [];
const lines = [];
const say = (ok, msg) => { lines.push(`  ${ok ? "ok  " : "✗   "} ${msg}`); if (!ok) fail.push(msg); };

/* ── 1. Source: nothing in the member app is inert ───────────────────── */

/** A label ending in an ellipsis is a busy state, not a button. */
const BUSY = /[…]\s*$/;

const dead = [];
for (const file of globSync("src/app/app/**/*.tsx")) {
  if (file.includes(".bak")) continue;
  const src = readFileSync(file, "utf8");

  for (const m of src.matchAll(/<Btn\b([\s\S]*?)>([\s\S]*?)<\/Btn>/g)) {
    // `type="submit"` is not dead: its handler is the form's `onSubmit`, and
    // giving it one of its own is how an action fires twice.
    if (/\bhref\b/.test(m[1]) || /\bonClick\b/.test(m[1]) || /type=["']submit["']/.test(m[1])) continue;
    const label = m[2].replace(/\{[^}]*\}/g, "…").replace(/\s+/g, " ").trim();
    if (BUSY.test(label)) continue;
    dead.push(`${file}:${src.slice(0, m.index).split("\n").length}  "${label}"`);
  }

  // A section heading's action is a button too, and it was dead in ten places.
  for (const m of src.matchAll(/<SectionHead\b([\s\S]*?)\/>/g)) {
    if (!/\baction=/.test(m[1]) || /\bonAction\b/.test(m[1])) continue;
    const label = (m[1].match(/action="([^"]+)"/) || [, "?"])[1];
    dead.push(`${file}:${src.slice(0, m.index).split("\n").length}  [heading] "${label}"`);
  }
}

say(dead.length === 0, `every button in the member app leads somewhere (${dead.length} dead)`);
for (const d of dead.slice(0, 40)) lines.push(`      ${d}`);
if (dead.length > 40) lines.push(`      …and ${dead.length - 40} more`);

/* ── 2. Surface: the six screens Phase 6 added ───────────────────────── */

const SCREENS = [
  ["withdraw",  "/app/wallet/withdraw"],
  ["statement", "/app/wallet/statement"],
  ["payments",  "/app/settings/payments"],
  ["saved",     "/app/saved"],
  ["scheme",    "/app/support-fund/sc1"],
  ["vault",     "/app/documents/vault"],
];

const token = await seededMemberToken();
const browser = await launch();

const settle = async (page) => {
  await page.waitForFunction(
    () => !document.querySelector('[role="status"]') && document.body.innerText.trim().length > 400,
    { timeout: 90000 }).catch(() => {});
};
const content = (page) => page.evaluate(() => {
  const sc = document.getElementById("ux-scroll");
  return sc ? sc.innerText : document.body.innerText;
});

for (const [name, route] of SCREENS) {
  for (const mode of ["light", "dark"]) {
    const a = await audit(browser, token, { route, mode, settle: 2600 });
    await settle(a.page);
    report(name, mode, a, fail, lines);
    await a.page.close();
  }
}

/* -- Withdraw: available and pending are never added together ---------- */
{
  const a = await audit(browser, token, { route: "/app/wallet/withdraw", settle: 2600 });
  await settle(a.page);
  const t = await content(a.page);
  // A withdrawal that bounces costs her a day and her trust in the wallet.
  say(/Available now/i.test(t) && /Still on its way/i.test(t),
      "withdraw separates what she can take from what is still coming");
  say(/Transfer fee[\s\S]{0,40}None/i.test(t),
      "the fee is stated as None, not left out");
  say(/three working days/i.test(t),
      "it says when the money lands, in days she can plan around");
  say(/Nothing moves until you press/i.test(t),
      "and that nothing happens until she presses the button");
  await a.page.close();
}

/* -- Payment methods: exactly one primary, and it is named ------------- */
{
  const a = await audit(browser, token, { route: "/app/settings/payments", settle: 2600 });
  await settle(a.page);
  const t = await content(a.page);
  // Count the badge, not the word: the sentence at the top of the screen
  // explains what Primary means and would otherwise count as a second one.
  const primaries = await a.page.$$eval("#ux-scroll span", (ns) =>
    ns.filter((n) => n.textContent.trim() === "Primary" && n.children.length === 0).length);
  say(primaries === 1, `exactly one method is marked Primary (${primaries})`);
  say(/never ask for your PIN/i.test(t), "it says what WomSakhi will never ask for");
  say(/Only you can start a withdrawal/i.test(t), "and that nobody else can move her money");
  await a.page.close();
}

/* -- The scheme page is written backwards from the counter ------------- */
{
  const a = await audit(browser, token, { route: "/app/support-fund/sc1", settle: 2600 });
  await settle(a.page);
  const t = await content(a.page);
  say(/acknowledgement slip/i.test(t), "it tells her to get a receipt at the counter");
  say(/turned down/i.test(t) && /apply again/i.test(t),
      "a refusal has a named next move — the reason most women never re-apply");
  say(/With us|Not added/.test(t), "papers are checked against what she has already given us");
  await a.page.close();
}

/* -- Saved things carry a clock, and expired ones are not hidden ------- */
{
  const a = await audit(browser, token, { route: "/app/saved", settle: 2600 });
  await settle(a.page);
  const t = await content(a.page);
  say(/Closes in|left\b/i.test(t), "saved items say how long is left");
  say(/Closed/.test(t), "and a closed one is shown as closed rather than quietly dropped");
  say(/does not apply, book or reserve/i.test(t), "saving is not mistaken for applying");
  await a.page.close();
}

/* -- The vault says who can see her papers, and where each is used ----- */
{
  const a = await audit(browser, token, { route: "/app/documents/vault", settle: 2600 });
  await settle(a.page);
  const t = await content(a.page);
  // An account that has uploaded nothing has nothing to say "Used by" about,
  // and must say THAT rather than showing a blank page or a 0-of-0 bar.
  const empty = /None added yet|not given us any papers/.test(t);
  say(empty || /Used by/.test(t),
      empty ? "an empty vault says so rather than showing a blank"
            : "each paper says where it is already being used");
  say(/Buyers and employers[\s\S]{0,40}Never/i.test(t),
      "and who never sees it");
  await a.page.close();
}

/* -- 3. The two new patterns, pressed rather than read ---------------- */

/**
 * A handler in the source is not the same as feedback on the screen. Both new
 * components are exercised the way a woman would: press it, and look.
 */

// ActionBtn — the label must become a confirmation, and go back afterwards.
{
  const a = await audit(browser, token, { route: "/app/events", settle: 2600 });
  await settle(a.page);
  const before = await a.page.$$eval("#ux-scroll button", (bs) => {
    const b = bs.find((x) => x.innerText.trim() === "Remind me");
    if (b) b.setAttribute("data-probe", "1");
    return b ? b.innerText.trim() : null;
  });
  say(before === "Remind me", "the events list has a Remind me button");
  await a.page.click('[data-probe="1"]');
  await wait(300);
  const after = await a.page.$eval('[data-probe="1"]', (b) => b.innerText.trim());
  say(after !== before && /remind you/i.test(after),
      `pressing it says what will happen ("${after}")`);
  // It must hand the label back, or the next press has nothing to confirm.
  await wait(2400);
  const back = await a.page.$eval('[data-probe="1"]', (b) => b.innerText.trim());
  say(back === before, "and the label comes back so it can be pressed again");
  await a.page.close();
}

// NoteBtn — the box must open, and refuse to send an empty note.
{
  const a = await audit(browser, token, { route: "/app/mentors", settle: 2600 });
  await settle(a.page);
  const found = await a.page.$$eval("#ux-scroll button", (bs) => {
    const b = bs.find((x) => x.innerText.trim() === "Ask for a session");
    if (b) b.setAttribute("data-probe", "1");
    return !!b;
  });
  say(found, "mentors offer a way to ask for a session");
  await a.page.click('[data-probe="1"]');
  await wait(400);
  const box = await a.page.evaluate(() => {
    const d = document.querySelector('[role="dialog"]');
    if (!d) return null;
    const send = Array.from(d.querySelectorAll("button")).find((b) => b.innerText.trim() === "Send it");
    return {
      titled: /Ask .+ for a session/.test(d.getAttribute("aria-label") || ""),
      area: !!d.querySelector("textarea"),
      // Empty is not sendable — an empty request wastes the mentor's reply.
      blocked: !!send && getComputedStyle(send).pointerEvents === "none",
      // It says who reads it before she types, not after she sends.
      names: /Only .+ sees this/.test(d.innerText),
    };
  });
  say(!!box, "pressing it opens a box to write in");
  say(box?.titled, "the box names the mentor it goes to");
  say(box?.area, "there is somewhere to type");
  say(box?.blocked, "an empty note cannot be sent");
  say(box?.names, "and it says who will read it before she writes");
  await a.page.close();
}

await browser.close();
finish(fail, lines, "Phase 6 complete: no button in the member app does nothing");
