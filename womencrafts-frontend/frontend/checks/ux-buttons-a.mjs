/**
 * The buttons that said "Sent" and sent nothing.
 *
 * `NoteBtn` — the compose box behind "Leave a note", "Reply", "Say hello",
 * "Ask for a session" and "Report someone" — had `onClick={() => setDone(true)}`
 * as its Send handler. Ten of them across eight screens showed a green tick,
 * the sentence "Only {to} sees this", and a star rating, and nothing ever left
 * the browser. Alongside them sat a row of `ActionBtn`s with no action at all:
 * "Photo removed", "Check both inboxes", "Sent to your email", "We will remind
 * you", "We have told {her}".
 *
 * Nothing here trusts the screen. Every claim is checked against the API: the
 * request is counted before the click and counted again after it, and the text
 * she typed has to come back out of the server.
 *
 * Run with both servers up:
 *     node checks/ux-buttons-a.mjs
 */
import { readFileSync, writeFileSync, unlinkSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

import { API, launch, pageAs, seededMemberToken, staffToken } from "./_shared.mjs";
import { APP, finish, wait } from "./_screen.mjs";

const fail = [];
const lines = [];
const say = (ok, msg) => { lines.push(`  ${ok ? "ok  " : "✗   "} ${msg}`); if (!ok) fail.push(msg); };
const head = (t) => {
  lines.push(`\n  ── ${t} ${"─".repeat(Math.max(0, 62 - t.length))}`);
  // To stderr, so a crash half way through still says which section it died
  // in — the first run of this file timed out on an unnamed navigation and
  // reported nothing at all.
  process.stderr.write(`  … ${t}\n`);
};

const token = await seededMemberToken();
if (!token) { console.log("  cannot sign in as the seeded member — is the API running?"); process.exit(2); }
const staff = await staffToken();

const ask = (path, init) =>
  fetch(API + path, {
    headers: { Cookie: `access_token=${token}`, "Content-Type": "application/json" },
    ...init,
  }).then((r) => (r.status === 204 ? null : r.json()));

const askStaff = (path) =>
  fetch(API + path, { headers: { Authorization: `Bearer ${staff}` } }).then((r) => r.json());

/* ── Source guard: no compose box may exist without somewhere to send ──────
 *
 * The API assertions below prove the wired ones work. This proves nobody can
 * quietly add an eleventh unwired one — which is exactly how the ten got here.
 */
const OWNED = [
  "src/app/app/help/page.tsx", "src/app/app/mentors/page.tsx",
  "src/app/app/documents/page.tsx", "src/app/app/bookings/page.tsx",
  "src/app/app/bookings/[id]/page.tsx", "src/app/app/stories/page.tsx",
  "src/app/app/stories/[id]/page.tsx", "src/app/app/settings/account/page.tsx",
  "src/app/app/wallet/statement/page.tsx", "src/app/app/schedule/page.tsx",
  "src/app/app/family/page.tsx", "src/app/app/profile/page.tsx",
  "src/app/app/profile/preview/page.tsx", "src/app/app/assess/page.tsx",
  "src/app/app/safety/page.tsx",
];

head("Every compose box and every confirming button has a server behind it");
{
  /** Split a file on a JSX tag name and return each opening tag's text. */
  const tagsOf = (src, name) => {
    const out = [];
    let i = src.indexOf(`<${name}`);
    while (i !== -1) {
      let j = i, depth = 0;
      while (j < src.length) {
        const c = src[j];
        if (c === "{") depth += 1;
        else if (c === "}") depth -= 1;
        else if (c === ">" && depth === 0) break;
        j += 1;
      }
      out.push(src.slice(i, j + 1));
      i = src.indexOf(`<${name}`, j);
    }
    return out;
  };

  let notes = 0, notesUnwired = 0, acts = 0, actsUnwired = 0;
  for (const f of OWNED) {
    const src = readFileSync(f, "utf8");
    for (const t of tagsOf(src, "NoteBtn")) { notes += 1; if (!/\bsend=/.test(t)) notesUnwired += 1; }
    for (const t of tagsOf(src, "ActionBtn")) { acts += 1; if (!/\bact=/.test(t)) actsUnwired += 1; }
  }
  say(notes > 0 && notesUnwired === 0, `all ${notes} NoteBtn boxes have a send (${notesUnwired} without)`);
  say(actsUnwired === 0, `all ${acts} ActionBtn buttons have an act (${actsUnwired} without)`);
}

const browser = await launch();
const page = await pageAs(browser, token, { width: 1500, height: 980 });
page.setDefaultTimeout(30000);

/**
 * Open a screen, patiently.
 *
 * Three other agents are driving this same dev server, so a cold route can
 * take minutes to compile. A second `goto` issued while the first is still in
 * flight detaches the frame and kills the run — so a slow navigation is waited
 * out by polling the URL rather than asked for again.
 */
const go = async (path, settle = 4200) => {
  try {
    await page.goto(`${APP}${path}`, { waitUntil: "domcontentloaded", timeout: 180000 });
  } catch {
    process.stderr.write(`     (${path} is slow — waiting for it)\n`);
    for (let i = 0; i < 90 && !page.url().includes(path); i += 1) await wait(2000);
  }
  await wait(settle);
};

/** `page.evaluate`, retried once — a render mid-navigation detaches the frame. */
async function look(fn, arg) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await page.evaluate(fn, arg);
    } catch (e) {
      if (attempt === 2 || !/detached|Execution context/i.test(String(e))) throw e;
      await wait(2500);
    }
  }
  return undefined;
}

const screen = () => look(() => document.getElementById("ux-scroll")?.innerText ?? "");

/** Click a button anywhere on the page whose visible text matches. */
const press = (re) =>
  look((source) => {
    const rx = new RegExp(source);
    const b = [...document.querySelectorAll("button, a")].find((x) => rx.test(x.innerText || ""));
    if (!b) return false;
    b.click();
    return true;
  }, re.source);

/**
 * Press a button once it exists.
 *
 * A tab that has just been switched, or a screen still waiting on four
 * requests, has not rendered its buttons yet — and `find` on an empty list
 * reports "the button is missing" when the truth is "not yet".
 */
async function pressWhenReady(re, seconds = 20) {
  for (let i = 0; i < seconds * 2; i += 1) {
    if (await press(re)) return true;
    await wait(500);
  }
  return false;
}

/** The Send button in the open compose box, if it is pressable. */
const sendIsBlocked = () =>
  look(() =>
    [...document.querySelectorAll('div[role="dialog"] button')]
      .find((x) => /^Send it$/.test(x.innerText.trim()))?.disabled === true);

const pressSend = () =>
  look(() => {
    const b = [...document.querySelectorAll('div[role="dialog"] button')]
      .find((x) => /^Send it$/.test(x.innerText.trim()));
    if (!b || b.disabled) return false;
    b.click();
    return true;
  });

/**
 * Fill the compose box and send it.
 *
 * The text is stamped so the assertion can look for those exact words coming
 * back out of the API rather than for the screen's own confirmation.
 */
async function compose(text, { stars = false, choice = null } = {}) {
  await page.waitForSelector('div[role="dialog"] textarea', { timeout: 20000 });
  if (choice) {
    await look((c) => {
      const b = [...document.querySelectorAll('div[role="dialog"] button')]
        .find((x) => x.innerText.trim() === c);
      b?.click();
    }, choice);
  }
  if (stars) {
    await look(() => {
      document.querySelector('div[role="dialog"] button[aria-label="5 out of 5"]')?.click();
    });
  }
  await page.type('div[role="dialog"] textarea', text, { delay: 4 });
  await wait(300);
  const sent = await pressSend();
  await wait(3500);
  return sent;
}

const stamp = () => Date.now().toString().slice(-6);

/* ── 1. Asking a mentor for a session ─────────────────────────────────── */
head("Ask for a session — POST /growth/mentors/{id}/request");
{
  const before = await ask("/growth/mentors/requests/mine");
  await go("/app/mentors");
  const words = `check ${stamp()}: I want help pricing what I make`;

  // A mentor she has already asked is refused by the server with a 409, and
  // rightly — so the box is opened on one she has not.
  // `Card` renders a <section class="ux-card">, not a div — the first version
  // of this looked for `div.ux-i`, matched nothing, and silently opened the
  // box on whichever mentor came first.
  const picked = await look(() => {
    const card = [...document.querySelectorAll("#ux-scroll button")]
      .filter((b) => /^Ask for a session$/.test(b.innerText.trim()))
      .map((b) => b.closest(".ux-card"))
      .find((c) => c && !/You asked/.test(c.innerText));
    if (!card) return null;
    const name = card.querySelector("h3")?.innerText.trim() ?? "";
    [...card.querySelectorAll("button")]
      .find((b) => /^Ask for a session$/.test(b.innerText.trim()))?.click();
    return { name };
  });
  const who = picked?.name ?? "";
  say(!!picked, `the compose box opens on a mentor she has not asked (${who || "none found"})`);
  const sent = picked ? await compose(words) : false;
  say(sent, "Send it was pressable and pressed");

  const after = await ask("/growth/mentors/requests/mine");
  say(after.length === before.length + 1,
      `THE SERVER RECEIVED THE REQUEST (${before.length} → ${after.length})`);
  const mine = after.find((r) => r.goal === words);
  say(!!mine, "and the goal on it is the sentence she actually typed");
  say(!!mine && mine.mentor_name === who, `addressed to the mentor whose card she pressed (${mine?.mentor_name ?? "—"})`);

  // And a woman she has already asked is not offered the box a second time.
  // The server answers a duplicate with a 409, so leaving the button there
  // only walked her into a refusal she had done nothing to earn.
  await go("/app/mentors");
  const offeredAgain = await look(() =>
    [...document.querySelectorAll("#ux-scroll button")]
      .filter((b) => /^Ask for a session$/.test(b.innerText.trim()))
      .map((b) => b.closest(".ux-card"))
      .filter((c) => c && /You asked/.test(c.innerText)).length);
  say(offeredAgain === 0,
      `a mentor she has already asked is not offered the box again (${offeredAgain} still are)`);
  const asked = await look(() =>
    [...document.querySelectorAll("#ux-scroll .ux-card")]
      .filter((c) => /You asked/.test(c.innerText)).length);
  say(asked > 0, `and the ones she has asked say so (${asked} cards)`);
}

/* ── 2. Replying to a review in her shop ──────────────────────────────── */
head("Reply to a review — POST /shop/reviews/{id}/reply");
{
  const before = await ask("/shop/reviews");
  if (!before.length) {
    say(false, "no reviews on the seeded shop, so the reply could not be exercised");
  } else {
    await go("/app/documents", 6000);
    await pressWhenReady(/^Reviews$/);
    await wait(2000);
    const words = `check ${stamp()}: thank you, I will stitch the next one wider`;
    const opened = await pressWhenReady(/^Reply$/);
    say(opened, "the reply box opens on a review");
    const sent = opened ? await compose(words) : false;
    say(sent, "Send it was pressable and pressed");

    const after = await ask("/shop/reviews");
    const replied = after.filter((r) => r.reply === words);
    say(replied.length === 1, `THE REPLY IS ON THE REVIEW ON THE SERVER (${replied.length} match)`);
    const was = before.find((r) => r.id === replied[0]?.id);
    say(!!was && was.reply !== words, "and it was not there before she pressed");
  }
}

/* ── 3. Leaving a note about a booking ────────────────────────────────── */
head("Leave a note — POST /me/feedback");
if (!staff) {
  say(false, "no staff token, so the feedback module could not be read back");
} else {
  const before = await askStaff("/feedback");
  const beforeRows = Array.isArray(before) ? before : before.items ?? [];
  await go("/app/bookings", 6000);
  await pressWhenReady(/^Past$/);
  await wait(2000);
  const words = `check ${stamp()}: the room was cold but the teacher was very good`;
  const opened = await pressWhenReady(/^Leave a note$/);
  say(opened, "the note box opens on a finished booking");

  if (opened) {
    // Words alone are not enough here: the box asks for stars and the server
    // stores a rating, so sending without one would record an opinion she
    // never gave. The box must refuse until she picks.
    await page.waitForSelector('div[role="dialog"] textarea', { timeout: 20000 });
    await page.type('div[role="dialog"] textarea', words, { delay: 4 });
    await wait(300);
    say(await sendIsBlocked(),
        "it will not send words with no star — a rating she never gave is not invented");

    await look(() => {
      document.querySelector('div[role="dialog"] button[aria-label="5 out of 5"]')?.click();
    });
    await wait(250);
    const sent = await pressSend();
    await wait(3500);
    say(sent, "and it sends once she has");

    const after = await askStaff("/feedback");
    const afterRows = Array.isArray(after) ? after : after.items ?? [];
    // Counting rows proves nothing here — /feedback answers with a capped page,
    // so the total does not move. The words themselves are the evidence.
    const text = (r) => r.text ?? r.comment ?? "";
    say(!beforeRows.some((r) => text(r) === words), "the note was not in the module before she pressed");
    say(afterRows.some((r) => text(r) === words),
        "THE TEAM'S FEEDBACK MODULE RECEIVED IT, in the words she typed");
    const row = afterRows.find((r) => text(r) === words);
    say(row?.rating === 5, `with the star she chose (${row?.rating ?? "—"})`);
  }
}

/* ── 4. Starting a chat with a person ─────────────────────────────────── */
head("Start a chat — POST /me/messages");
{
  const before = await ask("/me/messages");
  await go("/app/help");
  const words = `check ${stamp()}: my withdrawal has not arrived and it is four days`;
  const opened = await pressWhenReady(/^Start a chat$/);
  say(opened, "the chat box opens from Help");
  const sent = opened ? await compose(words) : false;
  say(sent, "Send it was pressable and pressed");

  const after = await ask("/me/messages");
  say(after.length === before.length + 1,
      `THE MESSAGE IS IN HER THREAD WITH THE TEAM (${before.length} → ${after.length})`);
  say(after.some((m) => m.body === words && m.sender === "member"),
      "written by her, in her own words");
}

/* ── 5. Reporting someone ─────────────────────────────────────────────── */
head("Report someone — POST /safety/reports");
{
  const before = (await ask("/safety")).reports;
  await go("/app/safety");
  await pressWhenReady(/^Know the tricks$/);
  await wait(1600);
  const words = `check ${stamp()}: he asked me for a registration fee to get me work`;
  const opened = await pressWhenReady(/^Report someone$/);
  say(opened, "the report box opens");

  if (opened) {
    // The server requires a category. The box starts on the least committal
    // one — so Send is never dead in her hand — and she can be more precise.
    await page.waitForSelector('div[role="dialog"] textarea', { timeout: 20000 });
    const picked = await look(() =>
      [...document.querySelectorAll('div[role="dialog"] button[aria-pressed="true"]')]
        .map((b) => b.innerText.trim()));
    say(picked.length === 1 && picked[0] === "Something else",
        `a category is chosen to begin with, and it is the least committal one (${picked.join(", ") || "none"})`);

    await page.type('div[role="dialog"] textarea', words, { delay: 4 });
    await wait(300);
    say(!(await sendIsBlocked()), "so Send is live as soon as she has written something");

    await look(() => {
      const b = [...document.querySelectorAll('div[role="dialog"] button')]
        .find((x) => x.innerText.trim() === "Money or fraud");
      b?.click();
    });
    await wait(250);
    const sent = await pressSend();
    await wait(3500);
    say(sent, "and it sends once she has picked one");

    const after = (await ask("/safety")).reports;
    say(after.length === before.length + 1,
        `THE SAFETY TEAM RECEIVED THE REPORT (${before.length} → ${after.length})`);
    const filed = after.find((r) => r.details === words);
    say(!!filed, "with the words she typed");
    say(filed?.category === "Money or fraud", `and the category she chose (${filed?.category ?? "—"})`);

    // And she is told what happened to it, from the server rather than from a
    // sentence the screen made up.
    const t = await screen();
    say(!/Reported\. We are looking at it now\./.test(t), "the old blanket claim is gone");
    say(/What you have reported/.test(t), "her filed reports are listed back to her");
  }
}

/* ── 6. Taking a skill test ───────────────────────────────────────────── */
head("Take the test — GET /assess/{id} then POST /assess/{id}/attempt");
{
  const before = await ask("/assess");
  const target = before.find((a) => a.question_count > 0);
  say(!!target, `the server has a test with questions on it (${target?.title ?? "—"})`);

  await go("/app/assess");
  const t0 = await screen();
  say(!/Starting…/.test(t0), "nothing is stuck on 'Starting…' before she presses");

  const opened = await pressWhenReady(/^(Take the test|Try again)$/);
  say(opened, "a test opens");
  await wait(3000);

  const asked = await look(() =>
    document.querySelectorAll('#ux-scroll [role="radio"]').length);
  say(asked > 0, `the questions are on the screen (${asked} options on the first one)`);

  // Answer every question, pressing Next until the last.
  for (let i = 0; i < 12; i += 1) {
    const more = await look(() => {
      document.querySelector('#ux-scroll [role="radio"]')?.click();
      return true;
    });
    if (!more) break;
    await wait(350);
    const advanced = await look(() => {
      const b = [...document.querySelectorAll("#ux-scroll button")]
        .find((x) => /^Next$/.test(x.innerText.trim()));
      if (!b || b.disabled) return false;
      b.click();
      return true;
    });
    await wait(400);
    if (!advanced) break;
  }
  const finished = await look(() => {
    const b = [...document.querySelectorAll("#ux-scroll button")]
      .find((x) => /Finish and see your score/.test(x.innerText));
    if (!b || b.disabled) return false;
    b.click();
    return true;
  });
  say(finished, "the last question offers a real Finish button");
  await wait(3800);

  const after = await ask("/assess");
  const attemptsBefore = before.reduce((a, x) => a + x.attempts, 0);
  const attemptsAfter = after.reduce((a, x) => a + x.attempts, 0);
  say(attemptsAfter === attemptsBefore + 1,
      `THE SERVER MARKED AN ATTEMPT (${attemptsBefore} → ${attemptsAfter})`);

  const t = await screen();
  const scored = /\d+%/.test(t) && /(Passed|pass mark)/.test(t);
  say(scored, "and she is shown the score the server marked");
}

/* ── 7. Her profile is hers ───────────────────────────────────────────── */
head("Profile — /me/profile, not a hardcoded checklist");
{
  const me = await ask("/me/profile");
  const filled = ["avatar", "bio", "phone", "location", "dob"].filter((k) => !!me[k]).length;
  const pct = Math.round((filled / 5) * 100);

  await go("/app/profile");
  const t = await screen();
  say(t.includes(`${pct}%`), `profile strength is counted from her own fields (${pct}%)`);
  say(!/34\b/.test(t) && !/looked you up/i.test(t),
      "the invented '34 people looked you up' card is gone");
  say(!/₹24,350/.test(t), "the invented '₹24,350 earned this month' is gone");
  say(!/Jaipur, Rajasthan/.test(t) || (me.location || "").includes("Jaipur"),
      "no hardcoded city is shown as hers");
  if (me.location) say(t.includes(me.location), `her real location is shown (${me.location})`);

  const certs = await ask("/me/certificates");
  say(t.includes(`${certs.length}\nCertificates`) || t.includes(`${certs.length} Certificates`)
      || new RegExp(`${certs.length}\\s*\\n?\\s*Certificates`).test(t),
      `the certificate count is the server's (${certs.length})`);

  await go("/app/profile/preview");
  const p = await screen();
  say(!/I sew, and I am learning to sell online/.test(p),
      "the preview no longer prints a stranger's line as her own");
  say(!/\b87\b/.test(p), "and no longer claims 87 orders delivered");
}

/* ── 8. Nothing left that confirms without doing ──────────────────────── */
head("The buttons that claimed without acting");
{
  const dead = [
    ["/app/settings/account", /Photo removed/, "settings/account — 'Photo removed'"],
    ["/app/settings/account", /Check both inboxes/, "settings/account — 'Check both inboxes'"],
    ["/app/wallet/statement", /Email it to me/, "wallet/statement — 'Email it to me'"],
    ["/app/schedule", /Remind me/, "schedule — 'Remind me'"],
    ["/app/family", /Go and see it/, "family — 'Go and see it'"],
    ["/app/bookings", /Add to calendar/, "bookings — 'Add to calendar'"],
  ];
  for (const [path, re, name] of dead) {
    await go(path, 3600);
    const t = await screen();
    say(!re.test(t), `${name} is gone`);
  }

  // Cancelling a mentor request had no endpoint and said "We have told {her}".
  await go("/app/mentors", 4200);
  await pressWhenReady(/^My sessions$/);
  await wait(1600);
  const t = await screen();
  say(!/We have told/.test(t), "mentors — 'We have told {her}' is gone");
}

/* ── 9. A story is the story that was written ─────────────────────────── */
head("Stories — one woman's words, and a like that is recorded");
{
  const stories = await ask("/community/stories");
  if (!stories.length) {
    say(false, "no published stories to check against");
  } else {
    const one = stories[0];
    await go(`/app/stories/${one.id}`);
    const t = await screen();
    say(t.includes(one.author_name), `the author is the server's (${one.author_name})`);
    say(!/The hardest part was not the work/.test(t),
        "the two paragraphs nobody wrote are gone from under her name");
    say(!/1\.2 km away/.test(t) && !/₹18,000 a month/.test(t),
        "no fixture trade, distance or income is attributed to her");

    const likesBefore = one.likes;
    await look(() => {
      const b = [...document.querySelectorAll("#ux-scroll button")]
        .find((x) => /like/i.test(x.getAttribute("aria-label") ?? ""));
      b?.click();
    });
    await wait(2600);
    const again = (await ask("/community/stories")).find((s) => s.id === one.id);
    say(again.likes !== likesBefore,
        `THE LIKE REACHED THE SERVER (${likesBefore} → ${again.likes})`);
    // Put it back so the check leaves the story as it found it.
    await ask(`/community/stories/${one.id}/like`, { method: "POST" });
  }
}

/* ── 10. Her photograph ───────────────────────────────────────────────── */
head("Change and remove your photo — POST /uploads then PATCH /me/profile");
{
  const was = (await ask("/me/profile")).avatar || "";
  // A one-pixel PNG, written where a check may write. The file input is
  // deliberately hidden on the screen; `uploadFile` drives it all the same.
  const png = join(tmpdir(), `womsakhi-check-${Date.now()}.png`);
  writeFileSync(png, Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64"));

  await go("/app/settings/account", 5000);
  const input = await page.$('input[type="file"]');
  say(!!input, "there is a real file input behind Change — it opened nothing before");

  if (input) {
    await input.uploadFile(png);
    await wait(6000);
    const now = (await ask("/me/profile")).avatar || "";
    say(!!now && now !== was, `THE PHOTO IS ON HER PROFILE ON THE SERVER (${now.slice(-28) || "—"})`);

    await pressWhenReady(/^Remove$/);
    await wait(4500);
    const cleared = (await ask("/me/profile")).avatar || "";
    say(cleared === "", "and Remove actually clears it — it used to only say so");
  }

  unlinkSync(png);
  // Leave her profile as it was found.
  await ask("/me/profile", { method: "PATCH", body: JSON.stringify({ avatar: was }) });
}

await browser.close();
finish(fail, lines, "Every one of these buttons now reaches the server, and the ones that cannot say so");
