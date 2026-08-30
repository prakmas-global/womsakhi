/**
 * The two-level navigation.
 *
 * The mode and the rail item are derived from the URL, which is the right
 * design and also the one that fails silently: a bad prefix rule highlights
 * "Home" while she is deep inside Work, and nothing throws. So every route in
 * the product is opened and asked which mode it thinks it is in.
 */
import { launch, pageAs, seededMemberToken } from "./_shared.mjs";
import { APP, wait } from "./_screen.mjs";

/** route → the mode tab that must be underlined, or null for "no mode". */
const EXPECT = [
  ["/app", "Home"],
  ["/app/progress", "Home"],
  ["/app/schedule", "Home"],
  ["/app/notifications", "Home"],
  ["/app/profile", "Home", "also"],
  ["/app/search?q=digital", "Home", "also"],
  ["/app/explore", "Discover"],
  ["/app/events", "Discover"],
  ["/app/intake", "Discover"],
  ["/app/programs", "Learn"],
  ["/app/mentors", "Learn"],
  ["/app/mentors/m1", "Learn"],
  ["/app/library", "Learn"],
  ["/app/certificates", "Learn"],
  ["/app/programs/dm-basics", "Learn"],
  ["/app/programs/dm-basics/lesson/6", "Learn"],
  ["/app/events/e1", "Discover"],
  ["/app/stories/st1", "Community"],
  ["/app/bookings/bk1", "Money", "also"],
  ["/app/checkout/WS-24817", "Money", "also"],
  ["/app/opportunities", "Work"],
  ["/app/opportunities/w1", "Work"],
  ["/app/applications", "Work"],
  ["/app/documents", "Work"],
  ["/app/documents/product/p1", "Work"],
  ["/app/documents/order/s1", "Work"],
  ["/app/circles/new", "Community"],
  ["/app/library/x1", "Learn"],
  ["/app/profile/preview", "Home", "also"],
  ["/app/wallet", "Money"],
  ["/app/payments", "Money"],
  ["/app/support-fund", "Money"],
  ["/app/bookings", "Money", "also"],
  ["/app/health", "Wellbeing"],
  ["/app/rights", "Wellbeing"],
  ["/app/family", "Wellbeing"],
  ["/app/travel", "Wellbeing"],
  ["/app/assess", "Learn"],
  ["/app/digital", "Learn"],
  ["/app/cover", "Money"],
  ["/app/group-buy", "Work"],
  ["/app/circles", "Community"],
  ["/app/circles/c1", "Community"],
  ["/app/stories", "Community"],
  ["/app/messages", "Community"],
  // Phase 6.
  ["/app/saved", "Home"],
  ["/app/sakhi", "Home"],
  ["/app/wallet/withdraw", "Money"],
  ["/app/wallet/statement", "Money"],
  ["/app/support-fund/sc1", "Money"],
  ["/app/documents/vault", "Work"],
  // Not modes on purpose — they live in the account menu.
  ["/app/settings", null],
  ["/app/settings/payments", null],
  ["/app/help", null],
  ["/app/safety", null],
  ["/app/refer", null],
  ["/app/feedback", null],
];

const fail = [];
const lines = [];
const token = await seededMemberToken();
const browser = await launch();
const page = await pageAs(browser, token, { width: 1536, height: 1024 });

for (const [route, want, kind] of EXPECT) {
  await page.goto(APP + route, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForFunction(() => document.querySelector("header") !== null, { timeout: 60000 }).catch(() => {});
  await wait(700);

  const got = await page.evaluate(() => {
    const tab = document.querySelector('header nav a[aria-current="page"]');
    const rail = document.querySelector('aside a[aria-current="page"]');
    return {
      mode: tab ? tab.innerText.trim() : null,
      item: rail ? rail.innerText.trim().split("\n")[0] : null,
      tabs: [...document.querySelectorAll("header nav a")].map((a) => a.innerText.trim()),
      railItems: [...document.querySelectorAll("aside nav a")].length,
      // A deep route must still resolve to exactly one underlined tab.
      underlined: document.querySelectorAll('header nav a[aria-current="page"]').length,
    };
  });

  const ok = got.mode === want && got.underlined === (want ? 1 : 0);
  lines.push(`  ${ok ? "ok  " : "✗   "} ${route.padEnd(26)} → ${String(got.mode).padEnd(10)} ` +
             `${got.item ? `· ${got.item}` : ""}`);
  if (!ok) fail.push(`${route}: highlights "${got.mode}", should be ${want ? `"${want}"` : "nothing"}`);
  if (got.tabs.length !== 7) fail.push(`${route}: ${got.tabs.length} mode tabs, expected 7`);
  // Inside a mode, the rail must actually offer that mode's sections.
  if (want && got.railItems < 3) fail.push(`${route}: the rail shows ${got.railItems} sections`);
  // And the current section has to be marked, or she cannot tell where she is.
  // A section must mark itself; an `also` route sits inside a mode without
  // being one of its sections, so nothing being marked is the truth.
  if (want && kind !== "also" && !got.item) fail.push(`${route}: no rail item is marked current`);
}

/* Every rail item, in every mode, must lead somewhere that renders. */
const seen = new Set();
for (const [route, want] of EXPECT) {
  if (!want || seen.has(want)) continue;
  seen.add(want);
  await page.goto(APP + route, { waitUntil: "domcontentloaded", timeout: 120000 });
  // Wait for the rail itself: 600ms read a cold route's skeleton and reported
  // a mode with four sections as having none.
  await page.waitForFunction(() => document.querySelectorAll("aside nav a").length > 0,
                             { timeout: 60000 }).catch(() => {});
  await wait(400);
  const hrefs = await page.$$eval("aside nav a", (as) => as.map((a) => a.getAttribute("href")));
  for (const h of hrefs) {
    const res = await page.goto(APP + h, { waitUntil: "domcontentloaded", timeout: 120000 });
    // Long enough for a cold Turbopack compile — 500ms read a still-empty page
    // as a broken route and reported a working screen as 0 chars.
    await page.waitForFunction(() => document.body.innerText.trim().length > 200, { timeout: 45000 }).catch(() => {});
    await wait(400);
    const landed = await page.evaluate(() => ({ path: location.pathname, chars: document.body.innerText.trim().length }));
    if (!res || res.status() >= 400 || landed.chars < 200) {
      fail.push(`${want} → ${h}: ${res ? res.status() : "no response"}, ${landed.chars} chars`);
    }
  }
  lines.push(`  ok   ${want.padEnd(10)} all ${hrefs.length} sections reachable`);
}

await page.close();
await browser.close();
console.log("\n" + lines.join("\n"));
console.log(fail.length
  ? "\n  " + fail.map((f) => "✗ " + f).join("\n  ") + "\n"
  : `\n  ${EXPECT.length} routes resolve to the right mode, and every section behind every mode renders\n`);
process.exit(fail.length ? 1 : 0);
