/**
 * Safety — against the real server.
 *
 * This file exists for one assertion. The panic button filled over a second
 * and a half and then called `setSent(true)`. Nothing left the browser. A
 * woman in trouble held it, read that her contacts had been given her
 * location, and was on her own. The screen also named two trusted contacts,
 * "Sunita Devi" and "Meera Joshi", who were a constant — hers are her sister
 * and her mother.
 *
 * Nothing here trusts the screen. Every claim is checked against the API.
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

// Any alert left open by a previous run, stood down first — otherwise the
// screen opens in the "alert is out" state and there is no button to press.
{
  const centre = await ask("/safety");
  if (centre.open_alert) await ask(`/safety/alert/${centre.open_alert.id}/stand-down`, { method: "POST" });
}

const centre = await ask("/safety");
say(centre.contacts.length > 0, `she has trusted contacts on the server (${centre.contacts.length})`);
say(centre.helplines.length > 0, `and the helplines come from the server (${centre.helplines.length})`);

const browser = await launch();
const page = await pageAs(browser, token, { width: 1500, height: 950 });
// Granted so the alert does not sit waiting on a permission prompt.
await browser.defaultBrowserContext().overridePermissions(APP, ["geolocation"]);
await page.goto(`${APP}/app/safety`, { waitUntil: "domcontentloaded", timeout: 180000 });
await wait(5200);
const text = () => page.evaluate(() => document.getElementById("ux-scroll")?.innerText ?? "");

/* ── The people named are the people she named ─────────────────────────── */
{
  const t = await text();
  say(!/Sunita Devi|Meera Joshi/.test(t), "no invented contact is listed");
  say(centre.contacts.slice(0, 2).every((c) => t.includes(c.name)),
      `her own contacts are shown (${centre.contacts.map((c) => c.name).join(", ")})`);
  const nums = centre.helplines.map((h) => h.number);
  say(nums.every((n) => t.includes(n)), `and the real helpline numbers (${nums.join(", ")})`);
}

/* ── THE ONE THAT MATTERS ──────────────────────────────────────────────── */
{
  const before = (await ask("/safety")).open_alert;
  say(!before, "no alert is open before she presses");

  // Press and hold. The button needs 1.5 seconds of a held pointer.
  const box = await page.evaluate(() => {
    const b = [...document.querySelectorAll("#ux-scroll button")]
      .find((x) => /Press and hold to send an alert/.test(x.innerText));
    if (!b) return null;
    const r = b.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  });
  say(!!box, "the alert button is on the screen");

  await page.mouse.move(box.x, box.y);
  await page.mouse.down();
  await wait(2200);
  await page.mouse.up();
  await wait(5000);

  const after = (await ask("/safety")).open_alert;
  say(!!after, "THE SERVER RECEIVED THE ALERT");
  say(after && after.contacts_notified === centre.contacts.length,
      `and it reached everyone she named (${after?.contacts_notified ?? 0} of ${centre.contacts.length})`);

  const t = await text();
  say(/Our team has it/.test(t) && !/have been told where you are/.test(t),
      "the screen says what actually happened — no message is sent to anybody yet");
}

/* ── Letting go early sends nothing ────────────────────────────────────── */
{
  const open = (await ask("/safety")).open_alert;
  if (open) await ask(`/safety/alert/${open.id}/stand-down`, { method: "POST" });
  await page.reload({ waitUntil: "domcontentloaded", timeout: 180000 });
  await wait(5000);

  const box = await page.evaluate(() => {
    const b = [...document.querySelectorAll("#ux-scroll button")]
      .find((x) => /Press and hold to send an alert/.test(x.innerText));
    if (!b) return null;
    const r = b.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  });
  if (box) {
    await page.mouse.move(box.x, box.y);
    await page.mouse.down();
    await wait(400);          // let go well before it fills
    await page.mouse.up();
    await wait(3000);
    say(!(await ask("/safety")).open_alert,
        "letting go early sends nothing — it cannot fire from a pocket");
  }
}

/* ── Standing down reaches the server too ──────────────────────────────── */
{
  await page.reload({ waitUntil: "domcontentloaded", timeout: 180000 });
  await wait(4500);
  const box = await page.evaluate(() => {
    const b = [...document.querySelectorAll("#ux-scroll button")]
      .find((x) => /Press and hold to send an alert/.test(x.innerText));
    if (!b) return null;
    const r = b.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  });
  if (box) {
    await page.mouse.move(box.x, box.y);
    await page.mouse.down();
    await wait(2200);
    await page.mouse.up();
    await wait(5000);
  }
  await page.$$eval("#ux-scroll button", (bs) =>
    bs.find((x) => /Stand down/.test(x.innerText))?.click());
  await wait(4500);
  say(!(await ask("/safety")).open_alert, "standing down closes it on the server");
}

await browser.close();
finish(fail, lines, "The alert actually goes out, to the people she actually named");
