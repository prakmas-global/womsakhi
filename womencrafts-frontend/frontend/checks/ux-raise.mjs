/**
 * Does every card actually come toward you?
 *
 * Not "is the class present" — every card in the main column is scrolled into
 * view, hovered with a real pointer, and read back. A card can carry `.ux-i`
 * and still not move because something later in the cascade sets `transform`
 * on the same element; that is exactly what the tilt rule was doing to the
 * quick-action tiles, and only a measurement caught it.
 *
 * Four things have to be true of a raised card, and the fourth is the one that
 * makes it read as depth rather than as a twitch: its neighbours step back.
 */
import { launch, pageAs, seededMemberToken } from "./_shared.mjs";

const APP = process.env.UX_URL || "http://localhost:3100";
/* `/app/saved` is in the list because it is the only one of the three that
   uses `.ux-deck`. The other two carry `.ux-i` cards and were being asked
   whether their neighbours receded — a question with no `.ux-deck` on the page
   to answer it, so the check reported "0 of them" and had been red since the
   Home quick-access grid was removed in the navigation rebuild. The lift and
   scale assertions still run on all three; the neighbour one now runs where
   the feature actually is. */
const ROUTES = ["/app", "/app/opportunities", "/app/saved"];
const MIN_SCALE = 1.012;   // below this nobody perceives it as approaching
const MIN_LIFT = 4;        // px
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const fail = [];

const parse = (m) => {
  const n = (m || "").match(/matrix\(([^)]+)\)/);
  if (!n) return { s: 1, y: 0 };
  const p = n[1].split(",").map(Number);
  return { s: p[0], y: p[5] };
};

const token = await seededMemberToken();
const browser = await launch();

for (const route of ROUTES) {
  const page = await pageAs(browser, token, { width: 1536, height: 1024 });
  await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "no-preference" }]);
  await page.goto(APP + route, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForFunction(() => document.querySelector("aside") !== null, { timeout: 60000 });
  await wait(2500);

  const total = await page.$$eval("main .ux-i", (n) => n.length);
  console.log(`\n  ${route} — ${total} cards`);

  let raised = 0, receded = 0, flat = [];
  for (let i = 0; i < total; i++) {
    // Bring it into the scrollport first: a pointer cannot hover a row that is
    // 400px below the fold, and mouse.move to an off-screen y silently does
    // nothing rather than erroring.
    const box = await page.evaluate((n) => {
      const el = document.querySelectorAll("main .ux-i")[n];
      el.scrollIntoView({ block: "center", behavior: "instant" });
      const r = el.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width, h: r.height,
               label: (el.innerText || "").trim().split("\n")[0].slice(0, 26) };
    }, i);
    if (box.y < 90 || box.y > 1010) continue;   // still under the topbar or off-screen

    await page.mouse.move(4, 300);
    await wait(320);
    const before = await page.evaluate((n) => {
      const e = document.querySelectorAll("main .ux-i")[n];
      return { t: getComputedStyle(e).transform, sh: getComputedStyle(e).boxShadow };
    }, i);

    await page.mouse.move(box.x, box.y);
    await wait(420);
    const after = await page.evaluate((n) => {
      const els = document.querySelectorAll("main .ux-i");
      const e = els[n];
      const deck = e.closest(".ux-deck");
      // A sibling in the same deck, to see whether it stepped back.
      const sib = deck ? [...deck.querySelectorAll(".ux-i")].find((x) => x !== e) : null;
      return {
        t: getComputedStyle(e).transform,
        sh: getComputedStyle(e).boxShadow,
        z: getComputedStyle(e).zIndex,
        sibT: sib ? getComputedStyle(sib).transform : null,
        sibFilter: sib ? getComputedStyle(sib).filter : null,
      };
    }, i);

    const B = parse(before.t), A = parse(after.t);
    const lift = B.y - A.y;
    const ok = A.s >= MIN_SCALE && lift >= MIN_LIFT && before.sh !== after.sh;
    if (ok) raised++;
    else flat.push(`${box.label} — scale ${A.s.toFixed(3)}, lift ${lift.toFixed(1)}px`);

    if (after.sibT) {
      const S = parse(after.sibT);
      // Shrunk AND desaturated: the recede is carried by filter rather than
      // opacity, because the scroll reveal on these cards already owns opacity.
      if (S.s < 0.995 && /saturate/.test(after.sibFilter || "")) receded++;
    }
  }

  console.log(`  ${raised === total || flat.length === 0 ? "ok  " : "✗   "} ${raised} of ${total} raise on hover ` +
              `(scale ≥ ${MIN_SCALE}, lift ≥ ${MIN_LIFT}px, shadow grows)`);
  // Only assert the recede where there is a deck to recede within.
  const decks = await page.evaluate(() => document.querySelectorAll("main .ux-deck").length);
  if (!decks) console.log(`  ok   no deck on this screen, so no neighbours to step back`);
  else console.log(`  ${receded > 0 ? "ok  " : "✗   "} neighbours stepped back on ${receded} of them`);
  for (const f of flat.slice(0, 4)) console.log(`       flat: ${f}`);
  if (flat.length) fail.push(`${route}: ${flat.length} card(s) do not raise — ${flat[0]}`);
  if (decks && !receded) fail.push(`${route}: no deck receded, so nothing reads as coming forward`);

  await page.close();
}

/**
 * A hover must not reach outside its own card.
 *
 * `.ux-deck` dims every `.ux-i` beneath it, and it matches descendants — so
 * marking a grid of cards as a deck made hovering one row in one card dim every
 * row in every OTHER card. Measured at the time: ten rows across three cards
 * reacted to a single hover. Nothing in the markup looks wrong when that
 * happens, which is why it is checked rather than reviewed.
 */
{
  const page = await pageAs(browser, token, { width: 1536, height: 1024 });
  await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "no-preference" }]);
  /* `/app/saved` and not `/app`. This block hovers a row inside a deck and
     asserts the dimming stops at that deck's edge — and `/app` has had no
     `.ux-deck` on it since the navigation rebuild removed the quick-access
     grid, so `host` came back undefined and the whole check crashed rather
     than failing. It runs where there is a deck to test. */
  await page.goto(APP + "/app/saved", { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForFunction(() => document.querySelector("aside") !== null, { timeout: 60000 });
  await wait(2500);

  const cardsWith = () => page.evaluate(() =>
    [...document.querySelectorAll("main section")]
      .filter((s) => s.querySelector(".ux-i"))
      .map((s) => ({
        name: (s.innerText || "").trim().split("\n")[0].slice(0, 26),
        dimmed: [...s.querySelectorAll(".ux-i")]
          .filter((e) => /saturate/.test(getComputedStyle(e).filter)).length,
      })));

  const box = await page.evaluate(() => {
    // A card whose deck has SIBLINGS — hovering a lone card dims nothing and
    // would let this pass while proving nothing.
    const host = [...document.querySelectorAll("main section")]
      .find((s) => {
        const deck = s.querySelector(".ux-deck");
        return deck && deck.querySelectorAll(".ux-i").length >= 2;
      });
    if (!host) return null;
    const row = host.querySelector(".ux-deck .ux-i");
    row.scrollIntoView({ block: "center", behavior: "instant" });
    const r = row.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2,
             host: (host.innerText || "").trim().split("\n")[0].slice(0, 26) };
  });
  if (!box) {
    console.log("\n  no multi-card deck on this screen — nothing to isolate");
    await page.close();
  } else {
  await page.mouse.move(4, 300); await wait(400);
  await page.mouse.move(box.x, box.y); await wait(650);

  const after = await cardsWith();
  const strayed = after.filter((c) => c.name !== box.host && c.dimmed > 0);
  const own = after.find((c) => c.name === box.host);
  console.log(`\n  hovering a row in "${box.host}"`);
  for (const c of after) console.log(`       ${c.name.padEnd(28)} ${c.dimmed} dimmed`);
  // Both halves matter: it has to work inside, and stop at the edge.
  console.log(`  ${own && own.dimmed > 0 ? "ok  " : "✗   "} its own neighbours receded (${own ? own.dimmed : 0})`);
  console.log(`  ${strayed.length === 0 ? "ok  " : "✗   "} and no other card reacted`);
  if (!own || own.dimmed === 0) fail.push("the deck did not dim anything, so nothing was actually tested");
  if (strayed.length) fail.push(`hover bleeds into ${strayed.map((c) => `"${c.name}"`).join(", ")}`);
  await page.close();
  }
}

/* Under reduced motion the whole thing must stand down. */
const page = await pageAs(browser, token, { width: 1536, height: 1024 });
await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
/* `/app/saved`, for the same reason as the block above: `/app` has carried no
   `.ux-i` since the quick-access grid was removed, so `main .ux-i` threw. */
await page.goto(APP + "/app/saved", { waitUntil: "domcontentloaded", timeout: 120000 });
await page.waitForFunction(() => document.querySelector("aside") !== null, { timeout: 60000 });
await wait(2200);
const box = await page.$eval("main .ux-i", (e) => {
  e.scrollIntoView({ block: "center", behavior: "instant" });
  const r = e.getBoundingClientRect();
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
});
await page.mouse.move(box.x, box.y);
await wait(500);
const still = await page.$eval("main .ux-i", (e) => {
  const deck = e.closest(".ux-deck");
  const sib = deck ? [...deck.querySelectorAll(".ux-i")].find((x) => x !== e) : null;
  return { t: getComputedStyle(e).transform, sibF: sib ? getComputedStyle(sib).filter : "none" };
});
const R = parse(still.t);
const held = Math.abs(R.s - 1) < 0.002 && Math.abs(R.y) < 1 && !/saturate/.test(still.sibF);
console.log(`\n  ${held ? "ok  " : "✗   "} reduced motion: nothing moves and nothing dims ` +
            `(scale ${R.s.toFixed(3)}, lift ${R.y.toFixed(1)}, sibling filter ${still.sibF})`);
if (!held) fail.push("reduced motion: cards still move on hover");
await page.close();

await browser.close();
console.log(fail.length
  ? "\n  " + fail.map((f) => "✗ " + f).join("\n  ") + "\n"
  : "\n  every card rises toward the pointer, its neighbours step back, and all of it stops when asked\n");
process.exit(fail.length ? 1 : 0);
