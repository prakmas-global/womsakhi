/**
 * Opening one section folds the last one shut, and you can see it happen.
 *
 * It did not, and for two reasons that both had to go:
 *
 *   The open section was derived from the URL, so it could not begin closing
 *   until the route had committed — by which point the incoming page was
 *   landing in the same frame and both panels changed in one step. Measured,
 *   309px to 0px between consecutive samples, no intermediate value at all.
 *
 *   And every navigation ran inside `document.startViewTransition()`, which
 *   render-blocks the document between its two snapshots. The rail was a still
 *   image for the only moment it had to animate. Worse, the update callback
 *   polled with `requestAnimationFrame` — which does not fire while the
 *   document is blocked — so it deadlocked and the browser held the frozen
 *   frame for its full timeout: 4,263ms per click.
 *
 * What this measures is the property she actually asked for: that the panel
 * passes through real intermediate heights on its way out rather than
 * vanishing, and that it has started doing so before the new screen arrives.
 */
import puppeteer from "puppeteer-core";
import { CHROME, APP, seededMemberToken } from "./_shared.mjs";

const tok = await seededMemberToken();
const b = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox"] });
const p = await b.newPage();
await p.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
// Headless defaults to reduce, which turns every one of these animations off
// and would have made this check pass against a completely static rail.
await p.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "no-preference" }]);
await p.setCookie({ name: "access_token", value: tok, domain: "localhost", path: "/" });

await p.goto(APP + "/app/earn", { waitUntil: "domcontentloaded", timeout: 180000 });
await p.waitForFunction(() => !!document.querySelector("aside nav[aria-label='Sections']"), { timeout: 60000 });
await new Promise(x => setTimeout(x, 2200));

const trace = await p.evaluate(async () => {
  window.__vt = 0;
  const orig = document.startViewTransition?.bind(document);
  if (orig) document.startViewTransition = (cb) => { window.__vt++; return orig(cb); };

  const rows = [...document.querySelectorAll("aside nav > div")];
  const row = (name) => rows.find(r => r.querySelector("a")?.innerText.trim().startsWith(name));
  const going = row("Earn"), coming = row("Learn");
  const h = (r) => Math.round(r.querySelector(".ux-reveal")?.getBoundingClientRect().height ?? -1);

  const t0 = performance.now();
  const log = [];
  const tick = () => log.push({ t: Math.round(performance.now() - t0), out: h(going), in: h(coming), path: location.pathname });
  tick();
  coming.querySelector("a").click();
  await new Promise((done) => {
    const step = () => { tick(); if (performance.now() - t0 > 1200) return done(); requestAnimationFrame(step); };
    requestAnimationFrame(step);
  });
  return { log, vt: window.__vt, full: log[0].out };
});

const { log, vt, full } = trace;
const mid = [...new Set(log.map(s => s.out))].filter(v => v > 0 && v < full);
const opened = [...new Set(log.map(s => s.in))].filter(v => v > 0);

// How evenly it moves, which is the whole complaint. "It opens immediately"
// is a first step that covers most of the distance: with the house expo-out
// curve the first painted frame was already 51% open.
const steps = (key, total) => {
  const seq = log.map(s => s[key]);
  const jumps = [];
  for (let i = 1; i < seq.length; i++) if (seq[i] !== seq[i - 1]) jumps.push(Math.abs(seq[i] - seq[i - 1]));
  return { first: jumps[0] ?? 0, biggest: Math.max(0, ...jumps), pct: (v) => Math.round((v / total) * 100) };
};
const opening = steps("in", Math.max(...log.map(s => s.in)));
const closing = steps("out", full);
const shut = log.find(s => s.out === 0);
const moved = log.find(s => s.out < full);
const before = moved && moved.path !== log.at(-1).path;

let bad = 0;
const say = (ok, msg) => { console.log(`  ${ok ? "ok  " : "FAIL"}  ${msg}`); if (!ok) bad++; };

console.log(`  the panel: ${[...new Set(log.map(s => s.out))].join(" → ")}px\n`);
say(full > 100, `the section starts open (${full}px)`);
say(mid.length >= 3, `it folds through real heights rather than vanishing (${mid.length} steps: ${mid.slice(0, 5).join(", ")})`);
say(!!shut && shut.t < 900, `and it is shut soon after (${shut ? shut.t + "ms" : "never"})`);
say(!!moved && moved.t < 250, `the fold starts on the press (${moved ? moved.t + "ms" : "never"})`);
say(!!before, "it has begun before the new screen arrives, not after");
say(opened.length >= 2, `the section she picked opens as the other closes (${opened.length} steps)`);
say(opening.pct(opening.first) < 25,
    `it does not arrive already open (first step ${opening.pct(opening.first)}% of the panel, was 51%)`);
say(opening.pct(opening.biggest) < 35 && closing.pct(closing.biggest) < 35,
    `it moves evenly rather than lurching (biggest step: opening ${opening.pct(opening.biggest)}%, closing ${closing.pct(closing.biggest)}%)`);
say(vt === 0, `no view transition wraps the navigation (${vt}) — that is what froze the rail`);

console.log(bad ? `\n FAIL  ${bad} of 9` : "\n PASS  one closes as the other opens, and you can watch it");
await b.close();
process.exit(bad ? 1 : 0);
