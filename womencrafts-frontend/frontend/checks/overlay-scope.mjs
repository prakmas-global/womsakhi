/**
 * A drawer must be on top, reachable, and only where it was meant to be.
 *
 * `Sheet` renders through a portal now, and that fixed one bug and made two
 * more possible. All three are invisible to `tsc`, to the linter and to a
 * `curl`, so they are checked here by opening a real one:
 *
 *  1. ON TOP — before the portal, `z-index` ranked the sheet only against its
 *     siblings, and HomeShell's sticky rail painted its tip cards straight
 *     over an open drawer while the dim behind it worked perfectly.
 *
 *  2. REACHABLE — `sm:bottom-auto` came after `sm:inset-y-0` and undid it, so
 *     on a desktop the panel took its height from its content instead of the
 *     viewport. The body never scrolled and a long form pushed its own Cancel
 *     and Send several hundred pixels below the bottom of the screen.
 *
 *  3. PHONE-ONLY STAYS PHONE-ONLY — a portalled sheet escapes an ancestor's
 *     `lg:hidden`, so the slot sheet started opening on desktops too, on top
 *     of the panel that already showed the same thing.
 *
 *     That third case is not checked any more, because its only subject is
 *     gone: `/app/shop/slots` was a week-grid built entirely from a fixture —
 *     it told her Sunita Devi was coming at 10:00 today — and the sheet that
 *     opened when she tapped a square went with it. No screen left in the app
 *     gates a `Sheet` on `useNarrow`. The lesson is kept here in words so that
 *     whoever builds the next narrow-only sheet knows to check it; a test that
 *     opens a screen that no longer exists is not a test.
 */
import puppeteer from "puppeteer-core";
import { CHROME, APP, seededMemberToken } from "./_shared.mjs";

const tok = await seededMemberToken();
if (!tok) { console.log(" FAIL  could not sign in"); process.exit(1); }

const b = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox"] });
const fails = [];
const ok = (cond, msg) => {
  console.log(`  ${cond ? "ok  " : "FAIL"}  ${msg}`);
  if (!cond) fails.push(msg);
};

async function page(w, h) {
  const p = await b.newPage();
  await p.setViewport({ width: w, height: h });
  await p.setCookie({ name: "access_token", value: tok, domain: "localhost", path: "/" });
  return p;
}
const settle = (ms = 1200) => new Promise((r) => setTimeout(r, ms));

/* ── 1 and 2: the quote drawer, on a desktop ──────────────────────────────── */
{
  const p = await page(1440, 900);
  await p.goto(`${APP}/app/documents/new`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await settle(2500);

  // Step 1 gates on a title, a category and a short description.
  await p.type('input[aria-label="Title"]', "Handmade cotton kurta");
  await p.select('select[aria-label="Category"]', "Clothing and stitching").catch(() => {});
  await p.type('textarea[aria-label="Short description"]', "A soft cotton kurta, stitched by hand.")
    .catch(() => {});
  await settle(500);

  const click = async (src) => {
    const i = await p.$$eval("button", (bs, s) =>
      bs.findIndex((x) => new RegExp(s, "i").test((x.textContent || "").trim())), src);
    if (i < 0) return false;
    await p.evaluate((n) => document.querySelectorAll("button")[n].click(), i);
    await settle();
    return true;
  };
  await click("^next");
  await click("by quote");
  const opened = await click("^ask for a price$");
  ok(opened, "the wizard's own preview opens the buyer's form");

  const m = await p.evaluate(() => {
    const panel = document.querySelector('[role="dialog"]');
    if (!panel) return null;
    const r = panel.getBoundingClientRect();
    const over = document.elementFromPoint(r.left + r.width / 2, r.top + Math.min(300, r.height / 3));
    const send = [...panel.querySelectorAll("button")]
      .find((x) => /send request/i.test(x.textContent || ""));
    const sr = send?.getBoundingClientRect();
    return {
      onTop: !!over && panel.contains(over),
      fitsViewport: r.height <= innerHeight + 1,
      sendOnScreen: !!sr && sr.top >= 0 && sr.bottom <= innerHeight + 1,
    };
  });
  ok(m?.onTop, "nothing from the page paints over the open drawer");
  ok(m?.fitsViewport, "the panel is the height of the window, not of its contents");
  ok(m?.sendOnScreen, "Send request is on screen, not below the fold");
  await p.close();
}


await b.close();
console.log(fails.length ? `\n FAIL  ${fails.length} of 4` : "\n PASS");
process.exit(fails.length ? 1 : 0);
