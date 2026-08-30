/**
 * The Home module, every screen, both themes, signed in as a real member.
 *
 * These pages sit behind the member guard, so they are checked with a real
 * token rather than anonymously — an unauthenticated fetch only ever proves the
 * redirect works. Beyond "does it render", this measures the four things a
 * screenshot review reliably misses: sideways scroll at the design width, the
 * shell geometry the boards were measured at, WCAG AA text contrast, and hit
 * targets too small to tap.
 */
import { launch, pageAs, seededMemberToken, measureContrast } from "./_shared.mjs";

const APP = process.env.UX_URL || "http://localhost:3100";
const ROUTES = [
  ["home",          "/app"],
  ["notifications", "/app/notifications"],
  ["schedule",      "/app/schedule"],
  ["profile",       "/app/profile"],
  ["search",        "/app/search?q=digital"],
  ["search-empty",  "/app/search?q=zzzznothing"],
  ["search-idle",   "/app/search"],
  ["first-run",     "/app?new=1"],
];

/** Anything a finger or cursor has to land on should be at least this tall. */
const MIN_HIT = 24;

const measureHits = (page) => page.evaluate((MIN) => {
  const out = [];
  for (const el of document.querySelectorAll('a,button,[role="button"],input[type="checkbox"]')) {
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) continue;                 // hidden
    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden") continue;
    // Skip-links are parked off-screen and only become a target once focused —
    // measuring them parked reports a size nobody is ever asked to hit.
    if (el.className && String(el.className).includes("sr-only")) continue;
    // A control wrapped by a bigger clickable label is as big as the label.
    const label = el.closest("label");
    const h = label ? Math.max(r.height, label.getBoundingClientRect().height) : r.height;
    const w = label ? Math.max(r.width, label.getBoundingClientRect().width) : r.width;
    if (h < MIN || w < MIN) {
      out.push({ tag: el.tagName, text: (el.innerText || el.getAttribute("aria-label") || "").trim().slice(0, 28),
                 w: Math.round(w), h: Math.round(h) });
    }
  }
  return out;
}, MIN_HIT);

const token = await seededMemberToken();
const browser = await launch();
const fail = [];
const lines = [];

for (const [name, route] of ROUTES) {
  for (const mode of ["light", "dark"]) {
    const page = await pageAs(browser, token, { width: 1536, height: 1024, mode });
    // The theme provider reads localStorage on mount and would undo a class we
    // set by hand, so set the preference the same way the switch does.
    await page.evaluateOnNewDocument((m) => {
      try { localStorage.setItem("theme", m); } catch {}
    }, mode);
    const errs = [];
    page.on("pageerror", (e) => errs.push(String(e).slice(0, 100)));
    page.on("console", (m) => {
      const t = m.text();
      if (m.type() === "error" && !t.includes("ERR_CONNECTION") && !t.includes("Failed to load resource")) {
        errs.push(t.slice(0, 100));
      }
    });

    // `domcontentloaded`, not `networkidle2`: Sakhi holds an open connection on
    // every /app screen, so the network never goes idle and the wait times out.
    await page.goto(APP + route, { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.waitForFunction(() => document.querySelector("aside") !== null, { timeout: 60000 }).catch(() => {});
    await new Promise((r) => setTimeout(r, 2000));

    const m = await page.evaluate(() => {
      // The shell scrolls its own column, so the page element is always exactly
      // the viewport — sideways overflow has to be read off that scroller.
      const el = document.getElementById("ux-scroll") || document.documentElement;
      const side = document.querySelector("aside");
      const head = document.querySelector("header");
      const ux = document.querySelector(".ux");
      const imgs = [...document.querySelectorAll("img")]
        .filter((i) => i.complete && i.naturalWidth === 0 && i.currentSrc)
        .map((i) => new URL(i.currentSrc).pathname);
      return {
        overflow: el.scrollWidth - el.clientWidth,
        sidebar: side ? Math.round(side.getBoundingClientRect().width) : 0,
        topbar: head ? Math.round(head.getBoundingClientRect().height) : 0,
        chars: document.body.innerText.trim().length,
        ink: ux ? getComputedStyle(ux).getPropertyValue("--ux-ink").trim() : "",
        broken: imgs,
        redirected: location.pathname,
      };
    });

    // measureContrast already returns only the failures, keyed by colour pair.
    const bad = Object.entries(await measureContrast(page));
    const small = await measureHits(page);
    await page.close();

    const tag = `${name} (${mode})`;
    if (mode === "light") {
      const okish = m.overflow <= 0 && m.chars > 200 && !bad.length && !m.broken.length;
      lines.push(`  ${okish ? "ok  " : "✗   "} ${name.padEnd(14)} ` +
                 `sidebar ${m.sidebar} · topbar ${m.topbar} · ${m.chars} chars · ` +
                 `overflow ${m.overflow} · contrast ${bad.length} · hits ${small.length}`);
      if (m.sidebar !== 253) fail.push(`${name}: sidebar is ${m.sidebar}px, the measured design is 253`);
      if (m.topbar !== 75) fail.push(`${name}: topbar is ${m.topbar}px, the measured design is 75`);
    } else {
      lines.push(`       ${"".padEnd(14)} dark: ${m.chars} chars · overflow ${m.overflow} · ` +
                 `contrast ${bad.length} · hits ${small.length}`);
    }

    if (!m.redirected.startsWith("/app")) fail.push(`${tag}: bounced to ${m.redirected} — the guard rejected the session`);
    if (m.overflow > 0) fail.push(`${tag}: scrolls sideways by ${m.overflow}px at the design width`);
    if (m.chars < 200) fail.push(`${tag}: rendered almost nothing (${m.chars} chars)`);
    if (errs.length) fail.push(`${tag}: ${errs[0]}`);
    for (const b of m.broken) fail.push(`${tag}: image 404 — ${b}`);
    for (const [k, n] of bad.slice(0, 3)) fail.push(`${tag}: contrast ${k} ×${n}`);
    for (const s of small.slice(0, 3)) fail.push(`${tag}: ${s.w}x${s.h}px hit target on "${s.text}" — under ${MIN_HIT}px`);
    if (mode === "dark" && m.ink.toLowerCase() === "#161734") fail.push(`${name}: dark mode did not swap the ink token`);
  }
}

await browser.close();
console.log("\n" + lines.join("\n"));
console.log(fail.length
  ? "\n  " + fail.map((f) => "✗ " + f).join("\n  ") + "\n"
  : `\n  ${ROUTES.length} Home screens, both themes: no errors, no sideways scroll, ` +
    `no contrast failures, no undersized targets\n`);
process.exit(fail.length ? 1 : 0);
