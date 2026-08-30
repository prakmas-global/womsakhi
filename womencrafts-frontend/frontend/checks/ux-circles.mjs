/**
 * Circles — the list, one circle, and starting one.
 *
 * The pay screen has its own check (`ux-circles-pay.mjs`). This one covers the
 * rest of the module, and exists because every screen in it showed the same
 * eleven invented women: `CIRCLE_MEMBERS` was a hardcoded list, and the line
 * "Sunita Devi takes the pot" was printed on every savings circle in the app,
 * whoever was actually next.
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

const circles = await ask("/community/circles");
const saver = circles.find((c) => c.is_savings);
say(!!saver, `the server marks savings circles explicitly (${saver?.name ?? "none"})`);

/* ── One circle: its members are the real ones ─────────────────────────── */
{
  const state = await ask(`/community/circles/${saver.id}/savings`);
  const page = await open(`/app/circles/${saver.id}`);
  const t = await text(page);

  say(state.members.slice(0, 3).every((m) => t.includes(m.name.split(" ")[0])),
      `the members shown are the circle's own (${state.members.length})`);
  say(!t.includes("Sunita Devi") || state.whose_turn === "Sunita Devi",
      "nobody is named as taking the pot unless the server says so");
  say(state.whose_turn ? t.includes(state.whose_turn) : true,
      `whose turn it is comes from the agreed order (${state.whose_turn || "none agreed"})`);
  say(t.includes(`${state.members_paid} of ${state.members_total}`),
      `and how many have paid is the server's count (${state.members_paid} of ${state.members_total})`);
  await page.close();
}

/* ── The list adds up to what the server holds ─────────────────────────── */
{
  const page = await open("/app/circles");
  const t = await text(page);
  const mine = circles.filter((c) => c.joined);
  say(t.includes(`${mine.length}`), `the count of circles she is in is the server's (${mine.length})`);
  const savingsMine = mine.filter((c) => c.is_savings);
  const monthly = savingsMine.reduce((a, c) => a + c.monthly_minor, 0);
  say(monthly === 0 || t.includes(`₹${(monthly / 100).toLocaleString("en-IN")}`),
      `what she has committed every month is summed from her circles (₹${monthly / 100})`);
  await page.close();
}

/* ── Starting a circle actually makes one ──────────────────────────────── */
{
  const before = (await ask("/community/circles")).length;
  const page = await open("/app/circles/new");

  // Step 1: pick a kind. Step 2: name it. Then create.
  await page.$$eval("#ux-scroll button", (bs) => {
    const b = bs.find((x) => /savings circle/i.test(x.innerText));
    if (b) b.click();
  });
  await wait(500);
  await page.$$eval("#ux-scroll button", (bs) => bs.find((x) => x.innerText.trim() === "Next")?.click());
  await wait(900);

  const name = `Check Circle ${before}`;
  const typed = await page.evaluate((n) => {
    const input = [...document.querySelectorAll("#ux-scroll input")]
      .find((i) => /name/i.test(i.getAttribute("placeholder") ?? "") || i.type === "text");
    if (!input) return false;
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    setter.call(input, n);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    return true;
  }, name);
  say(typed, "the form takes a name");
  await wait(600);

  const pressed = await page.$$eval("#ux-scroll button", (bs) => {
    const b = bs.find((x) => x.innerText.trim() === "Create the circle");
    if (b && !b.disabled) { b.click(); return true; }
    return false;
  });
  say(pressed, "Create the circle is pressable once it has a name");
  await wait(5000);

  const after = await ask("/community/circles");
  const made = after.find((c) => c.name === name);
  say(!!made, `THE SERVER MADE THE CIRCLE (${before} → ${after.length})`);
  if (made) {
    say(made.joined && made.is_savings, "she is in it, and it is marked as a savings circle");
    const st = await ask(`/community/circles/${made.id}/savings`);
    say(st.members_total === 1 && st.members[0].you,
        "she is its first member, without having to join her own circle");
    say((await text(page)).includes(name), "and the screen names the circle the server made");
  }
  await page.close();
}

/* ── Joining a circle reaches the server ───────────────────────────────── */
{
  const all = await ask("/community/circles");
  const notMine = all.find((c) => !c.joined);
  if (!notMine) {
    say(true, "she is already in every circle — nothing to join");
  } else {
    const page = await open(`/app/circles/${notMine.id}`);
    const t = await text(page);
    say(/Join this circle/.test(t),
        "a circle she is not in offers to join, not to leave");

    await page.$$eval("#ux-scroll button", (bs) =>
      bs.find((x) => /Join this circle/.test(x.innerText))?.click());
    await wait(4500);

    const after = (await ask("/community/circles")).find((c) => c.id === notMine.id);
    say(after?.joined === true, `THE SERVER PUT HER IN THE CIRCLE (${notMine.name})`);
    await page.close();

    // And on the next visit it must remember, rather than inviting her again.
    const again = await open(`/app/circles/${notMine.id}`);
    say(/Joined/.test(await text(again)) , "and the next visit says Joined, not Join");
    await again.close();
  }
}

await browser.close();
finish(fail, lines, "Circles show their own members, and starting one makes one");
