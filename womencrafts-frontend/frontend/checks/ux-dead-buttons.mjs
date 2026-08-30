/**
 * The buttons that say something happened and send nothing.
 *
 * Five phases of this app have turned up the same shape: a handler whose whole
 * body is `setSomething(true)`, under a label that makes a promise. The payment
 * button that waited 1.1s and said "Paid". The panic button that told a woman
 * her contacts had been alerted. Both looked wired. Both passed every render
 * check they had, because a render check reads the screen, and the screen was
 * exactly the thing that was lying.
 *
 * So nothing here trusts the screen. Each block presses a real button in a real
 * browser and then asks the API whether anything arrived. The screen's own
 * confirmation is treated as evidence of nothing.
 *
 * Every assertion is written so that PASSING means the button reached the
 * server. A failing line names a promise the app is currently making and not
 * keeping.
 */
import { API, launch, pageAs, seededMemberToken, staffToken } from "./_shared.mjs";
import { APP, finish, wait } from "./_screen.mjs";

const fail = [];
const lines = [];
// Printed as they happen, not collected and printed at the end. A single slow
// route used to time out the run and take every result before it down with it.
const emit = (l) => { lines.push(l); console.log(l); };
const say = (ok, msg) => { emit(`  ${ok ? "ok  " : "✗   "} ${msg}`); if (!ok) fail.push(msg); };
const note = (msg) => emit(`  --   ${msg}`);
const head = (msg) => emit(`\n${msg}`);

/**
 * Run one screen's block on its own.
 *
 * Without this the first route that took longer than the navigation timeout
 * killed the process and threw away every result already gathered — which is
 * how a check that found eight dead buttons reported none of them.
 */
const block = async (name, fn) => {
  try { await fn(); }
  catch (e) { say(false, `${name} could not be checked: ${String(e).split("\n")[0]}`); }
};

const token = await seededMemberToken();
if (!token) {
  console.log("could not sign in as the seeded member — is the API on " + API + "?");
  process.exit(1);
}

const ask = (path, init) =>
  fetch(API + path, {
    headers: { Cookie: `access_token=${token}`, "Content-Type": "application/json" },
    ...init,
  }).then((r) => (r.ok ? r.json() : null)).catch(() => null);

const browser = await launch();
const page = await pageAs(browser, token, { width: 1500, height: 1000 });

/** Everything the scroll container is currently showing. */
const text = () => page.evaluate(() => document.getElementById("ux-scroll")?.innerText ?? "");

const go = async (route) => {
  // The dev server compiles a route on first request, and a cold one can take
  // longer than a patient timeout. One retry: the second attempt is warm.
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      await page.goto(`${APP}${route}`, { waitUntil: "domcontentloaded", timeout: 120000 });
      break;
    } catch (e) {
      if (attempt) throw e;
    }
  }
  // The mock is painted first and replaced when the fetch lands; pressing
  // before that swap tests the fallback, not the screen.
  await wait(6500);
};

/**
 * Click the first button whose label matches, and say whether one was found.
 *
 * Buttons are matched on their own text because that is what a woman reads.
 * Searching the whole document rather than `#ux-scroll` alone: NoteBtn renders
 * its box into <body> through a portal, so its Send button is outside the
 * scroller.
 */
const click = (re) => page.evaluate((src) => {
  const rx = new RegExp(src);
  const b = [...document.querySelectorAll("button, a")]
    .find((x) => rx.test((x.innerText || "").trim()) && x.offsetParent !== null);
  if (!b) return false;
  b.click();
  return true;
}, re.source);

/** Fill the NoteBtn box and press Send. Returns false if the box never opened. */
const sendNote = async (words) => {
  const box = await page.$('textarea');
  if (!box) return false;
  await box.type(words);
  await wait(300);
  const sent = await click(/^Send it$/);
  await wait(3500);
  return sent;
};

/* ═══════════════════════════════════════════════════════════════════════════
   1. Safety — "Report someone"
   The panic button on this screen was fixed. The report box beside it was not.
   It says "Reported. We are looking at it now." `apiFileReport` exists in
   src/lib/safety-api.ts and nothing imports it.
   ═════════════════════════════════════════════════════════════════════════ */
head("/safety — reporting someone who hurt her");
await block("/safety — reporting someone who hurt her", async () => {
  const before = (await ask("/safety/reports")) ?? [];
  await go("/app/safety");
  // The report box is not on the first tab. The panic button is; this is not.
  await click(/Know the tricks/);
  await wait(1200);
  const opened = await click(/Report someone/);
  say(opened, "the report button is on the screen");
  if (opened) {
    await wait(900);
    const sent = await sendNote("Check run: a man at the market followed me home on Tuesday.");
    say(sent, "the box opens and takes her words");
    const t = await text();
    if (/Reported/.test(t)) note("the screen says: “Reported. We are looking at it now.”");
    const after = (await ask("/safety/reports")) ?? [];
    say(after.length > before.length,
        `THE REPORT REACHED THE SERVER (${before.length} → ${after.length} on POST /safety/reports)`);
  }
});

/* ═══════════════════════════════════════════════════════════════════════════
   1b. Travel — "Share this journey"
   The same lie the panic button told, on the screen next door. Pressing it
   prints "Sunita and Meera can see where you are until you tell them you have
   arrived" — the two invented contacts Phase 5 removed from /safety, still
   hardcoded at src/app/app/travel/page.tsx:147, and nothing is sent.

   There is no journey-sharing endpoint, so there is nothing to assert arrived.
   That makes the claim itself the defect: a screen may not tell a woman
   travelling alone that named people are watching her route when nobody is.
   ═════════════════════════════════════════════════════════════════════════ */
head("/travel — sharing her journey with someone");
await block("/travel — sharing her journey", async () => {
  const contacts = (await ask("/safety/contacts")) ?? [];
  const names = (Array.isArray(contacts) ? contacts : []).map((c) => c.name?.split(" ")[0]).filter(Boolean);

  await go("/app/travel");
  const pressed = await click(/Share this journey/);
  say(pressed, "the share button is on the screen");
  if (pressed) {
    await wait(2000);
    const t = await text();
    say(!/Sunita and Meera/.test(t),
        "no invented contact is named as watching her route");
    const claims = /can see where you are/.test(t);
    say(!claims || names.some((n) => t.includes(n)),
        `if it says somebody can see her, it names HER contacts (${names.join(", ") || "none named"})`);
  }
});

/* ═══════════════════════════════════════════════════════════════════════════
   2. Help — "Start a chat"
   Says "A person will answer you". No person is told.
   ═════════════════════════════════════════════════════════════════════════ */
head("/help — asking a human for help");
await block("/help — asking a human for help", async () => {
  const before = (await ask("/wallet/support")) ?? [];
  await go("/app/help");
  const opened = await click(/Start a chat/);
  say(opened, "the chat button is on the screen");
  if (opened) {
    await wait(900);
    await sendNote("Check run: I cannot withdraw my money and I do not know why.");
    const t = await text();
    if (/A person will answer you|Sent/.test(t)) note("the screen says: “A person will answer you”");
    const after = (await ask("/wallet/support")) ?? [];
    say(after.length > before.length,
        `HER QUESTION REACHED SOMEBODY (${before.length} → ${after.length} support requests)`);
  }
});

/* ═══════════════════════════════════════════════════════════════════════════
   3. Events — taking a place
   `toggleGoing` is a local array. POST /growth/events/{id}/register exists,
   and `apiRegisterForEvent` is already written and never called.
   ═════════════════════════════════════════════════════════════════════════ */
head("/events — taking a place at an event");
await block("/events — taking a place at an event", async () => {
  /**
   * Seed the event this block consumes, so the check can be re-run.
   *
   * The first run reported "no event with a free place to press" and passed
   * by saying nothing — which is the failure mode every check here exists to
   * avoid. A check that quietly skips is a check that will be believed.
   */
  const upcoming = (r) => (Array.isArray(r) ? r : r?.upcoming ?? []);
  let before = (await ask("/growth/events")) ?? [];
  // The API's own field names, not the screen's. `useEvents` renames
  // `registered`/`full` to `going`/`taken`/`spots` on the way in, and asserting
  // against the renamed shape read `undefined` and reported nothing to press.
  const free = (r) => upcoming(r).filter((e) => !e.registered && !e.full);
  if (!free(before).length) {
    const staff = await staffToken();
    const when = new Date(Date.now() + 21 * 864e5).toISOString().slice(0, 10);
    await fetch(`${API}/admin/growth/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${staff}` },
      body: JSON.stringify({
        title: "Check run — a place she can take",
        desc: "Seeded by checks/ux-dead-buttons.mjs so the Join button has something to press.",
        category: "Workshop", date: when, time: "11:00", duration: "2 hours",
        mode: "Online", host: "WomSakhi", seats: 40, fee: 0,
        language: "Hindi", status: "published",
      }),
    }).catch(() => {});
    await wait(600);
    before = (await ask("/growth/events")) ?? [];
  }

  const openOne = free(before)[0];
  if (!openOne) note("could not seed an event with a free place — is the admin account there?");
  else {
    await go("/app/events");
    const pressed = await click(/^(Join|Book · )/);
    say(pressed, "a Join button is on the screen");
    await wait(3500);
    const after = (await ask("/growth/events")) ?? [];
    say(free(after).length < free(before).length,
        `THE SERVER HAS HER DOWN AS GOING (${free(before).length} → ${free(after).length} events still unregistered)`);
  }
});

/* ═══════════════════════════════════════════════════════════════════════════
   4. Notifications — mark all read
   ═════════════════════════════════════════════════════════════════════════ */
head("/notifications — marking them read");
await block("/notifications — marking them read", async () => {
  const before = (await ask("/me/notifications")) ?? [];
  const rows = Array.isArray(before) ? before : before?.items ?? [];
  const unreadBefore = rows.filter((n) => !n.read && !n.read_at).length;
  if (!unreadBefore) note("nothing unread to mark — seed a notification and re-run");
  else {
    await go("/app/notifications");
    const pressed = await click(/Mark all read|Mark all as read/i);
    say(pressed, "the mark-all button is on the screen");
    await wait(3500);
    const after = (await ask("/me/notifications")) ?? [];
    const rowsAfter = Array.isArray(after) ? after : after?.items ?? [];
    const unreadAfter = rowsAfter.filter((n) => !n.read && !n.read_at).length;
    say(unreadAfter < unreadBefore,
        `THE SERVER MARKED THEM READ (${unreadBefore} → ${unreadAfter} unread)`);
  }
});

/* ═══════════════════════════════════════════════════════════════════════════
   5. Mentors — "Ask for a session"
   The DETAIL screen calls apiRequestMentor. The LIST screen opens a NoteBtn
   that says "Your request is with <her name>" and posts nothing — so which of
   two identical-looking buttons works depends on which screen she is on.
   ═════════════════════════════════════════════════════════════════════════ */
head("/mentors — asking a mentor for a session");
await block("/mentors — asking a mentor for a session", async () => {
  const before = (await ask("/growth/mentors/requests/mine")) ?? [];
  await go("/app/mentors");
  const opened = await click(/Ask for a session/);
  say(opened, "the ask button is on the list screen");
  if (opened) {
    await wait(900);
    await sendNote("Check run: I need help pricing my work. Free on Sunday mornings.");
    const after = (await ask("/growth/mentors/requests/mine")) ?? [];
    say(after.length > before.length,
        `THE MENTOR WAS ASKED (${before.length} → ${after.length} on /growth/mentors/requests/mine)`);
  }
});

/* ═══════════════════════════════════════════════════════════════════════════
   6. Skill exchange — asking about a swap
   ═════════════════════════════════════════════════════════════════════════ */
head("/library — asking about a skill swap");
await block("/library — asking about a skill swap", async () => {
  const before = (await ask("/exchange/threads")) ?? [];
  await go("/app/library");
  const pressed = await click(/Propose a swap/);
  say(pressed, "a “Propose a swap” button is on the screen");
  await wait(3500);
  const after = (await ask("/exchange/threads")) ?? [];
  say(after.length > before.length,
      `THE ASK REACHED HER (${before.length} → ${after.length} on POST /exchange/swaps/{id}/ask)`);
});

/* ═══════════════════════════════════════════════════════════════════════════
   7. Stories — the heart
   POST /community/stories/{id}/like exists. `apiLikeStory` is written twice,
   in community-api.ts and growth-api.ts, and called from neither screen.
   ═════════════════════════════════════════════════════════════════════════ */
head("/stories — liking another woman's story");
await block("/stories — liking another woman's story", async () => {
  await go("/app/stories");
  const pressed = await page.evaluate(() => {
    const b = [...document.querySelectorAll("#ux-scroll button")]
      .find((x) => x.querySelector('svg.lucide-heart') && x.offsetParent !== null);
    if (!b) return false;
    b.click();
    return true;
  });
  if (!pressed) note("no heart on the screen to press");
  else {
    await wait(3000);
    await page.reload({ waitUntil: "domcontentloaded", timeout: 180000 });
    await wait(4200);
    const stuck = await page.evaluate(() => {
      const b = [...document.querySelectorAll("#ux-scroll button")]
        .find((x) => x.querySelector('svg.lucide-heart'));
      const svg = b?.querySelector("svg");
      return !!svg && svg.getAttribute("fill") === "currentColor";
    });
    say(stuck, "THE LIKE SURVIVED A RELOAD — it went to the server, not to useState");
  }
});

/* ═══════════════════════════════════════════════════════════════════════════
   8. Refer — "Copy link"
   Not a server call at all, which is why no survey caught it. `copy()` on this
   screen sets a "Copied" label and never touches the clipboard. She pastes her
   referral link into WhatsApp and sends whatever was there before.
   ═════════════════════════════════════════════════════════════════════════ */
head("/refer — copying the code that pays her");
await block("/refer — copying the code that pays her", async () => {
  await browser.defaultBrowserContext()
    .overridePermissions(APP, ["clipboard-read", "clipboard-write"]);
  await go("/app/refer");

  /**
   * Watch the clipboard API instead of reading it.
   *
   * Reading it back needs a permission the headless browser will not always
   * grant, and a denied read is indistinguishable from an empty clipboard —
   * which would have reported a working button as broken. Wrapping
   * `writeText` needs no permission at all and answers the only question that
   * matters: did the button try?
   */
  await page.evaluate(() => {
    window.__wrote = null;
    const real = navigator.clipboard.writeText.bind(navigator.clipboard);
    navigator.clipboard.writeText = (t) => { window.__wrote = t; return real(t).catch(() => {}); };
    // The old-fashioned path, for anything not using the async API.
    document.execCommand = new Proxy(document.execCommand ?? (() => false), {
      apply(t, self, args) { if (args[0] === "copy") window.__wrote = "(execCommand)"; return Reflect.apply(t, self, args); },
    });
  });

  const pressed = await click(/Copy link/);
  say(pressed, "the copy-link button is on the screen");
  await wait(1500);
  const wrote = await page.evaluate(() => window.__wrote);
  say(wrote !== null,
      `THE LINK IS ACTUALLY PUT ON THE CLIPBOARD (wrote: ${JSON.stringify(wrote)})`);
  const t = await text();
  if (/Copied/.test(t) && wrote === null) note("and the button says “Copied” anyway");
});

/* ═══════════════════════════════════════════════════════════════════════════
   9. Welcome — the three questions that "decide what you see"
   POST /theme/onboarding/step and /finish exist. `finish` is
   `router.replace("/app")`.
   ═════════════════════════════════════════════════════════════════════════ */
head("/welcome — the onboarding answers");
await block("/welcome — the onboarding answers", async () => {
  const before = await ask("/theme/onboarding");
  await go("/app/welcome");
  await click(/^Next$/); await wait(700);
  await click(/^Next$/); await wait(700);
  await click(/Take me in/); await wait(3000);
  const after = await ask("/theme/onboarding");
  say(JSON.stringify(after) !== JSON.stringify(before),
      "HER ANSWERS REACHED THE SERVER (GET /theme/onboarding changed)");
});

await browser.close();
finish(fail, lines, "every button that promises something reaches the server");
