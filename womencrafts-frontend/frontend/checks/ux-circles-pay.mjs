/**
 * Paying into a savings circle, against the real server.
 *
 * It exists because this screen was a lie in three separate ways: the eleven
 * women named above the button were a hardcoded list, the amount was never
 * mapped so it read "Pay ₹0", and the button set a one-second timer and then
 * said "paid" without sending anything. Every assertion here asks the API what
 * it thinks happened, never the screen.
 */
import { API, launch, pageAs, seededMemberToken } from "./_shared.mjs";
import { APP, finish, wait } from "./_screen.mjs";

const fail = [];
const lines = [];
const say = (ok, msg) => { lines.push(`  ${ok ? "ok  " : "✗   "} ${msg}`); if (!ok) fail.push(msg); };

const token = await seededMemberToken();
const ask = (path, init) =>
  fetch(API + path, {
    headers: { Cookie: `access_token=${token}`, "Content-Type": "application/json" },
    ...init,
  }).then((r) => r.json());

const circles = await ask("/community/circles");
const circle = circles.find((c) => c.is_savings);
say(!!circle, `a savings circle exists (${circle?.name} — ${circle ? `₹${circle.monthly_minor / 100}/month` : "none"})`);
if (!circle) { finish(fail, lines, "Paying into a circle"); process.exit(0); }

const before = await ask(`/community/circles/${circle.id}/savings`);
say(before.round >= 1, `it is in a round counted from its start date (round ${before.round})`);
say(before.members.length > 0 && before.members.every((m) => m.name && m.name !== "A member"),
    `the members are real people from the database (${before.members.length})`);

// She must be unpaid for the press to prove anything. Her wallet must also
// hold enough — this is real money leaving a real balance.
const wallet = await ask("/wallet");
if (before.you_paid) {
  say(true, "she has already paid this round — the screen must not offer to charge her again");
} else if (wallet.balance_minor < before.monthly_minor) {
  say(false, `she cannot afford this round (₹${wallet.balance_minor / 100} of ₹${before.monthly_minor / 100}) — top up the seed`);
}

const browser = await launch();
const page = await pageAs(browser, token, { width: 1500, height: 950 });
await page.goto(`${APP}/app/circles/${circle.id}/pay`, { waitUntil: "domcontentloaded", timeout: 180000 });
await wait(5000);
const text = () => page.evaluate(() => document.getElementById("ux-scroll")?.innerText ?? "");
const screen = await text();

if (before.you_paid) {
  say(screen.includes("paid in") && !/Pay ₹/.test(screen),
      "coming back after paying does not offer to pay again");
} else {
  const rupees = `₹${(before.monthly_minor / 100).toLocaleString("en-IN")}`;
  say(screen.includes(rupees), `the share on screen is the server's figure (${rupees})`);
  say(!/Pay ₹0\b/.test(screen), "and it is not ₹0 — the amount reaches the screen");
  say(before.members.slice(0, 2).every((m) => screen.includes(m.name.split(" ")[0])),
      "the women waiting are named from the database, not invented");

  const pressed = await page.$$eval("#ux-scroll button", (bs) => {
    const b = bs.find((x) => /^Pay ₹/.test(x.innerText.trim()));
    if (b) b.click();
    return !!b;
  });
  say(pressed, "the Pay button is there");
  await wait(5500);

  const after = await ask(`/community/circles/${circle.id}/savings`);
  say(after.you_paid, `THE SERVER TOOK THE PAYMENT (paid ${before.members_paid} → ${after.members_paid})`);

  const walletAfter = await ask("/wallet");
  say(walletAfter.balance_minor === wallet.balance_minor - before.monthly_minor,
      `and it came out of her balance (₹${wallet.balance_minor / 100} → ₹${walletAfter.balance_minor / 100})`);

  const entry = walletAfter.transactions.find((t) => (t.label ?? "").includes(circle.name));
  say(!!entry && entry.kind === "debit", `the ledger names the circle and the round ("${entry?.label ?? "missing"}")`);
}

/* ── Paying twice for one round is impossible ──────────────────────────── */
{
  const again = await ask(`/community/circles/${circle.id}/contribute`, { method: "POST" });
  say(!!again?.error, `a second payment for the same round is refused ("${again?.error?.message ?? "IT WENT THROUGH"}")`);
}

/* ── A circle that does not collect money offers no button ─────────────── */
{
  const plain = circles.find((c) => !c.is_savings);
  if (plain) {
    const p2 = await pageAs(browser, token, { width: 1500, height: 950 });
    await p2.goto(`${APP}/app/circles/${plain.id}/pay`, { waitUntil: "domcontentloaded", timeout: 180000 });
    await wait(4000);
    const t = await p2.evaluate(() => document.getElementById("ux-scroll")?.innerText ?? "");
    say(t.includes("Nothing to pay here") && !/Pay ₹/.test(t),
        "a circle that does not collect money says so, and shows no Pay button");
    await p2.close();
  }
}

await browser.close();
finish(fail, lines, "Paying into a savings circle moves real money, once");
