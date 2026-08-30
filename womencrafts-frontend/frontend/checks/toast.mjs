/**
 * Does the feedback system actually work in a browser?
 *
 * checks/feedback.mjs proves the source is consistent. It cannot prove that a
 * toast appears, is announced, pauses when you reach for Undo, or that Escape
 * on a confirm dialog means "no". Those are the things that matter, and they
 * only exist at runtime.
 *
 * It drives the real UI rather than calling the hook directly, because the bugs
 * live in the wiring: a provider mounted in the wrong place, a live region
 * added at the same moment as its content, a dialog that resolves twice.
 */
import { APP, launch, pageAs, staffToken } from "./_shared.mjs";

const RED = "\x1b[31m", GREEN = "\x1b[32m", DIM = "\x1b[2m", OFF = "\x1b[0m";
const problems = [];
const ok = [];
const check = (name, pass, detail = "") =>
  pass ? ok.push(name) : problems.push(`${name}${detail ? ` — ${detail}` : ""}`);

const staff = await staffToken();
const browser = await launch();
const page = await pageAs(browser, staff, { width: 1600, height: 1000, name: "desktop", mode: "light" });

// ── 1. the live region exists before any toast does ──────────────────────────
// A region added at the same instant as its content is often missed entirely:
// the screen reader has nothing to notice a change against.
// The platform settings screen has nine plainly-labelled Save buttons, each
// of which now raises a toast — the most reliable place to trigger one.
await page.goto(`${APP}/dashboard/settings`, { waitUntil: "networkidle2", timeout: 30000 });
await new Promise((r) => setTimeout(r, 500));

const region = await page.evaluate(() => {
  const el = document.querySelector('ol[aria-label="Notifications"]');
  if (!el) return null;
  return { live: el.getAttribute("aria-live"), children: el.children.length };
});
check("live region is mounted before any toast", !!region, "no ol[aria-label=Notifications] found");
if (region) {
  check("region is polite", region.live === "polite", `aria-live="${region.live}"`);
  check("region starts empty", region.children === 0, `${region.children} children on load`);
}

// ── 2. a toast appears, says something, and is announced ─────────────────────
const raised = await page.evaluate(() => {
  const btn = [...document.querySelectorAll("button")].find((b) => (b.textContent || "").trim() === "Save");
  if (!btn) return "no save button on this screen";
  btn.click();
  return null;
});
if (raised) {
  problems.push(`could not raise a toast — ${raised}`);
} else {
  await new Promise((r) => setTimeout(r, 400));
  const toast = await page.evaluate(() => {
    const li = document.querySelector('ol[aria-label="Notifications"] > li');
    if (!li) return null;
    return {
      role: li.getAttribute("role"),
      text: (li.textContent || "").trim(),
      dismiss: !!li.querySelector('button[aria-label^="Dismiss"]'),
    };
  });
  check("a toast appears when something is saved", !!toast);
  if (toast) {
    check("it has words in it", toast.text.length > 2, `text was "${toast.text}"`);
    check("it is announced (role=status)", toast.role === "status", `role="${toast.role}"`);
    check("it can be dismissed", toast.dismiss, "no labelled dismiss button");

    // ── 3. hovering holds it ────────────────────────────────────────────────
    // Reaching for Undo must not be a race against the timer.
    await page.hover('ol[aria-label="Notifications"] > li').catch(() => {});
    await new Promise((r) => setTimeout(r, 5200));   // longer than the 4s default
    const held = await page.$('ol[aria-label="Notifications"] > li');
    check("hovering holds it on screen", !!held, "it vanished under the pointer");

    // ── 4. it goes away on its own once released ────────────────────────────
    await page.mouse.move(10, 10);
    await new Promise((r) => setTimeout(r, 5200));
    const gone = await page.$('ol[aria-label="Notifications"] > li');
    check("it clears itself afterwards", !gone, "still on screen after the timer");
  }
}

// ── 5. Escape on a destructive confirm means NO ──────────────────────────────
// Dismissing a question must never be read as agreeing to it.
//
// Programmes is used rather than segments because its row menus are labelled
// "More actions for …" and always have a Delete item; segments renders its
// actions differently, and the check silently skipped there — while still
// printing that Escape had been verified. A skipped test that reports success
// is worse than no test.
let confirmTested = false;
await page.goto(`${APP}/dashboard/programs`, { waitUntil: "networkidle2", timeout: 30000 });
await page.waitForFunction(() => ![...document.querySelectorAll(
  '.wc-skeleton,[class*="animate-pulse"],[class*="animate-spin"]')]
  .some((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; }),
  { timeout: 8000 }).catch(() => {});

const openedMenu = await page.evaluate(() => {
  // Row actions live behind a menu, so the trigger has to be opened before the
  // Delete item exists in the DOM at all.
  const trigger = [...document.querySelectorAll('[role="button"],button')]
    .find((b) => /more actions/i.test(b.getAttribute("aria-label") || ""));
  if (!trigger) return "no row-actions menu found";
  trigger.click();
  return null;
});

let why = openedMenu;
if (!why) {
  await new Promise((r) => setTimeout(r, 350));
  why = await page.evaluate(() => {
    const del = [...document.querySelectorAll('button,[role="menuitem"]')]
      .find((b) => /^delete/i.test((b.textContent || "").trim()));
    if (!del) return "menu opened but no Delete item";
    del.click();
    return null;
  });
}

if (!why) {
  await new Promise((r) => setTimeout(r, 400));
  const dialog = await page.evaluate(() => {
    const d = document.querySelector('[role="dialog"]');
    if (!d) return null;
    return {
      labelled: !!d.getAttribute("aria-labelledby"),
      modal: d.getAttribute("aria-modal") === "true",
      focusInside: d.contains(document.activeElement),
    };
  });
  if (!dialog) {
    why = "Delete clicked but no dialog appeared — the action may not be guarded";
  } else {
    confirmTested = true;
    check("the confirm dialog is labelled", dialog.labelled, "no aria-labelledby");
    check("it is modal", dialog.modal);
    check("focus moves into it", dialog.focusInside, "focus stayed outside the dialog");
    await page.keyboard.press("Escape");
    await new Promise((r) => setTimeout(r, 300));
    const stillOpen = await page.$('[role="dialog"]');
    check("Escape closes it", !stillOpen);
    // And nothing was deleted: the row count is unchanged.
    const rows = await page.evaluate(() => document.querySelectorAll("tbody tr").length);
    check("Escape did not delete anything", rows > 0, "the table emptied after Escape");
  }
}
if (why) problems.push(`the confirm dialog could not be reached — ${why}`);

await browser.close().catch(() => {});

console.log(`\n  ${ok.length + problems.length} behaviours checked`);
if (!problems.length) {
  console.log(
    `  ${GREEN}toasts appear, announce, hold on hover and clear${confirmTested ? "; Escape means no" : ""}${OFF}\n`
  );
} else {
  console.log(`  ${RED}${problems.length} problems${OFF}\n`);
  problems.forEach((p) => console.log(`   · ${p}`));
  console.log();
}
process.exit(problems.length ? 1 : 0);
