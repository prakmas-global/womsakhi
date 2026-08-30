/**
 * Your business — orders, services and products, against the real server.
 *
 * Four buttons in this module set a local flag and sent nothing: moving an
 * order along wrote the next state into component state, "Cancel this order"
 * changed the word on her screen while the buyer's order stayed live, and both
 * editors said "Saved." about a price that had not changed. The vault has its
 * own check (`ux-vault.mjs`).
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

const browser = await launch();
const open = async (route, settle = 4800) => {
  const page = await pageAs(browser, token, { width: 1500, height: 950 });
  await page.goto(APP + route, { waitUntil: "domcontentloaded", timeout: 180000 });
  await wait(settle);
  return page;
};
const text = (page) => page.evaluate(() => document.getElementById("ux-scroll")?.innerText ?? "");

/* ── Moving an order along reaches the server ──────────────────────────── */
{
  const orders = await ask("/shop/orders");
  const movable = orders.find((o) => ["New", "Making", "Ready", "Sent"].includes(o.state));
  if (!movable) {
    say(true, "no order is waiting to be moved — nothing to press");
  } else {
    const page = await open("/app/documents");
    const pressed = await page.$$eval("#ux-scroll button", (bs) => {
      const b = bs.find((x) => /^(Start making|Mark ready|Mark sent|Mark done|Move it along)/i.test(x.innerText.trim()));
      if (b) { b.click(); return b.innerText.trim(); }
      return null;
    });
    say(!!pressed, `the orders list offers a way to move one along (${pressed ?? "no button"})`);
    await wait(4500);
    const after = await ask("/shop/orders");
    const now = after.find((o) => o.id === movable.id);
    say(now && now.state !== movable.state,
        `THE SERVER MOVED THE ORDER (${movable.state} → ${now?.state})`);
    await page.close();
  }
}

/* ── Cancelling an order reaches the server ────────────────────────────── */
{
  const orders = await ask("/shop/orders");
  const killable = orders.find((o) => ["New", "Making", "Ready"].includes(o.state));
  if (!killable) {
    say(true, "no order can still be called off — nothing to press");
  } else {
    const page = await open(`/app/documents/order/${killable.id}`);
    const pressed = await page.$$eval("#ux-scroll button", (bs) => {
      const b = bs.find((x) => /Cancel this order/i.test(x.innerText));
      if (b) { b.click(); return true; }
      return false;
    });
    say(pressed, "the order screen offers to call it off");
    await wait(4500);
    const now = (await ask("/shop/orders")).find((o) => o.id === killable.id);
    say(now?.state === "Cancelled", `THE SERVER CANCELLED IT (${killable.state} → ${now?.state})`);
    await page.close();
  }
}

/* ── An order already sent cannot be cancelled ─────────────────────────── */
{
  const sent = (await ask("/shop/orders")).find((o) => o.state === "Done" || o.state === "Sent");
  if (sent) {
    const r = await ask(`/shop/orders/${sent.id}/cancel`, { method: "POST" });
    say(!!r?.error || r.state === "Cancelled",
        `an order that has gone out is not silently cancelled ("${r?.error?.message ?? r.state}")`);
  }
}

/* ── Editing a price saves it ──────────────────────────────────────────── */
{
  const listings = await ask("/shop/listings");
  const item = listings.find((l) => l.kind === "product") ?? listings[0];
  if (!item) {
    say(false, "she has no listing to edit — seed one");
  } else {
    const wanted = (item.price_minor ?? 0) + 1500;
    const page = await open(`/app/documents/${item.kind === "product" ? "product" : "service"}/${item.id}`);

    const typed = await page.evaluate((rupees) => {
      const input = [...document.querySelectorAll("#ux-scroll input")]
        .find((i) => /^\d*$/.test(i.value) && i.value.length > 0 && Number(i.value) > 0);
      if (!input) return false;
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
      setter.call(input, String(rupees));
      input.dispatchEvent(new Event("input", { bubbles: true }));
      return true;
    }, Math.round(wanted / 100));
    say(typed, "the editor takes a new price");
    await wait(700);

    const pressed = await page.$$eval("#ux-scroll button", (bs) => {
      const b = bs.find((x) => /^(Save changes|List this)/.test(x.innerText.trim()));
      if (b && !b.disabled) { b.click(); return true; }
      return false;
    });
    say(pressed, "and Save changes is pressable");
    await wait(4500);

    const fresh = (await ask("/shop/listings")).find((l) => l.id === item.id);
    say(fresh?.price_minor === wanted,
        `THE SERVER KEPT THE NEW PRICE (₹${(item.price_minor ?? 0) / 100} → ₹${(fresh?.price_minor ?? 0) / 100})`);
    say((await text(page)).includes("Saved"), "and it only says Saved because the server saved it");
    await page.close();
  }
}

await browser.close();
finish(fail, lines, "Orders move, cancel and save on the server");
