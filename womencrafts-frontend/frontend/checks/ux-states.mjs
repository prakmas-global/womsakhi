/**
 * Phase 3 — loading and error, on every screen.
 *
 * Before this, 0 of 38 screens handled a dead API and 3 had a loading state.
 * This walks EVERY member route in both states, in both themes, because the
 * failure mode is not one broken screen — it is the one screen nobody
 * remembered, found by a woman on a train with two bars of signal.
 *
 * The assertions are about what the states SAY, not that they exist. A skeleton
 * that is one grey bar and an error that says "Something went wrong" would both
 * pass a presence check and fail a person.
 */
import { launch, seededMemberToken } from "./_shared.mjs";
import { APP, audit, finish, report, wait } from "./_screen.mjs";

/** Every route that renders inside the member shell. */
const ROUTES = [
  "/app", "/app/progress", "/app/schedule", "/app/notifications", "/app/profile",
  "/app/profile/preview", "/app/search", "/app/explore", "/app/events", "/app/events/e1",
  "/app/intake", "/app/programs", "/app/programs/dm-basics",
  "/app/programs/dm-basics/lesson/6", "/app/mentors", "/app/mentors/m1", "/app/library",
  "/app/library/x1", "/app/certificates", "/app/opportunities", "/app/opportunities/w1",
  "/app/applications", "/app/documents", "/app/documents/product/p1",
  "/app/documents/order/s1", "/app/documents/service/sv1",
  "/app/circles/c1/pay", "/app/progress/goals", "/app/wallet", "/app/payments", "/app/support-fund",
  "/app/bookings", "/app/bookings/bk1", "/app/checkout/WS-24817", "/app/circles",
  "/app/circles/c1", "/app/circles/new", "/app/stories", "/app/stories/st1",
  "/app/messages", "/app/settings", "/app/settings/account", "/app/settings/language",
  "/app/settings/appearance", "/app/settings/notifications", "/app/settings/security",
  "/app/help", "/app/safety", "/app/refer", "/app/feedback",
  "/app/health", "/app/rights", "/app/family", "/app/travel",
  "/app/assess", "/app/digital", "/app/cover", "/app/group-buy",
  "/app/settings/voice", "/app/settings/offline",
  // Phase 6.
  "/app/saved", "/app/sakhi", "/app/wallet/withdraw", "/app/wallet/statement",
  "/app/settings/payments", "/app/support-fund/sc1", "/app/documents/vault",
];

const fail = [];
const lines = [];
const token = await seededMemberToken();
const browser = await launch();

const join = (r, s) => r + (r.includes("?") ? "&" : "?") + "state=" + s;

/* -- Every route, both states ------------------------------------------ */
let loadingOk = 0, errorOk = 0;
for (const route of ROUTES) {
  const L = await audit(browser, token, { route: join(route, "loading"), settle: 1400 });
  const l = await L.page.evaluate(() => ({
    skeletons: document.querySelectorAll(".ux-skeleton").length,
    status: !!document.querySelector('[role="status"]'),
    announced: (document.querySelector('[role="status"]') || {}).innerText || "",
    nav: !!document.querySelector("aside") && !!document.querySelector("header"),
  }));
  // A skeleton has to be shaped like the page, not one grey bar.
  const lOK = l.skeletons >= 6 && l.status && /Loading/i.test(l.announced) && l.nav;
  if (lOK) loadingOk++;
  else fail.push(`${route} loading: ${l.skeletons} blocks, status=${l.status}, nav=${l.nav}`);
  await L.page.close();

  const E = await audit(browser, token, { route: join(route, "error"), settle: 1400 });
  const e = await E.page.evaluate(() => {
    const t = document.querySelector('[role="alert"]');
    return {
      alert: !!t,
      text: t ? t.innerText : "",
      // Retry first, and a way out that is not the broken screen.
      retry: [...document.querySelectorAll('[role="alert"] button, [role="alert"] a')]
        .map((x) => x.innerText.trim()),
      nav: !!document.querySelector("aside") && !!document.querySelector("header"),
    };
  });
  const eOK = e.alert
    && /could not load/i.test(e.text)
    && !/something went wrong/i.test(e.text)
    && /has been lost/i.test(e.text)
    && e.retry[0] === "Try again"
    && e.nav;
  if (eOK) errorOk++;
  else fail.push(`${route} error: alert=${e.alert}, first action="${e.retry[0]}", nav=${e.nav}`);
  await E.page.close();
}

lines.push(`  ${loadingOk === ROUTES.length ? "ok  " : "✗   "} loading renders on ${loadingOk} of ${ROUTES.length} routes`);
lines.push(`  ${errorOk === ROUTES.length ? "ok  " : "✗   "} error renders on ${errorOk} of ${ROUTES.length} routes`);

const say = (ok, msg) => { lines.push(`  ${ok ? "ok  " : "✗   "} ${msg}`); if (!ok) fail.push(msg); };

/* -- Both states pass the same bar as every other screen --------------- */
for (const [name, route] of [["loading", "/app/opportunities?state=loading"],
                             ["error", "/app/opportunities?state=error"]]) {
  for (const mode of ["light", "dark"]) {
    const a = await audit(browser, token, { route, mode, settle: 1500 });
    report(name, mode, a, fail, lines);
    await a.page.close();
  }
}

/* -- The error names what failed, in her words ------------------------- */
{
  const cases = [
    ["/app/wallet?state=error", /your money/i],
    ["/app/applications?state=error", /your applications/i],
    ["/app/documents?state=error", /your business/i],
    ["/app/mentors?state=error", /the mentors/i],
  ];
  let named = 0;
  for (const [route, re] of cases) {
    const a = await audit(browser, token, { route, settle: 1200 });
    // Wait for the alert rather than guessing at 1200ms: a cold compile made
    // this read null and take the whole check down with it.
    await a.page.waitForSelector('[role="alert"]', { timeout: 60000 }).catch(() => {});
    const t = await a.page.evaluate(() => document.querySelector('[role="alert"]')?.innerText ?? "");
    if (re.test(t)) named++;
    else fail.push(`${route}: says "${(t.match(/We could not load [^\n]*/) || ["?"])[0]}"`);
    await a.page.close();
  }
  // "An error occurred" implies the whole app is broken. Naming the one thing
  // that failed tells her the rest still works.
  say(named === cases.length, `each error names what failed rather than "an error occurred" (${named}/${cases.length})`);
}

/* -- Next's own route boundaries exist, not just the forced ones ------- */
{
  const fs = await import("node:fs");
  const g = await import("node:child_process");
  const pages = g.execSync("find src/app/app -name page.tsx").toString().trim().split("\n");
  const missing = [];
  for (const p of pages) {
    const d = p.replace("/page.tsx", "");
    const route = d.replace("src/app/app", "") || "/";
    if (/\/(sakhi|verify|welcome)$/.test(d)) continue;   // frozen, or bare by design
    if (!fs.existsSync(`${d}/loading.tsx`)) missing.push(`${route} loading.tsx`);
    if (!fs.existsSync(`${d}/error.tsx`)) missing.push(`${route} error.tsx`);
  }
  // These are what fire on a genuinely slow connection or a real thrown error —
  // the forced states above only prove the components render.
  say(missing.length === 0,
      `every route has Next's own loading and error boundaries (${pages.length - 3} routes${missing.length ? `, missing ${missing.length}` : ""})`);
  for (const m of missing.slice(0, 4)) fail.push(`missing ${m}`);
}

await browser.close();
finish(fail, lines, `Phase 3 complete: ${ROUTES.length} routes have a loading state and an error state that says what failed`);
