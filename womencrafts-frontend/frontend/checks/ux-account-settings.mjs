/**
 * Settings, her journey, verification and her diary — against the real server.
 *
 * Phase 10's screens did not merely fail to save; most of them showed a life
 * that was not hers. Her journey said she had earned ₹1,48,500 and brought in
 * three women named Meera, Sunita and Farah. Account settings showed a phone
 * number, "Jaipur, Rajasthan" and a date of birth as her own — she is in
 * Mumbai. Her diary held five entries in May, including a mentor session with
 * somebody called Neha. And the security screen listed "An unknown phone ·
 * Safari on iPhone · Delhi · 3 weeks ago" as a device signed into her account.
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
const open = async (route, settle = 5200) => {
  const page = await pageAs(browser, token, { width: 1500, height: 950 });
  await page.goto(APP + route, { waitUntil: "domcontentloaded", timeout: 180000 });
  await wait(settle);
  return page;
};
const text = (page) => page.evaluate(() => document.getElementById("ux-scroll")?.innerText ?? "");

/* ── Nothing on these screens is somebody else's life ──────────────────── */
{
  const INVENTED = [
    "1,48,500", "Meera", "Farah", "Priya's Handloom", "Jaipur, Rajasthan",
    "An unknown phone", "Safari on iPhone", "Mentor Session with Neha",
    "Community Hall, Sector 12", "March 2025",
  ];
  for (const route of ["/app/progress", "/app/settings/account", "/app/settings/security", "/app/schedule"]) {
    const page = await open(route);
    const t = await text(page);
    const found = INVENTED.filter((bad) => t.includes(bad));
    say(found.length === 0, `${route} invents nothing${found.length ? ` — found ${found.join(", ")}` : ""}`);
    await page.close();
  }
}

/* ── Her journey adds up to what the server holds ──────────────────────── */
{
  const [insights, progress] = await Promise.all([ask("/wallet/insights"), ask("/me/progress")]);
  const lifetime = insights.monthly_minor.reduce((a, b) => a + b, 0);
  const page = await open("/app/progress");
  const t = await text(page);
  say(t.includes(`₹${Math.round(lifetime / 100).toLocaleString("en-IN")}`),
      `what she has earned is the ledger's figure (₹${Math.round(lifetime / 100)})`);
  say(t.includes(progress.member_since), `and she joined when the server says (${progress.member_since})`);
  say(t.includes(`${progress.programs_completed} finished`),
      `courses finished is counted, not claimed (${progress.programs_completed})`);
  await page.close();
}

/* ── Account settings show her details, and saving keeps them ──────────── */
{
  const before = await ask("/me/profile");
  const page = await open("/app/settings/account");
  const shown = await page.$$eval("#ux-scroll input", (els) => els.map((e) => e.value));
  say(shown.includes(before.full_name), `her own name is in the form (${before.full_name})`);
  say(!before.location || shown.includes(before.location),
      `and her own place (${before.location || "not set"})`);

  /*
   * The "A line about you" field, found through the `<label>` that wraps it.
   *
   * The first version of this walked the DOM for any node containing the label
   * text and then guessed at a parent. It matched the wrong element twice and
   * typed the test sentence into her NAME and her DATE OF BIRTH, on the live
   * seed. A check that writes to a profile has to be exact about which box it
   * is typing in, and put back whatever it changed.
   */
  const bio = `Check ${Date.now().toString(36)} — I sew and I am learning to sell online.`;
  const typed = await page.evaluate((v) => {
    const label = [...document.querySelectorAll("#ux-scroll label")]
      .find((l) => (l.querySelector("span")?.textContent ?? "").trim() === "A line about you");
    const input = label?.querySelector("input");
    if (!input) return false;
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set.call(input, v);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    return true;
  }, bio);
  say(typed, "the form takes a change to the line about her");
  await wait(500);

  await page.$$eval("#ux-scroll button", (bs) =>
    bs.find((x) => /Save changes/.test(x.innerText))?.click());
  await wait(4500);

  const after = await ask("/me/profile");
  say(after.bio === bio, `THE SERVER KEPT THE CHANGE ("${(after.bio || "nothing saved").slice(0, 40)}…")`);
  say(after.full_name === before.full_name && after.location === before.location
      && after.dob === before.dob,
      "and saving one field did not overwrite the others");

  // Put it back. This check writes to a real profile, and leaving test text in
  // the line an employer reads first is not a tidy place to stop.
  await ask("/me/profile", {
    method: "PATCH",
    body: JSON.stringify({ bio: before.bio ?? "" }),
  });
  await page.close();
}

/* ── Notification switches are hers, and persist ───────────────────────── */
{
  const before = await ask("/me/settings/notifications");
  const page = await open("/app/settings/notifications");
  const flipped = await page.$$eval("#ux-scroll button[role=switch], #ux-scroll input[type=checkbox]", (els) => {
    if (!els.length) return false;
    els[0].click();
    return true;
  });
  say(flipped, "the switches are pressable");
  await wait(500);
  await page.$$eval("#ux-scroll button", (bs) =>
    bs.find((x) => /Save changes/.test(x.innerText))?.click());
  await wait(4500);
  const after = await ask("/me/settings/notifications");
  say(JSON.stringify(after) !== JSON.stringify(before),
      "THE SERVER KEPT THE SWITCHES");
  say("money" in after && "orders" in after && "circles" in after,
      "and it carries all of them, not five of eight");
  await page.close();
}

/* ── Her diary is what she has actually agreed to ──────────────────────── */
{
  const bookings = await ask("/me/bookings");
  const live = bookings.filter((b) => b.status !== "cancelled");
  const page = await open("/app/schedule");
  const t = await text(page);
  say(live.length === 0 || live.slice(0, 2).some((b) => t.includes(b.service_name)),
      `the diary lists her own bookings (${live.length} live)`);
  say(!/Cancelled/.test(await page.$$eval("#ux-scroll button", (bs) => bs.map((b) => b.innerText).join(" "))),
      "and there is no permanently-empty Cancelled tab");
  await page.close();
}

/* ── Verification shows where she really is ────────────────────────────── */
{
  const status = await ask("/verification/status");
  const page = await open("/app/verify");
  const t = await text(page);
  say(status.status !== "active" || !/Confirm your email/.test(t),
      `a verified woman is not asked to confirm her email again (${status.status})`);
  await page.close();
}

await browser.close();
finish(fail, lines, "Settings, journey, verification and diary are hers");
