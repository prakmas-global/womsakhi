/**
 * Does the motion actually happen?
 *
 * A class name in the markup proves nothing — a typo in the selector, a missing
 * `overflow: hidden`, a parent without the hover hook, and the transform never
 * fires. So this hovers real elements with a real mouse and reads the computed
 * transform before and after, then does the whole pass again with reduced
 * motion on to prove the escape hatch works.
 */
import { launch, pageAs, seededMemberToken } from "./_shared.mjs";

const APP = process.env.UX_URL || "http://localhost:3100";

/** Each case: what to hover, what should move, and what kind of movement. */
const CASES = [
  // Scoped to the six-column grid: the hero's own clay button sits earlier in
  // `main`, and a bare `a.ux-clay` picked that up instead of a tile.
  { name: "quick-action tile press",  hover: "main .grid-cols-6 a.ux-clay",                     moves: "self",                      kind: "shadow" },
  { name: "tile icon leans",          hover: "main .grid-cols-6 a.ux-clay",                     moves: ".ux-ico, .ux-ico-alt",      kind: "rotate" },
  { name: "tile chevron travels",     hover: "main .grid-cols-6 a.ux-clay",                     moves: ".ux-arrow",                 kind: "translate" },
  { name: "course row lifts",         hover: 'main a.ux-i[href="/app/programs"]:has(img)', moves: "self",              kind: "translate" },
  { name: "course art zooms",         hover: 'main a.ux-i[href="/app/programs"]:has(img)', moves: ".ux-art",           kind: "scale" },
  { name: "See All arrow travels",    hover: "main button.ux-hov",                 moves: ".ux-arrow",                 kind: "translate" },
  { name: "sidebar icon leans",       hover: "aside a.ux-nav",                     moves: ".ux-ico",                   kind: "translate" },
  { name: "bell icon wakes",          hover: 'header a[aria-label="Notifications"]', moves: ".ux-ico",                 kind: "rotate" },
];

const parse = (m) => {
  if (!m || m === "none") return null;
  const n = m.match(/matrix\(([^)]+)\)/);
  if (!n) return null;
  const [a, b, , d, e, f] = n[1].split(",").map(Number);
  return { scale: Math.hypot(a, b), rot: Math.round(Math.atan2(b, a) * 180 / Math.PI), x: e, y: f };
};

const run = async (browser, token, reduced) => {
  const page = await pageAs(browser, token, { width: 1536, height: 1024 });
  // Headless Chrome reports `reduce` by default, so the "motion on" pass has to
  // say `no-preference` out loud — otherwise it silently measures the wrong thing
  // and reports that nothing moves.
  await page.emulateMediaFeatures([
    { name: "prefers-reduced-motion", value: reduced ? "reduce" : "no-preference" },
  ]);
  await page.goto(APP + "/app", { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForFunction(() => document.querySelector("aside") !== null, { timeout: 60000 });
  await new Promise((r) => setTimeout(r, 2500));

  const out = [];
  for (const c of CASES) {
    const target = await page.$(c.hover);
    if (!target) { out.push({ ...c, err: "nothing matched the hover selector" }); continue; }

    const read = () => page.evaluate((sel, moves, kind) => {
      const host = document.querySelector(sel);
      const el = moves === "self" ? host : host?.querySelector(moves);
      if (!el) return null;
      return kind === "shadow" ? getComputedStyle(el).boxShadow : getComputedStyle(el).transform;
    }, c.hover, c.moves, c.kind);

    // Park the pointer somewhere neutral first, or a previous case's hover lingers.
    await page.mouse.move(4, 300);
    await new Promise((r) => setTimeout(r, 420));
    const rawBefore = await read();
    const before = c.kind === "shadow" ? null : parse(rawBefore);

    // Scroll it into the middle first. The page grows as screens gain content,
    // and an element sitting at the viewport edge cannot be hovered — which
    // reads as "the effect is broken" rather than "the coordinates moved".
    const box = await page.evaluate((sel) => {
      const el = document.querySelector(sel);
      el.scrollIntoView({ block: "center", behavior: "instant" });
      const r = el.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    }, c.hover);
    if (!box) { out.push({ ...c, err: "the hover target has no box" }); continue; }
    await page.mouse.move(box.x, box.y);
    await new Promise((r) => setTimeout(r, 480));
    const rawAfter = await read();
    const after = c.kind === "shadow" ? null : parse(rawAfter);

    if (c.kind === "shadow") {
      out.push({ ...c, delta: rawBefore && rawAfter && rawBefore !== rawAfter ? 1 : 0 });
      continue;
    }

    const d = {
      translate: Math.abs((after?.x ?? 0) - (before?.x ?? 0)) + Math.abs((after?.y ?? 0) - (before?.y ?? 0)),
      scale: Math.abs((after?.scale ?? 1) - (before?.scale ?? 1)),
      rotate: Math.abs((after?.rot ?? 0) - (before?.rot ?? 0)) + Math.abs((after?.scale ?? 1) - (before?.scale ?? 1)),
    }[c.kind];
    out.push({ ...c, delta: Number(d.toFixed(3)) });
  }
  await page.close();
  return out;
};

const MIN = { translate: 1.5, scale: 0.02, rotate: 3, shadow: 1 };
const token = await seededMemberToken();
const browser = await launch();
const fail = [];

const normal = await run(browser, token, false);
console.log("\n  with motion on");
for (const r of normal) {
  const ok = !r.err && r.delta >= MIN[r.kind];
  const how = r.kind === "shadow" ? (r.delta ? "shadow deepens" : "shadow unchanged") : `${r.kind} moved by ${r.delta}`;
  console.log(`  ${ok ? "ok  " : "✗   "} ${r.name.padEnd(26)} ${r.err ?? how}`);
  if (r.err) fail.push(`${r.name}: ${r.err}`);
  else if (!ok) fail.push(`${r.name}: hovering changed the ${r.kind} by ${r.delta}, which is nothing`);
}

const reduced = await run(browser, token, true);
console.log("\n  with prefers-reduced-motion: reduce");
for (const r of reduced) {
  if (r.err) continue;
  // Shadow is exempt on purpose: the setting asks for less movement, not for
  // controls that stop responding. A depth change with a 1ms transition is
  // instant, which is exactly what it should be.
  if (r.kind === "shadow") {
    console.log(`       ${r.name.padEnd(26)} depth still responds (not motion)`);
    continue;
  }
  const still = r.delta < MIN[r.kind];
  console.log(`  ${still ? "ok  " : "✗   "} ${r.name.padEnd(26)} ${r.kind} moved by ${r.delta}`);
  if (!still) fail.push(`${r.name}: still moves ${r.delta} under reduced motion`);
}

await browser.close();
console.log(fail.length
  ? "\n  " + fail.map((f) => "✗ " + f).join("\n  ") + "\n"
  : `\n  ${CASES.length} interactions move on hover and hold still under reduced motion\n`);
process.exit(fail.length ? 1 : 0);
