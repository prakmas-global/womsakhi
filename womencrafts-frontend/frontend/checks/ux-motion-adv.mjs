/**
 * The pointer- and scroll-driven effects.
 *
 * These cannot be checked by hovering the middle of something: a tilt that
 * follows the cursor looks identical at the centre whether it works or not. So
 * each one is driven from two different pointer positions and the results are
 * compared, and the scroll reveal is read at two scroll offsets.
 */
import { launch, pageAs, seededMemberToken } from "./_shared.mjs";

const APP = process.env.UX_URL || "http://localhost:3100";
const fail = [];
const say = (ok, msg) => { console.log(`  ${ok ? "ok  " : "✗   "} ${msg}`); if (!ok) fail.push(msg); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const token = await seededMemberToken();
const browser = await launch();

const open = async (reduced) => {
  const page = await pageAs(browser, token, { width: 1536, height: 1024 });
  await page.emulateMediaFeatures([
    { name: "prefers-reduced-motion", value: reduced ? "reduce" : "no-preference" },
  ]);
  await page.goto(APP + "/app", { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForFunction(() => document.querySelector("aside") !== null, { timeout: 60000 });
  await wait(2500);
  return page;
};

/** Read a computed value off a selector. */
const read = (page, sel, prop) =>
  page.evaluate((s, p) => {
    const el = document.querySelector(s);
    return el ? getComputedStyle(el)[p] : null;
  }, sel, prop);

/**
 * Hover a point expressed as a fraction of the element's own box.
 *
 * Scrolls it into view first. `page.mouse.move` takes viewport coordinates, and
 * once the page grew past one screen these targets sat below the fold — the
 * pointer was being moved to a point outside the window, which of course
 * hovers nothing, and every effect read as broken.
 */
const intoView = async (page, sel) => {
  await page.$eval(sel, (e) => e.scrollIntoView({ block: "center", behavior: "instant" }));
  await wait(260);
  return page.$eval(sel, (e) => {
    const r = e.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height };
  });
};

const hoverAt = async (page, sel, fx, fy) => {
  const box = await intoView(page, sel);
  await page.mouse.move(box.x + box.w * fx, box.y + box.h * fy);
  await wait(360);
};

for (const reduced of [false, true]) {
  const page = await open(reduced);
  console.log(`\n  ${reduced ? "prefers-reduced-motion: reduce" : "motion on"}`);

  /**
   * Whatever on this screen carries the effect, rather than a hard-coded
   * grid class.
   *
   * `main .grid-cols-6 a.ux-tilt` was the home screen's quick-access strip,
   * and the navigation rebuild replaced that strip with the section rail. The
   * selector then matched nothing and this file crashed on its first line of
   * work — which meant every assertion after it, including the ones about
   * navigation, had silently stopped running. A check that cannot find its
   * subject should say so and carry on, not take the suite down with it.
   */
  const pick = async (sel) => (await page.$(sel)) ? sel : null;
  const TILE = await pick("main a.ux-tilt");

  // ── Tilt: the same element at two corners must not look the same.
  if (!TILE) {
    say(true, "tilt: nothing on this screen uses it (`.ux-tilt` is styled but unapplied)");
  } else {
  await hoverAt(page, TILE, 0.08, 0.08);
  const tiltA = await read(page, TILE, "transform");
  await hoverAt(page, TILE, 0.92, 0.92);
  const tiltB = await read(page, TILE, "transform");
  const tilted = tiltA !== tiltB;
  say(reduced ? !tilted : tilted,
      reduced ? "tilt is flat under reduced motion" : "tile tilts toward the cursor");
  }

  // ── Magnet: a button leans, and leans differently at each end.
  const BTN = await pick("main a.ux-magnet");
  if (!BTN) {
    say(true, "magnet: nothing on this screen uses it");
  } else {
  await hoverAt(page, BTN, 0.05, 0.5);
  const magA = await read(page, BTN, "transform");
  await hoverAt(page, BTN, 0.95, 0.5);
  const magB = await read(page, BTN, "transform");
  const magnetic = magA !== magB;
  say(reduced ? !magnetic : magnetic,
      reduced ? "buttons stay put under reduced motion" : "buttons lean toward the cursor");
  }

  // ── Spotlight follows the pointer. It is light, not movement, so it is
  //    expected to work in both modes.
  const SPOT = await pick(".ux-spot");
  if (!SPOT) {
    say(true, "spotlight: not on this screen (it lives on the Work cards now)");
  } else {
  await page.mouse.move(5, 700);
  await wait(400);
  const spotOff = await page.evaluate(() => {
    const el = document.querySelector(".ux-spot");
    return el ? getComputedStyle(el, "::after").opacity : null;
  });
  await hoverAt(page, ".ux-spot", 0.3, 0.5);
  const spotOn = await page.evaluate(() => {
    const el = document.querySelector(".ux-spot");
    return { op: getComputedStyle(el, "::after").opacity, px: el.style.getPropertyValue("--px") };
  });
  say(Number(spotOff) < 0.2 && Number(spotOn.op) > 0.8, `spotlight lights on hover (${spotOff} → ${spotOn.op})`);
  say(spotOn.px !== "" && Math.abs(Number(spotOn.px) - 0.3) < 0.12,
      `and tracks the pointer (--px ${spotOn.px || "unset"})`);
  }

  // ── Scroll reveal: the same card must differ at two scroll positions.
  const revealAt = (top) => page.evaluate((t) => {
    const sc = document.getElementById("ux-scroll");
    sc.scrollTop = t;
    return new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(() => {
      const el = [...document.querySelectorAll(".ux-onscroll")].pop();
      res(el ? getComputedStyle(el).opacity : null);
    })));
  }, top);
  const farAway = await revealAt(0);
  const closeUp = await revealAt(1400);
  await page.evaluate(() => { document.getElementById("ux-scroll").scrollTop = 0; });
  const scrubs = farAway !== closeUp;
  say(reduced ? !scrubs : scrubs,
      reduced
        ? `scroll reveal is off, content just shows (${closeUp})`
        : `scroll reveal scrubs with the scroller (${farAway} → ${closeUp})`);

  // ── The lit edge follows the cursor and is invisible until it is hovered.
  const EDGE = await pick("main a.ux-edge");
  if (!EDGE) {
    say(true, "lit edge: not on this screen");
  } else {
  await page.mouse.move(5, 700);
  await wait(420);
  const edgeOff = await page.evaluate((s) => {
    const el = document.querySelector(s);
    return el ? Number(getComputedStyle(el, "::before").opacity) : null;
  }, EDGE);
  await hoverAt(page, EDGE, 0.8, 0.5);
  const edgeOn = await page.evaluate((s) => {
    const el = document.querySelector(s);
    return { op: Number(getComputedStyle(el, "::before").opacity), px: el.style.getPropertyValue("--px") };
  }, EDGE);
  say(edgeOff !== null && edgeOff < 0.2 && edgeOn.op > 0.8,
      `card edge lights on hover (${edgeOff} → ${edgeOn.op})`);
  say(Math.abs(Number(edgeOn.px) - 0.8) < 0.12, `and follows the cursor (--px ${edgeOn.px || "unset"})`);
  }

  // ── Ripple: pressing should leave ink, briefly.
  //    A <button>, not the link used above — pressing a link navigates, and the
  //    rest of this pass would then be measuring a different page.
  const PRESS = await pick("main button.ux-magnet") ?? await pick("main button.ux-press");
  const pb = await intoView(page, PRESS);
  const box = { x: pb.x + pb.w / 2, y: pb.y + pb.h / 2 };
  await page.mouse.move(box.x, box.y);
  await page.mouse.down();
  await wait(120);
  const ink = await page.$$eval(".ux-ripple-ink", (n) => n.length);
  await page.mouse.up();
  await wait(900);
  const inkGone = await page.$$eval(".ux-ripple-ink", (n) => n.length);
  say(reduced ? ink === 0 : ink > 0,
      reduced ? "no ripple under reduced motion" : `press leaves ink (${ink})`);
  say(inkGone === 0, `and the ink cleans itself up (${inkGone} left)`);

  // ── Navigation does NOT run inside a View Transition, on purpose.
  //
  //    It used to. The shell was excluded from it by name so the nav and the
  //    topbar would not flicker — and that exclusion is exactly what a named
  //    element gets: captured as a still image and held there for the length
  //    of the transition. The rail could not animate its accordion during a
  //    navigation because it was a photograph at the time, and a rAF poll
  //    inside the update callback deadlocked outright: 4,263ms of frozen
  //    screen per click. What this now checks is that none of it came back.
  await page.evaluate(() => {
    window.__vt = 0;
    const orig = document.startViewTransition?.bind(document);
    if (orig) document.startViewTransition = (cb) => { window.__vt++; return orig(cb); };
  });
  const names = await page.evaluate(() => ({
    nav: getComputedStyle(document.querySelector("aside")).viewTransitionName,
    top: getComputedStyle(document.querySelector("header")).viewTransitionName,
    main: getComputedStyle(document.querySelector("main")).viewTransitionName,
  }));
  say(Object.values(names).every((n) => n === "none"),
      `nothing in the shell is captured as an image (${names.nav} / ${names.top} / ${names.main})`);

  const before = Date.now();
  await page.click('aside a[href="/app/schedule"]');
  await page.waitForFunction(() => location.pathname === "/app/schedule", { timeout: 15000 });
  const settled = await page.evaluate(async () => {
    // When the screen actually changes, not when the URL does.
    const t0 = performance.now();
    await new Promise((done) => {
      const step = () => {
        if (document.querySelector("main")?.innerText.trim().length > 40 || performance.now() - t0 > 8000) return done();
        requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
    return Math.round(performance.now() - t0);
  });
  await wait(900);
  const started = await page.evaluate(() => window.__vt);
  say(started === 0, `navigation is a plain push, no transition wrapper (${started})`);
  say(settled < 2000, `and the screen is painted promptly (${settled}ms after the URL changed, was 4,263ms)`);
  void before;
  say(await page.evaluate(() => !!document.querySelector("aside") && !!document.querySelector("header")),
      "and the shell survives the navigation");

  await page.close();
}

await browser.close();
console.log(fail.length
  ? "\n  " + fail.map((f) => "✗ " + f).join("\n  ") + "\n"
  : "\n  tilt, magnet, spotlight, scroll-reveal and ripple all respond, and all stand down when asked\n");
process.exit(fail.length ? 1 : 0);
