/**
 * Explore, Messages, Help and What you need — against the real server.
 *
 * Messages held four invented conversations, including a buyer called Anjali
 * Mehta asking for two inches at the back of a kurta nobody ordered; typing a
 * reply appended it to a local array. `/intake` said above its button that
 * "everything on your home screen is chosen from what you say here", and sent
 * nothing. Help's topic tiles advertised 41 answers against eight.
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
const open = async (route, settle = 5000) => {
  const page = await pageAs(browser, token, { width: 1500, height: 950 });
  await page.goto(APP + route, { waitUntil: "domcontentloaded", timeout: 180000 });
  await wait(settle);
  return page;
};
const text = (page) => page.evaluate(() => document.getElementById("ux-scroll")?.innerText ?? "");

/* ── Nothing invented on any of them ───────────────────────────────────── */
{
  const INVENTED = ["Anjali Mehta", "Neha Verma", "Jaipur Savings Circle", "Craft Mela — Jaipur"];
  for (const route of ["/app/messages", "/app/intake"]) {
    const page = await open(route);
    const t = await text(page);
    const found = INVENTED.filter((bad) => t.includes(bad));
    say(found.length === 0, `${route} invents nothing${found.length ? ` — ${found.join(", ")}` : ""}`);
    await page.close();
  }
}

/* ── A message reaches the server ──────────────────────────────────────── */
{
  const before = (await ask("/me/messages")).length;
  const page = await open("/app/messages");
  const words = `Check ${Date.now().toString(36)} — can you look at my withdrawal?`;
  const typed = await page.evaluate((w) => {
    const input = document.querySelector('#ux-scroll input[aria-label="Write a reply"]');
    if (!input) return false;
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set.call(input, w);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    return true;
  }, words);
  say(typed, "the reply box takes what she wrote");
  await wait(500);

  await page.$$eval('#ux-scroll button[aria-label="Send"]', (bs) => bs[0]?.click());
  await wait(4500);

  const after = await ask("/me/messages");
  say(after.length === before + 1, `THE SERVER RECEIVED THE MESSAGE (${before} → ${after.length})`);
  say(after.some((m) => m.body === words), "and it carries her words, not a placeholder");
  say((await text(page)).includes(words), "and the thread shows it because the server has it");
  await page.close();
}

/* ── What she needs reaches the server, and the answer comes back ──────── */
{
  const needs = await ask("/me/intake/needs");
  const page = await open("/app/intake");
  const t = await text(page);
  say(needs.length > 0 && needs.slice(0, 2).every((n) => t.includes(n.label)),
      `the needs offered are the server's (${needs.length})`);

  await page.$$eval("#ux-scroll button", (bs, want) => {
    const b = bs.find((x) => x.innerText.includes(want));
    if (b) b.click();
  }, needs[0].label);
  await wait(500);

  const pressed = await page.$$eval("#ux-scroll button", (bs) => {
    const b = bs.find((x) => /Show me what to do/.test(x.innerText));
    if (b && !b.disabled) { b.click(); return true; }
    return false;
  });
  say(pressed, "and the button is pressable once she has picked one");
  await wait(5000);

  const t2 = await text(page);
  say(/Start with these|Nothing matches/.test(t2), "THE SERVER ANSWERED with what to do next");
  await page.close();
}

/* ── Help counts its answers ───────────────────────────────────────────── */
{
  const page = await open("/app/help");
  const t = await text(page);
  const claimed = [...t.matchAll(/(\d+) answers?/g)].map((m) => Number(m[1]));
  const total = claimed.reduce((a, b) => a + b, 0);
  const shownAnswers = (t.match(/\?/g) ?? []).length;
  say(total > 0 && total <= shownAnswers + 2,
      `the topic tiles count the answers that exist (${total} claimed)`);
  await page.close();
}

/* ── Discover's detail links land somewhere real ───────────────────────── */
{
  const programs = await ask("/catalog/programs");
  const list = Array.isArray(programs) ? programs : programs.items ?? [];
  if (list.length) {
    const page = await pageAs(browser, token, { width: 1500, height: 950 });
    await page.goto(`${APP}/app/explore/program/${list[0].id}`, { waitUntil: "domcontentloaded", timeout: 180000 });
    // Wait for the address to change rather than sleeping at it — a fixed
    // pause raced the redirect and failed about half the time.
    let landed = page.url();
    for (let i = 0; i < 20 && !landed.includes("/app/programs/"); i++) {
      await wait(400);
      landed = page.url();
    }
    say(landed.includes("/app/programs/"),
        `an old Discover course link forwards to the real course page (${landed.split("/app")[1] ?? landed})`);
    await page.close();
  }
}

await browser.close();
finish(fail, lines, "Discover, Messages, Help and Intake reach the server");
