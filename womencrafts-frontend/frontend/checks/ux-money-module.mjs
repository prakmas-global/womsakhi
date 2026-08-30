/**
 * The Money module, pressed rather than read.
 *
 * `ux-money.mjs` checks that the screens render and the figures agree with each
 * other. This checks something different and, it turns out, more important:
 * that pressing a button changes something the **server** knows about.
 *
 * It exists because of one bug. `/bookings` → "Yes, cancel" set a local flag
 * and never called the endpoint that had been sitting there the whole time.
 * The screen agreed with her, the world did not, and on the day it counted as
 * a no-show — a mentor held an hour for a woman who thought she had said no.
 *
 * Nothing about the rendered page would have caught that. Only pressing the
 * button and then asking the server does.
 */
import { API, launch, pageAs, seededMemberToken, seedCancellableBooking } from "./_shared.mjs";
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

const browser = await launch();
const open = async (route, settle = 4500) => {
  const page = await pageAs(browser, token, { width: 1500, height: 950 });
  await page.goto(APP + route, { waitUntil: "domcontentloaded", timeout: 180000 });
  await wait(settle);
  return page;
};
const press = (page, label) =>
  page.$$eval("#ux-scroll button, #ux-scroll a", (els, want) => {
    const el = els.find((x) => x.innerText.trim() === want || x.innerText.trim().startsWith(want));
    if (el) el.click();
    return !!el;
  }, label);

/* ── Cancelling reaches the server ─────────────────────────────────────── */
{
  // Its own booking to cancel. Without this the check passes once and then
  // fails for ever after, having spent the last cancellable one in the seed.
  await seedCancellableBooking(token);
  const before = (await ask("/me/bookings")).filter((b) => b.status === "cancelled").length;
  const page = await open("/app/bookings");
  say(await press(page, "Cancel"), "the bookings list offers Cancel");
  await wait(700);
  say(await press(page, "Yes, cancel"), "and confirms before it acts");
  await wait(3500);
  const after = (await ask("/me/bookings")).filter((b) => b.status === "cancelled").length;
  // The one assertion this whole file exists for.
  say(after > before, `THE SERVER HEARD THE CANCELLATION (${before} → ${after})`);
  await page.close();
}

/* ── Goals persist, and count themselves ──────────────────────────────── */
{
  const page = await open("/app/progress/goals");
  const text = await page.evaluate(() => document.getElementById("ux-scroll")?.innerText || "");
  const goals = await ask("/me/goals");
  say(goals.length > 0, `she has goals on the server (${goals.length})`);
  say(goals.every((g) => text.includes(g.label)), "and every one of them is on the screen");

  const counted = goals.find((g) => g.manual);
  if (counted) {
    say(await press(page, "One more"), "a counted goal can be moved");
    await wait(3000);
    const now = (await ask("/me/goals")).find((g) => g.id === counted.id);
    say(now.current === counted.current + 1,
        `and the server kept it (${counted.current} → ${now.current})`);
  }
  const money = goals.find((g) => g.kind === "money");
  if (money) {
    // A money goal that could be nudged by hand is a money goal that can be
    // made to say anything.
    say(!money.manual, "a money goal is not moved by hand — it reads the ledger");
    const refused = await ask(`/me/goals/${money.id}`, {
      method: "PATCH", body: JSON.stringify({ current: 9_999_999 }),
    });
    say(!!refused?.error, `and the server refuses to let it be ("${refused?.error?.message ?? ""}")`);
  }
  await page.close();
}

/* ── Withdrawing is guarded on the server, not the screen ─────────────── */
{
  const wallet = await ask("/wallet");
  const over = await ask("/me/payout/withdraw", {
    method: "POST", body: JSON.stringify({ amount_minor: wallet.balance_minor + 100_000 }),
  });
  say(!!over?.error, "overdrawing is refused");
  say(/available/.test(over?.error?.message ?? ""),
      `and the refusal names her own figure ("${(over?.error?.message ?? "").slice(0, 52)}")`);

  const tooSmall = await ask("/me/payout/withdraw", {
    method: "POST", body: JSON.stringify({ amount_minor: 500 }),
  });
  say(/smallest/.test(tooSmall?.error?.message ?? ""), "and so is a withdrawal below the floor");
}

/* ── One request for the Earn screen ──────────────────────────────────── */
{
  const page = await pageAs(browser, token, { width: 1500, height: 950 });
  const calls = [];
  page.on("response", (r) => {
    const u = r.url();
    if (u.includes("/api/v1/") && !/auth|layout|theme|unread/.test(u)) calls.push(u.split("/api/v1")[1].split("?")[0]);
  });
  await page.goto(APP + "/app/wallet", { waitUntil: "domcontentloaded", timeout: 180000 });
  await wait(5000);
  say(calls.includes("/money/overview"), "Earn opens with the combined request");
  // It used to make four. Two is the overview plus the twelve-month chart,
  // which is deliberately separate because it sits below the fold.
  say(calls.length <= 3, `and not one per card (${calls.length}: ${calls.join(", ")})`);
  await page.close();
}

/* ── Marking a scheme applied-for survives a reload ────────────────────── */
{
  const schemes = await ask("/schemes");
  const first = schemes[0];
  await ask(`/reference/${first.id}/mark`, {
    method: "POST", body: JSON.stringify({ state: "applied", note: "" }),
  });
  const again = (await ask("/schemes")).find((s) => s.id === first.id);
  say(again?.mine?.state === "applied",
      "a scheme she marked as applied for is still marked on the next visit");
}

/* ── The statement is a real month ────────────────────────────────────── */
{
  const page = await open("/app/wallet/statement");
  const text = await page.evaluate(() => document.getElementById("ux-scroll")?.innerText || "");
  // It used to say "May 2026" whatever the ledger held, on a document a bank
  // is asked to accept.
  const wallet = await ask("/wallet");
  const months = new Set(
    wallet.transactions
      .map((t) => new Date(t.when))
      .filter((d) => !Number.isNaN(d.getTime()))
      .map((d) => d.toLocaleDateString("en-IN", { month: "long", year: "numeric" })),
  );
  say(months.size === 0 || [...months].some((m) => text.includes(m)),
      `the month tabs come from the ledger (${[...months].slice(0, 3).join(", ") || "no entries"})`);
  await page.close();
}

await browser.close();
finish(fail, lines, "every button in Money changes something the server knows about");
