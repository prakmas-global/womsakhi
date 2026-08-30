/**
 * Phase 1 — the detail pages.
 *
 * These are what a card opens into, so the failure that matters is a dead end:
 * a course you cannot start, an event whose "Book" button would fail, a
 * checkout whose total changes at the last step. Each assertion below is one of
 * those.
 */
import { API, launch, seededMemberToken } from "./_shared.mjs";
import { APP, audit, finish, report, wait } from "./_screen.mjs";

const SCREENS = [
  ["course",        "/app/programs/dm-basics"],
  ["course-gone",   "/app/programs/nope"],
  ["lesson",        "/app/programs/dm-basics/lesson/6"],
  ["lesson-gone",   "/app/programs/dm-basics/lesson/99"],
  ["event",         "/app/events/e1"],
  ["event-full",    "/app/events/e3"],
  ["event-gone",    "/app/events/nope"],
  ["story",         "/app/stories/st1"],
  ["story-gone",    "/app/stories/nope"],
  ["booking",       "/app/bookings/bk1"],
  ["booking-gone",  "/app/bookings/nope"],
  ["checkout",      "/app/checkout/WS-24817"],
];

const fail = [];
const lines = [];
const token = await seededMemberToken();
const browser = await launch();

for (const [name, route] of SCREENS) {
  for (const mode of ["light", "dark"]) {
    const a = await audit(browser, token, { route, mode });
    report(name, mode, a, fail, lines);
    await a.page.close();
  }
}

/** Main AND the rail — the rail is a sibling of <main>, not inside it. */
const content = (page) => page.evaluate(() => {
  const sc = document.getElementById("ux-scroll");
  return sc ? sc.innerText : document.body.innerText;
});

const say = (ok, msg) => { lines.push(`  ${ok ? "ok  " : "✗   "} ${msg}`); if (!ok) fail.push(msg); };

/* -- A course you can actually start ----------------------------------- */
{
  const a = await audit(browser, token, { route: "/app/programs/dm-basics" });
  const t = await a.page.evaluate(() => document.querySelector("main").innerText);
  // Never "Enrol" when she is part-way through — name the lesson she is on.
  say(/Continue/.test(t) && !/^Enrol/m.test(t), "a started course offers Continue, not Enrol");
  say(/You stopped at lesson \d+/.test(t), "and says exactly where she stopped");

  const lessons = await a.page.$$eval('main a[href*="/lesson/"]', (as) => as.length);
  say(lessons >= 4, `lessons open from the curriculum (${lessons} linked)`);

  await a.page.$$eval('main a[href*="/lesson/"]', (as) => as[0] && as[0].click());
  await a.page.waitForFunction(() => /\/lesson\//.test(location.pathname), { timeout: 15000 }).catch(() => {});
  await wait(1200);
  say(/\/lesson\//.test(a.page.url()), `and a lesson actually opens (${a.page.url().split("/app")[1]})`);
  await a.page.close();
}

/* -- The lesson respects a cheap phone on expensive data --------------- */
{
  const a = await audit(browser, token, { route: "/app/programs/dm-basics/lesson/6" });
  const t = await a.page.evaluate(() => document.querySelector("main").innerText);
  // Reading is free, video is not — the transcript is always open.
  say(/What she says, in words/.test(t), "the transcript is on the page");
  say(/0:00/.test(t) && /\d:\d\d/.test(t), "with timestamps, so it can be followed alongside");
  const videos = await a.page.$$eval("video, iframe", (n) => n.length);
  say(videos === 0, `nothing downloads until she asks (${videos} media elements before play)`);
  say(/Done . next lesson|Next: lesson|Finish the course/.test(t),
      "finishing and starting the next are one button");
  await a.page.close();
}

/* -- A full event never offers a button that would fail ---------------- */
{
  const a = await audit(browser, token, { route: "/app/events/e3" });
  const t = await a.page.evaluate(() => document.querySelector("main").innerText);
  const buttons = await a.page.$$eval("button, a", (n) => n.map((x) => x.innerText.trim()));
  say(/All taken|Full/.test(t), "a full event says so");
  say(!buttons.some((b) => /^(Book|Join,? free)/.test(b)), "and offers no button that would fail");
  say(buttons.some((b) => /place opens/.test(b)), "it offers a waiting list instead");
  await a.page.close();
}

/* -- A story is reachable, not just admirable -------------------------- */
{
  const a = await audit(browser, token, { route: "/app/stories/st1" });
  const t = await content(a.page);
  say(/What actually worked/.test(t), "the story names the specific thing that worked");
  const cta = await a.page.$$eval('a[href^="/app"]', (as) =>
    as.filter((x) => /Do the same thing/.test(x.innerText)).map((x) => x.getAttribute("href")));
  say(cta.length === 1 && /^\/app\//.test(cta[0]), `and links straight to it (${cta[0]})`);
  await a.page.close();
}

/* -- A booking shows the number she will be asked for ------------------ */
{
  // Ask the API which booking to open rather than hard-coding `bk1`. That was
  // a mock id, and the moment this screen read the real list it opened the
  // "not listed" state and failed three assertions for the wrong reason.
  const id = await fetch(API + "/me/bookings", { headers: { Cookie: `access_token=${token}` } })
    .then((r) => (r.ok ? r.json() : []))
    .then((rows) => rows[0]?.id)
    .catch(() => null) ?? "bk1";
  const a = await audit(browser, token, { route: `/app/bookings/${id}` });
  const t = await content(a.page);
  say(/WS-B-[A-Z0-9]+/.test(t), "the reference is on the page");
  const size = await a.page.$$eval("#ux-scroll span", (n) => {
    const el = n.find((x) => /^WS-B-[A-Z0-9]+$/.test(x.innerText.trim()));
    return el ? Math.round(parseFloat(getComputedStyle(el).fontSize)) : 0;
  });
  say(size >= 20, `and large enough to read out (${size}px)`);

  await a.page.$$eval("main button", (bs) => {
    const b = bs.find((x) => /Cancel booking/.test(x.innerText));
    if (b) b.click();
  });
  await wait(600);
  const asking = await a.page.evaluate(() => document.querySelector("main").innerText);
  say(/Cancel it\?/.test(asking), "cancelling asks first");
  say(/kept this hour free|comes back in|next woman/.test(asking), "and names who it costs");
  await a.page.close();
}

/* -- The total does not change at the last step ------------------------ */
{
  const a = await audit(browser, token, { route: "/app/checkout/WS-24817" });
  const t = await content(a.page);
  const line = Number((t.match(/Course\s*\n?\s*.([\d,]+)/) || [])[1] || "0".replace(/,/g, ""));
  const totals = [...t.matchAll(/.([\d,]+\.\d{2})/g)].map((m) => Number(m[1].replace(/,/g, "")));
  say(/WomSakhi fee\s*\n?\s*None/.test(t), "the fee is stated as none, not left out");
  say(totals.length > 0 && Math.abs(totals[0] - 999) < 0.01,
      `the total matches the item exactly (${totals[0]})`);
  const btn = await a.page.$$eval("main button, aside button, button", (bs) =>
    bs.map((b) => b.innerText.trim()).find((x) => /^Pay /.test(x)));
  say(!!btn && /999/.test(btn), `and the button repeats it (${btn})`);

  // Paying is one-way — a slow connection must not become two payments.
  await a.page.$$eval("button", (bs) => {
    const b = bs.find((x) => /^Pay /.test(x.innerText.trim()));
    if (b) b.click();
  });
  await wait(150);
  await a.page.$$eval("button", (bs) => {
    const b = bs.find((x) => /^Pay |Sending/.test(x.innerText.trim()));
    if (b) b.click();
  });
  await wait(1600);
  const done = await a.page.evaluate(() => document.body.innerText);
  say(/\bPaid\b/.test(done), "paying confirms");
  say((done.match(/Paid/g) || []).length <= 2, "and a double press still pays once");
  await a.page.close();
}

/* -- Duplicate detail routes redirect to the owning module ------------- */
{
  const a = await audit(browser, token, { route: "/app/explore/program/dm-basics" });
  say(a.path === "/app/programs/dm-basics", `explore/program redirects to the course (${a.path})`);
  await a.page.close();
  const b = await audit(browser, token, { route: "/app/explore/service/m1" });
  say(b.path === "/app/mentors/m1", `explore/service redirects to the mentor (${b.path})`);
  await b.page.close();
}

await browser.close();
finish(fail, lines, "Phase 1 complete: every card now opens into a real screen, in both themes");
