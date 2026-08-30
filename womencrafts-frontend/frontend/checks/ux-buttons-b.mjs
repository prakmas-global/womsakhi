/**
 * Applications, Events, Skill Exchange, Notifications, Schemes, Group buying
 * and Welcome — against the real server.
 *
 * Two faults, over and over, on seven screens.
 *
 * The first is a memo with the data missing from its dependency array.
 * `useResource` hands back a mock fallback on the first render and the real
 * answer a moment later, so a memo that does not list the data is computed
 * once, from the fixture, and never again. `/applications` showed a job at
 * "TechNova Solutions" while the header above it counted her seven real ones.
 *
 * The second is a button whose whole body is local state. Going to an event,
 * marking a notification read, asking about a swap, agreeing an exchange and
 * finishing onboarding all changed an array in the browser and sent nothing.
 *
 * Nothing here trusts the screen — the screen was the thing that was lying.
 * Every assertion presses a real button in a real browser and then asks the
 * API whether anything arrived. PASSING means the server heard it.
 */
import { API, launch, pageAs, seededMemberToken, staffToken } from "./_shared.mjs";
import { APP, finish, wait } from "./_screen.mjs";

const fail = [];
const lines = [];
// Printed as they happen: one slow route used to time out the run and take
// every result already gathered down with it.
const emit = (l) => { lines.push(l); console.log(l); };
const say = (ok, msg) => { emit(`  ${ok ? "ok  " : "✗   "} ${msg}`); if (!ok) fail.push(msg); };
const note = (msg) => emit(`  --   ${msg}`);
const head = (msg) => emit(`\n${msg}`);

const block = async (name, fn) => {
  try { await fn(); }
  catch (e) { say(false, `${name} could not be checked: ${String(e).split("\n")[0]}`); }
};

const token = await seededMemberToken();
if (!token) {
  console.log(`could not sign in as the seeded member — is the API on ${API}?`);
  process.exit(1);
}

const asked = (tok) => (path, init) =>
  fetch(API + path, {
    headers: { Cookie: `access_token=${tok}`, "Content-Type": "application/json" },
    ...init,
  }).then((r) => (r.status === 204 ? null : r.json())).catch(() => null);

const ask = asked(token);

const browser = await launch();
const open = async (tok, route, settle = 5200) => {
  const page = await pageAs(browser, tok, { width: 1500, height: 980 });
  await page.goto(APP + route, { waitUntil: "domcontentloaded", timeout: 180000 });
  await wait(settle);
  return page;
};
const text = (page) => page.evaluate(() => document.getElementById("ux-scroll")?.innerText ?? "");
/** Press the first button whose label matches. Returns whether one was found. */
const press = (page, re) =>
  page.$$eval("#ux-scroll button", (bs, src) => {
    const b = bs.find((x) => new RegExp(src).test(x.innerText.trim()));
    if (b && !b.disabled) { b.click(); return true; }
    return false;
  }, re.source);

/* ── Applications: the list is hers, not the fixture ───────────────────── */
head("/app/applications — the stale memo");
await block("applications", async () => {
  const apps = await ask("/growth/applications");
  const page = await open(token, "/app/applications");
  // "All", so the tab cannot be the reason a row is missing.
  await press(page, /^All$/);
  await wait(1200);
  const t = await text(page);

  const shown = apps.filter((a) => t.includes(a.org)).length;
  say(apps.length > 0 && shown === apps.length,
      `EVERY APPLICATION THE SERVER HAS IS ON SCREEN (${shown} of ${apps.length})`);
  // The fixture's giveaway. It was the only thing on this screen.
  say(!/TechNova Solutions|Digital Marketing Specialist/.test(t),
      "and none of the invented ones are");
  await page.close();
});

/* ── Events: the list is real, and going reaches the organiser ─────────── */
head("/app/events — the stale memo, and three buttons that sent nothing");
await block("events", async () => {
  const evs = await ask("/growth/events");
  const page = await open(token, "/app/events");
  const t = await text(page);
  say(evs.length > 0 && evs.slice(0, 3).every((e) => t.includes(e.title)),
      `the events on screen are the server's (${evs.length})`);
  say(!/Craft Mela — Jaipur|Women in Tech Webinar/.test(t),
      "and none of the invented ones are");

  // She is going to the ones the server says she is going to — this used to be
  // seeded from the fallback on the first render and never corrected.
  const going = evs.filter((e) => e.registered);
  await press(page, /^You are going$/);
  await wait(1400);
  const onTab = await text(page);
  say(going.every((e) => onTab.includes(e.title)),
      `"You are going" holds the ${going.length} she is registered for`);
  await press(page, /^Coming up$/);
  await wait(1200);

  const target = evs.find((e) => !e.registered && !e.full);
  if (!target) { note("she is registered for everything open — nothing left to press"); await page.close(); return; }

  const took = await page.$$eval("#ux-scroll button", (bs, title) => {
    // The Join button inside the card carrying this event's title.
    const card = [...document.querySelectorAll("#ux-scroll section, #ux-scroll .ux-card")]
      .find((c) => c.innerText.includes(title));
    const b = [...(card?.querySelectorAll("button") ?? bs)]
      .find((x) => /^(Join|Book)/.test(x.innerText.trim()));
    if (b && !b.disabled) { b.click(); return true; }
    return false;
  }, target.title);
  say(took, `there is a place to take on "${target.title}"`);
  await wait(5000);

  const after = (await ask("/growth/events")).find((e) => e.id === target.id);
  say(after?.registered === true, `THE SERVER TOOK THE REGISTRATION ("${target.title}")`);

  // And giving it up reaches the server too, rather than only the button.
  await page.close();
  const back = await open(token, `/app/events/${target.id}`);
  await press(back, /^Give up my place$/);
  await wait(5000);
  const gone = (await ask("/growth/events")).find((e) => e.id === target.id);
  say(gone?.registered === false, "and cancelling reaches it as well");
  await back.close();
});

/* ── Notifications: read is read ───────────────────────────────────────── */
head("/app/notifications — 50 unread before, 50 after");
await block("notifications", async () => {
  const before = (await ask("/me/notifications")).filter((n) => n.unread).length;
  if (!before) { note("nothing unread to mark — cannot measure"); return; }

  const page = await open(token, "/app/notifications");
  say((await text(page)).includes(String(before)),
      `the screen counts the same unread the server does (${before})`);

  await press(page, /^Mark all read$/);
  await wait(5000);
  const after = (await ask("/me/notifications")).filter((n) => n.unread).length;
  say(after === 0, `THE SERVER MARKED THEM READ (${before} unread → ${after})`);
  await page.close();
});

/* ── Skill Exchange: asking, saying and agreeing all land ──────────────── */
head("/app/library — the stale memo, and three writes that were local");
await block("library", async () => {
  const swaps = await ask("/exchange/swaps");
  const page = await open(token, "/app/library");
  const t = await text(page);
  const listed = swaps.filter((s) => !s.mine);
  say(listed.length > 0 && listed.slice(0, 2).every((s) => t.includes(s.skill)),
      `the offers on screen are the server's (${listed.length})`);

  const threadsBefore = (await ask("/exchange/threads")) ?? [];
  const target = listed.find((s) => !threadsBefore.some((th) => th.swap_id === s.id));
  if (!target) { note("she has asked about every offer — nothing left to press"); await page.close(); return; }

  const words = `Check ${Date.now().toString(36)} — I would like to learn ${target.skill}.`;
  await page.$$eval("#ux-scroll button", (bs, title) => {
    const card = [...document.querySelectorAll("#ux-scroll section, #ux-scroll .ux-card")]
      .find((c) => c.innerText.includes(title));
    [...(card?.querySelectorAll("button") ?? bs)]
      .find((x) => /^Propose a swap$/.test(x.innerText.trim()))?.click();
  }, target.skill);
  await wait(900);

  const typed = await page.evaluate((w) => {
    const ta = document.querySelector('[role="dialog"] textarea');
    if (!ta) return false;
    const set = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set;
    set.call(ta, w);
    ta.dispatchEvent(new Event("input", { bubbles: true }));
    return true;
  }, words);
  say(typed, "proposing a swap asks her what to say — the endpoint requires words");
  await wait(500);
  await page.$$eval('[role="dialog"] button', (bs) =>
    bs.find((x) => /^Send it$/.test(x.innerText.trim()))?.click());
  await wait(5000);

  const threadsAfter = (await ask("/exchange/threads")) ?? [];
  const made = threadsAfter.find((th) => th.swap_id === target.id);
  say(!!made, `THE SERVER OPENED THE EXCHANGE (${threadsBefore.length} → ${threadsAfter.length} threads)`);
  await page.close();
  if (!made) return;

  const convo = await ask(`/exchange/threads/${made.id}`);
  say((convo?.messages ?? []).some((m) => m.text === words),
      "and it carries what she wrote, not a line written for her");

  /* ── the thread screen ── */
  const thread = await open(token, `/app/library/${target.id}`);
  const tt = await text(thread);
  say(convo.messages.every((m) => tt.includes(m.text)),
      `the conversation on screen is the thread's own (${convo.messages.length} messages)`);
  say(!/I saw you teach blouse finishing/.test(tt),
      "and not the three-message fixture that used to be under every offer");

  const reply = `Check ${Date.now().toString(36)} — Tuesday or Thursday suits me.`;
  await thread.evaluate((w) => {
    const el = document.querySelector('#ux-scroll input[aria-label="Write a reply"]');
    const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    set.call(el, w);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }, reply);
  await wait(400);
  await thread.$$eval('#ux-scroll button[aria-label="Send"]', (bs) => bs[0]?.click());
  await wait(5000);
  const said = await ask(`/exchange/threads/${made.id}`);
  say((said?.messages ?? []).some((m) => m.text === reply),
      `THE SERVER TOOK THE REPLY (${convo.messages.length} → ${said?.messages?.length} messages)`);

  await press(thread, /^Agree to this$/);
  await wait(5000);
  const settled = await ask(`/exchange/threads/${made.id}`);
  say(settled?.agreed === true, "THE SERVER RECORDED THE AGREEMENT (agreed: false → true)");
  say(!!settled?.agreement?.i_teach && !!settled?.agreement?.she_teaches,
      `and it says who teaches what — "${settled?.agreement?.i_teach}" for "${settled?.agreement?.she_teaches}"`);
  await thread.close();
});

/* ── Schemes: the stale memo ───────────────────────────────────────────── */
head("/app/support-fund — the stale memo");
await block("support-fund", async () => {
  const schemes = await ask("/schemes");
  const page = await open(token, "/app/support-fund");
  await press(page, /^All schemes$/);
  await wait(1400);
  const t = await text(page);
  const shown = schemes.filter((s) => t.includes(s.title)).length;
  say(schemes.length > 0 && shown === schemes.length,
      `EVERY SCHEME THE SERVER HAS IS ON SCREEN (${shown} of ${schemes.length})`);
  await page.close();
});

/* ── Group buying: joining reaches the order ───────────────────────────── */
head("/app/group-buy — verifying the join path end to end");
await block("group-buy", async () => {
  const buys = await ask("/group-buy");
  const target = buys.find((b) => !b.joined_by_me && !b.full && !b.closed);
  if (!target) { note("she is in every open buy — nothing left to press"); return; }

  const page = await open(token, "/app/group-buy");
  const took = await page.$$eval("#ux-scroll button", (bs, item) => {
    const card = [...document.querySelectorAll("#ux-scroll section, #ux-scroll .ux-card")]
      .find((c) => c.innerText.includes(item));
    const b = [...(card?.querySelectorAll("button") ?? bs)]
      .find((x) => /^Join this buy$/.test(x.innerText.trim()));
    if (b && !b.disabled) { b.click(); return true; }
    return false;
  }, target.item);
  say(took, `there is a buy to join ("${target.item}")`);
  await wait(5000);

  const after = (await ask("/group-buy")).find((b) => b.id === target.id);
  say(after?.joined_by_me === true, `THE SERVER PUT HER IN THE ORDER ("${target.item}")`);
  say(after?.joined === target.joined + 1,
      `and counted her (${target.joined} → ${after?.joined} of ${target.needed})`);
  await page.close();

  // The read-back, which is the half that is still broken: `joined_by_me` is
  // on the wire and `toGroupBuy` in components/ux/entitlements.ts drops it, so
  // a fresh visit offers "Join this buy" on an order she has already joined.
  const again = await open(token, "/app/group-buy");
  const card = await again.evaluate((item) =>
    [...document.querySelectorAll("#ux-scroll section, #ux-scroll .ux-card")]
      .find((c) => c.innerText.includes(item))?.innerText ?? "", target.item);
  say(/You are in/.test(card),
      // Red until `toGroupBuy` carried `joined_by_me` through: the write
      // worked and the read-back did not, so a fresh visit offered "Join this
      // buy" on an order she was already in. The field is mapped now.
      "and a FRESH VISIT still shows her as in it");
  await again.close();
});

/* ── Opportunities: no button that promises what nothing does ──────────── */
head("/app/opportunities — the button with no action");
await block("opportunities", async () => {
  const page = await open(token, "/app/opportunities");
  const t = await text(page);
  say(!/Alert me|Alert set/.test(t),
      "nothing offers to message her when a listing turns up — nothing watches for one");
  const jobs = await ask("/growth/opportunities");
  say(jobs.length > 0 && jobs.slice(0, 2).every((j) => t.includes(j.title)),
      `and the listings on screen are the server's (${jobs.length})`);
  await page.close();
});

/* ── Welcome: three answers that went nowhere, and a loop ──────────────── */
head("/app/welcome — onboarding that never finished");
await block("welcome", async () => {
  // A member who has genuinely not been through it. The seeded one has.
  const staff = await staffToken();
  const email = `welcome.${Date.now()}@example.com`, pw = "TestMember!2345";
  const su = await fetch(`${API}/auth/signup`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ full_name: "Welcome Check", email, password: pw }),
  }).then((r) => r.json());
  const id = su?.user?.id || su?.user?._id;
  await fetch(`${API}/verification/${id}/approve`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${staff}` },
    body: JSON.stringify({ note: "checks" }),
  });
  const fresh = await fetch(`${API}/auth/signin`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: pw }),
  }).then((r) => r.json()).then((j) => j.access_token || j.token);
  const her = asked(fresh);

  const before = await her("/theme/onboarding");
  say(before?.complete === false, "a new member has not been through onboarding");

  const page = await open(fresh, "/app/welcome", 8000);
  // The list she picks from is the server's own, so her answer can be sent.
  const needs = await her("/me/intake/needs");
  const t = await page.evaluate(() => document.body.innerText);
  say(needs.length > 0 && needs.slice(0, 2).every((n) => t.includes(n.label)),
      `the things she can ask for are the server's (${needs.length})`);

  const pick = async (re) => page.$$eval("main button", (bs, src) =>
    !!bs.find((x) => new RegExp(src).test(x.innerText.trim()))?.click(), re.source);

  await pick(new RegExp(`^${needs[0].label}`));
  await wait(400);
  await pick(/^Next$/);
  await wait(3500);
  await pick(/^Tailoring$/);
  await wait(400);
  await pick(/^Next$/);
  await wait(1200);
  await pick(/^A few hours most days/);
  await wait(400);
  await pick(/^Take me in$/);
  await wait(12000);

  const after = await her("/theme/onboarding");
  say(after?.complete === true,
      `THE SERVER RECORDED IT (complete: ${before?.complete} → ${after?.complete})`);

  // Which is what lets her past the gate. Without it the member layout sends
  // her straight back here, and back, and back.
  const where = page.url();
  say(!/\/app\/welcome/.test(where), `and she is let into the app (${new URL(where).pathname})`);
  await page.close();
});

await browser.close();
finish(fail, lines, "Every button on these seven screens reaches the server");
