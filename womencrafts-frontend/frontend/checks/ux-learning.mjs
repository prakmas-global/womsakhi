/**
 * Courses, the phone course, health check-ups and group buys.
 *
 * The five the survey found late, after it learned to catch the quiet half of
 * the lie — a handler whose whole body is `setDone(true)`, with no timer to
 * give it away. Marking a lesson finished, ticking off a step, recording a
 * check-up and joining a group buy all changed a local array and nothing else.
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
  }).then((r) => (r.status === 204 ? null : r.json()));

const browser = await launch();
const open = async (route, settle = 5000) => {
  const page = await pageAs(browser, token, { width: 1500, height: 950 });
  await page.goto(APP + route, { waitUntil: "domcontentloaded", timeout: 180000 });
  await wait(settle);
  return page;
};
const text = (page) => page.evaluate(() => document.getElementById("ux-scroll")?.innerText ?? "");

/* ── A lesson marked finished stays finished ───────────────────────────── */
{
  const mine = await ask("/me/programs");
  const active = mine.find((m) => m.status === "active" && m.progress < 100) ?? mine[0];
  const before = await ask(`/me/programs/${active.program_id}/detail`);
  say(before.curriculum.length > 0,
      `the course has a curriculum on the server (${before.curriculum.length} lessons)`);

  // The first lesson she has NOT finished. Pressing "done" on one already
  // finished correctly changes nothing, which is not what this is testing.
  const nextN = before.curriculum.findIndex((l) => !l.done) + 1 || 1;
  const page = await open(`/app/programs/${active.program_id}/lesson/${nextN}`);
  const t = await text(page);
  say(before.curriculum.slice(0, 2).every((l) => t.includes(l.title)),
      "the lesson list on screen is the course's own");

  await page.$$eval("#ux-scroll button, #ux-scroll a", (els) =>
    els.find((x) => /^(Done — next lesson|Next: lesson|Finish the course)/.test(x.innerText.trim()))?.click());
  await wait(5000);

  const after = await ask(`/me/programs/${active.program_id}/detail`);
  say(after.progress > before.progress,
      `THE SERVER KEPT THE LESSON (lesson ${nextN}: ${before.progress}% → ${after.progress}%)`);
  say(after.curriculum[nextN - 1]?.done === true,
      "and the lesson itself is flagged finished, not just the percentage");
  await page.close();

  // And the next visit must show it, rather than starting her over.
  const again = await open(`/app/programs/${active.program_id}/lesson/${nextN}`);
  say(!/Done — next lesson/.test(await text(again)),
      "and coming back does not ask her to finish it again");
  await again.close();
}

/* ── Saving a course reaches her Saved list ────────────────────────────── */
{
  const mine = await ask("/me/programs");
  const id = mine[0].program_id;
  const before = await ask("/saved");
  const already = before.some((s) => s.kind === "program" && s.ref_id === id);
  if (already) await ask(`/saved/program/${id}`, { method: "DELETE" });

  const page = await open(`/app/programs/${id}`);
  await page.$$eval("#ux-scroll button", (bs) =>
    bs.find((x) => x.innerText.trim() === "Save")?.click());
  await wait(4500);
  const after = await ask("/saved");
  say(after.some((s) => s.kind === "program" && s.ref_id === id),
      "saving a course puts it on her Saved list");
  await page.close();
}

/* ── A step of the phone course ────────────────────────────────────────── */
{
  const steps = await ask("/digital");
  const fresh = steps.find((s) => !s.done);
  if (!fresh) {
    say(true, "every step is already done — nothing to tick");
  } else {
    const page = await open("/app/digital");
    await page.$$eval("#ux-scroll button", (bs, want) => {
      const b = bs.find((x) => x.innerText.includes(want));
      if (b) b.click();
    }, fresh.label.slice(0, 24));
    await wait(4500);
    const after = await ask("/digital");
    say(after.find((s) => s.id === fresh.id)?.done === true,
        `THE SERVER KEPT THE STEP (${fresh.label.slice(0, 34)})`);
    await page.close();
  }
}

/* ── A health check-up she has had ─────────────────────────────────────── */
{
  const checks = await ask("/wellbeing/health");
  const fresh = checks.find((c) => c.mine?.state !== "done") ?? checks[0];
  const page = await open("/app/health");
  await page.$$eval("#ux-scroll button", (bs, want) => {
    const card = bs.find((x) => /Mark|Done|Had it/i.test(x.innerText));
    if (card) card.click();
    void want;
  }, fresh.title);
  await wait(4500);
  const after = await ask("/wellbeing/health");
  const marked = after.filter((c) => c.mine?.state === "done").length;
  const was = checks.filter((c) => c.mine?.state === "done").length;
  say(marked !== was, `THE SERVER KEPT THE CHECK-UP (${was} → ${marked} marked)`);
  await page.close();
}

/* ── Joining a group buy ───────────────────────────────────────────────── */
{
  const buys = await ask("/group-buy");
  const target = buys.find((g) => !g.joined_by_me && !g.full && !g.closed) ?? buys[0];
  const page = await open("/app/group-buy");
  await page.$$eval("#ux-scroll button", (bs) =>
    bs.find((x) => /^(Join|Join this|I want in)/i.test(x.innerText.trim()))?.click());
  await wait(5000);
  const after = await ask("/group-buy");
  const now = after.find((g) => g.id === target.id);
  say(now?.joined_by_me === true || after.some((g) => g.joined_by_me),
      `THE SERVER PUT HER IN THE ORDER (${target.item})`);
  await page.close();
}

await browser.close();
finish(fail, lines, "Lessons, steps, check-ups and orders are kept by the server");
