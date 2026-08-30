/**
 * Certificates, Bookings, Refer, Safety and Help.
 *
 * The claims worth guarding here are about trust rather than layout: a
 * certificate is only proof if its code is on the page, a cancellation must ask
 * before it takes someone else's place away, a referral reward must never be
 * shown without its condition, and the safety alert must not be able to fire
 * from a tap.
 */
import { API, launch, seededMemberToken, seedCancellableBooking } from "./_shared.mjs";
import { audit, finish, report, wait } from "./_screen.mjs";

const SCREENS = [
  ["certificates", "/app/certificates", null],
  ["certs-progress", "/app/certificates", "In progress"],
  ["bookings", "/app/bookings", null],
  ["refer", "/app/refer", null],
  ["safety", "/app/safety", null],
  ["safety-tricks", "/app/safety", "Know the tricks"],
  ["help", "/app/help", null],
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

/* ── A certificate is only proof if it can be checked ──────────────────── */
{
  const a = await audit(browser, token, { route: "/app/certificates" });
  const cards = await a.page.$$eval("main .ux-i", (n) => n.map((e) => e.innerText));
  // Not `=== 4`. That was the mock's count, and the moment this screen read the
  // real API it had seven — a check pinned to a fixture fails on success.
  say(cards.length > 0, `certificates are listed (${cards.length})`);
  // Nor the mock's code FORMAT: live codes read WS-CERT-2026-1017. What has to
  // be true is that every card carries a code an employer can check, whatever
  // shape the issuer gives it.
  say(cards.every((t) => /WS-[A-Z0-9-]{4,}/.test(t)),
      "each carries a verification code on the page");
  say(cards.every((t) => /Download/.test(t) && /Share link/.test(t)),
      "and each can leave the app as a file or a link");
  await a.page.close();
}

/* ── Cancelling asks first, and says what it costs ─────────────────────── */
{
  // Its own booking to cancel — see `seedCancellableBooking`.
  await seedCancellableBooking(token);
  const a = await audit(browser, token, { route: "/app/bookings" });
  const before = await a.page.$$eval("main .ux-i", (n) => n.length);
  await a.page.$$eval("main button", (bs) => bs.find((b) => b.innerText.trim() === "Cancel")?.click());
  await wait(650);
  const asking = await a.page.evaluate(() => document.querySelector("main").innerText);
  say(/Cancel it\?/.test(asking), "cancelling asks before it does anything");
  say(/kept this hour free|comes back in|goes to the next woman/.test(asking),
      "and says what it costs someone else");
  // Backing out must leave the booking exactly as it was. Compared before and
  // after, not by the absence of the word "Cancelled" — the real list contains
  // a booking that was genuinely cancelled weeks ago, and reading its pill as
  // proof of a state change fails a screen that behaved perfectly.
  const cancelledBefore = await a.page.$$eval("main .ux-i",
    (n) => n.filter((e) => /Cancelled/.test(e.innerText)).length);
  await a.page.$$eval("main button", (bs) => bs.find((b) => b.innerText.trim() === "Keep it")?.click());
  await wait(600);
  const after = await a.page.evaluate(() => document.querySelector("main").innerText);
  const cancelledAfter = await a.page.$$eval("main .ux-i",
    (n) => n.filter((e) => /Cancelled/.test(e.innerText)).length);
  say(!/Cancel it\?/.test(after) && cancelledAfter === cancelledBefore,
      `backing out changes nothing (${cancelledBefore} cancelled before, ${cancelledAfter} after)`);
  await a.page.close();
}

/* ── A referral reward never appears without its condition ─────────────── */
{
  const a = await audit(browser, token, { route: "/app/refer" });
  const text = await a.page.evaluate(() => document.querySelector("main").innerText);
  const rewardLine = (text.match(/₹250 for each woman you bring[^\n]*/) || [""])[0];
  say(/finishes her first course/.test(rewardLine),
      `the reward states its condition in the same sentence ("${rewardLine.slice(0, 62)}…")`);
  // And a referral who has not earned must not be shown as if she had. With a
  // seeded account that has referred nobody there are no rows at all, which is
  // the correct answer — so the assertion is that no row claims a payment,
  // not that some row exists to claim one.
  const rows = await a.page.$$eval("main .ux-i", (n) => n.map((e) => e.innerText));
  const unpaid = rows.filter((t) => /Nothing yet/.test(t));
  say(unpaid.every((t) => !/\+₹/.test(t)),
      `no referral is shown as paid before she has earned (${unpaid.length} pending)`);
  // An account with nobody referred must say so rather than showing a blank.
  if (rows.length === 0) {
    const t = await a.page.evaluate(() => document.querySelector("main").innerText);
    say(/Nobody yet/.test(t), "and an account with no referrals says so");
  }
  await a.page.close();
}

/* ── The alert must not fire from a tap ────────────────────────────────── */
{
  const a = await audit(browser, token, { route: "/app/safety" });
  const box = await a.page.$eval("main button.ux-sq", (e) => {
    const r = e.getBoundingClientRect();
    return { x: r.x + 60, y: r.y + r.height / 2 };
  });
  // A quick tap — the gesture a pocket produces.
  await a.page.mouse.move(box.x, box.y);
  await a.page.mouse.down();
  await wait(140);
  await a.page.mouse.up();
  await wait(500);
  const afterTap = await a.page.evaluate(() => document.querySelector("main").innerText);
  say(/Press and hold to send an alert/.test(afterTap), "a quick tap does not send the alert");

  /*
   * A real press-and-hold does — and this now asks the SERVER, not the screen.
   *
   * It used to look for "have been told where you are" in the page text. That
   * sentence was the bug: the button called `setSent(true)` and no request
   * ever left the browser, so the check confirmed a lie about two invented
   * contacts. `ux-safety.mjs` covers this path in full.
   */
  await a.page.mouse.down();
  await wait(1900);
  await a.page.mouse.up();
  await wait(5000);
  const centre = await fetch(`${API}/safety`, { headers: { Cookie: `access_token=${token}` } }).then((r) => r.json());
  say(!!centre.open_alert, "holding it raises the alert on the server");
  const afterHold = await a.page.evaluate(() => document.querySelector("main").innerText);
  say(/Stand down/.test(afterHold), "and there is a way to stand down again");
  if (centre.open_alert) {
    await fetch(`${API}/safety/alert/${centre.open_alert.id}/stand-down`, {
      method: "POST", headers: { Cookie: `access_token=${token}` },
    });
  }

  // Every helpline number must be readable text, not only a tel: link.
  const nums = await a.page.evaluate(() => document.querySelector("main").innerText);
  say(/\b181\b/.test(nums) && /\b112\b/.test(nums) && /\b1930\b/.test(nums),
      "the numbers are on the page as text, so she can read them out");
  await a.page.close();
}

/* ── Help answers before it asks her to wait ───────────────────────────── */
{
  const a = await audit(browser, token, { route: "/app/help" });
  const faqs = await a.page.$$eval("main .ux-i", (n) => n.length);
  say(faqs >= 6, `answers are on the page before any contact form (${faqs})`);

  await a.page.type('input[aria-label="Search help"]', "bank");
  await wait(700);
  const hits = await a.page.$$eval("main .ux-i", (n) => n.map((e) => e.innerText));
  say(hits.length > 0 && hits.length < faqs, `search narrows the answers (${faqs} → ${hits.length})`);
  say(hits.every((t) => /bank/i.test(t)), "and every one mentions what she searched for");

  // Opening one must reveal the answer, not navigate away.
  await a.page.$$eval("main .ux-i button", (bs) => bs[0]?.click());
  await wait(600);
  const opened = await a.page.evaluate(() => ({
    expanded: !!document.querySelector('main [aria-expanded="true"]'),
    path: location.pathname,
  }));
  say(opened.expanded && opened.path === "/app/help", "an answer opens in place");
  await a.page.close();
}

await browser.close();
finish(fail, lines, "Certificates, Bookings, Refer, Safety and Help render in both themes and keep their promises");
