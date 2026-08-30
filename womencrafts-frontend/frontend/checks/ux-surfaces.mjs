/**
 * Are the surface techniques actually rendering?
 *
 * A class name proves nothing: `corner-shape` is new enough that a browser can
 * silently drop it, `backdrop-filter` is disabled outright in some contexts,
 * and `color-mix` fails to a transparent background that looks fine until the
 * text behind it shows through. So each technique is read back off the computed
 * style, and the glass is additionally checked for the one thing it can break —
 * whether the text on it still passes AA.
 */
import { launch, pageAs, seededMemberToken, measureContrast } from "./_shared.mjs";

const APP = process.env.UX_URL || "http://localhost:3100";
const fail = [];
const say = (ok, msg) => { console.log(`  ${ok ? "ok  " : "✗   "} ${msg}`); if (!ok) fail.push(msg); };

const token = await seededMemberToken();
const browser = await launch();

for (const mode of ["light", "dark"]) {
  const page = await pageAs(browser, token, { width: 1536, height: 1024, mode });
  await page.evaluateOnNewDocument((m) => { try { localStorage.setItem("theme", m); } catch {} }, mode);
  await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "no-preference" }]);
  await page.goto(APP + "/app", { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForFunction(() => document.querySelector("aside") !== null, { timeout: 60000 });
  await new Promise((r) => setTimeout(r, 2000));

  console.log(`\n  ${mode}`);

  const m = await page.evaluate(() => {
    const cs = (sel) => { const e = document.querySelector(sel); return e ? getComputedStyle(e) : null; };
    const clay = cs(".ux-clay");
    const glass = cs(".ux-glass");
    const metalSupported = CSS.supports("corner-shape", "squircle");
    const card = cs(".ux-card");
    return {
      squircleSupported: metalSupported,
      cardCorner: card?.getPropertyValue("corner-shape")?.trim() || card?.cornerShape || "",
      clayFound: !!clay,
      clayShadow: clay?.boxShadow || "",
      glassFound: !!glass,
      glassBlur: glass?.backdropFilter || glass?.webkitBackdropFilter || "",
      glassBg: glass?.backgroundColor || "",
      // A topbar that does not overlap the scroller has nothing to blur.
      topbarOverlaps: (() => {
        const h = document.querySelector("header");
        const sc = document.getElementById("ux-scroll");
        if (!h || !sc) return false;
        return h.getBoundingClientRect().bottom > sc.getBoundingClientRect().top + 1;
      })(),
    };
  });

  say(m.squircleSupported, "the browser supports corner-shape");
  if (m.squircleSupported) say(/squircle|superellipse/.test(m.cardCorner), `cards are squircles (corner-shape: ${m.cardCorner || "none"})`);
  say(m.clayFound && m.clayShadow.split("inset").length - 1 >= 2,
      `clay draws its inner shading (${m.clayShadow.split("inset").length - 1} inset layers)`);
  say(m.glassFound && /blur/.test(m.glassBlur), `glass blurs (${m.glassBlur || "no backdrop-filter"})`);
  // Chrome reports color-mix results as `color(srgb r g b / a)`, not `rgba()`,
  // so read the alpha out of either form rather than pattern-matching one.
  const alpha = (() => {
    const slash = m.glassBg.match(/\/\s*([\d.]+)\s*\)/);
    if (slash) return Number(slash[1]);
    const rgba = m.glassBg.match(/rgba\([^)]*,\s*([\d.]+)\s*\)/);
    return rgba ? Number(rgba[1]) : 1;
  })();
  say(m.glassFound && alpha > 0.2 && alpha < 0.95,
      `glass is translucent (alpha ${alpha} — ${m.glassBg})`);
  say(m.topbarOverlaps, "content scrolls under the topbar, so the blur has something to blur");

  // Glass is the one treatment that can quietly break text, so measure it.
  const bad = Object.entries(await measureContrast(page));
  say(bad.length === 0, `text on every surface still passes AA (${bad.length} failing)`);
  for (const [k, n] of bad.slice(0, 3)) fail.push(`${mode}: ${k} ×${n}`);

  // The two floating layers must be opaque. This is measured by pixel, not by
  // reading a colour: a menu can be opaque in CSS and still let content through
  // if an ancestor is translucent, and the only way to know is to look.
  for (const [what, openIt, sel] of [
    ["account menu", async () => {
      await page.click('button[aria-haspopup="menu"]');
      await page.waitForSelector('[role="menu"]', { timeout: 5000 });
    }, '[role="menu"]'],
    ["search palette", async () => {
      await page.keyboard.press("Escape");
      await page.keyboard.down("Meta"); await page.keyboard.press("KeyK"); await page.keyboard.up("Meta");
      await page.waitForSelector('[role="dialog"]', { timeout: 5000 });
    }, '[role="dialog"]'],
  ]) {
    await openIt();
    await new Promise((r) => setTimeout(r, 700));
    const box = await page.$eval(sel, (e) => {
      const r = e.getBoundingClientRect();
      return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
    });
    // Screenshot a blank strip of the layer twice, over two different pages
    // behind it, and compare. If the page shows through, the pixels differ.
    const strip = { x: box.x + 8, y: box.y + Math.round(box.h * 0.55), width: Math.min(220, box.w - 16), height: 10 };
    const a = await page.screenshot({ clip: strip, encoding: "base64" });
    await page.evaluate(() => { const s = document.getElementById("ux-scroll"); if (s) s.scrollTop = 420; });
    await new Promise((r) => setTimeout(r, 500));
    const b = await page.screenshot({ clip: strip, encoding: "base64" });
    await page.evaluate(() => { const s = document.getElementById("ux-scroll"); if (s) s.scrollTop = 0; });
    say(a === b, `${what} is opaque — scrolling the page behind it changes nothing`);
    await page.keyboard.press("Escape");
    await new Promise((r) => setTimeout(r, 400));
  }

  // Metal appears exactly once, and only where a credential is shown.
  await page.goto(APP + "/app/profile", { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForFunction(() => document.querySelector("aside") !== null, { timeout: 60000 });
  await new Promise((r) => setTimeout(r, 1500));
  const metal = await page.evaluate(() => {
    const els = [...document.querySelectorAll(".ux-metal")];
    return { n: els.length, bg: els[0] ? getComputedStyle(els[0]).backgroundImage.slice(0, 40) : "" };
  });
  say(metal.n === 1 && /gradient/.test(metal.bg), `metal used once, on the credential (${metal.n} found)`);

  await page.close();
}

await browser.close();
console.log(fail.length
  ? "\n  " + fail.map((f) => "✗ " + f).join("\n  ") + "\n"
  : "\n  squircle, clay and glass all render; metal stays put; nothing lost contrast\n");
process.exit(fail.length ? 1 : 0);
