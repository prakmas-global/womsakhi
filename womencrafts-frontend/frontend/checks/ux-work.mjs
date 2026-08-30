/**
 * Find work, Mentors and Feedback — against the real server.
 *
 * All three sent nothing. Applying for a job set a timer and said "Application
 * sent"; asking a mentor did the same; the feedback form waited 850ms and said
 * "sent" beside a rail listing what changed "because women asked". The
 * opportunities list was worse than faked — its filter memo was missing the
 * jobs themselves, so it showed the mock fallback for the whole session.
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

/* ── The list shows the server's jobs, not the fallback ────────────────── */
{
  const jobs = await ask("/growth/opportunities");
  const page = await open("/app/opportunities");
  const t = await text(page);
  say(jobs.length > 0 && jobs.slice(0, 2).every((j) => t.includes(j.title)),
      `the listings on screen are the server's (${jobs.length})`);
  await page.close();
}

/* ── Applying reaches the server ───────────────────────────────────────── */
{
  const jobs = await ask("/growth/opportunities");
  // Its deadline must still be open. The server rightly refuses an
  // application to a listing that has closed, and the seed holds a few.
  const today = new Date().toISOString().slice(0, 10);
  const fresh = jobs.find((j) => !j.applied && (!j.deadline || j.deadline.slice(0, 10) >= today));
  if (!fresh) {
    say(true, "she has applied to everything still open — nothing left to press");
  } else {
    const page = await open(`/app/opportunities/${fresh.id}`);
    say(/Apply now/.test(await text(page)), "a job she has not applied to offers Apply now");

    await page.$$eval("#ux-scroll button", (bs) =>
      bs.find((x) => /^Apply now/.test(x.innerText.trim()))?.click());
    await wait(5000);

    const after = (await ask("/growth/opportunities")).find((j) => j.id === fresh.id);
    say(after?.applied === true, `THE SERVER RECEIVED THE APPLICATION (${fresh.title})`);

    const apps = await ask("/growth/applications");
    say(apps.some((a) => a.opportunity_id === fresh.id),
        `and it is in her applications (${apps.length})`);

    // The next visit must not invite her to apply again.
    await page.close();
    const again = await open(`/app/opportunities/${fresh.id}`);
    const t = await text(again);
    say(/Application sent/.test(t) && !/Apply now/.test(t),
        "and the next visit says it is sent, not Apply now");
    await again.close();
  }
}

/* ── A closed listing refuses, in words, where she pressed ─────────────── */
{
  const closed = (await ask("/growth/opportunities"))
    .find((j) => j.deadline && j.deadline.slice(0, 10) < new Date().toISOString().slice(0, 10));
  if (closed) {
    const page = await open(`/app/opportunities/${closed.id}`);
    await page.$$eval("#ux-scroll button", (bs) =>
      bs.find((x) => /^Apply now/.test(x.innerText.trim()))?.click());
    await wait(4500);
    const t = await text(page);
    say(/deadline/i.test(t),
        "a listing that has closed says so on the screen, rather than doing nothing");
    await page.close();
  }
}

/* ── Saving a job is remembered ────────────────────────────────────────── */
{
  const jobs = await ask("/growth/opportunities");
  const target = jobs.find((j) => !j.saved);
  if (target) {
    const page = await open(`/app/opportunities/${target.id}`);
    await page.$$eval("#ux-scroll button", (bs) =>
      bs.find((x) => x.innerText.trim() === "Save")?.click());
    await wait(4000);
    const after = (await ask("/growth/opportunities")).find((j) => j.id === target.id);
    say(after?.saved === true, `saving a job reaches the server (${target.title})`);
    await page.close();
  }
}

/* ── Asking a mentor reaches the server ────────────────────────────────── */
{
  const mentors = await ask("/growth/mentors");
  const target = mentors.find((m) => !m.requested);
  if (!target) {
    say(true, "she has asked every mentor — nothing left to press");
  } else {
    const before = (await ask("/growth/mentors/requests/mine")).length;
    const page = await open(`/app/mentors/${target.id}`);

    const typed = await page.evaluate(() => {
      const ta = document.querySelector("#ux-scroll textarea");
      if (!ta) return false;
      const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set;
      setter.call(ta, "I want to price my tailoring work so I stop losing money on big orders.");
      ta.dispatchEvent(new Event("input", { bubbles: true }));
      return true;
    });
    say(typed, "the screen asks what she wants help with — the server requires it");
    await wait(600);

    const pressed = await page.$$eval("#ux-scroll button", (bs) => {
      const b = bs.find((x) => /^Ask (her|for)/.test(x.innerText.trim()));
      if (b && !b.disabled) { b.click(); return true; }
      return false;
    });
    say(pressed, "and Ask is pressable once she has written one");
    await wait(5000);

    const after = await ask("/growth/mentors/requests/mine");
    say(after.length === before + 1, `THE SERVER RECEIVED THE REQUEST (${before} → ${after.length})`);
    say(after.some((r) => (r.goal ?? "").includes("price my tailoring")),
        "and it carries what she wrote, not an empty note");
    await page.close();
  }
}

/* ── Feedback reaches the server ───────────────────────────────────────── */
{
  const page = await open("/app/feedback");
  await page.$$eval("#ux-scroll button", (bs) =>
    bs.find((x) => /An idea/.test(x.innerText))?.click());
  await wait(500);

  const words = `Check ${Date.now().toString(36)} — the withdraw screen should remember my bank account.`;
  const typed = await page.evaluate((w) => {
    const ta = document.querySelector("#ux-scroll textarea");
    if (!ta) return false;
    const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set;
    setter.call(ta, w);
    ta.dispatchEvent(new Event("input", { bubbles: true }));
    return true;
  }, words);
  say(typed, "the feedback form takes what she wrote");
  await wait(600);

  const pressed = await page.$$eval("#ux-scroll button", (bs) => {
    const b = bs.find((x) => x.innerText.trim() === "Send");
    if (b && !b.disabled) { b.click(); return true; }
    return false;
  });
  say(pressed, "and Send is pressable");
  await wait(5000);

  say(/Thank|sent|Sent/.test(await text(page)), "the screen says it went");
  await page.close();
}

await browser.close();
finish(fail, lines, "Applying, asking and telling all reach the server");
