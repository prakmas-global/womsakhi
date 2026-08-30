/**
 * Checkout, against the real server.
 *
 * It exists because of one screen. `/checkout/[orderId]` held two hardcoded
 * orders, rendered one of them whatever the id in the address bar said, and
 * its Pay button waited 1.1 seconds before announcing "Paid" without ever
 * calling the server. Every assertion here asks the API what it thinks
 * happened, never the screen.
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
const text = (page) => page.evaluate(() => document.getElementById("ux-scroll")?.innerText ?? "");

/* ── A real, unpaid order, so the check can be re-run ──────────────────── */
// A booking of its own, because paying for one is a thing you can only do
// once: re-using a previous run's booking gets "You've already paid for this."
// `paid: true` — the first service in the catalogue is free, and the server
// rightly refuses to raise an order for something that costs nothing.
const ref = await seedCancellableBooking(token, { paid: true });
const started = await ask("/payments/orders", {
  method: "POST",
  body: JSON.stringify({ purpose: "booking", reference_id: ref.id }),
});
const order = started.order;
say(!!order?.id && order.status !== "paid", `an unpaid order exists (${order?.title} — ${order?.amount_label})`);

/* ── The screen shows that order, not a hardcoded one ──────────────────── */
const page = await open(`/app/checkout/${order.id}`);
const screen = await text(page);
say(screen.includes(order.title), `the screen shows the real order (${order.title})`);
say(screen.includes(order.amount_label.replace(".00", "")), `and its real price (${order.amount_label})`);

const methods = await page.$$eval("#ux-scroll button[aria-pressed]", (bs) => bs.map((b) => b.innerText.split("\n")[0]));
say(methods.length >= 4, `the ways to pay come from the server (${methods.length}: ${methods.join(", ")})`);

/* ── The one assertion this whole file exists for ──────────────────────── */
// "Pay ₹599", not "Pay at the centre" — one of the ways to pay also starts
// with the word Pay, and matching on the prefix pressed the wrong control.
say(await press(page, "Pay ₹"), "the Pay button is there");
await wait(5000);
const after = await ask(`/payments/orders/${order.id}`);
say(after.status === "paid", `THE SERVER TOOK THE PAYMENT (${after.status}${after.method ? `, ${after.method}` : ""})`);
say((await text(page)).includes("Paid"), "and the screen only says Paid because the server did");
await page.close();

/* ── Coming back must not offer to charge her twice ────────────────────── */
{
  const again = await open(`/app/checkout/${order.id}`);
  const back = await text(again);
  say(back.includes("Paid") && !/Pay ₹/.test(back), "coming back to a paid order does not offer to pay again");
  await again.close();
}

/* ── Somebody else's order, or none at all ─────────────────────────────── */
{
  const nope = await open("/app/checkout/000000000000000000000000");
  const t = await text(nope);
  say(t.includes("could not find") && !/Pay ₹/.test(t),
      "an order that is not hers says so, and offers no button that charges");
  await nope.close();
}

await browser.close();
finish(fail, lines, "Checkout takes real money, once, and says so honestly");
